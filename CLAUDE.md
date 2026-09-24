# CLAUDE.md — project context

Context for Claude Code sessions in this repository. Keep it short and keep it
current — this file loads into every session.

## What Astra is

A personalised tech news aggregator. Pulls from many sources, **clusters
duplicates into stories**, enriches them with Claude, ranks them personally and
pushes what matters over Telegram.

The central idea: the unit is the **story**, not the post. One event produces 30
posts across 6 platforms — that becomes one card with 30 pieces of evidence. And
the fact that a story surfaces independently in several places is simultaneously
the strongest relevance signal available.

**User:** Noel (software engineer, DevOps engineer, Switzerland). One profile,
one or two reading guests.

## Status

**Phase 0 (foundation) nearly done** (`docs/05-roadmap.md`). **Live at
`https://astranews.ch`** since 2026-09-24: a Hetzner CPX12 in Falkenstein
(`188.245.171.28`), provisioned by cloud-init and deployed by the pipeline on
every push to `main`, with TLS from Let's Encrypt through Caddy. The domain is
registered at Hostpoint, which also hosts its DNS zone.

Next up — step 8 in `docs/08-operations.md`: order the Storage Box and set up
the nightly backup. Until then the backup timer fails every night, on purpose.
Then phase 1.

## Language — binding

| Where | Language |
|---|---|
| Everything in the repository | **English** |
| Code, identifiers, comments, log output | **English** |
| Commit messages, branch names, PRs, issues | **English** |
| Documents under `docs/`, this file, README | **English** |
| UI text and error messages shown to Noel | German |
| **Conversation with Noel** | **always German** |

Commit messages in the imperative, no trailing period: `Add Bluesky Jetstream
collector`, not `Added…`. Add a body when it helps, explaining **why** rather
than what — the what is in the diff.

Swiss orthography in any German text: `ss`, never `ß`.

## Read the docs first

| Question | Document |
|---|---|
| How is the system put together? | `docs/01-architecture.md` |
| Which source, which API, which limits? | `docs/02-sources.md` |
| How do clustering / AI / ranking work? | `docs/03-ranking-and-ai.md` |
| Colours, fonts, globe, layout? | `docs/04-design.md` |
| What comes next? | `docs/05-roadmap.md` |
| Why is X the way it is? | `docs/06-decisions.md` |
| How do we log / configure / call HTTP / …? | `docs/07-conventions.md` |
| How is it deployed, backed up, restored? | `docs/08-operations.md` |

For architectural questions: **always check the ADR log first.** A lot is
already decided and reasoned through.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript `strict` · Tailwind CSS v4 ·
Drizzle ORM · Postgres 18 + pgvector + pg_trgm · Redis + BullMQ ·
react-three-fiber · Zod · Vitest + Playwright

Monorepo: pnpm workspaces + Turborepo.
`apps/web`, `apps/worker`, `packages/{db,core,ai,ui}`, `infra/`

Deployment: Hetzner CPX12 (CX33 once available) · Docker Compose · Caddy ·
GitHub Actions → GHCR → SSH

## Claude API — rules for this project

**Models by task:**

| Task | Model | Why |
|---|---|---|
| Triage every story | `claude-haiku-4-5` | volume, cheap |
| Summarise top stories | `claude-sonnet-5` | quality per franc |
| Deep dive on click | `claude-opus-5` | rare, allowed to be expensive |

**Always observe** (otherwise: 400s or silent cost traps):

- **Batch API** for anything not latency-critical → 50% discount. Results come
  back **in arbitrary order** → always map by `custom_id`, never by position.
- **`output_config: { format: … }`** for structured output. Not the deprecated
  `output_format`.
- **No `temperature` / `top_p` / `top_k`** on Opus 5 or Sonnet 5 → 400. Steer
  through the prompt and `output_config.effort`.
- **No assistant prefill** → 400.
- **Opus 5 thinks by default.** `thinking: {type:"disabled"}` only up to
  `effort: "high"`; above that, 400.
- **Prompt cache minimums:** Opus 5 = 512 tokens, Sonnet 5 = 1024,
  **Haiku 4.5 = 4096**. A short Haiku prompt will not cache — no error, just
  `cache_creation_input_tokens: 0`.
- **Model IDs exactly** as above, no date suffix.
- **Every call writes `cost_usd`** into `job_runs`. No API call without cost
  capture.

