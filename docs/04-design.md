# Design

## Konzept: Glutkonsole

Die Vorgabe war "modern und gleichzeitig alt, dunkel mit orangen Akzenten, wie
ein altes Nintendo-Spiel". Die Referenz (Sci-Fi-Spiel-UI, siehe unten) hat das
präzisiert: keine goldene Bernsteinröhre, sondern eine **Kommandokonsole** —
dunkle, kühle Inhaltsflächen, gefasst in heiss glühendes Rot-Orange.

Drei Prinzipien, direkt aus der Referenz abgeleitet:

**1 · Orange ist Rahmen, nicht Fläche.**
Das Glühen sitzt in den Kanten, Rändern und Trennlinien. Inhaltsflächen bleiben
dunkel. Das ist der Grund, warum die Referenz edel statt grell wirkt — und die
schärfere Fassung der Faustregel "maximal 10% der Fläche".

**2 · Warm-Kalt-Kontrast.**
Warmes Chrom aussen, kühler Inhalt innen. Der Gegenakzent (Teal) trägt einen
guten Teil der Wirkung — ohne ihn kippt Monochrom-Orange schnell ins Eintönige.
Er wird sparsam eingesetzt: für Live- und Neu-Zustände.

**3 · Röhrenglühen als Textur, nicht als Kostüm.**
Scanlines, Bloom an den Kanten, leichtes Nachglühen. Das gibt die "alte"
Anmutung über **Licht** statt über Schriftauflösung — ein durchgehender
Pixelfont wird nach zwei Minuten Lesen anstrengend, ein Glühen nie.

Also: Astra sieht nicht aus wie ein Terminal *mit* Retro-Effekten, sondern wie
eine Konsole, die es nie gab. Alt in der Anmutung, modern in Typografie, Grid
und Motion.

> **Referenz:** Screenshot einer Sci-Fi-Spiel-UI (Noel, 2026-09-09). Übernommen
> wurde der **Farbeindruck** — heisses Rot-Orange als glühende Rahmenfassung,
> dunkler kühler Inhalt, Teal als Gegenakzent. Nicht übernommen: die dichte
> Panel-Schachtelung und die Informationsdichte; Astra ist ein Lesewerkzeug,
> kein Strategiespiel-HUD. Die Hex-Werte unten sind aus einem Foto geschätzt —
> die *Richtung* stimmt, die exakten Werte werden in Phase 5 am Bildschirm
> feinjustiert.

---

## Farbpalette

```css
:root {
  /* Grund — Schwarz mit warmem Rotstich, nie reines #000 */
  --bg:            #0C0A0A;
  --bg-elevated:   #16110F;
  --surface:       #1E1512;   /* Panelflächen: dunkel, warm getönt */

  /* Rahmen — die tragende Struktur */
  --border:        #3A211A;   /* ruhend */
  --border-hot:    #FF5B33;   /* aktiv / fokussiert / glühend */

  /* Text — warmes Off-White, nie reines Weiss */
  --text:          #F0E6E0;
  --text-muted:    #9A8A83;
  --text-dim:      #5F514B;

  /* Glut — heisses Rot-Orange, aus der Referenz */
  --ember:         #FF5B33;   /* Primär: Rahmen, Marker, Akzenttext */
  --ember-bright:  #FF8055;   /* Hover, Spitzlichter */
  --ember-core:    #E8431F;   /* Sättigungskern — Flächen, nie Kleintext */
  --ember-deep:    #A82D14;   /* ruhende Ränder, Drahtgitter */
  --ember-glow:    rgba(255, 91, 51, 0.40);
  --ember-wash:    rgba(255, 91, 51, 0.05);   /* Flächen-Tönung */

  /* Gegenakzent — kühl, wie die Innenräume der Referenz. Sparsam! */
  --coolant:       #4FC3B0;   /* "neu", "live", frische Daten */
  --coolant-deep:  #2E7A6E;

  /* Semantik */
  --signal-high:   var(--ember);
  --signal-new:    var(--coolant);
  --signal-mute:   #4A423F;
}
```

**Die drei Regeln:**

