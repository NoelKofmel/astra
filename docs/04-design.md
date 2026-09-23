# Design

## Concept: Ember Console

The brief was "modern and old at the same time, dark with orange accents, like
an old Nintendo game". The reference image (a sci-fi game UI, see below)
sharpened that: not a golden amber CRT, but a **command console** — dark, cool
content surfaces framed in hot glowing red-orange.

Three principles, taken straight from the reference:

**1 · Orange is frame, not fill.**
The glow lives in edges, borders and dividers. Content surfaces stay dark. That
is why the reference reads as refined rather than garish — and it is the sharper
version of the "at most 10% of the surface" rule of thumb.

**2 · Warm against cool.**
Warm chrome outside, cool content inside. The counter-accent (teal) carries a
good share of the effect — without it, monochrome orange turns monotonous fast.
It is used sparingly: for live and new states only.

**3 · Tube glow as texture, not costume.**
Scanlines, bloom on edges, slight afterglow. That delivers the "old" feeling
through **light** rather than through letterform resolution — a full pixel font
gets tiring after two minutes of reading; a glow never does.

So: Astra does not look like a terminal *with* retro effects. It looks like a
console that never existed. Old in feel, modern in typography, grid and motion.

> **Reference:** screenshot of a sci-fi game UI (Noel, 2026-09-09). What was
> taken: the **colour impression** — hot red-orange as a glowing frame, dark cool
> content, teal as counter-accent. What was not: the dense panel nesting and the
> information density. Astra is a reading tool, not a strategy-game HUD. The hex
> values below are estimated from a photo — the *direction* is right, exact
> values get tuned on a real screen in phase 5.

---

## Colour palette

```css
:root {
  /* Ground — black with a warm red cast, never pure #000 */
  --bg:            #0C0A0A;
  --bg-elevated:   #16110F;
  --surface:       #1E1512;   /* panel surfaces: dark, warm-tinted */

  /* Frame — the load-bearing structure */
  --border:        #3A211A;   /* at rest */
  --border-hot:    #FF5B33;   /* active / focused / glowing */

  /* Text — warm off-white, never pure white */
  --text:          #F0E6E0;
  --text-muted:    #9A8A83;
  --text-dim:      #5F514B;

  /* Ember — hot red-orange, from the reference */
  --ember:         #FF5B33;   /* primary: frames, markers, accent text */
  --ember-bright:  #FF8055;   /* hover, highlights */
  --ember-core:    #E8431F;   /* saturated core — fills, never small text */
  --ember-deep:    #A82D14;   /* resting borders, wireframe */
  --ember-glow:    rgba(255, 91, 51, 0.40);
  --ember-wash:    rgba(255, 91, 51, 0.05);   /* surface tint */

  /* Counter-accent — cool, like the interiors in the reference. Sparingly! */
  --coolant:       #4FC3B0;   /* "new", "live", fresh data */
  --coolant-deep:  #2E7A6E;

  /* Semantic */
  --signal-high:   var(--ember);
  --signal-new:    var(--coolant);
  --signal-mute:   #4A423F;
}
```

**Three rules:**

1. **Ember is structure, not surface.** Frames, dividers, borders, markers.
   There are no large orange areas. If everything glows, nothing glows — still
   roughly 10% of visible surface.
2. **Importance is graded by glow intensity, not by size.** A 94-point story
   gets a brighter frame than a 71, not a bigger card.
3. **Teal is a spice.** Only for "new" and "live". The moment it appears as a
   second brand colour, the warm/cool contrast is spent.

**Contrast:** `--text` on `--bg` is roughly 15.6:1 (WCAG AAA). `--ember` on
`--bg` is roughly 6.3:1 — fine for body text. `--ember-core` is darker and
belongs on surfaces and borders, **not** under 16px text. Pure white and pure
black appear nowhere in the project.

---

## Typography

Two directions to choose from. Both are free and self-hostable (no Google Fonts
CDN — better for Swiss data protection, and faster).

### Direction A — "Terminal" *(recommended)*

| Role | Font | Why |
|---|---|---|
| Display / H1–H2 | **Departure Mono** | Pixel feel, but modern draughtsmanship and razor-sharp at large sizes |
| Body / UI | **Geist Mono** or **IBM Plex Mono** | Monospace, readable over long stretches |
| Numbers / metadata | same family, `tabular-nums` | Values do not jump when they tick |

Monospace throughout. Reads as technical and consistent, and supports the
terminal metaphor. Risk: slightly tiring for very long explainer text.

### Direction B — "Contrast"

| Role | Font | Why |
|---|---|---|
| Display | **Silkscreen** or **Pixelify Sans** | Much stronger retro accent |
| Body | **Space Grotesk** | Proportional, comfortable at length, with its own character |
| Code / meta | **JetBrains Mono** | |

