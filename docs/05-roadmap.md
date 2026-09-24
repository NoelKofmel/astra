# Roadmap

Nine phases. Each has a **definition of done** you can check without argument —
that is the difference between a plan and a wish list.

Timings assume evening and weekend work. They are estimates, not commitments;
the ordering matters more than the pace.

---

## Phase 0 — Foundation · ~1 week

**Goal:** an empty but fully deployable system. Nothing does anything useful
yet, but everything is wired up.

- [x] Monorepo: pnpm workspaces + Turborepo, TypeScript `strict`
- [x] `docker-compose.dev.yml` — Postgres 18 + pgvector, Redis
- [x] Drizzle schema + first migration (every table from `01-architecture.md`)
- [x] Next.js skeleton with a healthcheck route
- [x] Worker skeleton with BullMQ and one dummy job
- [x] GitHub Actions: lint → typecheck → test → build
- [x] Settle the phase-0 conventions — logging, config, time/IDs, jobs
      (`07-conventions.md`) — including the lint rules that enforce them
- [ ] Provision the Hetzner CX32 and **harden it** (SSH keys only, UFW,
      fail2ban, unattended-upgrades)
- [ ] Domain + Caddy with automatic TLS
- [ ] Deploy pipeline: GHCR image → SSH → `docker compose up -d`
- [ ] Nightly `pg_dump` to the storage box

> **State on 2026-09-24:** CI runs on GitHub — green on the pull request and on
> `main`, which pushes both images to GHCR. The domain is `astranews.ch`
> (Hostpoint). Every other unchecked item exists as code and was tested locally
> — `infra/server/cloud-init.yaml`, `infra/caddy/Caddyfile`, `infra/deploy.sh`,
> `infra/backup.sh`. What is left is manual: create the server, point the DNS at
> it, set the GitHub secrets, order the Storage Box. Step by step in
> [`08-operations.md`](08-operations.md).

**Done when:** `git push` to `main` deploys automatically and
`https://<domain>/api/health` returns `{ ok: true }` with the database
reachable.

> This phase feels unproductive because nothing visible comes out of it. It is
> still the most important one: a working pipeline from day one means every
> later change is live in minutes. Skip it and you deploy manually for the first
> time in week six — and then spend three days on it.

---

## Phase 1 — Ingestion (polling) · ~2 weeks

**Goal:** data flows in.

- [ ] `Collector` interface + registry
- [ ] Normaliser including **URL canonicalisation** (redirects, UTM, fragments)
- [ ] Collector: Hacker News (Algolia)
- [ ] Collector: RSS (~20 feeds, with ETag/Last-Modified)
- [ ] Collector: GitHub (Search API)
- [ ] Collector: arXiv
- [ ] Collector: Lobsters
- [ ] BullMQ scheduler with per-source cron
- [ ] Error handling: retry with backoff, circuit breaker per source
- [ ] Admin view: "what came in" — raw, ugly, but present
- [ ] `job_runs` telemetry for every run

**Done when:** after 24 hours there are > 1000 `raw_items` from ≥ 4 sources in
the database, and one broken source does not affect the others.

---

## Phase 1b — Bluesky firehose · ~1 week

Separate, because streaming is a different operational class from polling.

- [ ] Jetstream WebSocket client with reconnect backoff + jitter
- [ ] Cursor persistence for seamless restarts
- [ ] Two-stage filter: `wantedDids` (~200 accounts) + keyword match
- [ ] Backpressure: Redis buffer, batch processing
- [ ] Health check on the **last received event**, not on socket state

**Done when:** the stream runs for 48 hours straight, survives a forced network
drop on its own, and loses no events doing so.

---

## Phase 2 — Clustering · ~1.5 weeks

**Goal:** posts become stories. The most demanding part technically.

- [ ] Embedding provider interface + Voyage implementation
- [ ] pgvector HNSW index
- [ ] Stage 1: exact URL match
- [ ] Stage 2: `pg_trgm` title similarity
- [ ] Stage 3: semantic clustering with thresholds
- [ ] Stage 4: LLM adjudicator for the grey band (Haiku, structured output)
- [ ] **Calibration:** label 100 pairs, measure precision/recall, fix thresholds,
      lock in as a regression test
- [ ] Record `match_method` and `confidence` in `story_items`

**Done when:** recall ≥ 0.90 at precision ≥ 0.85 on the labelled set, and a real
story with ≥ 3 sources shows up as **one** card.

---

## Phase 3 — AI enrichment · ~1.5 weeks

- [ ] Anthropic client wrapper with retry, cost capture, structured outputs
- [ ] Triage prompt (Haiku 4.5) including `geo` extraction
- [ ] Summary prompt (Sonnet 5): summary, explainer, context, disagreement
- [ ] Batch API integration (map results strictly by `custom_id`)
- [ ] Verify prompt caching (note: Haiku needs ≥ 4096 tokens)
- [ ] `cost_usd` per call into `job_runs`
- [ ] **Daily budget guard** with automatic stop + Telegram warning
- [ ] Prompt versioning, so reprocessing stays possible

**Done when:** all new stories are enriched, daily cost is under $0.60, and the
guard has demonstrably fired in a test run.

---

## Phase 4 — Ranking and a working feed · ~1 week

**Goal:** usable daily for the first time. Not pretty yet — but real.

