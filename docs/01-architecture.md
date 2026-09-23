# Architecture

## The guiding idea

Astra does not process posts. It processes **stories**. One event — say, Nvidia
acquiring Hugging Face — produces an HN thread, a Lobsters thread, two RSS
articles and dozens of Bluesky posts within minutes. That is not 30 news items.
It is one, with 30 pieces of evidence.

Condensing them is the technical heart of the system, and it solves two problems
at once:

1. **The feed becomes readable.** One card instead of 30 near-duplicates.
2. **Relevance falls out for free.** A story appearing simultaneously on HN,
   Bluesky and TechCrunch is important. That signal is stronger than any upvote
   count, and clustering hands it to us as a by-product.

## Pipeline

```
┌───────────┐   ┌────────────┐   ┌───────────┐   ┌────────────┐   ┌─────────┐   ┌──────────┐
│ Collector │ → │ Normaliser │ → │ Clusterer │ → │ AI enrich- │ → │ Ranking │ → │ Feed +   │
│  (n of)   │   │            │   │  (dedup)  │   │ ment       │   │         │   │ Telegram │
└───────────┘   └────────────┘   └───────────┘   └────────────┘   └─────────┘   └──────────┘
   raw_items        raw_items        stories         stories        feed_rank      UI / push
```

Every stage writes to the database, and every stage is **independently
repeatable**. That is deliberate. Improve the summarisation prompt and you can
re-run enrichment without re-collecting anything. Break a collector and the
other sources are untouched.

### 1. Collector

One adapter per source behind a shared interface:

```ts
interface Collector {
  id: string;                              // "hackernews", "bluesky", ...
  mode: "poll" | "stream";
  schedule?: string;                       // cron, only for mode: "poll"
  collect(ctx: CollectorContext): AsyncIterable<RawItem>;
}
```

Two modes, because the sources differ fundamentally:

- **poll** — a cron job through BullMQ. HN, RSS, GitHub, arXiv, Hugging Face,
  Product Hunt, Lobsters.
- **stream** — a long-lived WebSocket with reconnect backoff. Bluesky Jetstream.
  Needs stable infrastructure, so it lands after the polling collectors
  (roadmap phase 1b).

Adding a source means writing an adapter and inserting a row into `sources`.
Nothing else in the system changes. That is the single most important property
of this design — X/Twitter was deliberately left out, but it could be added
later as just another adapter.

### 2. Normaliser

Flattens everything into a `RawItem` and does the critical groundwork for
clustering: **URL canonicalisation**.

```
https://techcrunch.com/2026/09/08/nvidia-hf/?utm_source=hn&utm_medium=social#top
                          ↓
https://techcrunch.com/2026/09/08/nvidia-hf
```

Resolve redirects (shorteners matter here), strip tracking parameters
(`utm_*`, `ref`, `fbclid`, `source`), drop the fragment, normalise the trailing
slash, lowercase the host, remove `www.`. Without this, deduplication is
impossible — the same URL arrives formatted differently from every source.

### 3. Clusterer

