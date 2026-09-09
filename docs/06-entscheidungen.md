# Entscheidungslog (ADRs)

Jede Entscheidung mit Datum, Kontext und Begründung. Der Punkt ist nicht die
Formalität, sondern dass man in drei Monaten nachvollziehen kann, *warum* etwas
so ist — und ob der Grund noch gilt.

---

## ADR-001 — Ein Profil, mehrere Lesende

**Status:** akzeptiert · 2026-09-09

**Kontext:** Astra ist primär für Noel. Ein bis zwei Freunde sollen mitlesen
können, brauchen aber keinen eigenen personalisierten Feed.

**Entscheidung:** Ein Personalisierungsprofil. Zugang über GitHub OAuth mit
Allowlist. Das Schema trägt trotzdem überall eine `user_id`.

**Konsequenzen:**
- Kein User-Management, kein Onboarding, keine Registrierung
- Ranking und Profilvektor bleiben einfach — kein Cold-Start für neue User
- Die `user_id` kostet jetzt nichts und spart später eine schmerzhafte Migration
- Freunde sehen *Noels* Feed. Das ist Absicht, kein Mangel.

---

## ADR-002 — Self-Hosting auf Hetzner statt PaaS

**Status:** akzeptiert · 2026-09-09

**Kontext:** Noel ist seit einem Monat DevOps Engineer. Das Projekt soll fachlich
weiterbringen, nicht nur ein Produkt liefern. Vercel + Neon wäre schneller live.

**Entscheidung:** Hetzner CX32, Docker Compose, Caddy, GitHub Actions.

**Konsequenzen:**
- Maximaler Lernwert genau dort, wo er beruflich wächst
- Volle Kontrolle über Cron, lang laufende Worker und WebSocket-Verbindungen —
  die auf Vercel alle problematisch wären
- ~7 EUR/Monat statt Free-Tier
- Ops-Aufwand liegt bei ihm: Updates, Backups, Monitoring
- **Bedingung:** Server-Härtung passiert in Phase 0, nicht später

---

## ADR-003 — Budgetrahmen 25–30 CHF/Monat

**Status:** akzeptiert · 2026-09-09

**Entscheidung:** Zielkosten ~20 CHF, Deckel bei 30 CHF, harte Guards im Code.

**Konsequenzen:**
- Modellstaffelung ist Pflicht, nicht Optimierung: Haiku triagiert, Sonnet fasst
  zusammen, Opus nur auf Klick
- Batch API überall dort, wo Latenz egal ist (50% Rabatt)
- Kostenerfassung pro API-Aufruf ab Phase 3
- Tages-Budget-Guard, der die Anreicherung stoppt statt still weiterzulaufen
- Direkte Folge: ADR-004

---

## ADR-004 — Kein X/Twitter

**Status:** akzeptiert · 2026-09-09

**Kontext:** X war ursprünglich als Hauptquelle gedacht. Seit Februar 2026 ist
das API-Modell reines Pay-per-Use bei ~$0.005 pro gelesenem Post; der Gratis-Tier
ist gestrichen, die Flat-Tiers (Basic $200, Pro $5000) sind für neue Entwickler
nicht mehr verfügbar und wurden 2026 zwangsmigriert.

Rechnung: 30 Accounts, 3× täglich, ~50 Posts pro Abruf ≈ 4500 Posts/Monat ≈
**$23/Monat**. Stündliches Polling einer 80-Account-Liste ≈ **$360/Monat**.

**Entscheidung:** X wird nicht implementiert. Das Budget geht in bessere
KI-Zusammenfassungen und häufigere Ingestion.

**Konsequenzen:**
- Bluesky (Jetstream, gratis, unbegrenzt) übernimmt die Social-Signal-Rolle
- Grosse Meldungen erreichen HN ohnehin binnen Minuten — der Verlust ist
  vermutlich klein, aber nicht null
- Das Collector-Interface bleibt so gebaut, dass X ein Adapter unter vielen wäre
- **Überprüfbar:** Der Quellen-Trust-Score aus Phase 4 zeigt nach ein paar
  Wochen datenbasiert, ob relevante Storys fehlen. Dann neu entscheiden — mit
  Zahlen statt Bauchgefühl.

