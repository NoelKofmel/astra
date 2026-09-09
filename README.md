# ASTRA

> Ein personalisierter Tech-News-Aggregator. Sammelt aus vielen Quellen, erkennt
> dass die gleiche Story überall gleichzeitig auftaucht, fasst sie mit KI
> zusammen und erklärt sie — und meldet sich nur, wenn es wirklich relevant ist.

**Status:** Planungsphase abgeschlossen, Umsetzung noch nicht begonnen.

> **Zur Doku:** Alles hier ist **Leitfaden, nicht Anleitung.** Die Dokumente
> halten Richtung und Begründungen fest, damit dieselbe Entscheidung nicht
> dreimal getroffen werden muss. Sie schreiben die Umsetzung nicht vor. Was sich
> beim Bauen als unpraktisch erweist, wird geändert — die Erfahrung am laufenden
> System schlägt jeden Plan auf Papier. Änderungen wandern zurück ins passende
> Dokument, grössere Richtungswechsel bekommen einen Eintrag im
> [Entscheidungslog](docs/06-entscheidungen.md).

## Das Problem

Es gibt keinen guten Ort, an dem man als Informatiker*in die für einen selbst
relevanten Tech-News bekommt. Twitter/X ist Lärm, Reddit ist unstrukturiert,
Newsletter sind zu langsam, HN ist ohne Personalisierung. Wer "Nvidia übernimmt
Hugging Face" mitkriegen will, muss fünf Apps offen haben — und liest die gleiche
Meldung dann in fünf Varianten.

## Die Lösung

Eine Pipeline, die den Lärm zu **Storys** verdichtet statt zu Posts:

```
Quellen  →  Normalisierung  →  Clustering  →  KI-Anreicherung  →  Ranking  →  Feed + Push
```

Der Kern ist das Clustering: HN-Thread, Reddit-Post, TechCrunch-Artikel und
Bluesky-Diskussion zum gleichen Ereignis werden zu **einer** Story mit mehreren
Belegen. Dass eine Story an fünf Orten gleichzeitig auftaucht, ist dabei selbst
das stärkste Relevanzsignal.

## Dokumentation

| Dokument | Inhalt |
|---|---|
| [`docs/01-architektur.md`](docs/01-architektur.md) | Pipeline, Services, Datenmodell, Deployment |
| [`docs/02-quellen.md`](docs/02-quellen.md) | Quellenkatalog, APIs, Rate Limits, Auth-Status |
| [`docs/03-ranking-und-ki.md`](docs/03-ranking-und-ki.md) | Clustering, LLM-Einsatz, Scoring, Kosten |
| [`docs/04-design.md`](docs/04-design.md) | Design-System, Globus, Layout |
| [`docs/05-roadmap.md`](docs/05-roadmap.md) | Phasenplan mit Definition of Done |
| [`docs/06-entscheidungen.md`](docs/06-entscheidungen.md) | Entscheidungslog (ADRs) |
| [`CLAUDE.md`](CLAUDE.md) | Projektkontext für Claude-Code-Sessions |

## Eckdaten

- **Nutzung:** Primär ein Profil (Noel), Lesezugriff für 1–2 Freunde
- **Hosting:** Hetzner VPS, Docker Compose, GitHub Actions CI/CD
- **Quellen:** Hacker News, Reddit, RSS, GitHub Trending, Bluesky, arXiv,
  Hugging Face, Product Hunt — **kein X/Twitter** (siehe ADR-004)
- **KI:** Claude Haiku 4.5 (Triage) → Sonnet 5 (Zusammenfassungen) → Opus 5 (Deep Dive)
- **Push:** Telegram-Bot
- **Budget:** ~20 CHF/Monat bei einem Rahmen von 25–30 CHF

## Lizenz / Inhalte

Privates Projekt. Fremdinhalte werden **nicht** vollständig gespeichert oder
reproduziert — nur Metadaten, kurze Snippets und eigene KI-Zusammenfassungen,
immer mit Link und Quellenangabe. Siehe [`docs/02-quellen.md`](docs/02-quellen.md#rechtliches).
