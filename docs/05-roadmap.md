# Roadmap

Neun Phasen. Jede hat eine **Definition of Done**, die man ohne Diskussion
prüfen kann — das ist der Unterschied zwischen einem Plan und einer Wunschliste.

Zeitangaben gehen von Feierabend- und Wochenendarbeit aus. Sie sind Schätzungen,
keine Zusagen; die Reihenfolge ist wichtiger als das Tempo.

---

## Phase 0 — Fundament · ~1 Woche

**Ziel:** Ein leeres, aber vollständig deploybares System. Nichts tut etwas
Nützliches, aber alles ist verkabelt.

- [ ] **Reddit-API-Zugang beantragen** ← zuerst, Freigabe dauert 2–4 Wochen
- [ ] Monorepo: pnpm Workspaces + Turborepo, TypeScript `strict`
- [ ] `docker-compose.dev.yml` — Postgres 17 + pgvector, Redis
- [ ] Drizzle-Schema + erste Migration (alle Tabellen aus `01-architektur.md`)
- [ ] Next.js-Grundgerüst mit Healthcheck-Route
- [ ] Worker-Grundgerüst mit BullMQ und einem Dummy-Job
- [ ] GitHub Actions: lint → typecheck → test → build
- [ ] Hetzner CX32 aufsetzen, **Server härten** (SSH-Key-only, UFW, fail2ban,
      unattended-upgrades)
- [ ] Domain + Caddy mit automatischem TLS
- [ ] Deploy-Pipeline: GHCR-Image → SSH → `docker compose up -d`
- [ ] Nächtliches `pg_dump` auf Storage Box

**Done, wenn:** `git push` auf `main` deployt automatisch, und
`https://<domain>/api/health` gibt `{ ok: true }` mit erreichbarer DB zurück.

> Diese Phase fühlt sich unproduktiv an, weil nichts Sichtbares entsteht. Sie ist
> trotzdem die wichtigste: eine funktionierende Pipeline ab Tag 1 bedeutet, dass
> jede spätere Änderung in Minuten live ist. Wer sie überspringt, deployt in
> Woche 6 zum ersten Mal von Hand — und dann drei Tage lang.

---

## Phase 1 — Ingestion (Poll) · ~2 Wochen

**Ziel:** Daten fliessen rein.

- [ ] `Collector`-Interface + Registry
- [ ] Normalisierer inkl. **URL-Kanonisierung** (Redirects, UTM, Fragmente)
- [ ] Collector: Hacker News (Algolia)
- [ ] Collector: RSS (~20 Feeds, mit ETag/Last-Modified)
- [ ] Collector: GitHub (Search API)
- [ ] Collector: arXiv
- [ ] Collector: Reddit *(sobald Freigabe da)*
- [ ] BullMQ-Scheduler mit Cron pro Quelle
- [ ] Fehlerbehandlung: Retry mit Backoff, Circuit Breaker pro Quelle
- [ ] Admin-Ansicht: "was kam rein" — roh, hässlich, aber vorhanden
- [ ] `job_runs`-Telemetrie für jeden Lauf

**Done, wenn:** Nach 24 Stunden liegen > 1000 `raw_items` aus ≥ 4 Quellen in der
DB, und eine kaputte Quelle beeinträchtigt die anderen nicht.

---

## Phase 1b — Bluesky Firehose · ~1 Woche

Getrennt, weil Streaming eine andere Betriebsklasse ist als Polling.

- [ ] Jetstream-WebSocket-Client mit Reconnect-Backoff + Jitter
- [ ] Cursor-Persistenz für nahtlosen Neustart
- [ ] Zweistufiger Filter: `wantedDids` (~200 Accounts) + Keyword-Match
- [ ] Backpressure: Redis-Puffer, Batch-Verarbeitung
- [ ] Health-Check auf **letztes empfangenes Event**, nicht auf Socket-Status

**Done, wenn:** Der Stream läuft 48 Stunden durch, übersteht einen erzwungenen
Netzwerkabbruch selbstständig und verliert dabei keine Events.

---

## Phase 2 — Clustering · ~1.5 Wochen

**Ziel:** Aus Posts werden Storys. Der technisch anspruchsvollste Teil.

- [ ] Embedding-Provider-Interface + Voyage-Implementierung
- [ ] pgvector-HNSW-Index
- [ ] Stufe 1: exakter URL-Match
- [ ] Stufe 2: `pg_trgm`-Titelähnlichkeit
- [ ] Stufe 3: semantisches Clustering mit Schwellenwerten
- [ ] Stufe 4: LLM-Schiedsrichter für die Grauzone (Haiku, Structured Output)
- [ ] **Kalibrierung:** 100 Paare labeln, Precision/Recall messen, Schwellen
      festlegen, als Regressionstest sichern
