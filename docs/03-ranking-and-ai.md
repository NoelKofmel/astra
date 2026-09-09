# Clustering, AI enrichment and ranking

The substantive core of Astra. Three parts that build on each other: clustering
turns posts into stories, enrichment makes them understandable, ranking decides
what you see first.

---

## Clustering

**The job:** recognise that an HN thread, two Reddit posts, a TechCrunch article
and forty Bluesky posts are all about the same event.

Three stages, cheapest first. Each catches what it can and passes the rest on.
That keeps the cost at a few cents a day.

### Stage 1 — Exact URL match (~40% of duplicates, free)

After canonicalisation, a `canonical_url` match is a certain hit. This covers
the most common case: the same article shared to HN, Reddit and Bluesky at once.

```sql
SELECT story_id FROM story_items si
  JOIN raw_items ri ON ri.id = si.raw_item_id
 WHERE ri.canonical_url = $1
 LIMIT 1;
```

### Stage 2 — Title similarity (~20%, free)

For cases with no shared URL: TechCrunch and The Verge write their own articles
about the same event. `pg_trgm` with a GIN index:

```sql
SELECT id, similarity(title, $1) AS sim
  FROM stories
 WHERE last_activity_at > now() - interval '72 hours'
   AND title % $1
 ORDER BY sim DESC LIMIT 5;
```

Threshold around 0.45. This only proposes candidates — stage 3 decides.

### Stage 3 — Semantic similarity (the remainder, ~$0.02/M tokens)

Embed `title + first ~200 words`, then cosine similarity against every story
from the last 72 hours via an HNSW index:

```sql
SELECT id, 1 - (embedding <=> $1) AS sim
  FROM stories
 WHERE last_activity_at > now() - interval '72 hours'
 ORDER BY embedding <=> $1 LIMIT 5;
```

Three bands:

| Similarity | Decision |
|---|---|
| ≥ 0.86 | Same story — attach |
| 0.74 – 0.86 | **Uncertain → stage 4** |
| < 0.74 | New story |

These are starting values, not truths. They need calibrating (below).

### Stage 4 — LLM adjudicator (the grey band only, ~20–40 cases/day)

Claude Haiku 4.5 receives both titles plus snippets and answers with structured
output:

```json
{ "same_story": true, "confidence": 0.91, "reason": "Both cover the acquisition..." }
```

Cost: ~30 cases/day × ~600 tokens ≈ 0.5M tokens/month ≈ **$0.30**. Negligible —
and it rescues exactly the cases where pure similarity measures fail. "Nvidia
buys Hugging Face" and "What the HF acquisition means for open-source AI" are
semantically close but are two different stories.

### Calibration — do not skip this

Without measurement the thresholds are guesses. The plan:

1. Collect a day of raw data.
2. Label 100 pairs by hand (same story: yes/no). Takes about 45 minutes.
3. Measure precision and recall across a threshold sweep from 0.70 to 0.92.
4. **Prioritise recall.** Two separate cards for one story is a cosmetic flaw;
   two different stories wrongly merged is data loss — one of them disappears
   from the feed entirely.
5. Lock it in as a Vitest regression test, so a later change to the embedding
   model cannot quietly break it.

### Embeddings

Anthropic offers no embedding API. Chosen: **Voyage AI `voyage-3.5-lite`**
(~$0.02/M tokens, 32k context, multilingual — which matters for mixed German and
English content).

At ~500 stories/day × ~300 tokens ≈ 4.5M tokens/month ≈ **$0.09/month**.

Behind an interface, so switching stays a configuration change:

```ts
interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  readonly dimensions: number;
  readonly id: string;   // stored per story — changing models forces a reindex
}
```

Later alternative: `bge-m3` locally in a small ONNX service. Free and
independent, but needs ~2.5 GB of RAM. Feasible on the CX32, though only once
everything else is stable — the operational overhead exceeds the nine cents it
saves.

---

## AI enrichment

### Model tiering

The single biggest cost lever: not every story needs the most expensive model.

