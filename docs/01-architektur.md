# Architektur

## Leitgedanke

Astra verarbeitet keine Posts, sondern **Storys**. Ein Ereignis ("Nvidia
übernimmt Hugging Face") erzeugt binnen Minuten einen HN-Thread, drei
Reddit-Posts, zwei RSS-Artikel und dutzende Bluesky-Posts. Das sind nicht
30 News, sondern eine — mit 30 Belegen.

Diese Verdichtung ist der technische Kern. Sie löst gleich zwei Probleme:

1. **Der Feed wird lesbar.** Eine Karte statt 30 Duplikate.
2. **Relevanz fällt gratis ab.** Wenn eine Story gleichzeitig auf HN, Bluesky
   und TechCrunch auftaucht, ist sie wichtig. Das ist ein stärkeres Signal als
   jede Upvote-Zahl, und wir kriegen es als Nebenprodukt des Clusterings.

## Pipeline

```
┌───────────┐   ┌──────────────┐   ┌────────────┐   ┌───────────┐   ┌─────────┐   ┌──────────┐
│ Collector │ → │ Normalisierer│ → │ Clustering │ → │ KI-Anrei- │ → │ Ranking │ → │ Feed +   │
│ (n Stück) │   │              │   │ (Dedup)    │   │ cherung   │   │         │   │ Telegram │
└───────────┘   └──────────────┘   └────────────┘   └───────────┘   └─────────┘   └──────────┘
   raw_items         raw_items          stories         stories        feed_rank      UI/Push
```

Jede Stufe schreibt in die DB und ist **einzeln wiederholbar**. Das ist bewusst
so: wenn der Summary-Prompt verbessert wird, lässt sich die Anreicherung neu
laufen, ohne alles neu einzusammeln. Und wenn ein Collector kaputtgeht, sind die
Daten der anderen unberührt.

### 1. Collector

Ein Adapter pro Quelle hinter einem gemeinsamen Interface:

```ts
interface Collector {
  id: string;                              // "hackernews", "bluesky", ...
  mode: "poll" | "stream";
  schedule?: string;                       // Cron, nur bei mode: "poll"
  collect(ctx: CollectorContext): AsyncIterable<RawItem>;
}
```

Zwei Betriebsarten, weil die Quellen sich fundamental unterscheiden:

- **poll** — Cron-Job über BullMQ. HN, Reddit, RSS, GitHub, arXiv, HF, Product Hunt.
- **stream** — Dauerhafte WebSocket-Verbindung mit Reconnect-Backoff. Bluesky
  Jetstream. Braucht eine stabile Infrastruktur, kommt deshalb erst nach den
  Poll-Collectors (siehe Roadmap Phase 1b).

Neue Quelle hinzufügen heisst: einen Adapter schreiben, eine Zeile in der
`sources`-Tabelle. Nichts anderes im System muss angefasst werden. Das ist die
wichtigste Design-Eigenschaft — X/Twitter wurde bewusst weggelassen, könnte aber
jederzeit als weiterer Adapter nachgereicht werden.

### 2. Normalisierer

Vereinheitlicht alles auf ein `RawItem` und macht die entscheidende Vorarbeit
fürs Clustering: **URL-Kanonisierung**.

```
https://techcrunch.com/2026/09/08/nvidia-hf/?utm_source=hn&utm_medium=social#top
                          ↓
https://techcrunch.com/2026/09/08/nvidia-hf
```

Schritte: Redirects auflösen (Kurzlinks!), Tracking-Parameter entfernen
(`utm_*`, `ref`, `fbclid`, `source`), Fragment abschneiden, Trailing-Slash
normalisieren, Host lowercase, `www.` entfernen. Ohne das ist Deduplizierung
nicht möglich — die gleiche URL kommt aus jeder Quelle anders formatiert an.

### 3. Clustering

Siehe [`03-ranking-und-ki.md`](03-ranking-und-ki.md#clustering) für Details.
Dreistufig: exakter URL-Match → Trigram-Titelähnlichkeit → semantisch via
Embeddings, mit LLM-Schiedsrichter nur für die unsichere Grauzone.

### 4. KI-Anreicherung

Zweistufig, um Kosten zu kontrollieren:

- **Triage** (Haiku 4.5, alle Storys): Wichtigkeit, Themen, Entitäten, Ort,
  Rausch-Flag. Billig, filtert 80% weg.
- **Zusammenfassung** (Sonnet 5, nur die relevanten): Kurzfassung, Erklärung
  für Nicht-Expert*innen, Einordnung.

Beides über die **Batch API** (50% günstiger) — Ingestion ist nicht
latenzkritisch. Ergebnisse landen in `stories`, nicht in einem Cache: sie sind
Teil des Datenmodells.

### 5. Ranking

Regelbasiert → Embeddings → LLM-Re-Rank, in dieser Reihenfolge über die Phasen
hinweg. Details in [`03-ranking-und-ki.md`](03-ranking-und-ki.md#ranking).

### 6. Auslieferung

Web-Feed (Next.js) und Telegram-Push. Der Push hat eine eigene Regel-Engine mit
Rate-Limit und Ruhezeiten — eine Benachrichtigung, die zu oft kommt, ist
schlimmer als keine.

## Services (Docker Compose)

| Service | Image / Basis | Zweck |
|---|---|---|
| `web` | Node 22 · Next.js 16 | UI + API Routes |
| `worker` | Node 22 | Collectors, Anreicherung, Clustering (BullMQ Consumer) |
| `scheduler` | Node 22 | Cron → BullMQ Jobs (kann im Worker mitlaufen) |
| `postgres` | `pgvector/pgvector:pg17` | Alles Persistente |
| `redis` | `redis:7-alpine` | BullMQ Queue + Cache |
| `caddy` | `caddy:2-alpine` | Reverse Proxy, automatisches TLS |
| `grafana` + `loki` + `promtail` | — | Logs & Dashboards (ab Phase 8) |

`web` und `worker` teilen sich Code (Monorepo, siehe unten), laufen aber als
getrennte Container. Der Grund ist Betriebs-Hygiene: ein Collector, der wegen
eines kaputten RSS-Feeds im Retry-Loop hängt, darf die Website nicht mitreissen.

## Repo-Struktur

```
astra/
├── apps/
│   ├── web/                 # Next.js 16 (App Router)
│   └── worker/              # Collectors, Jobs, Pipeline
├── packages/
│   ├── db/                  # Drizzle Schema + Migrationen
│   ├── core/                # Domain-Typen, Scoring, Clustering-Logik
│   ├── ai/                  # Anthropic- und Embedding-Wrapper, Prompts
│   └── ui/                  # Design-System-Komponenten
├── infra/
│   ├── docker-compose.yml       # Produktion
│   ├── docker-compose.dev.yml   # Lokal (nur Postgres + Redis)
│   ├── Caddyfile
│   └── grafana/
├── assets/
│   └── blender/             # .blend-Quelldateien für Detail-Assets
├── docs/
└── .github/workflows/
```

Monorepo mit pnpm Workspaces + Turborepo. Der Hauptgrund ist geteilte
Typsicherheit: das Drizzle-Schema in `packages/db` ist die einzige Wahrheit über
die Datenformen, und `web` wie `worker` leiten ihre Typen davon ab. Ändert sich
eine Spalte, bricht der Build an jeder betroffenen Stelle — genau dort, wo man es
merken will.

## Datenmodell

Postgres 17 mit `pgvector` (semantische Suche) und `pg_trgm` (Titelähnlichkeit).

### `sources`
Registry der Quellen. Konfiguration in `config jsonb` (Subreddit-Liste,
Feed-URLs, Bluesky-Filter). `enabled` als Feature-Flag, `health` und
`last_run_at` fürs Monitoring.

### `raw_items`
Roh eingesammelte Einträge, **unverändert**. Eine Zeile pro Quelle pro Fund.

```
id, source_id, external_id, url, canonical_url, title, body_snippet,
author, published_at, engagement jsonb, fetched_at, raw jsonb
UNIQUE (source_id, external_id)
INDEX ON (canonical_url), (fetched_at DESC)
```

`raw jsonb` behält die Original-Antwort. Kostet wenig, rettet einen aber, wenn
der Normalisierer einen Bug hatte — dann lässt sich reprozessieren statt neu
einzusammeln. `body_snippet` statt Volltext: rechtlich sauber (siehe
[Rechtliches](02-quellen.md#rechtliches)) und spart Platz.

### `stories`
Das verdichtete Ereignis — die Einheit, die der Mensch am Ende sieht.

```
id, cluster_key, title, summary_short, summary_deep, explainer,
topics text[], entities jsonb, geo jsonb, importance smallint,
embedding vector(1024), lang, first_seen_at, last_activity_at,
source_count smallint, enriched_at
INDEX USING hnsw (embedding vector_cosine_ops)
INDEX ON (last_activity_at DESC), (importance DESC)
```

`source_count` ist redundant (liesse sich aus `story_items` zählen), wird aber
im Ranking bei jeder Abfrage gebraucht — deshalb denormalisiert.

`geo` speichert einen Ort pro Story (Firmensitz, Ereignisort), von der Triage
extrahiert. Das ist die Datenbasis für die leuchtenden Punkte auf dem Globus:
Design und Funktion hängen hier zusammen, der Globus ist keine Deko.

### `story_items`
n:m zwischen `stories` und `raw_items`. Speichert zusätzlich
`match_method` (`url` | `trigram` | `embedding` | `llm`) und `confidence` —
damit lässt sich später auswerten, welche Clustering-Stufe wie gut arbeitet.

### `interactions`
Verhaltensdaten für die Personalisierung.

```
id, story_id, kind, value, created_at
kind ∈ (impression | open | dwell | save | hide | up | down)
```

`dwell` (Verweildauer in Sekunden) ist das ehrlichste Signal — ein Klick sagt
"sah interessant aus", 90 Sekunden Lesezeit sagen "war es auch".

### `profile`
Aktuell eine Zeile. Enthält `topic_weights jsonb` (explizit gesetzt) und
`embedding vector(1024)` (implizit gelernt). Die Tabelle hat trotzdem eine
`user_id`, damit ein zweites Profil später keine Migration braucht.

### `notifications`
`story_id, channel, sent_at, reason, feedback` — verhindert Doppel-Pushes und
protokolliert, *warum* etwas rausging. Ohne dieses `reason`-Feld lässt sich eine
Regel-Engine nicht debuggen.

### `job_runs`
`job_name, started_at, finished_at, status, items_in, items_out, cost_usd, error`
— Telemetrie für jeden Pipeline-Lauf. Basis fürs Kosten-Dashboard und für die
Alarmierung, wenn ein Collector still stirbt.

## Deployment

**Server:** Hetzner CX32 (4 vCPU, 8 GB RAM, 80 GB SSD, ~7 EUR/Monat), Ubuntu
24.04, Standort Nürnberg oder Helsinki.

> Warum CX32 statt des günstigeren CX22 (4 GB): Postgres mit pgvector,
> Redis, zwei Node-Prozesse und später Grafana passen in 4 GB nur mit Mühe.
> Die 2.50 EUR Aufpreis sind billiger als ein OOM-Kill um drei Uhr nachts.

**Absicherung** (Tag 1, vor dem ersten Deploy): SSH nur mit Key, root-Login aus,
UFW auf 22/80/443, fail2ban, unattended-upgrades. Nicht optional.

**CI/CD** (GitHub Actions):

```
Push → lint → typecheck → test → build Docker-Image → push GHCR
     → SSH auf Hetzner → docker compose pull && up -d → Healthcheck
```

Migrationen laufen als eigener Schritt **vor** dem Container-Neustart, und
zwar ausschliesslich additiv (Spalte hinzufügen ja, Spalte umbenennen nein) —
so überlebt ein Rollback die Datenbank.

**Backups:** Nächtlicher `pg_dump` → Hetzner Storage Box, 30 Tage Retention.
Ein **Restore-Test** gehört in die Roadmap (Phase 8): ein Backup, das nie
zurückgespielt wurde, ist kein Backup.

**Secrets:** In GitHub Actions Secrets für Deploy, auf dem Server als `.env`
mit `chmod 600`. Für ein Ein-Personen-Projekt ist Vault Overkill; falls es
später mehr wird, ist SOPS + age der nächste Schritt.

## Technologie-Entscheidungen

| Bereich | Wahl | Warum |
|---|---|---|
| Framework | Next.js 16, App Router | Server Components passen zum leseintensiven Feed; ein Deployment-Artefakt für UI und API |
| Sprache | TypeScript, `strict` | Ein Typsystem über die ganze Pipeline, vom Collector bis zum React-Component |
| ORM | Drizzle | SQL-nah statt magisch, gute pgvector-Unterstützung, Migrationen sind lesbares SQL |
| Queue | BullMQ + Redis | Ausgereift, Retries/Backoff/Cron eingebaut, brauchbare UI (Bull Board) |
| Styling | Tailwind CSS v4 | CSS-first-Config passt exakt zum Token-Ansatz des Design-Systems |
| 3D | react-three-fiber + drei | Three.js deklarativ, integriert sich in React statt daneben zu leben |
| Validierung | Zod | Externe Daten sind grundsätzlich unvertrauenswürdig — jede API-Antwort wird geparst |
| Tests | Vitest + Playwright | Vitest für Scoring/Clustering (reine Funktionen), Playwright für die kritischen Flows |

## Was bewusst *nicht* gebaut wird

Ein Plan ist auch eine Liste von Dingen, die man nicht tut:

- **Kein Kubernetes** (Phase 1–8). Ein Server, sieben Container. k3s wäre
  Lernen um des Lernens willen und würde das Produkt verzögern. Als bewusste
  Phase-9-Übung sinnvoll, wenn Astra läuft.
- **Kein eigenes Auth-System.** Ein Profil, zwei Lesegäste. GitHub OAuth mit
  Allowlist reicht und ist in einer Stunde erledigt.
- **Kein Microservice-Zuschnitt.** `web` und `worker` sind zwei Prozesse,
  nicht zwei Produkte.
- **Kein Volltext-Speichern** von Fremdartikeln. Snippet plus Link — siehe
  [Rechtliches](02-quellen.md#rechtliches).
- **Kein eigenes ML-Training.** Embeddings kommen von der Stange, das Ranking
  ist erklärbare Arithmetik. Ein selbsttrainiertes Modell wäre bei einem
  einzigen Nutzer ohnehin datenarm.