---

## ADR-005 — Clustering vor Ranking

**Status:** akzeptiert · 2026-09-09

**Kontext:** Ein naiver Aggregator zeigt 30 Posts zur gleichen Meldung.

**Entscheidung:** Die Einheit im Datenmodell ist die **Story**, nicht der Post.
Clustering ist ein eigener Pipeline-Schritt vor dem Ranking und nicht optional.

**Konsequenzen:**
- Der Feed wird überhaupt erst lesbar
- `corroboration` (Anzahl unabhängiger Quellen) wird zum stärksten Relevanz-
  signal — und fällt gratis ab
- Die Zusammenfassung sieht alle Quellen gleichzeitig und kann Widersprüche
  benennen
- Dafür: die technisch schwierigste Komponente, mit Kalibrierungsaufwand
- Fehlerkosten sind asymmetrisch → beim Tuning **Recall priorisieren**

---

## ADR-006 — Personalisierung stufenweise, nicht sofort semantisch

**Status:** akzeptiert · 2026-09-09

**Kontext:** Ein reines Embedding-Ranking wäre technisch eleganter, hat aber ein
Cold-Start-Problem und ist schwer zu debuggen.

**Entscheidung:** Drei Stufen — (1) regelbasiert, (2) Embeddings ergänzend,
(3) LLM-Re-Ranking der Spitze.

**Konsequenzen:**
- Nach Phase 4 gibt es einen funktionierenden Feed, ohne Trainingsdaten
- Jede Stufe ist einzeln evaluierbar: man sieht, ob sie etwas verbessert
- Der Regelanteil bleibt dauerhaft drin — er ist der Filterblasen-Schutz
- Zusätzlich ein Exploration-Slot (5%) gegen Eintönigkeit
- LLM-Re-Ranking liefert die Warum-Zeile → das Ranking wird erklärbar

---

## ADR-007 — Telegram für Push

**Status:** akzeptiert · 2026-09-09

**Kontext:** Alternativen waren ntfy (self-hosted, passt zum Ops-Thema),
Web Push/PWA (kein Drittanbieter) und Pushover (kostenpflichtig).

**Entscheidung:** Telegram-Bot.

**Konsequenzen:**
- In unter einer Stunde gebaut und zuverlässig
- **Inline-Buttons** ermöglichen 👍/👎 direkt aus der Nachricht — die
  Benachrichtigung wird Teil der Feedback-Schleife, nicht nur Ausgabe
- Abhängigkeit von Telegram; Benachrichtigungen mischen sich unter Chats
- Web Push bleibt als Ergänzung in Phase 9 offen

---

## ADR-008 — Globus prozedural statt aus Blender

**Status:** akzeptiert · 2026-09-09

**Kontext:** Der Globus ist das zentrale Designelement. Blender sollte gelernt
werden — die Frage war, woran.

**Entscheidung:** Globus prozedural in react-three-fiber aus Geodaten. Blender
für Detail-Assets (Loader, Badges, Icons).

**Konsequenzen:**
- Story-Marker lassen sich datengetrieben platzieren — der Globus zeigt echte
  Daten statt Dekoration
- Design und Funktion hängen zusammen: die Triage extrahiert dafür `geo`
- Blender wird an kleineren, abgeschlossenen Aufgaben gelernt — schnelleres
  Erfolgserlebnis als am Hauptobjekt zu scheitern
- Weniger künstlerische Kontrolle über den Globus selbst; der Look entsteht über
  Material und Punktdichte im Code

---

## ADR-009 — Voyage AI für Embeddings

**Status:** akzeptiert · 2026-09-09

**Kontext:** Anthropic bietet keine Embedding-API. Alternativen: OpenAI oder ein
lokales Modell (`bge-m3`).

**Entscheidung:** `voyage-3.5-lite` (~$0.02/Mio Tokens), hinter einem
Provider-Interface.

**Konsequenzen:**
- ~$0.09/Monat bei erwartetem Volumen — praktisch gratis
- Mehrsprachig, was bei gemischt deutschen/englischen Inhalten zählt
- Kein RAM-Verbrauch auf dem Server (lokal wären ~2.5 GB nötig)
- Externe Abhängigkeit; das Interface hält den Wechsel billig
- **Achtung:** Modell-ID wird pro Story gespeichert. Ein Modellwechsel erzwingt
  einen vollständigen Reindex.

