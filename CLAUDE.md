# CLAUDE.md — Projektkontext

Kontext für Claude-Code-Sessions in diesem Repo. Kurz halten und aktuell halten —
diese Datei wird bei jeder Session geladen.

## Was ist Astra

Personalisierter Tech-News-Aggregator. Sammelt aus vielen Quellen, **clustert
Duplikate zu Storys**, reichert sie mit Claude an, rankt personalisiert und
pusht Relevantes per Telegram.

Die zentrale Idee: Die Einheit ist die **Story**, nicht der Post. Ein Ereignis
erzeugt 30 Posts auf 6 Plattformen — daraus wird eine Karte mit 30 Belegen.
Dass eine Story mehrfach unabhängig auftaucht, ist gleichzeitig das stärkste
Relevanzsignal.

**Nutzer:** Noel (Informatiker, DevOps Engineer, Schweiz). Ein Profil, 1–2
Lesegäste. Kommunikation auf Deutsch, Schweizer Rechtschreibung (`ss`, kein `ß`).

## Status

**Planungsphase abgeschlossen. Noch kein Anwendungscode.** Als Nächstes: Roadmap
Phase 0 (`docs/05-roadmap.md`).

## Dokumentation zuerst lesen

| Frage | Dokument |
|---|---|
| Wie ist das System aufgebaut? | `docs/01-architektur.md` |
| Welche Quelle, welche API, welche Limits? | `docs/02-quellen.md` |
| Wie funktionieren Clustering/KI/Ranking? | `docs/03-ranking-und-ki.md` |
| Farben, Fonts, Globus, Layout? | `docs/04-design.md` |
| Was ist als Nächstes dran? | `docs/05-roadmap.md` |
| Warum ist X so entschieden? | `docs/06-entscheidungen.md` |

Bei Architekturfragen: **immer erst das ADR-Log prüfen.** Vieles ist bereits
entschieden und begründet.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript `strict` · Tailwind CSS v4 ·
Drizzle ORM · Postgres 17 + pgvector + pg_trgm · Redis + BullMQ ·
react-three-fiber · Zod · Vitest + Playwright

Monorepo: pnpm Workspaces + Turborepo.
`apps/web`, `apps/worker`, `packages/{db,core,ai,ui}`, `infra/`

Deployment: Hetzner CX32 · Docker Compose · Caddy · GitHub Actions → GHCR → SSH

## Claude-API — Regeln für dieses Projekt

**Modelle nach Aufgabe:**

| Aufgabe | Modell | Warum |
|---|---|---|
| Triage aller Storys | `claude-haiku-4-5` | Volumen, billig |
| Zusammenfassung Top-Storys | `claude-sonnet-5` | Qualität pro Franken |
| Deep Dive auf Klick | `claude-opus-5` | selten, darf teuer sein |

**Immer beachten** (sonst 400-Fehler oder stille Kostenfallen):

- **Batch API** für alles Nicht-Latenzkritische → 50% Rabatt. Ergebnisse kommen
  in beliebiger Reihenfolge zurück → **immer über `custom_id` zuordnen**, nie
  über die Position.
- **`output_config: { format: … }`** für strukturierte Ausgaben.
  Nicht das veraltete `output_format`.
- **Kein `temperature` / `top_p` / `top_k`** auf Opus 5 und Sonnet 5 → 400.
  Steuerung über Prompt und `output_config.effort`.
- **Kein Assistant-Prefill** → 400.
- **Opus 5 denkt standardmässig.** `thinking: {type:"disabled"}` nur bis
  `effort: "high"`, darüber 400.
- **Prompt-Caching-Minimum:** Opus 5 = 512 Tokens, Sonnet 5 = 1024,
  **Haiku 4.5 = 4096**. Ein kurzer Haiku-Prompt cached nicht — kein Fehler, nur
  `cache_creation_input_tokens: 0`.
- **Modell-IDs exakt** wie oben, ohne Datums-Suffix.
- **Jeder Aufruf schreibt `cost_usd`** in `job_runs`. Kein API-Call ohne
  Kostenerfassung.

Embeddings kommen **nicht** von Anthropic → Voyage AI `voyage-3.5-lite` hinter
dem `EmbeddingProvider`-Interface.

## Konventionen

