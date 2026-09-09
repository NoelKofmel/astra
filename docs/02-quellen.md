# Quellen

Stand: September 2026. Der API-Markt ist in Bewegung — Preise und Zugangsregeln
vor dem Bau jedes Collectors kurz gegenprüfen.

## Übersicht

| Quelle | Auth | Kosten | Modus | Priorität | Risiko |
|---|---|---|---|---|---|
| Hacker News | keine | gratis | poll | **P0** | keins |
| RSS-Feeds | keine | gratis | poll | **P0** | Feeds verschwinden |
| GitHub | Token | gratis | poll | P1 | Rate Limit |
| arXiv | keine | gratis | poll | P1 | keins |
| Bluesky (Jetstream) | keine | gratis | **stream** | P1 | Volumen, Reconnect |
| Hugging Face | optional | gratis | poll | P2 | keins |
| Product Hunt | OAuth | gratis | poll | P2 | Quote |
| Reddit | OAuth | gratis (nicht-kommerziell) | poll | P1 | **Freigabe dauert 2–4 Wochen** |
| Lobsters | keine | gratis | poll | P3 | klein |
| ~~X/Twitter~~ | OAuth | **~$0.005/Post** | — | **gestrichen** | Kosten (ADR-004) |

> ⚠️ **Sofort erledigen:** Reddit-API-Zugang beantragen. Seit der Responsible
> Builder Policy (Ende 2025) gibt es keine Selbstregistrierung mehr — jeder neue
> OAuth-Client durchläuft eine manuelle Freigabe, typischerweise 2–4 Wochen.
> Das ist der einzige Punkt im ganzen Plan mit externer Wartezeit. Wenn der
> Antrag in Phase 0 rausgeht, ist die Freigabe da, wenn Phase 1 sie braucht.

---

## P0 — Fundament

### Hacker News

Über die **Algolia Search API**, nicht die offizielle Firebase-API. Kein Key,
kein Rate Limit in der Praxis, und man kann nach Zeitfenster und Punktzahl
filtern, statt Item-IDs einzeln abzuklappern.

```
https://hn.algolia.com/api/v1/search_by_date?tags=story&numericFilters=created_at_i>{ts},points>20
```

- **Frequenz:** alle 15 Minuten
- **Ausbeute:** ~50–150 Storys/Tag über der Punkteschwelle
- **Nutzen:** Beste Einzelquelle für Tech-News. Die meisten grossen Meldungen
  landen hier binnen Minuten. `points` und `num_comments` sind starke
  Engagement-Signale fürs Ranking.

### RSS / Atom

Der unspektakulärste und verlässlichste Collector. Parser: `rss-parser` oder
`feedparser`. Wichtig: `ETag` und `Last-Modified` senden, sonst lädt man alle
30 Minuten dieselben 40 Feeds komplett neu.

Startset (in `sources.config` gepflegt, jederzeit erweiterbar):

| Kategorie | Feeds |
|---|---|
| Allgemein Tech | Ars Technica, The Verge, TechCrunch, Heise, Golem |
| Engineering | InfoQ, The Pragmatic Engineer, ACM Queue |
| KI | Import AI, The Batch, Simon Willison, Anthropic News, OpenAI Blog |
| Cloud/DevOps | AWS/GCP/Azure What's New, CNCF Blog, Kubernetes Blog |
| Schweiz | Inside IT, Netzwoche |

- **Frequenz:** alle 30 Minuten
- **Nutzen:** Redaktionell aufbereitet und meist mit mehr Kontext als ein
  Social-Post. Als Cluster-Partner ideal — der HN-Thread liefert die Diskussion,
  der RSS-Artikel den belastbaren Text.

---

## P1 — Breite und Tiefe

### Reddit

OAuth2 Client Credentials, `snoowrap` oder direkt gegen die REST-API.

- **Limit:** 100 Requests/Minute pro OAuth-Client (über 10 Minuten gemittelt),
  10/min unauthentifiziert
- **Frequenz:** alle 20 Minuten, `/r/{sub}/new` und `/r/{sub}/top?t=day`
- **Subreddits:** `programming`, `MachineLearning`, `LocalLLaMA`, `devops`,
  `selfhosted`, `webdev`, `rust`, `golang`, `kubernetes`, `netsec`,
  `ExperiencedDevs`, `hardware`
- **Nutzen:** Fachliche Tiefe in den Kommentaren, oft mit Widerspruch zum
  Hype — genau das, was in einer Zusammenfassung fehlt und sie wertvoll macht.

**Die kommerzielle Grenze ist ernst zu nehmen.** Nicht-kommerzielle Nutzung ist
gratis; kommerziell kostet $0.24/1000 Calls und braucht einen ausgehandelten
Vertrag. Astra ist privat und bleibt es — falls das je gewerblich würde, muss
der Reddit-Collector als Erstes abgeschaltet werden.