1. **Glut ist Struktur, nicht Fläche.** Rahmen, Trennlinien, Ränder, Marker.
   Grosse orange Flächen gibt es nicht. Wenn alles leuchtet, leuchtet nichts —
   Faustregel weiterhin ~10% der sichtbaren Fläche.
2. **Wichtigkeit wird über Leuchtintensität abgestuft, nicht über Grösse.** Eine
   94er-Story hat einen helleren Rahmen als eine 71er, nicht eine grössere Karte.
3. **Teal ist ein Gewürz.** Nur für "neu" und "live". Sobald es als zweite
   Markenfarbe auftritt, ist der Warm-Kalt-Kontrast verbraucht.

**Kontrast:** `--text` auf `--bg` liegt bei ~15.6:1 (WCAG AAA). `--ember` auf
`--bg` bei ~6.3:1 — reicht für normalen Text. `--ember-core` ist dunkler und
gehört auf Flächen und Ränder, **nicht** unter 16px Text. Reines Weiss und
reines Schwarz kommen im ganzen Projekt nicht vor.

---

## Typografie

Zwei Richtungen zur Auswahl. Beide sind kostenlos und selbst hostbar (kein
Google-Fonts-CDN — DSG-freundlich und schneller).

### Richtung A — "Terminal" *(Empfehlung)*

| Rolle | Font | Warum |
|---|---|---|
| Display / H1–H2 | **Departure Mono** | Pixel-Anmutung, aber modern gezeichnet und in grossen Graden gestochen scharf |
| Body / UI | **Geist Mono** oder **IBM Plex Mono** | Monospace, gut lesbar über lange Strecken |
| Zahlen / Metadaten | gleiche Familie, `tabular-nums` | Werte springen beim Ticken nicht |

Durchgehend Monospace. Wirkt technisch und konsequent, unterstützt die
Terminal-Metapher. Risiko: bei sehr langen Erklärtexten etwas anstrengend.

### Richtung B — "Kontrast"

| Rolle | Font | Warum |
|---|---|---|
| Display | **Silkscreen** oder **Pixelify Sans** | Deutlich stärkerer Retro-Akzent |
| Body | **Space Grotesk** | Proportional, angenehm auf Länge, mit eigenem Charakter |
| Code / Meta | **JetBrains Mono** | |

Kräftigerer Bruch zwischen Retro-Headline und moderner Fliesstext-Schrift.
Lesbarer bei langen Texten, aber weniger "aus einem Guss".

**Vermeiden:** Inter, Roboto, Arial, System-Fonts. Die sind der visuelle
Gleichmacher, den man an KI-generierten Seiten sofort erkennt.

**Skala** (Major Third, 1.25):
`12 · 14 · 16 · 20 · 25 · 31 · 39 · 49 px` — Body 16, Story-Titel 20, Section 25,
Hero 39–49.

---

## Retro-Effekte

Alle Effekte sind **abschaltbar** (Einstellung + automatisch bei
`prefers-reduced-motion`) und bewusst dezent dosiert. Der Unterschied zwischen
stilvoll und Kirmes liegt hier bei etwa 3% Deckkraft.

| Effekt | Umsetzung | Dosierung |
|---|---|---|
| Scanlines | `repeating-linear-gradient`, 2px Raster, Overlay | 3% Deckkraft |
| Phosphor-Glow | `text-shadow: 0 0 12px var(--ember-glow)` | nur auf Akzentelementen |
| Vignette | radialer Verlauf an den Rändern | sehr subtil |
| Boot-Sequenz | Typewriter-Zeilen beim ersten Laden | 1×, überspringbar, in `localStorage` gemerkt |
| Chromatische Aberration | ±0.5px roter/blauer Versatz | nur auf Hover bei H1 |
| Flicker | minimale Opazitätsschwankung | fast unmerklich, **nie** bei reduced-motion |
| CRT-Rundung | `border-radius` 2px, keine weichen Ecken | durchgängig |

**Bewusst nicht:** Übertriebene Barrel-Distortion, animierte Static-Noise-Layer,
Terminal-Cursor überall. Das kippt schnell ins Kostümhafte und kostet
Performance.

---

## Der Globus

Zentrales Element und **keine Deko**: Er zeigt echte Daten. Jede Story bekommt
in der Triage ein `geo`-Feld (Firmensitz, Ereignisort) — der Globus visualisiert,
wo gerade etwas passiert.

