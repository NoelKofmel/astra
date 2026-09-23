#!/usr/bin/env bash
# Nightly database backup, run by astra-backup.timer as the deploy user:
# pg_dump into a restic repository on the Hetzner Storage Box — encrypted,
# deduplicated, 30 daily snapshots. The latest dump also stays on local disk
# for a quick restore. Restoring: docs/08-operations.md#restore.
#
# RESTIC_REPOSITORY and RESTIC_PASSWORD come from /opt/astra/.env through
# the systemd unit's EnvironmentFile.
set -euo pipefail
cd "$(dirname "$0")"
: "${RESTIC_REPOSITORY:?}" "${RESTIC_PASSWORD:?}"

dump=/var/backups/astra/astra.dump
trap 'rm -f "${dump}.partial"' EXIT

# Dump to a temporary file first: a failed or truncated dump must never
# become the latest backup. Uncompressed custom format, because restic
# compresses and deduplicates across days, which a compressed dump defeats.
docker compose --env-file .env --env-file release.env exec -T postgres \
  pg_dump --username astra --dbname astra --format custom --compress 0 > "${dump}.partial"
mv "${dump}.partial" "${dump}"

restic backup --host astra --tag postgres "${dump}"
# Grouped by host and tag, so retention works even if the dump's path changes.
restic forget --host astra --tag postgres --group-by host,tags --keep-daily 30 --prune

echo "backup stored: $(du -h "${dump}" | cut -f1)"
