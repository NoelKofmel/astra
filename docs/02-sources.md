# Sources

As of September 2026. The API landscape moves — re-check pricing and access
rules before building each collector.

## Overview

| Source | Auth | Cost | Mode | Priority | Risk |
|---|---|---|---|---|---|
| Hacker News | none | free | poll | **P0** | none |
| RSS feeds | none | free | poll | **P0** | feeds disappear |
| GitHub | token | free | poll | P1 | rate limit |
| arXiv | none | free | poll | P1 | none |
| Bluesky (Jetstream) | none | free | **stream** | P1 | volume, reconnects |
| Hugging Face | optional | free | poll | P2 | none |
| Product Hunt | OAuth | free | poll | P2 | quota |
| Reddit | OAuth | free (non-commercial) | poll | P1 | **approval takes 2–4 weeks** |
| Lobsters | none | free | poll | P3 | small |
| ~~X/Twitter~~ | OAuth | **~$0.005/post** | — | **dropped** | cost (ADR-004) |

> ⚠️ **Do this first:** apply for Reddit API access. Since the Responsible
> Builder Policy (late 2025) there is no self-service registration — every new
> OAuth client goes through manual approval, typically 2–4 weeks. This is the
> only item in the entire plan with an external wait. File it during phase 0 and
> approval arrives before phase 1 needs it.

---

## P0 — Foundation

### Hacker News

Via the **Algolia Search API**, not the official Firebase API. No key, no rate
limit in practice, and you can filter by time window and score instead of
walking item IDs one at a time.

```
https://hn.algolia.com/api/v1/search_by_date?tags=story&numericFilters=created_at_i>{ts},points>20
```

- **Frequency:** every 15 minutes
- **Yield:** ~50–150 stories/day above the score threshold
- **Value:** the best single source for tech news. Most major items land here
  within minutes. `points` and `num_comments` are strong engagement signals for
  ranking.

### RSS / Atom

The least glamorous and most reliable collector. Parser: `rss-parser` or
`feedparser`. Send `ETag` and `Last-Modified` — otherwise you re-download forty
complete feeds every half hour.

Starting set (maintained in `sources.config`, extend at will):

| Category | Feeds |
|---|---|
| General tech | Ars Technica, The Verge, TechCrunch, Heise, Golem |
| Engineering | InfoQ, The Pragmatic Engineer, ACM Queue |
| AI | Import AI, The Batch, Simon Willison, Anthropic News, OpenAI Blog |
| Cloud / DevOps | AWS/GCP/Azure What's New, CNCF Blog, Kubernetes Blog |
| Switzerland | Inside IT, Netzwoche |

- **Frequency:** every 30 minutes
- **Value:** edited, and usually with more context than a social post. Ideal
  cluster partners — the HN thread brings the discussion, the RSS article brings
  substantiated text.

---

## P1 — Breadth and depth

### Reddit

OAuth2 client credentials, via `snoowrap` or the REST API directly.

- **Limit:** 100 requests/minute per OAuth client (averaged over ten minutes);
  10/min unauthenticated
- **Frequency:** every 20 minutes, `/r/{sub}/new` and `/r/{sub}/top?t=day`
- **Subreddits:** `programming`, `MachineLearning`, `LocalLLaMA`, `devops`,
  `kubernetes`, `sysadmin`, `netsec`, `selfhosted`, `webdev`, `ExperiencedDevs`,
  `rust`, `hardware`
- **Value:** technical depth in the comments, often pushing back against the
  hype — exactly what a summary lacks and what makes one worth reading.

**Take the commercial boundary seriously.** Non-commercial use is free;
commercial use costs $0.24 per 1000 calls and requires a negotiated contract.
Astra is private and stays that way — if it ever turns commercial, the Reddit
collector is the first thing to switch off.

> **Applying:** describe the use case as non-commercial and single-user, give a
> concrete request volume (12 subreddits × 2 endpoints every 20 minutes ≈ 1.2
> requests/minute, ~1% of the limit), state that content is not republished, and
> that every story links back to the original thread. Vague applications get
> rejected. Phrase the subreddit list as "approximately 12 subreddits,
> currently: …" so adding one later is not a scope change.

### Bluesky (Jetstream)

The most interesting collector technically. Do **not** consume the full AT
Protocol firehose: it runs 24–232 GB/day depending on load and delivers
CBOR/CAR-encoded Merkle trees you have to decode first.

**Jetstream** is the right choice: filtered JSON, ~850 MB/day for *all* posts,
server-side filtering by collection and repo, no API key.

```
wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post
```

Two filtering strategies, combined:
1. **Follow list** — ~200 curated tech accounts via `wantedDids`. Filtered
   server-side, minimal volume.
2. **Keyword match** on the broader stream — catches stories from accounts you
   do not follow.

Implementation details you otherwise learn the hard way:
- Exponential reconnect backoff with jitter. The connection *will* drop.
- Persist the `cursor` so a restart does not lose the window.
- Backpressure: the stream is faster than processing. Buffer into Redis and
  process in batches — do not write to the database per event.
- Health check on the **last received event**, not on socket state. "Socket
  open" and "data arriving" are different things.

### GitHub

There is no official trending endpoint. Two workable routes:
- Search API: `q=created:>{date} stars:>50&sort=stars` — official and good enough
- Watch releases of significant repos (React, Next.js, Postgres, Kubernetes, …)

- **Limit:** 5000 requests/hour with a token
- **Value:** complements the news with what people are actually adopting. A tool
  that gains 3000 stars in a day is a story.

### arXiv

Atom API, no key. Categories `cs.AI`, `cs.LG`, `cs.CL`, `cs.CR`, `cs.SE`.
Courtesy rule: at most one request every three seconds.

- **Frequency:** twice daily
- **Value:** covers the "what's new in AI research" angle. Fairly unreadable raw
  — this is where the AI explainer earns its keep most.

---

## P2 / P3 — Supplementary

- **Hugging Face** — Daily Papers, new models gaining traction. Matches the
  original motivating example exactly.
- **Product Hunt** — GraphQL, OAuth. New tools and launches.
- **Lobsters** — `https://lobste.rs/hottest.json`. Small, but high signal
  density and little overlap with HN.

---

## Legal

Astra is private, but a few rules still apply and are cheaper to honour from day
one than to retrofit:

1. **Do not store full text.** Title, metadata and a snippet (≤ 500 characters).
   The substance comes from the AI summary, which is a new work.
2. **Always link and attribute.** Every story card names its sources with links.
   That is also correct UX: the path to reading further must stay open.
3. **Respect robots.txt and rate limits.** No scraping where an API exists. Set
   a `User-Agent` with a contact address.
4. **Do not cross Reddit's commercial boundary** (see above).
5. **If Astra ever goes public:** Swiss DSG means a privacy policy; an imprint is
   not mandatory for non-commercial operation but is better practice. At that
   point, also check whether the summaries still stand as independent works or
   sit too close to the original.

## Measuring source quality

From phase 4 each source carries a continuously computed trust score that feeds
the ranking:

```
source_trust = 0.4 · precision   (share of items that make it into a story)
             + 0.3 · scoop rate  (share of stories where this source was first)
             + 0.3 · engagement  (share you actually open)
```

The feed then regulates itself: a source that only produces noise sinks without
anyone having to switch it off. And the question "do I need X/Twitter after all?"
becomes answerable from data rather than gut feeling after a few weeks.