A sharper break between retro headline and modern body text. More readable over
long passages, but less "of a piece".

**Avoid:** Inter, Roboto, Arial, system fonts. They are the visual flattener you
can spot on an AI-generated page instantly.

**Scale** (major third, 1.25):
`12 · 14 · 16 · 20 · 25 · 31 · 39 · 49 px` — body 16, story title 20, section
25, hero 39–49.

---

## CRT effects

Every effect is **switchable off** (a setting, plus automatically under
`prefers-reduced-motion`) and deliberately understated. The difference between
tasteful and funfair is about 3% opacity.

| Effect | Implementation | Dosage |
|---|---|---|
| Scanlines | `repeating-linear-gradient`, 2px raster, overlay | 3% opacity |
| Phosphor glow | `text-shadow: 0 0 12px var(--ember-glow)` | accent elements only |
| Vignette | radial gradient at the edges | very subtle |
| Boot sequence | typewriter lines on first load | once, skippable, remembered in `localStorage` |
| Chromatic aberration | ±0.5px red/blue offset | on hover, H1 only |
| Flicker | minimal opacity variance | barely perceptible, **never** under reduced-motion |
| CRT corners | `border-radius` 2px, no soft corners | throughout |

**Deliberately not:** heavy barrel distortion, animated static-noise layers,
terminal cursors everywhere. That tips into costume quickly and costs
performance.

---

## The globe

The centrepiece, and **not decoration**: it shows real data. Triage gives every
story a `geo` field (headquarters, event site) — the globe visualises where
things are happening.

### Technique

Procedural with react-three-fiber rather than imported from Blender. Reason:
only generated geometry can be driven by data. Marrying a static glTF mesh to
live data points is considerably more painful than building both from one hand.

**Three layers:**

1. **Wireframe sphere** — `IcosahedronGeometry(radius, 4)` as wireframe,
   `--ember-deep` at ~15% opacity. Gives the form.
2. **Landmasses as a point cloud** — Natural Earth 110m GeoJSON, sampled to
   ~10,000 points, as `THREE.Points` with additive blending. This is the
   characteristic look: not a textured globe but a sketch made of light —
   exactly the "roughly sketched" from the brief.
3. **Story markers** — glowing points at `geo` positions, size and intensity by
   `importance`. New stories pulse briefly. Clicking opens the story.

### Interacting with the points

The glowing points are the heart of the interface, not decoration. Three layers
that build on each other:

**1 · At rest** — the point glows ember, size and intensity by `importance`. New
stories pulse for the first few minutes.

**2 · Hover → the card unfolds**

On hover, in this order:

```
  Point brightens + scales 1.0 → 1.6         (140ms, ease-out)
        ↓
  Leader line draws out to the card          (180ms, length 0 → 48px)
        ↓
  Card unfolds                                (200ms, scaleY 0.7 → 1 + fade)
```

```
                    ┌───────────────────────────────┐
                    │ 94 ▓▓▓▓▓            2 hrs ago │
                   ╱│                               │
                  ╱ │ Nvidia acquires               │
                 ╱  │ Hugging Face                  │
      ●━━━━━━━━━╱   │                               │
   (marker)         │ HN 1.2k · TechCrunch · Bluesky│
                    │ ▸ AI infra  ▸ Acquisitions    │
                    └───────────────────────────────┘
```

Details that make the difference:
- **120ms delay** before unfolding — otherwise it flickers as the mouse crosses
  the globe. Close immediately on leave.
- **Auto-rotation pauses** on hover and resumes after ~800ms.
- The card renders as an **HTML overlay** (`<Html>` from drei), not as WebGL
  text — type stays crisp and selectable.
- It follows the point as the globe turns, and **flips to the other side**
  automatically when it would otherwise run out of the viewport.
- Only **one** card open at a time.

**3 · Click → the story opens**

A panel slides in from the right (280ms), the globe shifts left and keeps
turning. The full story: summary, explainer, context, all sources with links,
👍/👎. The corresponding point stays highlighted so the connection remains
visible. `Esc` or a click outside closes it.

### Further globe animations

Beyond the markers — each one says something true about the data, none is
ornament:

| Animation | Trigger | Effect |
|---|---|---|
| **Impact ripple** | new story arrived | ring expands from the point, ~2s, fades |
| **Connection arc** | story with multiple locations | great-circle arc draws between the points (Santa Clara ↔ Paris on an acquisition, say) |
| **Density glow** | many stories in one region | region glows warmer — shows where things are happening |
| **Day/night terminator** | real UTC time | the terminator line travels across the globe. Costs almost nothing and makes it tangible that the view is live |
| **Ingest pulse** | new data collected | brief pulse on the equator ring — ambient "it's alive" |
| **Assembly on load** | first visit | points fly from scattered positions into place, ~1.2s, skippable |
| **Inertial spin** | after dragging | decays with friction, ~800ms |