| Tier | Model | Volume | Job |
|---|---|---|---|
| **Triage** | `claude-haiku-4-5` | all (~300/day) | importance, topics, entities, location, noise flag |
| **Summary** | `claude-sonnet-5` | top ~50/day | short summary, explainer, context |
| **Deep dive** | `claude-opus-5` | on click (~30/month) | deep analysis, follow-up questions |

Both batch tiers run through the **Batch API** (50% discount). Ingestion is not
latency-sensitive — nobody notices twenty minutes of delay, everyone notices
half the bill.

### Triage prompt (Haiku 4.5)

Structured output, so nothing needs parsing:

```json
{
  "importance": 0,          // 0-100
  "is_noise": false,        // advertising, repost, pure meme
  "topics": ["ai-infra", "acquisitions"],
  "entities": { "orgs": ["Nvidia", "Hugging Face"], "people": [], "tech": [] },
  "geo": { "place": "Santa Clara, CA", "lat": 37.35, "lon": -121.96 },
  "why_matters": "One sentence."
}
```

`geo` feeds the markers on the globe, which is why it lives here rather than in
a separate step. The globe is a visualisation of real data, not decoration.

### Summary prompt (Sonnet 5)

Receives **all** `raw_items` belonging to a story — this is precisely the payoff
from clustering. The model sees the report, the discussion and the pushback at
once, and can weigh them against each other.

Output:
- `summary_short` — 2–3 sentences on what happened
- `explainer` — 4–6 sentences for someone without background in the topic. This
  is the feature that separates Astra from an RSS reader.
- `context` — what led here, what follows
- `disagreement` — where sources contradict each other, say so rather than
  smoothing it over

### Prompt caching

The system prompts are stable and cacheable, with one catch that matters:

| Model | Cache minimum |
|---|---|
| Opus 5 | 512 tokens |
| Sonnet 5 | 1024 tokens |
| **Haiku 4.5** | **4096 tokens** |

A short triage prompt on Haiku **will not cache** and still produces quiet
overhead — no error, just `cache_creation_input_tokens: 0`. Two options: skip
caching on Haiku (the batch discount carries most of the saving anyway), or push
the prompt past 4096 tokens with few-shot examples, which improves quality at the
same time. Test the second, fall back to the first.

### API pitfalls (as of September 2026)

Otherwise these cost an hour of debugging:

- **No `temperature`/`top_p`/`top_k`** on Opus 5 or Sonnet 5 → 400. Steer through
  the prompt and `output_config.effort`.
- **No assistant prefill** → 400. Use `output_config.format` instead.
- `output_config: { format: … }`, **not** the deprecated `output_format`.
- Opus 5 thinks by default. `thinking: {type:"disabled"}` only works up to
  `effort: "high"`; above that, 400.
- Model IDs exactly as written: `claude-haiku-4-5`, `claude-sonnet-5`,
  `claude-opus-5` — never append a date suffix.
- Batch results return **in arbitrary order** → always map by `custom_id`, never
  by position.

### Cost model

Assuming ~300 clustered stories/day, ~50 of them relevant enough for a full
summary.

| Item | Calculation | $/month |
|---|---|---|
| Triage (Haiku, batch) | 300/day × 400 in + 100 out | ~4.05 |
| Summary (Sonnet, batch) | 50/day × 1500 in + 500 out | ~9.00 |
| Cluster adjudicator (Haiku, batch) | ~30/day × 600 | ~0.30 |
| Deep dive (Opus, on demand) | 30/month × 3000 in + 1000 out | ~1.20 |
| Embeddings (voyage-3.5-lite) | 4.5M tokens | ~0.09 |
| **AI total** | | **~$14.6** |

Plus infrastructure:

| Item | CHF/month |
|---|---|
| Hetzner CX32 | ~6.50 |
| Domain | ~1.50 |
| Backup storage | ~1.00 |
| AI (above, ~$14.6) | ~11.70 |
| **Total** | **~20.70** |

Inside the 25–30 CHF budget, with room to experiment.

