#!/usr/bin/env bash
# Deploys one release on the server. The pipeline runs it over SSH:
#
#   /opt/astra/deploy.sh <version>
#
# Migrations run before the new containers start. They are additive, so the
# old release keeps working against the new schema until it is replaced — and
# a rollback to it stays possible. If the new release does not come up
# healthy, the previous one is restored and the script fails.
#
# release.env records the release that is running; it changes only once a
# release is healthy.
set -euo pipefail

version="${1:?usage: deploy.sh <version>}"
cd "$(dirname "$0")"
touch release.env

compose() { docker compose --env-file .env --env-file release.env "$@"; }

previous="$(sed -n 's/^ASTRA_VERSION=//p' release.env)"

# The shell variable wins over release.env for this run.
export ASTRA_VERSION="${version}"
compose pull --quiet web worker
compose up --detach --wait postgres redis
compose run --rm --no-deps worker node packages/db/src/migrate.ts

if ! compose up --detach --wait --remove-orphans; then
  echo "release ${version} did not become healthy" >&2
  if [[ -n "${previous}" && "${previous}" != "${version}" ]]; then
    echo "rolling back to ${previous}" >&2
    ASTRA_VERSION="${previous}" compose up --detach --wait --remove-orphans || true
  fi
  exit 1
fi

echo "ASTRA_VERSION=${version}" > release.env

# The Caddyfile may have changed without the caddy service changing.
compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile

# Keep a week of old images around for manual rollbacks.
docker image prune --all --force --filter "until=168h" > /dev/null
echo "deployed ${version}"
