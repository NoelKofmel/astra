# syntax=docker/dockerfile:1

# Both production images come from this file:
#
#   docker build --target web    --build-arg APP_VERSION=<sha> -t astra-web .
#   docker build --target worker --build-arg APP_VERSION=<sha> -t astra-worker .

ARG NODE_IMAGE=node:24-alpine

# ---- shared: Node plus the pnpm version pinned in package.json --------------
FROM ${NODE_IMAGE} AS base
WORKDIR /repo
COPY package.json ./
RUN npm install --global "$(node -p 'require("./package.json").packageManager')" \
 && npm cache clean --force
ENV NEXT_TELEMETRY_DISABLED=1

# Manifests only, so the install layers stay cached until dependencies change.
FROM base AS manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/

# ---- web: build with every dependency, ship only the standalone server -----
FROM manifests AS web-build
RUN pnpm install --frozen-lockfile --filter "@astra/web..."
COPY tsconfig.base.json ./
COPY packages/core packages/core
COPY packages/db packages/db
COPY apps/web apps/web
RUN pnpm --filter @astra/web build

FROM ${NODE_IMAGE} AS web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
# Owned by node: Next.js writes its cache below .next at runtime.
COPY --from=web-build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=web-build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# ---- worker: production dependencies, TypeScript run directly by Node -------
FROM manifests AS worker-deps
RUN pnpm install --frozen-lockfile --prod --filter "@astra/worker..."

FROM ${NODE_IMAGE} AS worker
ENV NODE_ENV=production
WORKDIR /app
# The workspace layout stays intact: pnpm's symlinks resolve to packages/*,
# outside node_modules, where Node agrees to strip types (docs/07-conventions.md).
COPY --from=worker-deps /repo ./
COPY packages/core/src packages/core/src
COPY packages/db/src packages/db/src
COPY packages/db/drizzle packages/db/drizzle
COPY apps/worker/src apps/worker/src
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}
USER node
# Also runs the migrations: node packages/db/src/migrate.ts
CMD ["node", "apps/worker/src/main.ts"]