See [`03-ranking-and-ai.md`](03-ranking-and-ai.md#clustering). Three stages:
exact URL match → trigram title similarity → semantic embeddings, with an LLM
adjudicating only the uncertain band in between.

### 4. AI enrichment

Two tiers, to keep costs predictable:

- **Triage** (Haiku 4.5, every story): importance, topics, entities, location,
  noise flag. Cheap, and it filters out roughly 80%.
- **Summary** (Sonnet 5, the survivors only): short summary, plain-language
  explainer, context.

Both run through the **Batch API** for a 50% discount — ingestion is not
latency-sensitive. Results land in `stories`, not in a cache: they are part of
the data model.

### 5. Ranking

Rule-based → embeddings → LLM re-rank, introduced in that order across the
phases. Details in [`03-ranking-and-ai.md`](03-ranking-and-ai.md#ranking).

### 6. Delivery

Web feed (Next.js) and Telegram push. The push path has its own rules engine
with rate limiting and quiet hours — a notification that fires too often is
worse than no notification at all.

## Services (Docker Compose)

| Service | Image / base | Purpose |
|---|---|---|
| `web` | Node 24 · Next.js 16 | UI + API routes |
| `worker` | Node 24 | Collectors, enrichment, clustering (BullMQ consumers) |
| `scheduler` | Node 24 | Cron → BullMQ jobs (may run inside the worker) |
| `postgres` | `pgvector/pgvector:0.8.6-pg18` | Everything persistent |
| `redis` | `redis:8.10-alpine` | BullMQ queue + cache |
| `caddy` | `caddy:2-alpine` | Reverse proxy, automatic TLS |
| `grafana` + `loki` + `promtail` | — | Logs and dashboards (phase 8 onwards) |

> Versions changed when phase 0 started (2026-09-23): Node 24 is the active
> LTS, while 22 reaches end of life in April 2027. Postgres 18 instead of 17
> buys a year more support (to 2030) and skips the first major upgrade. Redis 8
> is the maintained line. BullMQ 6 could also run on Postgres instead of Redis,
> but that backend was only two months old then; since the API is identical,
> switching later is a small change.

`web` and `worker` share code but run as separate containers. The reason is
operational hygiene: a collector stuck in a retry loop because of a broken RSS
feed must not take the website down with it.

## Repository layout

```
astra/
├── apps/
│   ├── web/                 # Next.js 16 (App Router)
│   └── worker/              # Collectors, jobs, pipeline
├── packages/
│   ├── db/                  # Drizzle schema + migrations
│   ├── core/                # Domain types, scoring, clustering logic
│   ├── ai/                  # Anthropic + embedding wrappers, prompts
│   └── ui/                  # Design system components
├── infra/
│   ├── docker-compose.yml       # Production
│   ├── docker-compose.dev.yml   # Local (Postgres + Redis only)
│   ├── Caddyfile
│   └── grafana/
├── assets/
│   └── blender/             # .blend source files for detail assets
├── docs/
└── .github/workflows/
```

A monorepo on pnpm workspaces + Turborepo. The main argument is shared type
safety: the Drizzle schema in `packages/db` is the single source of truth about
data shapes, and both `web` and `worker` derive their types from it. Change a
column and the build breaks everywhere it matters — which is exactly where you
want to find out.

## Data model

PostgreSQL 18 with `pgvector` (semantic search) and `pg_trgm` (title
similarity).

### `sources`
Registry of sources. Configuration lives in `config jsonb` (feed URLs, GitHub
queries, Bluesky filters). `enabled` acts as a feature flag; `health` and
`last_run_at` feed monitoring.

### `raw_items`
Collected entries, **unmodified**. One row per source per find.

```
id, source_id, external_id, url, canonical_url, title, body_snippet,
author, published_at, engagement jsonb, fetched_at, raw jsonb
UNIQUE (source_id, external_id)
INDEX ON (canonical_url), (fetched_at DESC)
```

`raw jsonb` keeps the original response. It costs little and saves you when the
normaliser turns out to have had a bug — then you reprocess instead of
re-collecting. `body_snippet` rather than full text: legally clean (see
[Legal](02-sources.md#legal)) and smaller.

### `stories`
The condensed event — the unit a human actually sees.

```
id, cluster_key, title, summary_short, summary_deep, explainer,
topics text[], entities jsonb, geo jsonb, importance smallint,
embedding vector(1024), lang, first_seen_at, last_activity_at,
source_count smallint, enriched_at
INDEX USING hnsw (embedding vector_cosine_ops)
INDEX ON (last_activity_at DESC), (importance DESC)
```

`source_count` is redundant — it could be counted from `story_items` — but the
ranking needs it on every query, so it is denormalised.

`geo` holds one location per story (headquarters, event site), extracted during
triage. It is the data behind the glowing markers on the globe: design and
function are coupled here, and the globe is not decoration.

### `story_items`
Many-to-many between `stories` and `raw_items`. Also records `match_method`
(`url` | `trigram` | `embedding` | `llm`) and `confidence`, so you can later
measure how well each clustering stage performs.

### `interactions`
Behavioural data for personalisation.

```
id, story_id, kind, value, created_at
kind ∈ (impression | open | dwell | save | hide | up | down)
```

`dwell` (seconds spent reading) is the most honest signal available. A click
says "looked interesting"; ninety seconds says "it was".

### `profile`
One row for now. Holds `topic_weights jsonb` (set explicitly) and
`embedding vector(1024)` (learned implicitly). The table still carries a
`user_id` so a second profile later needs no migration.

### `notifications`
`story_id, channel, sent_at, reason, feedback` — prevents duplicate pushes and
records *why* something went out. Without that `reason` field a rules engine is
undebuggable.

### `job_runs`
`job_name, started_at, finished_at, status, items_in, items_out, cost_usd, error`
— telemetry for every pipeline run. The basis for the cost dashboard and for
alerting when a collector dies quietly.

## Deployment

**Server:** Hetzner CX32 (4 vCPU, 8 GB RAM, 80 GB SSD, ~7 EUR/month),
Ubuntu 24.04, Nuremberg or Helsinki.

> Why CX32 over the cheaper CX22 (4 GB): Postgres with pgvector, Redis, two Node
> processes and later Grafana only just fit into 4 GB. The 2.50 EUR difference
> is cheaper than an OOM kill at three in the morning.

**Hardening** (day one, before the first deploy): SSH keys only, root login
disabled, UFW limited to 22/80/443, fail2ban, unattended-upgrades. Not optional.

**CI/CD** (GitHub Actions):

```
push → lint → typecheck → test → build image → push to GHCR
     → SSH to Hetzner → docker compose pull && up -d → healthcheck
```

Migrations run as a separate step **before** containers restart, and strictly
additively — adding a column yes, renaming one no. That way a rollback survives
contact with the database.

**Backups:** nightly `pg_dump` to a Hetzner Storage Box, 30-day retention. A
**restore test** is on the roadmap (phase 8): a backup that has never been
restored is not a backup.

**Secrets:** GitHub Actions secrets for deployment, a `chmod 600` `.env` on the
server. Vault is overkill for a one-person project; if it ever grows, SOPS + age
is the next step.

## Technology choices

| Area | Choice | Why |
|---|---|---|
| Framework | Next.js 16, App Router | Server Components suit a read-heavy feed; one deployment artefact for UI and API |
| Language | TypeScript, `strict` | One type system across the whole pipeline, from collector to React component |
| ORM | Drizzle | Close to SQL rather than magical, good pgvector support, migrations are readable SQL |
| Queue | BullMQ + Redis | Mature, retries/backoff/cron built in, usable UI (Bull Board) |
| Styling | Tailwind CSS v4 | CSS-first config maps exactly onto the design system's token approach |
| 3D | react-three-fiber + drei | Three.js declaratively, integrated into React rather than living beside it |
| Validation | Zod | External data is untrusted by default — every API response gets parsed |
| Tests | Vitest + Playwright | Vitest for scoring and clustering (pure functions), Playwright for critical flows |

## Deliberately not built

A plan is also a list of things you decide not to do:

- **No Kubernetes** (phases 1–8). One server, seven containers. k3s would be
  learning for its own sake and would delay the product. It makes sense as a
  deliberate phase-9 exercise, once Astra runs.
- **No custom auth system.** One profile, two reading guests. GitHub OAuth with
  an allowlist covers it in an hour.
- **No microservice split.** `web` and `worker` are two processes, not two
  products.
- **No full-text storage** of third-party articles. Snippet plus link — see
  [Legal](02-sources.md#legal).
- **No custom ML training.** Embeddings come off the shelf and the ranking is
  explainable arithmetic. A self-trained model would be starved of data with a
  single user anyway.