Embeddings do **not** come from Anthropic → Voyage AI `voyage-3.5-lite` behind
the `EmbeddingProvider` interface.

## Conventions

**TypeScript**
- `strict: true`, no `any`. Where genuinely uncertain: `unknown` + a Zod parse.
- External data (API responses, feeds, webhooks) is **always** parsed through a
  Zod schema. Never `as SomeType` on foreign data.
- Derive types from the Drizzle schema; do not define them in parallel.
- Node 24 runs the sources directly: **relative imports end in `.ts`**, and
  only erasable syntax (no `enum`). Details in `docs/07-conventions.md`.
- Query operators (`sql`, `eq`, …) come from `@astra/db`, not `drizzle-orm`.

**Database**
- Migrations are **additive**. Adding a column yes; renaming or dropping only as
  a separate, deliberately planned step — otherwise no rollback survives.
- Every query on the feed path needs an index. When unsure, run
  `EXPLAIN ANALYZE`.

**Collectors**
- One adapter per source behind the `Collector` interface. Nothing outside the
  adapter may be source-specific.
- Respect rate limits. Set a `User-Agent` with a contact address.
- A failure in one source must never affect the others (circuit breaker).
- **Do not store full text of third-party articles** — a snippet of ≤ 500
  characters plus a link. See `docs/02-sources.md#legal`.

**Frontend**
- Server Components by default, `"use client"` only where needed.
- Use design tokens from `@theme`; **never** hardcode colour values.
- All animation respects `prefers-reduced-motion`.
- The 3D globe is **not loaded** on mobile (dynamic import behind a breakpoint
  check), not merely hidden.

**Tests**
- Pure logic (scoring, clustering, URL canonicalisation): Vitest, high coverage.
- The clustering thresholds have a **regression test** on the labelled dataset.
  Do not change them without re-measuring.
- Critical flows: Playwright.
- Tests run from the root as Vitest projects (`vitest.config.ts`) — no
  per-package test scripts. `pnpm test:coverage` writes the LCOV report that
  SonarQube imports in CI (`docs/08-operations.md#sonarqube`).

## Commands

First time: `cp .env.example .env && pnpm install`.

```bash
pnpm infra:up       # Postgres + Redis in Docker, waits until healthy
pnpm db:migrate     # apply migrations
pnpm dev            # web (localhost:3000) + worker
pnpm test           # Vitest, every package (--project @astra/worker narrows it)
pnpm test:coverage  # the same with coverage, as CI runs it
pnpm lint && pnpm typecheck
pnpm build          # Next.js production build
pnpm format         # Prettier
pnpm db:generate    # new migration after changing packages/db/src/schema.ts
pnpm db:studio      # Drizzle Studio
pnpm infra:down     # stop Postgres + Redis (data stays in the volumes)
```

## MCP servers

- `playwright` — project scope, in `.mcp.json`
- `context7` — current library docs (Next.js 16, Tailwind v4, Drizzle move
  fast); local config, not in the repo
- `graphify` — code knowledge graph; local config, not in the repo. Pays off
  once the codebase is large (phase 2–3 onward)

Add servers when a concrete need exists, not in advance — every server costs
context in every session.

## How to work here

- **The docs are a guide, not a manual.** They record direction and reasoning so
  the same decision does not get made three times — not to prescribe the
  implementation. Much of it is a *proposal* that may turn out impractical, too
  expensive or simply wrong once building starts. When that happens:
  **Noel's judgement on the running system beats any document.** Deviating is
  normal and needs no justification — only a note in the affected document, so
  things do not drift apart.
- **Detail emerges while building.** Specifics get decided *when* the relevant
  phase comes up, not in advance. New features or insights along the way go
  straight into the right document rather than getting lost in a chat. Larger
  shifts in direction get an ADR.
- **One way per cross-cutting concern.** Logging, errors, config, HTTP, jobs,
  AI calls: check `docs/07-conventions.md` before building one. The first
  implementation settles the pattern and is recorded there in the same commit.
  A wrong pattern gets changed and the code migrated — never a second way
  alongside. Prefer enforcing a convention with a lint rule over a sentence.
- **Roadmap phases in order.** The ordering is deliberate: a usable feed
  (phase 4) *before* design (phase 5).
- Cost is a feature. With every AI change, think about what it costs per month.
- No secrets in the repository. `.env` is ignored, `.env.example` is maintained.

## Open items

- [ ] Decide typography direction A or B (`docs/04-design.md`)
