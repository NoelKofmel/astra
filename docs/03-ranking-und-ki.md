# Clustering, KI-Anreicherung und Ranking

Das inhaltliche Herz von Astra. Drei Teile, die aufeinander aufbauen:
Clustering macht aus Posts Storys, Anreicherung macht sie verständlich, Ranking
entscheidet, was du zuerst siehst.

---

## Clustering

**Aufgabe:** Erkennen, dass ein HN-Thread, zwei Reddit-Posts, ein TechCrunch-
Artikel und 40 Bluesky-Posts vom gleichen Ereignis handeln.

Dreistufig, von billig nach teuer. Jede Stufe fängt ab, was sie kann, und gibt
nur den Rest weiter. Das hält die Kosten bei ein paar Rappen pro Tag.

### Stufe 1 — Exakter URL-Match (~40% der Duplikate, gratis)

Nach der Kanonisierung ist ein `canonical_url`-Match ein sicherer Treffer.
Deckt den häufigsten Fall ab: derselbe Artikel wird auf HN, Reddit und Bluesky
gleichzeitig geteilt.

```sql
SELECT story_id FROM story_items si
  JOIN raw_items ri ON ri.id = si.raw_item_id
 WHERE ri.canonical_url = $1
 LIMIT 1;
```

### Stufe 2 — Titelähnlichkeit (~20%, gratis)

Für Fälle ohne gemeinsame URL: TechCrunch und The Verge schreiben eigene
Artikel über dasselbe Ereignis. `pg_trgm` mit GIN-Index:

```sql
SELECT id, similarity(title, $1) AS sim
  FROM stories
 WHERE last_activity_at > now() - interval '72 hours'
   AND title % $1
 ORDER BY sim DESC LIMIT 5;
```

Schwelle ~0.45. Nur ein Kandidatenvorschlag — die Entscheidung fällt in Stufe 3.

### Stufe 3 — Semantische Ähnlichkeit (der Rest, ~0.02 $/Mio Tokens)

Embedding aus `Titel + erste ~200 Wörter`, Kosinus-Ähnlichkeit gegen alle
Storys der letzten 72 Stunden über einen HNSW-Index:

```sql
SELECT id, 1 - (embedding <=> $1) AS sim
  FROM stories
 WHERE last_activity_at > now() - interval '72 hours'
 ORDER BY embedding <=> $1 LIMIT 5;
```

Drei Zonen:

| Similarity | Entscheidung |
|---|---|
| ≥ 0.86 | Gleiche Story — anhängen |
| 0.74 – 0.86 | **Unsicher → Stufe 4** |
| < 0.74 | Neue Story |

Die Schwellenwerte sind Startwerte, keine Wahrheiten. Sie müssen kalibriert
werden (siehe unten).

### Stufe 4 — LLM-Schiedsrichter (nur die Grauzone, ~20–40 Fälle/Tag)

Claude Haiku 4.5 bekommt beide Titel plus Snippets und antwortet mit Structured
Output:

```json
{ "same_story": true, "confidence": 0.91, "reason": "Beide über die Übernahme..." }
```