- [ ] Rule-based scoring (five terms)
- [ ] Continuously computed source trust
- [ ] Feed API with pagination
- [ ] Minimal UI: list, story detail, topic filter
- [ ] Interaction tracking (`impression`, `open`, `dwell`, `save`, `hide`)
- [ ] GitHub OAuth with an allowlist (you + 2 friends)

**Done when:** you use Astra daily for a week instead of HN — and the feed still
makes sense afterwards.

> This is the milestone that counts. From here you are working on a running
> system rather than an idea. Everything after this is improvement.

---

## Phase 5 — Design · ~2 weeks

- [ ] Design tokens in Tailwind v4 `@theme`
- [ ] Self-host fonts, type scale
- [ ] Component library: StoryCard, ticker, chips, empty states
- [ ] CRT effect layer (scanlines, glow, boot) — switchable off
- [ ] **Globe** in react-three-fiber: wireframe → point cloud → markers
- [ ] Globe base interaction: drag, inertia, auto-rotation
- [ ] **Hover card:** leader line + unfold animation, 120ms delay, viewport-edge
      collision handling, auto-rotation pauses
- [ ] **Marker click** → story panel slides in from the right
- [ ] Globe animations: impact ripple, connection arcs, density glow, day/night
      terminator, assembly on load
- [ ] Keyboard operation of the globe (Tab through markers, Enter opens,
      `aria-label`)
- [ ] **View switch** globe ↔ blog in the header, choice in `localStorage`, 3D
      bundle by dynamic import on first switch only
- [ ] Three-column desktop layout for both views
- [ ] Mobile: blog view only, 3D never loaded
- [ ] Motion respecting `prefers-reduced-motion`
- [ ] Lighthouse ≥ 90 on performance and accessibility
- [ ] **README showcase:** hero screenshot or GIF of the globe, Mermaid
      architecture diagram, quick start — the repo's front door

**Done when:** you show someone the site and the reaction is "where did you get
that" — and it still loads in under two seconds.

**In parallel:** Blender basics on a detail asset (satellite loader).

---

## Phase 6 — Personalisation · ~1.5 weeks

- [ ] Profile vector as an EMA over weighted interactions
- [ ] Hybrid scoring (60% rules / 40% semantic)
- [ ] Exploration slot (5%), visibly marked
- [ ] LLM re-ranking of the top 30 with a why-line
- [ ] Settings UI: topic weights, mutes
- [ ] "Less like this" on the story card

**Done when:** across a week of A/B comparison, the open rate on the
personalised ordering measurably beats the purely rule-based one.

---

## Phase 7 — Notifications · ~4 days

- [ ] Telegram bot (BotFather, webhook)
- [ ] Rules engine: thresholds, quiet hours, daily quota, cluster dedup
- [ ] Message format with inline buttons
- [ ] `callback_query` handler → writes into `interactions`
- [ ] Morning digest at 07:30
- [ ] Settings: adjustable thresholds and quiet hours

**Done when:** a week of operation without a single push you would afterwards
call unnecessary.

---

## Phase 8 — Operations and hardening · ongoing

- [ ] Grafana + Loki + Promtail
- [ ] Dashboards: pipeline throughput, cost, source health, error rate
- [ ] Alerting on silent collector failure (the most dangerous failure mode:
      everything runs, nothing arrives)
- [ ] **Restore test** — replay a backup onto a fresh container
- [ ] Rate limiting on the API
- [ ] Security review: dependencies, secrets, headers
- [ ] Load test of the pipeline

**Done when:** a deliberately disabled collector triggers an alert within 30
minutes, and a backup has demonstrably been restored once.

---

## Phase 9 — Optional / expansion

As the mood and need take you, in no fixed order:

- **k3s migration** as a deliberate DevOps exercise (ArgoCD, GitOps, Terraform)
- **Local embeddings** (`bge-m3` as an ONNX service) — independence rather than
  nine cents
- **X/Twitter adapter** — if the data shows stories are being missed (see
  ADR-004); with a hard spend cap
- **Weekly review** — Opus 5 writes the week up as an essay
- **PWA + web push** alongside Telegram
- **Podcast mode** — TTS over the morning digest
- **Public blog mode** — curated stories published, then with a privacy policy

---

## Critical path

```
Phase 0 ──▶ Phase 1 ──▶ Phase 2 ──▶ Phase 3 ──▶ Phase 4 ✅ usable
             │                                     │
             └─▶ Phase 1b (parallel)               ├─▶ Phase 5 (design)
                                                   ├─▶ Phase 6 (personalisation)
                                                   └─▶ Phase 7 (push)
                                                           │
                                                     Phase 8 (operations)
```

There are no external blockers. Everything depends only on you.

**Realistic total to phase 4 (usable): 6–7 weeks.**
**To phase 8 (rounded and polished): 12–14 weeks.**

## Biggest risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Clustering quality disappoints | medium | The calibration step in phase 2 is mandatory, not optional |
| Design consumes unbounded time | **high** | Phase 5 deliberately comes *after* a working feed |
| LLM costs run away | low | Budget guard in phase 3, before full operation |
| Bluesky stream unstable | medium | Phase 1b is separate; polling sources keep running independently |
| Motivation after phase 3 | **high** | Which is why phase 4 (usable) comes before phase 5 (pretty) |

The last two rows are meant seriously. The biggest danger to an evening project
of this size is not technical, it is the point in week four where a lot is built
and none of it is any fun yet. The phase ordering exists so that there is a
usable feed *before* the design work starts.