**TypeScript**
- `strict: true`, kein `any`. Bei echter Unsicherheit `unknown` + Zod-Parse.
- Externe Daten (API-Antworten, Feeds, Webhooks) werden **immer** durch ein
  Zod-Schema geparst. Kein `as SomeType` auf Fremddaten.
- Typen aus dem Drizzle-Schema ableiten, nicht parallel definieren.

**Datenbank**
- Migrationen **additiv**. Spalte hinzufügen ja, umbenennen/löschen nur in einem
  eigenen, bewusst geplanten Schritt — sonst überlebt kein Rollback.
- Jede Query, die im Feed-Pfad läuft, braucht einen Index. Bei Unsicherheit
  `EXPLAIN ANALYZE` laufen lassen.

**Collectors**
- Ein Adapter pro Quelle hinter dem `Collector`-Interface. Nichts ausserhalb des
  Adapters darf quellenspezifisch sein.
- Rate Limits respektieren. `User-Agent` mit Kontaktmöglichkeit setzen.
- Fehler in einer Quelle dürfen andere nie beeinträchtigen (Circuit Breaker).
- **Kein Volltext von Fremdartikeln speichern** — Snippet ≤ 500 Zeichen plus
  Link. Siehe `docs/02-quellen.md#rechtliches`.

**Frontend**
- Server Components als Standard, `"use client"` nur wo nötig.
- Design-Tokens aus `@theme` verwenden, **nie** Farbwerte hart schreiben.
- Alle Animationen respektieren `prefers-reduced-motion`.
- Der 3D-Globus wird auf Mobil **nicht geladen** (dynamischer Import hinter
  Breakpoint-Prüfung), nicht nur versteckt.

**Tests**
- Reine Logik (Scoring, Clustering, URL-Kanonisierung): Vitest, hohe Abdeckung.
- Die Clustering-Schwellenwerte haben einen **Regressionstest** auf dem
  gelabelten Datensatz. Nicht ohne erneute Messung ändern.
- Kritische Flows: Playwright.

## Befehle

*(werden in Phase 0 eingerichtet — hier eintragen, sobald vorhanden)*

```bash
pnpm dev            # Web + Worker lokal
pnpm db:migrate     # Migrationen anwenden
pnpm db:studio      # Drizzle Studio
pnpm test           # Vitest
pnpm lint && pnpm typecheck
docker compose -f infra/docker-compose.dev.yml up -d   # Postgres + Redis
```

## Arbeitsweise

- **Die Docs sind ein Leitfaden, keine Anleitung.** Sie halten Richtung und
  Begründungen fest, damit man nicht dreimal dasselbe entscheidet — nicht, um
  die Umsetzung vorzuschreiben. Vieles darin ist ein *Vorschlag*, der sich beim
  Bauen als unpraktisch, zu aufwendig oder schlicht falsch herausstellen kann.
  Dann gilt: **Noels Urteil am laufenden System schlägt jedes Dokument.**
  Abweichen ist normal und braucht keine Rechtfertigung — nur eine Notiz im
  betroffenen Dokument, damit es nicht auseinanderdriftet.
- **Detail entsteht beim Bauen.** Feinheiten werden festgelegt, *wenn* die
  jeweilige Phase drankommt, nicht auf Vorrat. Neue Features oder Erkenntnisse
  unterwegs: direkt ins passende Dokument, nicht in einem Chat versanden lassen.
  Grössere Richtungswechsel bekommen einen ADR.
- **Roadmap-Phasen der Reihe nach.** Die Reihenfolge ist bewusst gewählt:
  benutzbarer Feed (Phase 4) *vor* Design (Phase 5).
- Bei Architekturentscheidungen: neuen ADR in `docs/06-entscheidungen.md`
  anlegen, nicht still im Code entscheiden.
- Kosten sind ein Feature. Bei jeder KI-Änderung mitdenken, was sie pro Monat
  kostet.
- Keine Secrets ins Repo. `.env` ist ignoriert, `.env.example` gepflegt.

## Offene Punkte

- [ ] Reddit-API-Freigabe beantragen (2–4 Wochen Wartezeit) — **blockiert Phase 1**
- [ ] Screenshots der TikTok-Design-Referenzen von Noel
- [ ] Typografie-Richtung A oder B entscheiden (`docs/04-design.md`)
- [ ] Domain registrieren