Kosten: ~30 Fälle/Tag × ~600 Tokens ≈ 0.5 Mio Tokens/Monat ≈ **$0.30**.
Vernachlässigbar — und es rettet genau die Fälle, an denen reine Ähnlichkeits-
masse scheitern ("Nvidia kauft Hugging Face" vs. "Was die HF-Übernahme für
Open-Source-KI bedeutet": semantisch ähnlich, aber zwei verschiedene Storys).

### Kalibrierung — nicht überspringen

Ohne Messung sind die Schwellenwerte geraten. Der Plan:

1. Einen Tag Rohdaten sammeln.
2. 100 Paare von Hand labeln (gleiche Story: ja/nein). Dauert ~45 Minuten.
3. Precision und Recall über einen Schwellenwert-Sweep von 0.70 bis 0.92 messen.
4. **Recall priorisieren.** Zwei getrennte Karten für dieselbe Story sind ein
   Schönheitsfehler; zwei verschiedene Storys fälschlich zusammengeworfen ist
   ein Datenverlust — die eine verschwindet dann aus dem Feed.
5. Als Regressionstest in `vitest` festhalten, damit spätere Änderungen am
   Embedding-Modell nicht still etwas kaputtmachen.

### Embeddings

Anthropic bietet keine Embedding-API. Gewählt: **Voyage AI `voyage-3.5-lite`**
(~$0.02/Mio Tokens, 32k Kontext, mehrsprachig — wichtig bei gemischten
deutschen und englischen Inhalten).

Bei ~500 Storys/Tag × ~300 Tokens ≈ 4.5 Mio Tokens/Monat ≈ **$0.09/Monat**.

Hinter einem Interface, damit ein Wechsel eine Konfigurationsänderung bleibt:

```ts
interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  readonly dimensions: number;
  readonly id: string;   // wird pro Story gespeichert — Modellwechsel erzwingt Reindex
}
```

Alternative für später: `bge-m3` lokal in einem kleinen ONNX-Service. Gratis und
unabhängig, braucht aber ~2.5 GB RAM. Auf dem CX32 machbar, aber erst wenn der
Rest stabil läuft — der Betriebsaufwand ist grösser als die 9 Cent, die es spart.

---

## KI-Anreicherung

### Modellstaffelung

Der Kostenhebel schlechthin: nicht jede Story braucht das teuerste Modell.

| Stufe | Modell | Menge | Aufgabe |
|---|---|---|---|
| **Triage** | `claude-haiku-4-5` | alle (~300/Tag) | Wichtigkeit, Themen, Entitäten, Ort, Rausch-Flag |
| **Zusammenfassung** | `claude-sonnet-5` | Top ~50/Tag | Kurzfassung, Erklärung, Einordnung |
| **Deep Dive** | `claude-opus-5` | auf Klick (~30/Monat) | Tiefe Analyse, Rückfragen |

Beide Batch-Stufen laufen über die **Batch API** (50% Rabatt). Ingestion ist
nicht latenzkritisch — 20 Minuten Verzögerung merkt niemand, halber Preis schon.

### Triage-Prompt (Haiku 4.5)

Structured Output, damit nichts geparst werden muss:

```json
{
  "importance": 0,          // 0-100
  "is_noise": false,        // Werbung, Repost, reines Meme
  "topics": ["ai-infra", "acquisitions"],
  "entities": { "orgs": ["Nvidia", "Hugging Face"], "people": [], "tech": [] },
  "geo": { "place": "Santa Clara, CA", "lat": 37.35, "lon": -121.96 },
  "why_matters": "Ein Satz."
}
```

`geo` speist die Punkte auf dem Globus — deshalb steht es hier und nicht in
einem separaten Schritt. Der Globus ist so kein Deko-Element, sondern eine
Visualisierung echter Daten.

### Zusammenfassungs-Prompt (Sonnet 5)

Bekommt **alle** `raw_items` einer Story — genau das ist der Vorteil des
Clusterings. Das Modell sieht die Meldung, die Diskussion und die Gegenrede
gleichzeitig und kann sie gegeneinander abgleichen.

Ausgabe:
- `summary_short` — 2–3 Sätze, was passiert ist
- `explainer` — 4–6 Sätze, für jemanden ohne Vorwissen im Thema. Das ist das
  Feature, das Astra von einem RSS-Reader unterscheidet.
- `context` — Einordnung: was ging voraus, was folgt daraus
- `disagreement` — falls die Quellen sich widersprechen, wird das benannt statt
  weggeglättet

### Prompt-Caching

Die System-Prompts sind stabil und cachebar — mit einem Haken, der wichtig ist:

| Modell | Cache-Minimum |
|---|---|
| Opus 5 | 512 Tokens |
| Sonnet 5 | 1024 Tokens |
| **Haiku 4.5** | **4096 Tokens** |

Ein kurzer Triage-Prompt auf Haiku **cached nicht** und erzeugt trotzdem stillen
Overhead — kein Fehler, nur `cache_creation_input_tokens: 0`. Zwei Optionen:
Caching auf Haiku weglassen (der Batch-Rabatt trägt ohnehin den Grossteil), oder
den Prompt mit Few-Shot-Beispielen über 4096 Tokens bringen, was die Qualität
gleich mit verbessert. Zweiteres testen, ersteres als Rückfall.

### API-Fallstricke (Stand September 2026)

Kostet sonst eine Stunde Debugging:

- **Kein `temperature`/`top_p`/`top_k`** auf Opus 5 und Sonnet 5 → 400.
  Steuerung läuft über den Prompt und `output_config.effort`.
- **Kein Assistant-Prefill** → 400. Stattdessen `output_config.format`.
- `output_config: { format: … }`, **nicht** das veraltete `output_format`.
- Opus 5 denkt standardmässig. `thinking: {type:"disabled"}` geht nur bis
  `effort: "high"`; darüber 400.
- Modell-IDs exakt: `claude-haiku-4-5`, `claude-sonnet-5`, `claude-opus-5` —
  keine Datums-Suffixe anhängen.
- Batch-Ergebnisse kommen **in beliebiger Reihenfolge** zurück → immer über
  `custom_id` zuordnen, nie über die Position.

### Kostenmodell

Annahmen: ~300 geclusterte Storys/Tag, ~50 davon relevant genug für eine
vollständige Zusammenfassung.

| Posten | Rechnung | $/Monat |
|---|---|---|
| Triage (Haiku, Batch) | 300/Tag × 400 in + 100 out | ~4.05 |
| Zusammenfassung (Sonnet, Batch) | 50/Tag × 1500 in + 500 out | ~9.00 |
| Cluster-Schiedsrichter (Haiku, Batch) | ~30/Tag × 600 | ~0.30 |
| Deep Dive (Opus, on demand) | 30/Monat × 3000 in + 1000 out | ~1.20 |
| Embeddings (voyage-3.5-lite) | 4.5 Mio Tokens | ~0.09 |
| **KI gesamt** | | **~$14.6** |

Plus Infrastruktur:

| Posten | CHF/Monat |
|---|---|
| Hetzner CX32 | ~6.50 |
| Domain | ~1.50 |
| Backup-Speicher | ~1.00 |
| KI (siehe oben, ~$14.6) | ~11.70 |
| **Gesamt** | **~20.70** |

Innerhalb des Rahmens von 25–30 CHF, mit Luft für Experimente.

**Kostenkontrolle** ab Phase 3, nicht später:
- Jeder API-Call schreibt `cost_usd` in `job_runs`
- Tages-Budget-Guard: bei Überschreitung stoppt die Anreicherung und schickt
  eine Telegram-Warnung
- Dashboard mit Kosten pro Story und pro Quelle — beantwortet nebenbei, welche
  Quelle ihr Geld wert ist

---

## Ranking

Dreiphasig gebaut. Jede Phase ist für sich benutzbar, was wichtig ist: du hast
nach Phase 4 einen funktionierenden Feed, nicht erst nach Phase 6.

### Phase 1 — Regelbasiert (erklärbar, kein Cold Start)

```
score = 0.20 · source_trust           // gelernter Quellen-Score
      + 0.25 · topic_match            // Übereinstimmung mit gesetzten Themengewichten
      + 0.20 · recency                // score / (alter_h + 2)^1.5, HN-Stil
      + 0.25 · corroboration          // log(1 + anzahl_unabhängiger_quellen)
      + 0.10 · engagement_z           // normalisiert je Quelle
```

`corroboration` ist der interessanteste Term und ein Geschenk des Clusterings:
Eine Story auf fünf unabhängigen Quellen innerhalb von sechs Stunden ist fast
immer wichtig. Diese Information hat ein einzelner RSS-Reader schlicht nicht.

Die Normalisierung von `engagement` **pro Quelle** ist notwendig: 500 Punkte auf
HN und 500 Upvotes in r/programming bedeuten nicht dasselbe.

### Phase 2 — Semantische Personalisierung

Ein Profilvektor, fortgeschrieben als exponentiell gleitender Durchschnitt über
die Storys, mit denen du interagierst:

```
profile = normalize( (1-α)·profile + α·Σ(gewicht_k · embedding_k) )

gewicht:  open +0.3 | dwell>60s +0.6 | save +1.0 | up +1.0 | hide −0.8 | down −1.0
α ≈ 0.05
```

Dann:

```
final = 0.6 · regel_score + 0.4 · cosine(profile, story.embedding)
```

Wichtig: Der Regel-Score bleibt drin. Ein reines Ähnlichkeitsranking baut eine
Filterblase — es zeigt immer mehr vom Gleichen. Der `corroboration`- und
`recency`-Anteil sorgt dafür, dass objektiv Wichtiges durchkommt, auch wenn es
nicht ins bisherige Profil passt.

Zusätzlich **5% Exploration**: ein garantierter Slot für etwas ausserhalb des
Profils, deutlich als solcher markiert. Kostet fast nichts und verhindert, dass
der Feed über Monate langsam eintönig wird.

### Phase 3 — LLM Re-Ranking

Die Top 30 gehen an Haiku/Sonnet, zusammen mit dem Profil als Text:

> "Noel ist Informatiker, DevOps Engineer, interessiert an Infrastruktur,
> KI-Tooling und Systemdesign. Weniger an Krypto und Startup-Finanzierung.
> Ordne diese 30 Storys nach Relevanz für ihn und begründe jede in einem Satz."

Der Rückgabewert enthält für jede Story eine **Warum-Zeile** — die wird im UI
angezeigt. Damit wird das Ranking sichtbar und diskutierbar statt Blackbox, und
wenn es danebenliegt, sieht man sofort, warum.

Kosten: 1× täglich, ~30 Storys × 300 Tokens ≈ 9k Tokens → wenige Cent/Monat.

### Explizite Kontrolle

Neben allem Gelernten immer manuelle Regler:
- Themengewichte (`ai-infra: hoch`, `crypto: aus`)
- Stummschaltung für Keywords und Domains
- "Weniger davon" direkt auf der Story-Karte

Bei einem einzigen Nutzer sind explizite Einstellungen oft besser als gelerntes
Verhalten — du weisst schliesslich selbst, was dich interessiert. Das Gelernte
ergänzt, es ersetzt nicht.

---

## Benachrichtigungen (Telegram)

**Grundsatz:** Eine Benachrichtigung zu viel ist schlimmer als eine zu wenig.
Wer eine News-App stummschaltet, kommt nicht zurück.

Regel-Engine:

```
push wenn:
    importance ≥ 70
UND personal_score ≥ 0.6
UND nicht bereits für diesen Cluster gepusht
UND ausserhalb der Ruhezeit (22:00–07:00 Europe/Zurich)
UND Tageskontingent nicht erschöpft (Standard: 4)
```

Zwei Modi:
- **Breaking** — sofort, nur bei `importance ≥ 85`
- **Digest** — 07:30 Uhr, die Top 5 der Nacht in einer Nachricht

Die Telegram-Nachricht bekommt **Inline-Buttons**:

```
📡 Nvidia übernimmt Hugging Face für 12 Mrd. USD

Nvidia kauft die grösste Open-Source-KI-Plattform. Damit
kontrolliert ein Hardwarehersteller die zentrale
Verteilstelle für offene Modelle.

Quellen: HN (1.2k) · TechCrunch · Bluesky (340)

[ Im Feed öffnen ]  [ 👍 ]  [ 👎 ]  [ 🔕 Thema ]
```

Die Feedback-Buttons schreiben direkt in `interactions` und trainieren damit den
Profilvektor. Das ist der eleganteste Teil der Schleife: die Benachrichtigung,
die dich stört, macht das System sofort besser darin, dich nicht zu stören.

Technisch: Bot via BotFather, `sendMessage` mit `MarkdownV2` (Escaping beachten!),
`callback_query`-Webhook für die Buttons. Für lokale Entwicklung Polling statt
Webhook, sonst braucht man einen Tunnel.