Every animation respects `prefers-reduced-motion` and can be switched off
globally. Without motion the points stay statically visible — the view remains
fully functional.

### Operating it without a mouse

The globe must not be the only route to a story. The blog view is its equal,
fully accessible twin (see below). On the globe itself: `Tab` cycles markers in
importance order, `Enter` opens, arrow keys rotate. Every marker carries an
`aria-label` with title and importance.

**Performance:**
- `frameloop="demand"` — renders only on interaction or animation. Noticeably
  kinder to the battery when idle.
- DPR capped at `[1, 2]`
- Point cloud as **one** BufferGeometry, not 10,000 meshes
- Everything inside `<Suspense>` with a skeleton fallback
- Target: < 250 KB of JS for the 3D scene, 60fps on a MacBook Air

### Blender

Not for the globe, but for **detail assets** — where the learning curve is
gentler and the result more visible:

- A rotating low-poly satellite icon as the loading animation
- 3D badges for story categories
- A "signal received" object for the empty state
- Possibly an intro render for the landing page later

Export as glTF/GLB with Draco compression. That is an afternoon of Blender
basics for a visible result — better than spending days failing on the main
object.

---

## Layout

Astra has **two equal views**, switchable in the header. Not a primary and a
secondary — two ways of doing the same thing:

| View | For | Metaphor |
|---|---|---|
| **Globe** | overview, discovery, "what's happening" | radar |
| **Blog** | reading, working through, catching up | newspaper |

The switch sits in the header and remembers the choice (`localStorage`). On a
first visit Astra opens in the globe — that is the moment that explains the
site. After that, whatever you used last applies; anyone reading daily ends up
in the blog.

**Both views show the same stories with the same ranking.** No story appears only
on the globe — otherwise the globe would be a trap rather than a view. Sidebars,
ticker and filters stay identical; only the middle changes. The switch itself is
a 200ms crossfade, not a page reload.

### View A — Globe (1280px and up)

```
┌──────────────────────────────────────────────────────────────────┐
│  ASTRA ▸ 07:42     ⦿ Globe │ ▤ Blog          [Topics] [Settings] │  56px
├──────────────┬───────────────────────────────────┬───────────────┤
│              │                                   │               │
│  TOPICS      │            ◯   ◯   ◯              │  RIGHT NOW    │
│  ─────────   │        ◯      ●        ◯          │  ────────────  │
│  ▸ AI infra  │      ◯                    ◯       │  ▸ 94  Nvidia…│
│  ▸ DevOps    │     ◯        GLOBE         ●━━┐   │  ▸ 88  Rust 2…│
│  ▸ Systems   │      ◯        (3D)        ◯  │   │  ▸ 81  K8s 1.…│
│  ▸ Security  │        ◯      ●        ◯     │   │               │
│              │            ◯   ◯   ◯    ┌────┴──┐│  LIVE TICKER  │
│  SOURCES     │                         │94 ▓▓▓▓▓││  ────────────  │
│  ─────────   │                         │Nvidia  ││  09:41 HN ↑412│
│  ● HN     42 │   ● story   ◯ landmass  │acqui…  ││  09:38 BSky   │
│  ● Bluesky 18│                         │HN·TC   ││  09:31 arXiv  │
│  ● RSS     7 │                         └────────┘│               │
│  ○ arXiv   3 │                                   │  COST TODAY   │
│              │                                   │  $0.42 / $1.00│
└──────────────┴───────────────────────────────────┴───────────────┘
   240px                  flexible                      280px
```

