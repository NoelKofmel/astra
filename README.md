# ASTRA

> A personalised tech news aggregator. Pulls from many sources, recognises when
> the same story surfaces everywhere at once, summarises and explains it with
> AI — and only speaks up when something is genuinely relevant.

**Status:** Planning complete. Implementation not started.

> **About the docs:** everything here is a **guide, not a manual.** The documents
> capture direction and reasoning so the same decision doesn't have to be made
> three times. They do not prescribe implementation. Whatever turns out to be
> impractical while building gets changed — experience with a running system
> beats any plan on paper. Changes flow back into the relevant document; larger
> shifts in direction get an entry in the
> [decision log](docs/06-decisions.md).

## The problem

There is no good place to get the tech news that is actually relevant to you as
a software engineer. X is noise, Reddit is unstructured, newsletters are too
slow, Hacker News has no personalisation. Catching something like "Nvidia
acquires Hugging Face" means keeping five apps open — and then reading the same
story in five variations.

## The approach

A pipeline that condenses noise into **stories** rather than posts:

```
Sources  →  Normalise  →  Cluster  →  AI enrichment  →  Rank  →  Feed + Push
```

Clustering is the core. The HN thread, the Lobsters post, the TechCrunch article
and the Bluesky discussion about one event become **one** story backed by
several pieces of evidence. And the fact that a story shows up in five places at
once is itself the strongest relevance signal available — it falls out of the
clustering for free.

## Documentation

| Document | Contents |
|---|---|
| [`docs/01-architecture.md`](docs/01-architecture.md) | Pipeline, services, data model, deployment |
| [`docs/02-sources.md`](docs/02-sources.md) | Source catalogue, APIs, rate limits, legal |
| [`docs/03-ranking-and-ai.md`](docs/03-ranking-and-ai.md) | Clustering, LLM usage, scoring, cost model |
| [`docs/04-design.md`](docs/04-design.md) | Design system, globe, layout |
| [`docs/05-roadmap.md`](docs/05-roadmap.md) | Phased plan with definition of done |
| [`docs/06-decisions.md`](docs/06-decisions.md) | Decision log (ADRs) |
| [`docs/07-conventions.md`](docs/07-conventions.md) | How cross-cutting concerns are done — one way each |
| [`CLAUDE.md`](CLAUDE.md) | Project context for Claude Code sessions |

## At a glance

- **Users:** one personalisation profile (Noel), read access for one or two friends
- **Hosting:** Hetzner VPS, Docker Compose, GitHub Actions CI/CD
- **Sources:** Hacker News, RSS, GitHub, Bluesky, arXiv, Hugging Face,
  Product Hunt, Lobsters — **no X/Twitter** (ADR-004), **no Reddit** (ADR-013)
- **AI:** Claude Haiku 4.5 (triage) → Sonnet 5 (summaries) → Opus 5 (deep dive)
- **Push:** Telegram bot
- **Budget:** ~20 CHF/month against a 25–30 CHF ceiling

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Drizzle ORM ·
PostgreSQL 18 + pgvector · Redis + BullMQ · react-three-fiber ·
Anthropic API · Voyage AI embeddings

## Language

Everything in this repository is English — code, comments, commits, branches,
pull requests and documentation. Day-to-day conversation and UI text are German.

## Content and licence

Private project. Third-party content is **not** stored or reproduced in full —
only metadata, short snippets and original AI summaries, always with a link and
attribution. See [`docs/02-sources.md`](docs/02-sources.md#legal).