### Technik

Prozedural mit react-three-fiber statt aus Blender importiert. Grund: Nur
generierte Geometrie lässt sich datengetrieben bespielen. Ein statisches
glTF-Mesh mit Live-Datenpunkten zu verheiraten ist deutlich mühsamer als beides
aus einer Hand zu bauen.

**Aufbau (drei Layer):**

1. **Drahtgitter-Sphäre** — `IcosahedronGeometry(radius, 4)` als Wireframe,
   `--ember-deep` bei ~15% Deckkraft. Gibt die Form.
2. **Landmassen als Punktwolke** — Natural Earth 110m GeoJSON, gesampelt auf
   ~10 000 Punkte, als `THREE.Points` mit additivem Blending. Das ist der
   charakteristische Look: kein texturierter Globus, sondern eine Skizze aus
   Licht — genau das "nur grob skizziert" aus deiner Beschreibung.
3. **Story-Marker** — leuchtende Punkte an `geo`-Positionen, Grösse und
   Intensität nach `importance`. Neue Storys pulsieren kurz. Klick öffnet die
   Story.

### Interaktion mit den Punkten

Die leuchtenden Punkte sind das Herzstück der Bedienung, nicht nur Deko. Drei
Ebenen, die aufeinander aufbauen:

**1 · Ruhe** — Punkt leuchtet in Glut-Orange, Grösse und Intensität nach
`importance`. Neue Storys pulsieren die ersten Minuten.

**2 · Hover → Karte klappt auf**

Beim Überfahren passiert Folgendes, in dieser Reihenfolge:

```
  Punkt wird heller + skaliert 1.0 → 1.6      (140ms, ease-out)
        ↓
  Dünne Leitlinie zeichnet sich zum Kasten    (180ms, Länge 0 → 48px)
        ↓
  Kasten klappt auf                            (200ms, scaleY 0.7 → 1 + fade)
```

```
                    ┌───────────────────────────────┐
                    │ 94 ▓▓▓▓▓        vor 2 Std     │
                   ╱│                               │
                  ╱ │ Nvidia übernimmt              │
                 ╱  │ Hugging Face                  │
      ●━━━━━━━━━╱   │                               │
   (Marker)         │ HN 1.2k · TechCrunch · Bluesky│
                    │ ▸ KI-Infra  ▸ Übernahmen      │
                    └───────────────────────────────┘
```

Details, die den Unterschied machen:
- **120ms Verzögerung** vor dem Aufklappen — sonst flackert es, wenn die Maus
  über den Globus wandert. Beim Verlassen sofort schliessen.
- **Autorotation pausiert** beim Hover und läuft nach ~800ms wieder an.
- Die Karte wird als **HTML-Overlay** gerendert (`<Html>` aus drei/drei), nicht
  als WebGL-Text — Schrift bleibt so gestochen scharf und selektierbar.
- Sie folgt dem Punkt, während der Globus sich dreht, und **kippt automatisch
  auf die andere Seite**, wenn sie sonst aus dem Viewport laufen würde.
- Immer nur **eine** Karte gleichzeitig offen.

**3 · Klick → Story öffnet sich**

Ein Panel fährt von rechts ein (280ms), der Globus rückt nach links und dreht
weiter. Die volle Story: Zusammenfassung, Erklärung, Einordnung, alle Quellen
mit Links, 👍/👎. Der zugehörige Punkt bleibt hervorgehoben, damit der Bezug
sichtbar bleibt. `Esc` oder Klick daneben schliesst.

### Weitere Globus-Animationen

Über die Marker hinaus — jede erzählt etwas Wahres über die Daten, keine ist
reine Zierde:

