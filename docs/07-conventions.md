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
| [Configuration and secrets](#configuration-and-secrets) | `open` | phase 0 | — |
| [Time and IDs](#time-and-ids) | `open` | phase 0 | — |
| [Background jobs](#background-jobs) | `open` | phase 0 | — |
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

**Status:** `open` · settle in phase 0

- Each app reads environment variables in **exactly one module**, parses them
  with Zod at startup and fails fast on anything missing or malformed.
  Everything else imports the typed config object.
- A new variable goes into `.env.example` in the same commit.
- No secrets in the repository (`CLAUDE.md`).

**Enforcement:** lint rule against `process.env` outside the config module.

## Time and IDs

**Status:** `open` · settle in phase 0

- Timestamps are `timestamptz`, stored in UTC. Conversion to `Europe/Zurich`
  happens only at the edge (UI, Telegram messages).
- Still to decide: primary key type (serial vs. UUIDv7), date library (if any).

## Background jobs

**Status:** `open` · settle in phase 0

- Every job run writes one `job_runs` row: start, end, status, item counts,
  `cost_usd` where applicable.
- Jobs are **idempotent** — a retry must never create duplicates.
- Still to decide: how a job is defined and registered with BullMQ.

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