- [ ] `match_method` und `confidence` in `story_items` protokollieren

**Done, wenn:** Auf dem gelabelten Set Recall ≥ 0.90 bei Precision ≥ 0.85, und
eine reale Story mit ≥ 3 Quellen erscheint als **eine** Karte.

---

## Phase 3 — KI-Anreicherung · ~1.5 Wochen

- [ ] Anthropic-Client-Wrapper mit Retry, Kostenerfassung, Structured Outputs
- [ ] Triage-Prompt (Haiku 4.5) inkl. `geo`-Extraktion
- [ ] Zusammenfassungs-Prompt (Sonnet 5): Kurzfassung, Erklärung, Kontext,
      Widerspruch
- [ ] Batch-API-Integration (Zuordnung strikt über `custom_id`)
- [ ] Prompt-Caching prüfen (Achtung: Haiku braucht ≥ 4096 Tokens)
- [ ] `cost_usd` pro Aufruf in `job_runs`
- [ ] **Tages-Budget-Guard** mit automatischem Stopp + Telegram-Warnung
- [ ] Prompt-Versionierung, damit Reprozessieren möglich bleibt

**Done, wenn:** Alle neuen Storys sind angereichert, die Tageskosten liegen unter
$0.60, und der Guard hat sich in einem Testlauf nachweislich ausgelöst.

---

## Phase 4 — Ranking & funktionierender Feed · ~1 Woche

**Ziel:** Erstmals täglich benutzbar. Noch nicht schön — aber echt.

- [ ] Regelbasiertes Scoring (5 Terme)
- [ ] Quellen-Trust laufend berechnen
- [ ] Feed-API mit Pagination
- [ ] Minimale UI: Liste, Story-Detail, Themenfilter
- [ ] Interaktions-Tracking (`impression`, `open`, `dwell`, `save`, `hide`)
- [ ] GitHub OAuth mit Allowlist (du + 2 Freunde)

**Done, wenn:** Du benutzt Astra eine Woche lang täglich statt HN — und der
Feed ist danach immer noch sinnvoll sortiert.

> Das ist der Meilenstein, der zählt. Ab hier arbeitest du an einem laufenden
> System und nicht mehr an einer Idee. Alles Weitere ist Verbesserung.

---

## Phase 5 — Design · ~2 Wochen

- [ ] Design-Tokens in Tailwind v4 `@theme`
- [ ] Fonts selbst hosten, Typoskala
- [ ] Komponentenbibliothek: StoryCard, Ticker, Chips, Empty States
- [ ] Retro-Effektschicht (Scanlines, Glow, Boot) — abschaltbar
- [ ] **Globus** in react-three-fiber: Drahtgitter → Punktwolke → Marker
- [ ] Globus-Basisinteraktion: Ziehen, Trägheit, Autorotation
- [ ] **Hover-Karte:** Leitlinie + Aufklapp-Animation, 120ms Verzögerung,
      Kollisionserkennung am Viewport-Rand, Autorotation pausiert
- [ ] **Marker-Klick** → Story-Panel fährt von rechts ein
- [ ] Globus-Animationen: Einschlag-Welle, Verbindungsbögen, Dichte-Glühen,
      Tag/Nacht-Grenze, Aufbau beim Laden
- [ ] Tastaturbedienung des Globus (Tab durch Marker, Enter öffnet, `aria-label`)
- [ ] **Ansichts-Umschalter** Globus ↔ Blog im Header, Wahl in `localStorage`,
      3D-Bundle per dynamischem Import erst beim ersten Wechsel
- [ ] Desktop-Dreispaltenlayout für beide Ansichten
- [ ] Mobile: nur Blog-Ansicht, 3D gar nicht erst laden
- [ ] Motion mit `prefers-reduced-motion`-Respekt
- [ ] Lighthouse ≥ 90 auf Performance und Accessibility

**Done, wenn:** Du zeigst die Seite jemandem und die Reaktion ist "wo hast du
das her" — und sie lädt trotzdem in unter 2 Sekunden.

**Parallel:** Blender-Grundlagen an einem Detail-Asset (Satelliten-Loader).

---

## Phase 6 — Personalisierung · ~1.5 Wochen

- [ ] Profilvektor als EMA über gewichtete Interaktionen
- [ ] Hybrides Scoring (60% Regel / 40% semantisch)
- [ ] Exploration-Slot (5%), sichtbar markiert
- [ ] LLM-Re-Ranking der Top 30 mit Warum-Zeile
- [ ] Einstellungs-UI: Themengewichte, Stummschaltungen
- [ ] "Weniger davon" auf der Story-Karte