---

## ADR-010 — Kein Kubernetes in Phase 1–8

**Status:** akzeptiert · 2026-09-09

**Kontext:** k3s hätte den grössten Karriere-Lernwert.

**Entscheidung:** Docker Compose auf einem Server. k3s als optionale Phase 9.

**Konsequenzen:**
- Deutlich schneller zu einem laufenden Produkt
- Ein Server, sieben Container — Kubernetes würde hier nichts lösen, was es
  nicht selbst mitbringt
- Als *spätere* Übung sogar besser: eine laufende Anwendung nach k8s zu
  migrieren lehrt mehr als auf der grünen Wiese zu starten

---

## ADR-011 — Zwei gleichwertige Ansichten: Globus und Blog

**Status:** akzeptiert · 2026-09-09

**Kontext:** Der Globus ist das prägende Designelement, aber zum Durcharbeiten
von 40 Storys taugt eine rotierende Kugel nicht. Umgekehrt wäre ein reiner Feed
visuell beliebig.

**Entscheidung:** Zwei Ansichten, umschaltbar im Header — **Globus** (Radar:
Überblick, entdecken) und **Blog** (Zeitung: lesen, aufholen). Beide zeigen
dieselben Storys mit demselben Ranking. Die Wahl wird in `localStorage`
gemerkt; erster Besuch startet im Globus.

**Konsequenzen:**
- Der Globus muss nicht alles können und darf spektakulär sein
- Die Blog-Ansicht ist gleichzeitig der barrierefreie Zwilling — Tastatur- und
  Screenreader-Nutzung ist damit vollständig abgedeckt, ohne den Globus zu
  verbiegen
- **Harte Regel:** Keine Story darf nur in einer Ansicht auftauchen. Sonst wird
  der Globus zur Falle statt zur Ansicht
- Das 3D-Bundle lädt per dynamischem Import erst beim Wechsel zum Globus — wer
  nur liest, zahlt nie dafür
- Auf Mobil gibt es **keinen** Umschalter, nur den Blog (siehe ADR-012)

---

## ADR-012 — Globus-Punkte als primäre Bedienung, nicht als Deko

**Status:** akzeptiert · 2026-09-09

**Kontext:** Ein Globus mit Punkten kann Illustration sein oder Interface. Die
Entscheidung fällt an der Interaktion.

**Entscheidung:** Die leuchtenden Punkte sind vollwertige Bedienelemente:
Hover klappt eine Info-Karte auf (mit Leitlinie zum Punkt), Klick öffnet die
Story in einem Seitenpanel. Dazu datengetriebene Animationen —
Einschlag-Wellen bei neuen Storys, Verbindungsbögen zwischen Orten einer Story,
Tag/Nacht-Grenze in Echtzeit.

**Konsequenzen:**
- Die Triage muss zuverlässig `geo` liefern — ohne Ort kein Punkt. Storys ohne
  ermittelbaren Ort brauchen eine Behandlung (Vorschlag: Sammelmarker "global",
  in Phase 5 zu entscheiden)
- Info-Karten als HTML-Overlay (`<Html>` aus drei/drei), nicht als WebGL-Text —
  scharfe Schrift, selektierbar, barrierefrei
- Immer nur eine Karte gleichzeitig offen, sonst leidet die Performance
- Jede Animation muss etwas Wahres über die Daten aussagen. Bewegung ohne
  Bedeutung fliegt raus
- Mehr Aufwand in Phase 5 — dafür ist der Globus kein Deko-Element, das man
  nach zwei Wochen wegklickt

---

## Vorlage für neue Einträge

```markdown
## ADR-0XX — Titel

**Status:** vorgeschlagen | akzeptiert | überholt durch ADR-0YY · YYYY-MM-DD

**Kontext:** Welches Problem, welche Alternativen?

**Entscheidung:** Was wurde gewählt?

**Konsequenzen:** Was folgt daraus — positiv wie negativ?
```