### Bluesky (Jetstream)

Der technisch interessanteste Collector. **Nicht** den vollen AT-Protocol-
Firehose nehmen: der macht je nach Tageslast 24–232 GB/Tag und liefert
CBOR/CAR-kodierte Merkle-Trees, die man erst dekodieren muss.

**Jetstream** ist die richtige Wahl: gefiltertes JSON, ~850 MB/Tag für *alle*
Posts, serverseitig nach Collection und Repos filterbar, kein API-Key.

```
wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post
```

Zwei Filterstrategien, kombiniert:
1. **Follow-Liste** — ~200 kuratierte Tech-Accounts über `wantedDids`.
   Server-seitig gefiltert, minimales Volumen.
2. **Keyword-Match** auf dem breiteren Strom — fängt Storys von Accounts, denen
   man nicht folgt.

Implementierungsdetails, die man sonst schmerzhaft lernt:
- Exponentielles Reconnect-Backoff mit Jitter. Die Verbindung *wird* abbrechen.
- `cursor` persistieren, damit ein Neustart nicht das Zeitfenster verliert.
- Backpressure: Der Stream ist schneller als die Verarbeitung. Erst in Redis
  puffern, dann in Batches verarbeiten — nicht pro Event in die DB schreiben.
- Health-Check: "Verbindung offen" ist nicht dasselbe wie "Daten kommen an".
  Auf *letztes empfangenes Event* alarmieren, nicht auf den Socket-Status.

### GitHub

Kein offizieller Trending-Endpoint. Zwei brauchbare Wege:
- Search API: `q=created:>{date} stars:>50&sort=stars` — offiziell, gut genug
- Releases wichtiger Repos beobachten (React, Next.js, Postgres, Kubernetes …)

- **Limit:** 5000 Requests/Stunde mit Token
- **Nutzen:** Ergänzt die News um "was benutzen die Leute gerade tatsächlich".
  Ein neues Tool, das an einem Tag 3000 Sterne sammelt, ist eine Story.

### arXiv

Atom-API, kein Key. Kategorien `cs.AI`, `cs.LG`, `cs.CL`, `cs.CR`, `cs.SE`.
Höflichkeitsregel: max. 1 Request alle 3 Sekunden.

- **Frequenz:** 2× täglich
- **Nutzen:** Deckt die "was ist neu in der KI-Forschung"-Schiene ab. Roh
  ziemlich unlesbar — hier zahlt sich die KI-Erklärung am meisten aus.

---

## P2/P3 — Ergänzung

- **Hugging Face** — Daily Papers, neue Modelle mit Traktion. Passt exakt zu
  deinem Ausgangsbeispiel.
- **Product Hunt** — GraphQL, OAuth. Neue Tools und Launches.
- **Lobsters** — `https://lobste.rs/hottest.json`, klein, aber hohe Signaldichte
  und kaum Überschneidung mit HN.

---

## Rechtliches

Astra ist privat, aber ein paar Regeln gelten trotzdem und sind ab Tag 1
billiger einzuhalten als nachträglich einzubauen:

1. **Kein Volltext speichern.** Nur Titel, Metadaten und ein Snippet (≤ 500
   Zeichen). Die inhaltliche Substanz liefert die eigene KI-Zusammenfassung, und
   die ist ein neues Werk.
2. **Immer verlinken und zuschreiben.** Jede Story-Karte nennt ihre Quellen mit
   Link. Das ist auch UX-technisch richtig: der Weiterlese-Weg muss offen sein.
3. **robots.txt und Rate Limits respektieren.** Kein Scraping, wo eine API
   existiert. Ein `User-Agent` mit Kontaktmöglichkeit setzen.
4. **Reddits kommerzielle Grenze** nicht überschreiten (siehe oben).
5. **Falls Astra je öffentlich wird:** Schweizer DSG bedeutet Datenschutz-
   erklärung; ein Impressum ist bei nicht-kommerziellem Betrieb nicht zwingend,
   aber sauberer Stil. Dann auch prüfen, ob die Zusammenfassungen noch als
   eigenständige Werke durchgehen oder zu nah am Original sind.

## Quellenqualität messen

Ab Phase 4 bekommt jede Quelle einen fortlaufend berechneten Trust-Score, der
ins Ranking einfliesst:

```
source_trust = 0.4 · Präzision   (Anteil Items, die es in eine Story schaffen)
             + 0.3 · Erstmeldung (Anteil Storys, wo diese Quelle die schnellste war)
             + 0.3 · Engagement  (Anteil, den du tatsächlich öffnest)
```

Damit reguliert sich der Feed selbst: ein Feed, der nur Rauschen liefert, sinkt
automatisch ab, ohne dass man ihn von Hand abschalten muss. Und die Frage "brauche
ich X/Twitter doch?" wird nach ein paar Wochen datenbasiert beantwortbar statt
Bauchgefühl.