**Cost control** from phase 3, not later:
- Every API call writes `cost_usd` into `job_runs`
- A daily budget guard halts enrichment on breach and sends a Telegram warning
- A dashboard showing cost per story and per source — which incidentally answers
  which sources are worth their money

---

## Ranking

Built in three phases. Each is usable on its own, which matters: you have a
working feed after phase 4, not only after phase 6.

### Phase 1 — Rule-based (explainable, no cold start)

```
score = 0.20 · source_trust           // learned per-source score
      + 0.25 · topic_match            // against explicit topic weights
      + 0.20 · recency                // score / (age_h + 2)^1.5, HN-style
      + 0.25 · corroboration          // log(1 + independent source count)
      + 0.10 · engagement_z           // normalised per source
```

`corroboration` is the most interesting term and a gift from clustering: a story
on five independent sources within six hours is almost always important. A plain
RSS reader simply does not have that information.

Normalising `engagement` **per source** is necessary: 500 points on HN and 500
upvotes in r/programming do not mean the same thing.

### Phase 2 — Semantic personalisation

A profile vector, maintained as an exponential moving average over the stories
you interact with:

```
profile = normalize( (1-α)·profile + α·Σ(weight_k · embedding_k) )

weight:  open +0.3 | dwell>60s +0.6 | save +1.0 | up +1.0 | hide −0.8 | down −1.0
α ≈ 0.05
```

Then:

```
final = 0.6 · rule_score + 0.4 · cosine(profile, story.embedding)
```

The rule score stays in deliberately. A pure similarity ranking builds a filter
bubble — it keeps showing more of the same. The `corroboration` and `recency`
terms ensure objectively important things get through even when they do not
match the existing profile.

Plus **5% exploration**: one guaranteed slot for something outside the profile,
clearly marked as such. Costs almost nothing and stops the feed going slowly
monotonous over months.

### Phase 3 — LLM re-ranking

The top 30 go to Haiku/Sonnet along with the profile as text:

> "Noel is a software engineer and DevOps engineer, interested in
> infrastructure, AI tooling and systems design. Less so in crypto and startup
> funding. Rank these 30 stories by relevance to him and justify each in one
> sentence."

The response carries a **why-line** per story, shown in the UI. That makes the
ranking visible and arguable rather than a black box — and when it gets things
wrong, you can see why immediately.

Cost: once daily, ~30 stories × 300 tokens ≈ 9k tokens → a few cents a month.

### Explicit control

Alongside everything learned, always manual controls:
- Topic weights (`ai-infra: high`, `crypto: off`)
- Muted keywords and domains
- "Less like this" directly on the story card

With a single user, explicit settings often beat learned behaviour — you know
what interests you. The learned part supplements; it does not replace.

---

## Notifications (Telegram)

**Principle:** one notification too many is worse than one too few. Someone who
mutes a news app does not come back.

Rules engine:

```
push if:
    importance ≥ 70
AND personal_score ≥ 0.6
AND not already pushed for this cluster
AND outside quiet hours (22:00–07:00 Europe/Zurich)
AND daily quota not exhausted (default: 4)
```

Two modes:
- **Breaking** — immediately, only for `importance ≥ 85`
- **Digest** — 07:30, the top five overnight in one message

The Telegram message carries **inline buttons**:

```
📡 Nvidia acquires Hugging Face for $12B

Nvidia buys the largest open-source AI platform. A hardware
manufacturer now controls the central distribution point for
open models.

Sources: HN (1.2k) · TechCrunch · Bluesky (340)

[ Open in feed ]  [ 👍 ]  [ 👎 ]  [ 🔕 Topic ]
```

The feedback buttons write straight into `interactions` and so train the profile
vector. That is the most elegant part of the loop: the notification that annoys
you immediately makes the system better at not annoying you.

Technically: bot via BotFather, `sendMessage` with `MarkdownV2` (mind the
escaping), a `callback_query` webhook for the buttons. Use polling instead of a
webhook in local development, otherwise you need a tunnel.
