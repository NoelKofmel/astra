# Decision log (ADRs)

Every decision with a date, its context and its reasoning. The point is not the
formality — it is being able to reconstruct in three months *why* something is
the way it is, and whether the reason still holds.

---

## ADR-001 — One profile, several readers

**Status:** accepted · 2026-09-09

**Context:** Astra is primarily for Noel. One or two friends should be able to
read along but do not need their own personalised feed.

**Decision:** a single personalisation profile. Access via GitHub OAuth with an
allowlist. The schema nevertheless carries a `user_id` everywhere.

**Consequences:**
- No user management, no onboarding, no registration
- Ranking and the profile vector stay simple — no cold start for new users
- The `user_id` costs nothing now and saves a painful migration later
- Friends see *Noel's* feed. That is intentional, not a shortcoming.

---

## ADR-002 — Self-hosting on Hetzner rather than PaaS

**Status:** accepted · 2026-09-09

**Context:** Noel has been a DevOps engineer for a month. The project should
advance him professionally, not just ship a product. Vercel + Neon would be
live faster.

**Decision:** Hetzner CX32, Docker Compose, Caddy, GitHub Actions.

**Consequences:**
- Maximum learning value exactly where he is growing professionally
- Full control over cron, long-running workers and WebSocket connections — all
  of which are awkward on Vercel
- ~7 EUR/month instead of a free tier
- Operational burden is his: updates, backups, monitoring
- **Condition:** server hardening happens in phase 0, not later

---

## ADR-003 — Budget of 25–30 CHF/month

**Status:** accepted · 2026-09-09

**Decision:** target ~20 CHF, ceiling at 30 CHF, hard guards in code.

**Consequences:**
- Model tiering is mandatory, not an optimisation: Haiku triages, Sonnet
  summarises, Opus only on click
- Batch API wherever latency does not matter (50% discount)
- Cost capture per API call from phase 3
- A daily budget guard that halts enrichment rather than running on quietly
- Direct consequence: ADR-004

---

## ADR-004 — No X/Twitter

**Status:** accepted · 2026-09-09

**Context:** X was originally intended as a primary source. Since February 2026
the API model is pure pay-per-use at ~$0.005 per post read; the free tier is
gone, and the flat tiers (Basic $200, Pro $5000) are no longer available to new
developers and were force-migrated during 2026.

The arithmetic: 30 accounts, 3× daily, ~50 posts per pull ≈ 4500 posts/month ≈
**$23/month**. Hourly polling of an 80-account list ≈ **$360/month**.

**Decision:** X will not be implemented. The budget goes into better AI
summaries and more frequent ingestion instead.

**Consequences:**
- Bluesky (Jetstream, free, unlimited) takes over the social-signal role
- Major items reach HN within minutes anyway — the loss is probably small, but
  it is not zero
- The collector interface stays built so that X would be one adapter among many
- **Testable:** the source trust score from phase 4 will show from data, after a
  few weeks, whether relevant stories are being missed. Then decide again — with
  numbers instead of instinct.

---

## ADR-005 — Clustering before ranking

**Status:** accepted · 2026-09-09

**Context:** a naive aggregator shows 30 posts about the same item.

**Decision:** the unit in the data model is the **story**, not the post.
Clustering is its own pipeline stage ahead of ranking, and it is not optional.

**Consequences:**
- The feed becomes readable at all
- `corroboration` (count of independent sources) becomes the strongest relevance
  signal — and it falls out for free
- The summary sees every source at once and can name contradictions
- In exchange: the hardest component technically, with calibration work
- Error costs are asymmetric → **prioritise recall** when tuning

---

## ADR-006 — Personalisation in stages, not semantic from the start

**Status:** accepted · 2026-09-09

**Context:** a pure embedding ranking would be more elegant technically, but has
a cold-start problem and is hard to debug.

**Decision:** three stages — (1) rule-based, (2) embeddings as a supplement,
(3) LLM re-ranking of the top slice.

**Consequences:**
- There is a working feed after phase 4, with no training data
- Each stage is separately evaluable: you can see whether it improves anything
- The rule component stays permanently — it is the filter-bubble guard
- Plus an exploration slot (5%) against monotony
- LLM re-ranking supplies the why-line → the ranking becomes explainable

---

## ADR-007 — Telegram for push