**Done, wenn:** Bei einem A/B-Vergleich über eine Woche liegt die Öffnungsrate
der personalisierten Reihenfolge messbar über der rein regelbasierten.

---

## Phase 7 — Benachrichtigungen · ~4 Tage

- [ ] Telegram-Bot (BotFather, Webhook)
- [ ] Regel-Engine: Schwellen, Ruhezeiten, Tageskontingent, Cluster-Dedup
- [ ] Nachrichtenformat mit Inline-Buttons
- [ ] `callback_query`-Handler → schreibt in `interactions`
- [ ] Morgen-Digest um 07:30
- [ ] Einstellungen: Schwellen und Ruhezeiten anpassbar

**Done, wenn:** Eine Woche Betrieb ohne einen einzigen Push, den du im
Nachhinein als überflüssig einstufst.

---

## Phase 8 — Betrieb & Härtung · laufend

- [ ] Grafana + Loki + Promtail
- [ ] Dashboards: Pipeline-Durchsatz, Kosten, Quellen-Gesundheit, Fehlerrate
- [ ] Alarmierung bei stillem Collector-Ausfall (die gefährlichste Fehlerart:
      alles läuft, nur es kommt nichts mehr rein)
- [ ] **Restore-Test** — Backup auf einem frischen Container zurückspielen
- [ ] Rate-Limiting an der API
- [ ] Sicherheits-Review: Dependencies, Secrets, Header
- [ ] Lasttest der Pipeline

**Done, wenn:** Ein absichtlich abgeschalteter Collector löst binnen 30 Minuten
einen Alarm aus, und ein Backup wurde nachweislich einmal zurückgespielt.

---

## Phase 9 — Optional / Ausbau

Nach Lust und Bedarf, in keiner festen Reihenfolge:

- **k3s-Migration** als bewusste DevOps-Übung (ArgoCD, GitOps, Terraform)
- **Lokale Embeddings** (`bge-m3` als ONNX-Service) — Unabhängigkeit statt 9 Cent
- **X/Twitter-Adapter** — falls die Datenauswertung zeigt, dass Storys fehlen
  (siehe ADR-004); mit hartem Spend-Cap
- **Wöchentlicher Rückblick** — Opus 5 fasst die Woche in einem Essay zusammen
- **PWA + Web Push** als Ergänzung zu Telegram
- **Podcast-Modus** — TTS über den Morgen-Digest
- **Öffentlicher Blog-Modus** — kuratierte Storys öffentlich, dann mit
  Datenschutzerklärung

---

## Kritischer Pfad

```
Phase 0 ──▶ Phase 1 ──▶ Phase 2 ──▶ Phase 3 ──▶ Phase 4 ✅ benutzbar
             │                                     │
             └─▶ Phase 1b (parallel)               ├─▶ Phase 5 (Design)
                                                   ├─▶ Phase 6 (Personalisierung)
   Reddit-Freigabe ····························▶   └─▶ Phase 7 (Push)
   (2–4 Wochen Wartezeit, blockiert nichts)                   │
                                                       Phase 8 (Betrieb)
```

Der einzige externe Blocker ist die Reddit-Freigabe — und der ist harmlos, wenn
der Antrag in Phase 0 rausgeht. Alles andere hängt nur an dir.

**Realistische Gesamtdauer bis Phase 4 (benutzbar): 6–7 Wochen.**
**Bis Phase 8 (rund und schön): 12–14 Wochen.**

## Grösste Risiken

| Risiko | Wahrscheinlichkeit | Gegenmassnahme |
|---|---|---|
| Clustering-Qualität enttäuscht | mittel | Kalibrierungsschritt in Phase 2 ist Pflicht, nicht optional |
| Design frisst unbegrenzt Zeit | **hoch** | Phase 5 kommt bewusst *nach* dem funktionierenden Feed |
| Reddit-Freigabe wird abgelehnt | niedrig | Die anderen Quellen tragen; nicht auf Reddit planen |
| LLM-Kosten laufen davon | niedrig | Budget-Guard in Phase 3, vor dem Vollbetrieb |
| Bluesky-Stream instabil | mittel | Phase 1b getrennt, Poll-Quellen laufen unabhängig weiter |
| Motivation nach Phase 3 | **hoch** | Deshalb steht Phase 4 (benutzbar) vor Phase 5 (schön) |

Die letzten beiden Zeilen sind ernst gemeint. Die grösste Gefahr für ein
Feierabendprojekt dieser Grösse ist nicht Technik, sondern der Punkt in Woche 4,
an dem viel gebaut ist und noch nichts Freude macht. Deshalb ist die
Phasenreihenfolge so gewählt, dass es einen benutzbaren Feed gibt, *bevor* das
Design dran ist.