The globe fills the middle. Hovering a point unfolds the card (see
[Interacting with the points](#interacting-with-the-points)); clicking slides the
story panel in from the right and pushes the globe left.

### View B — Blog (1280px and up)

```
┌──────────────────────────────────────────────────────────────────┐
│  ASTRA ▸ 07:42     ◯ Globe │ ▦ Blog          [Topics] [Settings] │  56px
├──────────────┬───────────────────────────────────┬───────────────┤
│  TOPICS      │  ┌─────────────────────────────┐  │  RIGHT NOW    │
│  ─────────   │  │ 94 ▓▓▓▓▓          2 hrs ago │  │  ────────────  │
│  ▸ AI infra  │  │ Nvidia acquires Hugging F.  │  │  ▸ 94  Nvidia…│
│  ▸ DevOps    │  │ Nvidia buys the largest     │  │  ▸ 88  Rust 2…│
│  ▸ Systems   │  │ open-source AI platform…    │  │  ▸ 81  K8s 1.…│
│  ▸ Security  │  │ HN 1.2k · TechCrunch · BSky │  │               │
│              │  │ ▸ AI infra  ▸ Acquisitions  │  │  LIVE TICKER  │
│  SOURCES     │  └─────────────────────────────┘  │  ────────────  │
│  ─────────   │  ┌─────────────────────────────┐  │  09:41 HN ↑412│
│  ● HN     42 │  │ 88 ▓▓▓▓           4 hrs ago │  │  09:38 BSky   │
│  ● Bluesky 18│  │ Rust 2.0 RFC accepted       │  │  09:31 arXiv  │
│  ● RSS     7 │  └─────────────────────────────┘  │               │
│  ○ arXiv   3 │  ┌─────────────────────────────┐  │  COST TODAY   │
│              │  │ 81 ▓▓▓            6 hrs ago │  │  $0.42 / $1.00│
└──────────────┴───────────────────────────────────┴───────────────┘
   240px                  flexible                      280px
```

Classic reading mode: cards scroll past, clicking opens the story on its own
page (not in a panel) — here you read rather than scan.

**Important for loading:** in the blog view the 3D bundle is **never fetched**.
It arrives via dynamic import on the first switch to the globe and stays in
memory afterwards, so the second switch is instant. Anyone who only reads never
pays for the 3D scene.

The cost widget in the bottom right is visible in both views. It is part of the
DevOps character and keeps cost control in sight rather than in a dashboard
nobody opens.

### Mobile (< 768px) — deliberately reduced

```
┌─────────────────────┐
│ ASTRA        ☰      │
├─────────────────────┤
│  [ static           │   ← the 3D globe is NOT loaded
│    SVG globe,       │     an animated silhouette instead
│    ~140px tall ]    │
├─────────────────────┤
│ ▸ All  AI  DevOps   │   ← horizontally scrollable chips
├─────────────────────┤
│ 94 ▓▓▓▓▓   2 hrs    │
│ Nvidia acquires     │
│ Hugging Face        │
│ HN · TC · BSky      │
├─────────────────────┤
│ 88 ▓▓▓▓    4 hrs    │
```

**There is no view switch on mobile — only the blog.** The globe at the top is a
static, lightly animated silhouette with no interaction. That is a decision, not
a missing feature: hitting 8-pixel points on a rotating sphere with a thumb is
frustrating, and the card interaction needs room a phone does not have. On a
phone you read stories.

Also dropped: live ticker, sources sidebar, cost widget. Not hidden behind a
menu — **gone**. You do not administer a system on a phone.

The 3D globe is not merely hidden but never loaded (dynamic import behind a
breakpoint check). Otherwise you pay the bundle price for something you cannot
see.

---

## Motion

Library: **Motion** (the successor to Framer Motion).

| Interaction | Duration | Easing |
|---|---|---|
| Hover states | 120ms | `ease-out` |
| Card entrance | 240ms, 40ms stagger | `cubic-bezier(.16,1,.3,1)` |
| View switch | 200ms crossfade | `ease-in-out` |
| Globe inertia | ~800ms decay | physical |
| New story | 600ms pulse | `ease-out` |

Everything drops to 0ms under `@media (prefers-reduced-motion: reduce)` — not as
an afterthought but as a standing line in the design system.

---

## Implementation

- **Tailwind CSS v4** with CSS-first config: the tokens above live in `@theme`,
  not in a JS file. One source of truth for colour and spacing.
- **Design tokens before components.** Nail down colour, type scale and spacing
  first, then build components. The other way round produces sprawl.
- **Storybook** for the core components (StoryCard, globe, ticker) — lets design
  work happen without a running data pipeline.
- **Visual regression tests** with Playwright screenshots. In a design this
  effect-heavy you otherwise will not notice when a CSS change breaks the glow
  on every card.

## Open design questions

This document is deliberately **not finished**. It fixes the direction — palette,
concept, globe behaviour, layout structure — and leaves the detail level open.
Component states, micro-copy, case-by-case spacing and edge cases get decided
*when they are built* (phase 5). Nailing everything down now would be work on
spec: you only learn what you actually need by building it.

If features occur to you while working: note them here, or drop them straight
into the relevant section. The docs grow with the project.

1. **Tune the hex values on a real screen** — the palette is estimated from a
   photo. The direction is right; exact saturation and brightness get decided on
   a monitor in phase 5
2. Decide typography direction A or B (recommendation: A)
3. Wordmark / logo for "ASTRA" — its own Blender or type project
4. Favicon and PWA icons
5. Empty states and error states in the ember look (often forgotten, but they
   shape the overall impression strongly)
6. How strong can the frame bloom get before it turns kitsch? Only decidable on
   a running screen