**Status:** accepted · 2026-09-09

**Context:** alternatives were ntfy (self-hosted, fits the ops theme), web
push/PWA (no third party) and Pushover (paid).

**Decision:** a Telegram bot.

**Consequences:**
- Built in under an hour and reliable
- **Inline buttons** allow 👍/👎 straight from the message — the notification
  becomes part of the feedback loop rather than just output
- A dependency on Telegram; notifications mix in with chats
- Web push stays open as a supplement in phase 9

---

## ADR-008 — Procedural globe rather than a Blender import

**Status:** accepted · 2026-09-09

**Context:** the globe is the central design element. Blender was to be learned
— the question was on what.

**Decision:** the globe procedurally in react-three-fiber from geodata. Blender
for detail assets (loader, badges, icons).

**Consequences:**
- Story markers can be placed from data — the globe shows real information
  rather than decoration
- Design and function are coupled: triage extracts `geo` for exactly this
- Blender gets learned on smaller, self-contained tasks — a faster sense of
  progress than failing on the main object
- Less artistic control over the globe itself; its look comes from material and
  point density in code

---

## ADR-009 — Voyage AI for embeddings

**Status:** accepted · 2026-09-09

**Context:** Anthropic offers no embedding API. Alternatives: OpenAI or a local
model (`bge-m3`).

**Decision:** `voyage-3.5-lite` (~$0.02/M tokens), behind a provider interface.

**Consequences:**
- ~$0.09/month at expected volume — effectively free
- Multilingual, which matters with mixed German and English content
- No RAM cost on the server (a local model would need ~2.5 GB)
- An external dependency; the interface keeps switching cheap
- **Note:** the model ID is stored per story. Changing models forces a full
  reindex.

---

## ADR-010 — No Kubernetes in phases 1–8

**Status:** accepted · 2026-09-09

**Context:** k3s would carry the most career learning value.

**Decision:** Docker Compose on one server. k3s as an optional phase 9.

**Consequences:**
- Considerably faster to a running product
- One server, seven containers — Kubernetes would solve nothing here that it
  does not also introduce
- Better as a *later* exercise anyway: migrating a running application to k8s
  teaches more than starting on a greenfield

---

## ADR-011 — Two equal views: globe and blog

**Status:** accepted · 2026-09-09

**Context:** the globe is the defining design element, but a rotating sphere is
no way to work through 40 stories. Conversely, a plain feed would be visually
interchangeable.

**Decision:** two views, switchable in the header — **globe** (radar: overview,
discovery) and **blog** (newspaper: reading, catching up). Both show the same
stories with the same ranking. The choice is remembered in `localStorage`; a
first visit opens in the globe.

**Consequences:**
- The globe does not have to do everything, and is free to be spectacular
- The blog view doubles as the accessible twin — keyboard and screen reader use
  are fully covered without contorting the globe
- **Hard rule:** no story may appear in only one view. Otherwise the globe
  becomes a trap rather than a view
- The 3D bundle loads by dynamic import only on switching to the globe — anyone
  who only reads never pays for it
- There is **no** switch on mobile, only the blog (see ADR-012)

---

## ADR-012 — Globe points as primary interface, not decoration

**Status:** accepted · 2026-09-09

**Context:** a globe with points can be an illustration or an interface. The
interaction decides which.

**Decision:** the glowing points are full controls. Hover unfolds an info card
(with a leader line back to the point); clicking opens the story in a side
panel. Alongside them, data-driven animations — impact ripples for new stories,
connection arcs between the locations of one story, a real-time day/night
terminator.

**Consequences:**
- Triage must reliably produce `geo` — no location, no point. Stories with no
  determinable location need handling (proposal: a "global" collector marker,
  to be decided in phase 5)
- Info cards as HTML overlays (`<Html>` from drei), not WebGL text — crisp,
  selectable, accessible
- Only one card open at a time, or performance suffers
- Every animation must say something true about the data. Movement without
  meaning gets cut
- More work in phase 5 — in exchange the globe is not an ornament you click away
  after two weeks

---

## Template for new entries

```markdown
## ADR-0XX — Title

**Status:** proposed | accepted | superseded by ADR-0YY · YYYY-MM-DD

**Context:** what problem, which alternatives?

**Decision:** what was chosen?

**Consequences:** what follows — good and bad?
```