| Animation | Auslöser | Wirkung |
|---|---|---|
| **Einschlag-Welle** | neue Story eingetroffen | Ring läuft vom Punkt aus, ~2s, verblasst |
| **Verbindungsbogen** | Story mit mehreren Orten | Grosskreis-Bogen zeichnet sich zwischen den Punkten (z.B. Santa Clara ↔ Paris bei einer Übernahme) |
| **Dichte-Glühen** | viele Storys in einer Region | Region glimmt wärmer — zeigt, wo gerade "was los" ist |
| **Tag/Nacht-Grenze** | echte UTC-Zeit | Terminator-Linie wandert über den Globus. Kostet fast nichts und macht spürbar, dass die Ansicht live ist |
| **Ingest-Puls** | neue Daten eingesammelt | kurzer Puls am Äquatorring — ambientes "es lebt" |
| **Aufbau beim Laden** | erster Besuch | Punkte fliegen aus verstreuten Positionen an ihren Platz, ~1.2s, überspringbar |
| **Trägheits-Drehung** | nach dem Ziehen | läuft mit Reibung aus, ~800ms |

Alle Animationen respektieren `prefers-reduced-motion` und sind global
abschaltbar. Ohne Motion bleiben die Punkte statisch sichtbar — die Ansicht
funktioniert weiterhin vollständig.

### Bedienbarkeit ohne Maus

Der Globus darf nicht der einzige Weg zu einer Story sein. Die Blog-Ansicht ist
der gleichwertige, vollständig zugängliche Zwilling (siehe unten). Zusätzlich
auf dem Globus: `Tab` springt durch die Marker in Reihenfolge der Wichtigkeit,
`Enter` öffnet, Pfeiltasten drehen. Jeder Marker hat ein `aria-label` mit Titel
und Wichtigkeit.

**Performance:**
- `frameloop="demand"` — rendert nur bei Interaktion oder Animation. Spart im
  Leerlauf spürbar Akku.
- DPR gedeckelt auf `[1, 2]`
- Punktwolke als **eine** BufferGeometry, nicht 10 000 Meshes
- Alles in `<Suspense>` mit Skelett-Fallback
- Ziel: < 250 KB JS für die 3D-Szene, 60fps auf einem MacBook Air

### Blender

Nicht für den Globus, sondern für **Detail-Assets** — dort ist die Lernkurve
angenehmer und das Ergebnis sichtbarer:

- Ein rotierendes Low-Poly-Satelliten-Icon als Ladeanimation
- 3D-Badges für Story-Kategorien
- Ein "Signal empfangen"-Objekt für den leeren Zustand
- Später vielleicht ein Intro-Render fürs Landing

Export als glTF/GLB mit Draco-Kompression. Das ist ein Nachmittag Blender-
Grundlagen für ein sichtbares Ergebnis — besser als tagelang am Hauptobjekt zu
scheitern.

---

## Layout

Astra hat **zwei gleichwertige Ansichten**, umschaltbar im Header. Nicht Haupt-
und Nebenansicht — zwei Arten, dasselbe zu tun:

| Ansicht | Wofür | Metapher |
|---|---|---|
| **Globus** | Überblick, entdecken, "was ist gerade los" | Radar |
| **Blog** | Lesen, durcharbeiten, aufholen | Zeitung |

Der Umschalter sitzt im Header und merkt sich die Wahl (`localStorage`). Beim
allerersten Besuch startet Astra im Globus — das ist der Moment, der die Seite
erklärt. Danach gilt, was du zuletzt benutzt hast; wer täglich liest, landet
also im Blog.

**Beide Ansichten zeigen dieselben Storys mit demselben Ranking.** Es gibt keine
Story, die nur auf dem Globus auftaucht — sonst wäre der Globus eine Falle statt
einer Ansicht. Seitenleisten, Ticker und Filter bleiben identisch; nur die Mitte
wechselt. Der Wechsel selbst ist ein 200ms-Crossfade, kein Seitenneuladen.

### Ansicht A — Globus (ab 1280px)

