# Conventions

How cross-cutting things are done in Astra — logging, errors, configuration,
outbound HTTP and the like. The goal is that every one of them exists **exactly
once**, so that a year from now there are not three ways to log and two ways to
read an environment variable.

## How this document works

Most of the stack is not built yet, so most entries below are **open**: the
constraints are known, the concrete pattern is not. That is deliberate — the
pattern gets decided when it is first needed, not in advance.

1. **Before building anything cross-cutting, look here.** If an entry exists,
   follow it.
2. **The first implementation settles the pattern.** Whoever builds it first
   records it here in the same commit: status → `settled`, plus a link to the
   reference implementation. From then on, all code follows it.
3. **A wrong pattern gets changed, not bypassed.** Update the entry and migrate
   the existing code — in the same PR or a directly following one. Never a
   second way alongside the first.
4. **Enforce with tooling wherever possible.** A convention that lives only in
   a document drifts. A lint rule, a single module or a type does not. Each
   entry names its enforcement.

| Status | Meaning |
|---|---|
| `open` | Constraints known, pattern not yet built |
| `settled` | Pattern exists; reference implementation linked; follow it |

Rules that are already binding live in `CLAUDE.md` (TypeScript, database,
collectors, frontend, tests) and are not repeated here.

## Overview

| Concern | Status | Settle in | Reference |
|---|---|---|---|
| [TypeScript and modules](#typescript-and-modules) | `settled` | — | `tsconfig.base.json` |
| [Logging](#logging) | `settled` | — | `packages/core/src/logger.ts` |
| [Configuration and secrets](#configuration-and-secrets) | `settled` | — | `apps/worker/src/config.ts` |
| [Time and IDs](#time-and-ids) | `settled` | — | `packages/db/src/schema.ts` |
| [Background jobs](#background-jobs) | `settled` | — | `apps/worker/src/jobs/` |
| [Errors](#errors) | `open` | phase 1 | — |
| [Outbound HTTP](#outbound-http) | `open` | phase 1 | — |
| [AI calls](#ai-calls) | `open` | phase 3 | — |
| [Documentation](#documentation) | `settled` | — | this file, `README.md` |

---

## TypeScript and modules

**Status:** `settled` · reference: `tsconfig.base.json`, `pnpm-workspace.yaml`

- **Node 24 runs the TypeScript sources directly** (type stripping). The worker
  and the internal packages have no build step; only `apps/web` is built, by
  Next.js. `tsc` only type-checks (`noEmit`).
- **Relative imports carry the `.ts` extension** (`import { x } from
  "./x.ts"`) — Node resolves files, not modules. Type-only imports use
  `import type`.
- **Erasable syntax only:** no `enum`, no `namespace`, no constructor parameter
  properties. Use `as const` objects and unions instead of enums.
- **Internal packages export their TypeScript source** through the `exports`
  field of their `package.json`, one subpath per public module
  (`@astra/core/logger`). No barrel file that drags server code along.
- **Never copy workspace packages into `node_modules`** (e.g. `pnpm deploy`):
  Node refuses to strip types below a `node_modules` path. Docker images keep
  the workspace layout with pnpm's symlinks.
- **TypeScript is held at 6.0.x.** TypeScript 7 (the native compiler) is out,
  but typescript-eslint supports `<6.1` only. Move once it does — the settings
  in `tsconfig.base.json` are already 7-compatible.
- **Shared dependency versions** live in the pnpm catalog
  (`pnpm-workspace.yaml`) and are referenced as `catalog:`.

**Enforcement:** the compiler — `module: nodenext` rejects extensionless
relative imports, `erasableSyntaxOnly` rejects non-erasable syntax.

## Logging

**Status:** `settled` · reference: `packages/core/src/logger.ts`

- **pino, through one factory:** `createLogger({ service, level })` from
  `@astra/core/logger`. Each app creates its logger once at startup and hands
  it — or children of it — down. `console.*` is not used anywhere.
- **Structured JSON to stdout.** Docker collects it; from phase 8, Promtail
  ships it to Loki (`01-architecture.md`). No log files, no transports inside
  the application. Each line carries `level` as a label, `time` as ISO 8601 in
  UTC, and `service`.
- **Readable in development** by piping through `pino-pretty` outside the
  process, in the app's `dev` script. Never as a transport.
- **Context through child loggers**, not string interpolation: always
  `service`; where applicable `source`, `jobId`, `storyId`.
- **Levels mean something:**
  - `error` — someone has to act
  - `warn` — degraded but handled (e.g. a source's circuit breaker opened)
  - `info` — lifecycle, and one summary line per job run
  - `debug` — off in production
- **The level comes from `LOG_LEVEL`**, read by the app's config module.
- **Errors go under `err`** — `log.error({ err }, "what failed")` — and are
  serialised with type, message and stack.
- **Never log** secrets, tokens, full article text, or full prompts and LLM
  responses. Log IDs, counts and sizes instead. As a safety net, the keys
  `password`, `token`, `apiKey`, `secret`, `authorization`, `cookie`,
  `databaseUrl` and `redisUrl` are redacted at the top level and one level
  down — a net, not a licence.
- **Log an error once**, where it is handled — not again at every layer on the
  way up.

Still open: request correlation in `apps/web` — decided when the web app gets
real API routes (phase 4).

**Enforcement:** ESLint `no-console` (`eslint.config.js`).

## Configuration and secrets

**Status:** `settled` · reference: `apps/worker/src/config.ts`,
`packages/core/src/env.ts`

- Each app reads environment variables in **exactly one module**,
  `src/config.ts`: a Zod schema parsed with `parseEnv` from `@astra/core/env`,
  which reports every problem at once and never echoes the values. Everything
  else imports the typed result.
- **Fail fast:** the worker parses on import, before anything connects.
- **The web app parses lazily** — `config()` in `apps/web/src/config.ts` —
  because `next build` loads route modules without a runtime environment.
  `instrumentation-node.ts` calls it at server start and exits on failure;
  Next.js would otherwise log the error and go on answering with 500s.
- **Local development uses one `.env` at the repository root**, copied from
  `.env.example`. Scripts load it with Node's `--env-file-if-exists`; the web
  app with `process.loadEnvFile` in `next.config.ts`, because Next.js hands
  Node flags to its child processes through `NODE_OPTIONS`, where
  `--env-file` is not allowed. Variables already set in the shell win.
- A new variable goes into `.env.example` in the same commit.
- No secrets in the repository (`CLAUDE.md`). Production values live in a
  `chmod 600` env file on the server.

**Enforcement:** ESLint `no-restricted-properties` on `process.env` and
`no-restricted-imports` on `env` from `process`, except in the files listed as
`envReaders` in `eslint.config.js`.

## Time and IDs

**Status:** `settled` · reference: `packages/db/src/schema.ts`

- **Primary keys are `bigint` identity columns** (`generated always as
  identity`), assigned by the database. There is one database and no
  distributed ID generation, so UUIDs would buy nothing; 8-byte keys keep
  indexes and foreign keys small and IDs readable in logs, URLs and the admin
  view. In TypeScript they are `number`. Foreign keys are `bigint` as well.
- **Timestamps are `timestamptz`**, stored in UTC. Conversion to
  `Europe/Zurich` happens only at the edge (UI, Telegram messages).
- **No date library.** `Date` for instants; `Intl.DateTimeFormat` with
  `timeZone: "Europe/Zurich"` for display. Revisit once `Temporal` ships
  unflagged in the Node LTS we run (Node 24 has it behind a flag only).
- **Money is `numeric`**, never a float: `cost_usd` is `numeric(12, 6)`.

**Enforcement:** the column helpers `id()`, `foreignId()` and `timestamptz()`
in `schema.ts` — new tables use them rather than spelling columns out.

## Background jobs

**Status:** `settled` · reference: `apps/worker/src/jobs/`

- **A job is a `defineJob({ name, queue, data, schedule?, run })`** in its own
  module, listed in `jobs/registry.ts` — a job missing there is neither
  scheduled nor processed. `name` is unique; it doubles as the BullMQ job name,
  the scheduler ID and `job_runs.job_name`.
- **Job data is parsed** with the job's Zod schema before `run`: it comes out
  of Redis like any external input. Malformed data fails at once, without
  retries.
- **Every attempt writes one `job_runs` row**: job ID, attempt, status, item
  counts, `cost_usd`, error. A job reports through `ctx.stats` (`itemsIn`,
  `itemsOut`, `costUsd`), and the runner records the stats on failure too —
  money spent before an error is never lost.
- **The runner logs** one summary line per attempt: `info` on success, `error`
  on failure. Jobs log through `ctx.log`, already bound to job, job ID and
  attempt, and throw rather than log their own failure.
- Jobs are **idempotent** — a retry must never create duplicates.
- **Retries:** three attempts with exponential backoff from 30 s
  (`defaultJobOptions`, set on every queue). Redis keeps finished jobs for a
  day and failed ones for a week; `job_runs` is the history.
- **Schedules** are cron patterns in UTC. The worker syncs them to BullMQ job
  schedulers at every start and removes schedulers whose job is gone — so the
  scheduler runs inside the worker, with no container of its own.
- **Queues** are declared in `QUEUES` with their concurrency. Phase 0 has one,
  `system`.
- **Shutdown:** on `SIGTERM` the worker lets running jobs finish; the
  container's stop grace period must outlast the longest job.

**Enforcement:** the registry, plus `registry.test.ts` (unique names, schedule
data valid for its job).

## Errors

**Status:** `open` · settle in phase 1

- Distinguish **expected failures** (a source is down, a feed is malformed, a
  rate limit hit) from **bugs**. Expected failures are part of normal
  operation and are handled; bugs crash loudly.
- A failing source never affects another (circuit breaker, `CLAUDE.md`).
- Still to decide: typed error classes vs. a `Result` type for expected
  failures.

## Outbound HTTP

**Status:** `open` · settle in phase 1

- One HTTP client wrapper in `packages/core`. Collectors do not call `fetch`
  directly.
- The wrapper always sets the `User-Agent` with a contact address and a
  timeout, retries idempotent requests with backoff, and respects per-source
  rate limits.
- Every response is parsed through a Zod schema before use.

**Enforcement:** lint rule against `fetch` inside collector adapters.

## AI calls

**Status:** `open` · settle in phase 3

- Only through the client wrapper in `packages/ai` (roadmap phase 3). No direct
  SDK calls elsewhere.
- The wrapper is where the Claude API rules from `CLAUDE.md` are enforced:
  exact model IDs, Batch API, `output_config`, and `cost_usd` capture on every
  call.
- Direct Anthropic SDK, no multi-provider gateway — the rules above depend on
  Anthropic-specific features.

**Enforcement:** lint rule against importing `@anthropic-ai/sdk` outside
`packages/ai`.

## Documentation

**Status:** `settled`

- **README** answers what Astra is, why it exists and how it is built — short
  enough to read in three minutes, with diagrams. Details live in `docs/`.
- **Diagrams as Mermaid** inside the Markdown. GitHub renders them; they are
  text, diffable and cannot silently go stale like an exported image.
- **Screenshots and GIFs** under `docs/assets/`, only of real UI — no mock-ups
  in the README.
- **Docs change with the code.** A new insight or a deviation from a document
  goes into that document in the same commit. Larger shifts get an ADR.