```
┌──────────────────────────────────────────────────────────────────┐
│  ASTRA ▸ 07:42     ⦿ Globus │ ▤ Blog        [Themen] [Einstell.] │  56px
├──────────────┬───────────────────────────────────┬───────────────┤
│              │                                   │               │
│  THEMEN      │            ◯   ◯   ◯              │  JETZT WICHTIG│
│  ─────────   │        ◯      ●        ◯          │  ────────────  │
│  ▸ KI-Infra  │      ◯                    ◯       │  ▸ 94  Nvidia…│
│  ▸ DevOps    │     ◯        GLOBUS        ●━━┐   │  ▸ 88  Rust 2…│
│  ▸ Systeme   │      ◯        (3D)        ◯  │   │  ▸ 81  K8s 1.…│
│  ▸ Security  │        ◯      ●        ◯     │   │               │
│              │            ◯   ◯   ◯    ┌────┴──┐│  LIVE-TICKER  │
│  QUELLEN     │                         │94 ▓▓▓▓▓││  ────────────  │
│  ─────────   │                         │Nvidia  ││  09:41 HN ↑412│
│  ● HN     42 │   ● Story   ◯ Landmasse │über…   ││  09:38 BSky   │
│  ● Bluesky 18│                         │HN·TC   ││  09:31 arXiv  │
│  ● Reddit  7 │                         └────────┘│               │
│  ○ arXiv   3 │                                   │  KOSTEN HEUTE │
│              │                                   │  $0.42 / $1.00│
└──────────────┴───────────────────────────────────┴───────────────┘
   240px                  flexibel                      280px
```

Der Globus füllt die Mitte. Beim Hover auf einem Punkt klappt die Karte auf
(siehe [Interaktion](#interaktion-mit-den-punkten)), beim Klick fährt das
Story-Panel von rechts ein und schiebt den Globus nach links.

### Ansicht B — Blog (ab 1280px)

```
┌──────────────────────────────────────────────────────────────────┐
│  ASTRA ▸ 07:42     ◯ Globus │ ▦ Blog        [Themen] [Einstell.] │  56px
├──────────────┬───────────────────────────────────┬───────────────┤
│  THEMEN      │  ┌─────────────────────────────┐  │  JETZT WICHTIG│
│  ─────────   │  │ 94 ▓▓▓▓▓          vor 2 Std │  │  ────────────  │
│  ▸ KI-Infra  │  │ Nvidia übernimmt Hugging F. │  │  ▸ 94  Nvidia…│
│  ▸ DevOps    │  │ Nvidia kauft die grösste    │  │  ▸ 88  Rust 2…│
│  ▸ Systeme   │  │ Open-Source-KI-Plattform…   │  │  ▸ 81  K8s 1.…│
│  ▸ Security  │  │ HN 1.2k · TechCrunch · BSky │  │               │
│              │  │ ▸ KI-Infra  ▸ Übernahmen    │  │  LIVE-TICKER  │
│  QUELLEN     │  └─────────────────────────────┘  │  ────────────  │
│  ─────────   │  ┌─────────────────────────────┐  │  09:41 HN ↑412│
│  ● HN     42 │  │ 88 ▓▓▓▓           vor 4 Std │  │  09:38 BSky   │
│  ● Bluesky 18│  │ Rust 2.0 RFC angenommen     │  │  09:31 arXiv  │
│  ● Reddit  7 │  └─────────────────────────────┘  │               │
│  ○ arXiv   3 │  ┌─────────────────────────────┐  │  KOSTEN HEUTE │
│              │  │ 81 ▓▓▓            vor 6 Std │  │  $0.42 / $1.00│
└──────────────┴───────────────────────────────────┴───────────────┘
   240px                  flexibel                      280px
```

Klassischer Lesemodus: Karten scrollen durch, Klick öffnet die Story auf einer
eigenen Seite (nicht im Panel) — hier liest man, statt zu überfliegen.

**Wichtig fürs Laden:** In der Blog-Ansicht wird das 3D-Bundle **gar nicht erst
geholt**. Es kommt per dynamischem Import beim ersten Wechsel zum Globus und
bleibt dann im Speicher — der zweite Wechsel ist sofort. Wer nur liest, zahlt
nie für die 3D-Szene.

Das Kosten-Widget rechts unten ist in beiden Ansichten sichtbar: Es ist Teil des
DevOps-Charakters und hält die Kostenkontrolle im Blick statt in einem
Dashboard, das man nie öffnet.

### Mobil (< 768px) — bewusst reduziert

```
┌─────────────────────┐
│ ASTRA        ☰      │
├─────────────────────┤
│  [ statischer       │   ← 3D-Globus wird NICHT geladen
│    SVG-Globus,      │     stattdessen animierte Silhouette
│    ~140px hoch ]    │
├─────────────────────┤
│ ▸ Alle  KI  DevOps  │   ← horizontal scrollbare Chips
├─────────────────────┤
│ 94 ▓▓▓▓▓   2 Std    │
│ Nvidia übernimmt    │
│ Hugging Face        │
│ HN · TC · BSky      │
├─────────────────────┤
│ 88 ▓▓▓▓    4 Std    │
```

**Auf Mobil gibt es keinen Ansichts-Umschalter — nur den Blog.** Der Globus
oben ist eine statische, leicht animierte Silhouette ohne Interaktion. Das ist
eine bewusste Entscheidung, kein fehlendes Feature: Punkte von 8 Pixeln auf
einer rotierenden Kugel mit dem Daumen zu treffen ist frustrierend, und die
Karten-Interaktion braucht Platz, den ein Handy nicht hat. Auf dem Handy liest
man Storys.

Weiter weggelassen: Live-Ticker, Quellen-Seitenleiste, Kosten-Widget. Nicht
versteckt hinter einem Menü — **weg**. Man administriert kein System auf dem
Handy.

Der 3D-Globus wird dabei nicht nur ausgeblendet, sondern gar nicht erst geladen
(dynamischer Import hinter einer Breakpoint-Prüfung). Sonst zahlt man den
Bundle-Preis, ohne etwas zu sehen.

---

## Motion

Bibliothek: **Motion** (Nachfolger von Framer Motion).

| Interaktion | Dauer | Easing |
|---|---|---|
| Hover-Zustände | 120ms | `ease-out` |
| Karten-Eintritt | 240ms, 40ms gestaffelt | `cubic-bezier(.16,1,.3,1)` |
| Seitenwechsel | 200ms Crossfade | `ease-in-out` |
| Globus-Trägheit | ~800ms Ausklingen | physikalisch |
| Neue Story | 600ms Puls | `ease-out` |

Alles unter `@media (prefers-reduced-motion: reduce)` auf 0ms — nicht als
Nachgedanke, sondern als Standardzeile im Design-System.

---

## Umsetzung

- **Tailwind CSS v4** mit CSS-first-Config: Die Tokens oben leben in
  `@theme`, nicht in einer JS-Datei. Eine Wahrheit für Farben und Abstände.
- **Design-Tokens vor Komponenten.** Erst Farben, Typoskala und Abstände
  festnageln, dann Komponenten bauen. Andersherum entsteht Wildwuchs.
- **Storybook** für die Kernkomponenten (StoryCard, Globus, Ticker) — erlaubt
  Designarbeit ohne laufende Datenpipeline.
- **Visuelle Regressionstests** mit Playwright-Screenshots. Bei einem so
  effektlastigen Design merkt man sonst nicht, wenn eine CSS-Änderung den
  Glow auf allen Karten kaputtmacht.

## Offene Design-Punkte

Dieses Dokument ist bewusst **nicht fertig**. Es legt die Richtung fest — Palette,
Konzept, Globus-Verhalten, Layoutstruktur — und lässt die Detailebene offen.
Komponentenzustände, Micro-Copy, Abstände im Einzelfall und Randfälle werden
festgelegt, *wenn* sie gebaut werden (Phase 5). Alles jetzt festzunageln wäre
Arbeit auf Verdacht: Man weiss erst beim Bauen, was man wirklich braucht.

Wenn dir während der Arbeit Features einfallen: hier eintragen oder direkt in
den passenden Abschnitt. Die Docs wachsen mit dem Projekt.

1. **Hex-Werte am echten Bildschirm feinjustieren** — die Palette ist aus einem
   Foto geschätzt. Richtung stimmt, exakte Sättigung und Helligkeit werden in
   Phase 5 am Monitor entschieden
2. Typografie-Richtung A oder B entscheiden (Vorschlag: A)
3. Wortmarke / Logo für "ASTRA" — eigenes Blender- oder Typo-Projekt
4. Favicon und PWA-Icons
5. Empty States und Fehlerzustände im Glut-Look (oft vergessen, prägen
   den Gesamteindruck aber stark)
6. Wie stark darf der Rahmen-Bloom sein, bevor es kitschig wird? Nur am
   laufenden Bildschirm entscheidbar
