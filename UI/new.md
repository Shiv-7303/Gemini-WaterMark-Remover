# Unmark — UI Improvement Brief

**Audience:** an AI coding agent (Antigravity). Read the whole file before editing anything.
**Task:** redesign the visual layer of the existing Unmark page so it stops looking like an unstyled template and starts looking like a designed product. No AI slop.
**Stack assumption:** plain HTML, CSS and JavaScript (`index.html`, `style.css`, `main.js`). Do not add frameworks, libraries, build steps or CDN scripts. Fonts are the only external resource allowed.

---

## 1. Where the UI is today

Three screenshots were reviewed: hero, before and after section, FAQ section.

### 1.1 What is wrong

- Everything has the same visual weight. The primary action is a black pill that looks like every other landing page.
- The dropzone is buried in decoration: a dashed frame, tiny stacked photo cards (whose icons are hidden by the neighbouring card) and two big tilted photos with green chips.
- Proof is static. The mark is a few pixels in two side by side images, so the visitor cannot see the result.
- Accordions use default browser markers inside grey boxes.
- The nav pill blurs content behind it and lets it bleed through.
- One mint accent used twice; no color system. All sections look alike, so scrolling has no rhythm.

### 1.2 What is good and must be kept

The headline copy "Drop a file. Get it back clean."; the three modes (Image, Video, Batch); the Add, Clean, Save idea; the engine chip; the real sample photos as proof material; the FAQ content and the equation explanation.

---

## 2. Goals and non-goals

**Goals:** one clear first action above the fold (drop a file); proof you can see (interactive compare plus a pixel loupe on the mark); a real color system where color carries meaning; tactile detail (texture, engraved marks, hard shadows) that fits a precision tool; strong section rhythm (light, dark, light); a workspace that feels like operating equipment.

**Non-goals:** changing how files are processed; accounts, pricing, testimonials, logos, statistics or any invented claim; a dark mode toggle; new pages.

---

## 3. Hard rules (do not break)

1. **Do not modify the processing logic** in `main.js` (unblending, WebCodecs, MediaBunny, preset detection, ZIP). You may change markup and classes around it.
2. **Keep every element `id`, `name`, `data-*` attribute and event listener target** that `main.js` reads. If markup must move, move the element with its id intact. Search `main.js` for `getElementById`, `querySelector` and `dataset` before editing HTML.
3. **No new dependencies.** No Tailwind, no icon libraries, no animation libraries, no CSS frameworks. Draw icons as inline SVG.
4. **No raster images added by you.** Reuse the existing sample photos. All other graphics are CSS or inline SVG.
5. **No emoji anywhere** in UI, copy, comments or alt text.
6. **Do not add claims.** Allowed statements are the ones in section 23. If a claim is not there, do not write it.
7. **Do not mention any third-party site, brand or URL** in new copy. (Existing SEO copy stays as it is unless section 23 changes it.)
8. **Keep it fast.** No layout shift, no blocking font loads, no animation on scroll that runs JavaScript every frame.
9. **Respect `prefers-reduced-motion`.**
10. **Commit in phases** (section 21) and verify each phase in a real browser before continuing.

---

## 4. Anti-slop rules

"Slop" is the default look that AI tools produce when nobody decides anything. The rules below are binding. If a rule and your instinct disagree, the rule wins.

### 4.1 Banned

- Purple to pink or blue to purple gradients; gradient text.
- Glassmorphism (backdrop blur, translucent cards over content); glowing colored shadows; neon outlines.
- Floating blurred blobs, aurora backgrounds, noise used as decoration on top of content.
- Sparkle emoji, confetti, particle bursts, shimmer on everything, bouncing or pulsing buttons.
- Three identical feature cards with a circle icon on top; centering every section.
- Pill shapes on every button, chip, tab and card.
- Uppercase tracked small labels above every heading.
- Fake stats, logos, ratings, testimonials, "trusted by" rows.
- `Inter` or `Space Grotesk` as the main font; cream background with serif and terracotta; dark mode with a neon accent.
- Lorem ipsum or placeholder names; arrows glued to button labels; emoji bullets and checkmark spam.
- Marketing words: revolutionary, seamless, magical, cutting-edge, supercharge, unleash, next-gen.

### 4.2 Required

- One strong decision per section; everything else supports it.
- Asymmetry where it helps. The hero is left text plus a right object, not a centered stack.
- Real proof: the real before and after pair, shown at pixel level.
- Color with a job: orange is action and active state, green is ok, amber is caution, red is failure. Nothing else is colored.
- Contrast between sections: alternating light and dark bands.
- Tactile detail: hard bottom edges on buttons, engraved ticks, crop marks, knurled grips.
- Honest copy that describes what the tool does. Restraint: if it can go without losing meaning, it goes.

### 4.3 Self-check before every commit

1. **Squint test.** Blur your eyes (or take a screenshot and apply a 12 px blur). You must still see: the primary action, the headline, the section breaks.
2. **Grayscale test.** Convert the screenshot to grayscale. Hierarchy must still be clear.
3. **Swap test.** Replace the logo with another product's name. If the page still "works" unchanged, it is too generic. Add something specific to this product (crop marks, ticks, pixel loupe, formula).
4. **Count test.** Count saturated colors visible on screen. At most two at any time (orange plus one status color).
5. **Banned list.** Grep the CSS for `backdrop-filter`, `linear-gradient(` with purple hues, `blur(` on large elements, `text-shadow`. Each hit needs a reason or goes.

---

## 5. Design direction

### 5.1 Concept: a calibrated instrument

The product reverses a mathematical blend. It is precise and measurable. The interface should feel like a piece of lab equipment or a well made camera: a light powder-coated panel, a dark viewfinder where the image appears, engraved ticks, a tactile orange control, small status LEDs.

This gives the page color and texture with a reason, and it is hard to confuse with a generic SaaS page.

### 5.2 Ingredients

| Ingredient | Where it appears |
| --- | --- |
| Powder-coat panel (light grey with fine noise) | Page background, inspector, content panels |
| Viewfinder well (near-black, rounded, inset) | Dropzone, stage, compare, loupe, preview modal |
| Crop marks | Around every well |
| Engraved tick ruler | Edge of the stage, under the timeline, beside sliders |
| Signal orange | Primary button, active tab LED, compare line, slider fill, focus accent on dark |
| Status LEDs | Engine chip, row status, confidence meter |
| Monospace readouts | Values, coordinates, file sizes, shortcuts |
| Hard bottom shadow on controls | Buttons and switches feel like keys |

### 5.3 Section rhythm

Nav (panel, sticky), hero (aluminium grey with noise), proof band (full-bleed dark), how it works (panel), modes (aluminium grey), FAQ (panel), footer (dark).

### 5.4 Shape language

Small radii (6, 10, 14, 18); pills only for toggles. Hairline 1 px borders plus a 1 px white top highlight on raised parts. Neutral, tight shadows; no colored glows.

---

## 6. Design tokens

Create these in a `:root` block at the top of `style.css`. Replace existing color values with tokens. No raw hex outside this block (except inside the noise SVG).

### 6.1 Color

```css
:root {
  color-scheme: light;

  /* surfaces */
  --bg:            #e7e8ea;   /* page, aluminium */
  --bg-deep:       #dcdde0;   /* recessed areas, tab tracks */
  --panel:         #f6f6f4;   /* panel face */
  --panel-raised:  #ffffff;   /* active segment, inputs */

  /* viewfinder (dark) */
  --well:          #151618;
  --well-2:        #1f2023;
  --well-line:     #34363a;
  --well-text:     #f2f2f0;
  --well-text-2:   #a3a7ae;   /* 7.9:1 on --well */

  /* ink */
  --ink:           #141518;
  --ink-2:         #44474d;
  --ink-3:         #6a6e76;   /* 4.7:1 on --panel */

  /* lines */
  --line:          #cfd1d5;
  --line-strong:   #b4b7bd;

  /* signal */
  --signal:        #ff4f1f;
  --signal-press:  #d93a0d;
  --signal-tint:   #ffe6dd;

  /* status LEDs */
  --ok:            #1fa971;  --ok-tint:   #ddf3e9;  --ok-ink:   #0b5b3a;
  --warn:          #f2b100;  --warn-tint: #fff1cc;  --warn-ink: #6b4a00;
  --err:           #c62828;  --err-tint:  #fbe1e1;  --err-ink:  #7f1414;
}
```

### 6.2 Color usage rules

- `--signal`: primary button fill, active LED, compare line, slider fill, drag-over crop marks. Text on it is always `--ink`, never white (3.3 : 1 fails).
- `--signal-tint`: hover on ghost buttons and selected rows.
- `--ok`, `--warn`, `--err`: status only (LEDs, chips, meters).
- `--well*`: media wells, the proof band and the footer only.
- `--ink-3` is helper text on light surfaces; `--well-text-2` is helper text on dark.

### 6.3 Typography

| Role | Font | Weights | Fallback |
| --- | --- | --- | --- |
| Display and headings | Bricolage Grotesque | 600, 700 | `system-ui, sans-serif` |
| Interface and body | Figtree | 400, 500, 600 | `system-ui, sans-serif` |
| Readouts and labels | IBM Plex Mono | 400, 500 | `ui-monospace, Menlo, monospace` |

```css
:root {
  --font-display: "Bricolage Grotesque", system-ui, sans-serif;
  --font-ui:      "Figtree", system-ui, sans-serif;
  --font-mono:    "IBM Plex Mono", ui-monospace, Menlo, monospace;
}
```

| Token | Size / line | Weight | Tracking | Use |
| --- | --- | --- | --- | --- |
| `--t-display` | `clamp(44px, 6.2vw, 84px) / 0.98` | 700 | -0.035em | Hero H1 only |
| `--t-h2` | `clamp(32px, 4vw, 52px) / 1.05` | 600 | -0.03em | Section headings |
| `--t-h3` | `24px / 30px` | 600 | -0.015em | Sub headings, modal titles |
| `--t-body` | `16px / 26px` | 400 | 0 | Paragraphs |
| `--t-ui` | `14px / 20px` | 500 | 0 | Controls |
| `--t-mono` | `12.5px / 18px` | 500 | 0 | Readouts, tick labels |

Rules:

- Sentence case everywhere. No `text-transform: uppercase`.
- Paragraph width: `max-width: 62ch`.
- Mono is for values and legends only, never for sentences.
- Load fonts with `font-display: swap`, Latin subset, only the weights listed.

### 6.4 Spacing, radius, borders, shadows

```css
:root {
  --s-1: 4px;  --s-2: 8px;  --s-3: 12px; --s-4: 16px; --s-5: 24px;
  --s-6: 32px; --s-7: 48px; --s-8: 64px; --s-9: 96px; --s-10: 128px;

  --r-1: 6px;  --r-2: 10px; --r-3: 14px; --r-4: 18px;

  --edge: 1px solid var(--line);
  --highlight: inset 0 1px 0 rgba(255, 255, 255, 0.9);

  --sh-panel: var(--highlight), 0 1px 2px rgba(20, 21, 24, 0.08), 0 14px 28px -18px rgba(20, 21, 24, 0.28);
  --sh-key:   0 2px 0 var(--signal-press), 0 10px 16px -10px rgba(20, 21, 24, 0.45);
  --sh-well:  inset 0 0 0 1px var(--well-line), inset 0 12px 32px rgba(0, 0, 0, 0.35), 0 18px 36px -20px rgba(20, 21, 24, 0.55);

  --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --d-1: 120ms; --d-2: 200ms; --d-3: 320ms; --d-4: 600ms;
}
```

### 6.5 Texture tokens

Three textures only. Each has one job.

**A. Panel noise** (page and panels): subtle powder-coat grain.

```css
body { background: var(--bg); position: relative; }
body::before {
  content: "";
  position: fixed; inset: 0; z-index: -1; pointer-events: none;
  opacity: 0.06; mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
}
```

Rules: opacity stays between 0.04 and 0.08. It never sits on top of text or media (it is behind everything).

**B. Engraved ticks** (rulers beside stages, timelines and sliders):

```css
.ticks {
  height: 10px;
  background:
    repeating-linear-gradient(90deg, var(--ink-3) 0 1px, transparent 1px 40px) left bottom / 100% 10px no-repeat,
    repeating-linear-gradient(90deg, var(--line-strong) 0 1px, transparent 1px 8px) left bottom / 100% 5px no-repeat;
}
.ticks--dark {
  background:
    repeating-linear-gradient(90deg, var(--well-text-2) 0 1px, transparent 1px 40px) left bottom / 100% 10px no-repeat,
    repeating-linear-gradient(90deg, var(--well-line) 0 1px, transparent 1px 8px) left bottom / 100% 5px no-repeat;
}
```

**C. Crop marks** (outside every well):

```css
.marks { position: relative; --m: var(--ink-3); }
.marks::before {
  content: ""; position: absolute; inset: -12px; pointer-events: none;
  background:
    linear-gradient(var(--m), var(--m)) 0 0 / 18px 1.5px no-repeat,
    linear-gradient(var(--m), var(--m)) 0 0 / 1.5px 18px no-repeat,
    linear-gradient(var(--m), var(--m)) 100% 0 / 18px 1.5px no-repeat,
    linear-gradient(var(--m), var(--m)) 100% 0 / 1.5px 18px no-repeat,
    linear-gradient(var(--m), var(--m)) 0 100% / 18px 1.5px no-repeat,
    linear-gradient(var(--m), var(--m)) 0 100% / 1.5px 18px no-repeat,
    linear-gradient(var(--m), var(--m)) 100% 100% / 18px 1.5px no-repeat,
    linear-gradient(var(--m), var(--m)) 100% 100% / 1.5px 18px no-repeat;
}
.marks--dark { --m: var(--well-line); }
.marks.is-active { --m: var(--signal); }
```

### 6.6 Base styles

```css
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; color: var(--ink); background: var(--bg); font: 400 16px/26px var(--font-ui); -webkit-font-smoothing: antialiased; }
h1, h2, h3, p, ol, ul { margin: 0; padding: 0; }
button, input, summary { font: inherit; color: inherit; }
button { background: none; border: 0; cursor: pointer; }
img, svg, video, canvas { display: block; max-width: 100%; }
:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; border-radius: var(--r-1); }
.on-dark :focus-visible { outline-color: var(--signal); }
.mono { font: 500 12.5px/18px var(--font-mono); font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition-duration: 1ms !important; } }
```

---

## 7. Page rhythm and layout

### 7.1 Container

```css
.wrap { width: min(1240px, 100% - 64px); margin-inline: auto; }
@media (max-width: 760px) { .wrap { width: calc(100% - 32px); } }
section { position: relative; }
.band-dark { background: var(--well); color: var(--well-text); }
.band-panel { background: var(--panel); border-block: var(--edge); }
```

### 7.2 Vertical spacing

Section padding top and bottom: hero 72 / 104 px, proof band 104 / 112, how it works 104, modes 96, FAQ 104 / 112, footer 64 / 48. Halve all values below 760 px.

### 7.3 Section headers

All section headings are **left aligned**, `--t-h2`, max width 18ch. Under the heading a single paragraph at `--ink-2` (or `--well-text-2` on dark), max width 56ch. No eyebrow labels, no decorative underlines.

---

## 8. Navigation bar

### 8.1 Behavior

- Sticky at the top, full width of `.wrap`, 64 px tall, 12 px from the top edge.
- **Opaque** panel: `background: var(--panel); border: var(--edge); border-radius: var(--r-3); box-shadow: var(--sh-panel);`
- No `backdrop-filter`, no transparency. Content must not show through.
- After scrolling 8 px, the shadow tightens (`0 6px 16px -12px rgba(20,21,24,.35)`) over 200 ms. Nothing else changes.

### 8.2 Layout

```text
[ logo + Unmark ]        [ Image | Video | Batch ]        [ LED In browser ] [ settings ]
```

Three columns: `grid-template-columns: 1fr auto 1fr`.

### 8.3 Logo

- Keep the four point sparkle mark, but draw it flat in `--ink` (no gradient), 20 px.
- Wordmark: Bricolage 700, 19 px, `-0.02em`.
- While a job runs, the mark rotates slowly (4 s per turn). Otherwise it is still.

### 8.4 Mode switch (replaces the grey icon bubbles)

A hardware style three-position switch.

```css
.modes { display: inline-grid; grid-auto-flow: column; padding: 4px; gap: 2px;
  background: var(--bg-deep); border-radius: var(--r-3);
  box-shadow: inset 0 1px 3px rgba(20,21,24,.18), 0 1px 0 #fff; }
.modes button { position: relative; display: inline-flex; align-items: center; gap: 10px;
  height: 40px; padding: 0 18px; border-radius: var(--r-2);
  font: 600 14px/1 var(--font-ui); color: var(--ink-2);
  transition: color var(--d-2) var(--ease), background var(--d-2) var(--ease), box-shadow var(--d-2) var(--ease); }
.modes button::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--line-strong); }
.modes button:hover { color: var(--ink); }
.modes button[aria-selected="true"] { color: var(--ink); background: var(--panel-raised);
  box-shadow: var(--highlight), 0 1px 2px rgba(20,21,24,.18), 0 2px 0 var(--line-strong); }
.modes button[aria-selected="true"]::before { background: var(--signal); box-shadow: 0 0 0 2px var(--signal-tint); }
```

- No icons in the tabs. The LED dot is the only indicator. The label carries the meaning.
- Keyboard: left and right arrows move, `1`, `2`, `3` jump. Tooltip shows the key as a mono chip.

### 8.5 Engine chip and settings

- Engine chip: rectangular, `--r-2`, 36 px high, `--bg-deep` fill, 1 px `--line`, 8 px LED (green for browser or local engine, amber when offline) and a label.
- Settings button: 40 px square, `--r-2`, ghost, hover `--bg-deep`.

---

## 9. Hero

### 9.1 Goal

The user understands the product in two seconds and drops a file in five.

### 9.2 Layout

Two columns on desktop, text left, viewfinder right.

```text
+-------------------------------------------------------------------------+
| Drop a file.                       +---------------------------------+  |
| Get it back clean.                 |  [ crop marks ]                 |  |
|                                    |                                 |  |
| Removes the visible sparkle        |       tray icon                 |  |
| mark by reversing the blend.       |   Drop an image, video          |  |
|                                    |   or folder                     |  |
| 1  Add     image, video, folder    |   [ Choose files ]              |  |
| 2  Clean   the mark is reversed    |   PNG JPG WEBP MP4 ZIP          |  |
| 3  Save    full resolution         |  ---- hud: LED ready  no upload |  |
|                                    +---------------------------------+  |
+-------------------------------------------------------------------------+
```

```css
.hero { padding: 72px 0 104px; }
.hero .wrap { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 64px; align-items: center; }
```

### 9.3 Left column

**Headline** (`h1`, `--t-display`, `--ink`): "Drop a file." line break "Get it back clean." Left aligned. The second line is the same color. No gradient, no highlight marker.

**Subline** (`--t-body`, `--ink-2`, `max-width: 44ch`, 20 px above): "Removes the visible sparkle mark from AI images and videos by reversing the blend, not painting over it."

**Step ledger** (replaces the three pills): an ordered list with hairlines.

```html
<ol class="ledger">
  <li><span class="mono">1</span><b>Add</b><span>Image, video or a whole folder</span></li>
  <li><span class="mono">2</span><b>Clean</b><span>The mark is reversed, not painted over</span></li>
  <li><span class="mono">3</span><b>Save</b><span>Same resolution as the source</span></li>
</ol>
```

```css
.ledger { margin-top: 40px; border-top: var(--edge); list-style: none; }
.ledger li { display: grid; grid-template-columns: 28px 72px 1fr; gap: 12px; align-items: baseline;
  padding: 14px 0; border-bottom: var(--edge); font-size: 15px; color: var(--ink-2); }
.ledger b { font: 600 16px/1 var(--font-display); color: var(--ink); }
.ledger .mono { color: var(--ink-3); }
```

The step numbers are real sequence, so numbering stays. They are plain mono digits, not colored circles.

### 9.4 Right column: the viewfinder dropzone

This is the one dominant object on the page. Element is the same node `main.js` already uses for dropping (keep its id). Only classes and children change.

```html
<div class="drop marks marks--dark" id="dropzone" role="button" tabindex="0" aria-describedby="drop-help">
  <div class="drop-body">
    <svg class="drop-icon" width="44" height="44" viewBox="0 0 44 44" aria-hidden="true"><!-- tray with downward stroke --></svg>
    <p class="drop-title">Drop an image, video or folder</p>
    <button class="btn btn-primary" type="button" id="choose-files">Choose files</button>
    <p class="mono drop-types" id="drop-help">PNG  JPG  WEBP  MP4  ZIP</p>
  </div>
  <div class="hud mono">
    <span><i class="led led-ok"></i>Ready</span>
    <span>Runs in this browser. Nothing is uploaded.</span>
  </div>
</div>
```

```css
.drop { position: relative; aspect-ratio: 16 / 11; display: grid; place-items: center;
  background: var(--well); color: var(--well-text); border-radius: var(--r-4); box-shadow: var(--sh-well);
  transition: box-shadow var(--d-3) var(--ease); }
.drop::after { /* faint inner grid, drawn only inside the well */
  content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; opacity: .5;
  background:
    linear-gradient(var(--well-line) 1px, transparent 1px) 0 0 / 48px 48px,
    linear-gradient(90deg, var(--well-line) 1px, transparent 1px) 0 0 / 48px 48px;
  mask-image: radial-gradient(60% 60% at 50% 50%, #000 0%, transparent 100%);
}
.drop-body { position: relative; z-index: 1; display: grid; justify-items: center; gap: 18px; text-align: center; padding: 32px; }
.drop-icon { color: var(--well-text-2); transition: transform var(--d-3) var(--ease), color var(--d-2); }
.drop-title { font: 600 clamp(22px, 2.4vw, 30px)/1.15 var(--font-display); letter-spacing: -0.02em; max-width: 14ch; }
.drop-types { color: var(--well-text-2); letter-spacing: .08em; }
.hud { position: absolute; left: 0; right: 0; bottom: 0; display: flex; justify-content: space-between; gap: 16px;
  padding: 12px 20px; color: var(--well-text-2); border-top: 1px solid var(--well-line); }
.led { display: inline-block; width: 8px; height: 8px; margin-right: 8px; border-radius: 50%; background: var(--ok); }
.led-warn { background: var(--warn); } .led-err { background: var(--err); } .led-off { background: var(--line-strong); }
```

Interaction states:

| State | Treatment |
| --- | --- |
| Idle | As above |
| Hover | Icon rises 3 px; marks stay grey |
| Keyboard focus | 2 px `--signal` outline, 4 px offset around the whole well |
| Drag over | Crop marks turn `--signal` and move inward 6 px (transition 200 ms); well gets `box-shadow: inset 0 0 0 2px var(--signal), ...`; title becomes "Release to add" |
| Invalid file | Marks turn `--err`; title becomes "That file type is not supported"; the HUD text reads "Use PNG, JPG, WEBP, MP4 or ZIP"; resets after 2.4 s |
| Whole window drag | A 2 px `--signal` dashed outline appears 8 px inside the viewport edge, no color wash |

### 9.5 What to delete from the hero

The dashed inner frame and white outer card, the three small overlapping photo cards, the two large tilted photos with their green chips, the three colored step pills, and the separate privacy line (it now lives in the HUD). The two sample photos are reused in the modes section (see 12).

---

## 10. Proof band (compare and pixel loupe)

This replaces "Before and After Comparison" and is the page's second strongest element.

### 10.1 Layout

Full-bleed `.band-dark`. Heading left, then a two column grid: large compare (8 columns) and the pixel loupe stack (4 columns).

```text
  See the mark come off.
  Drag the line. The mark sits in the bottom right corner.

  +----------------------------------------+   +---------------+
  |  Original                     Cleaned  |   | Before  6x    |
  |                                        |   | [ pixels ]    |
  |             compare image              |   +---------------+
  |                                        |   | After   6x    |
  |                                   (*)  |   | [ pixels ]    |
  +----------------------------------------+   +---------------+
  ticks ruler                                   x 1136  y 576  96 px
```

### 10.2 Compare component

- Element is a real `<div role="slider">` with two stacked images (same asset used today for original and cleaned).
- Surface: `--well-2`, `--r-4`, `--sh-well`, `.marks--dark` around it.
- Default position 62 percent so the mark corner is visible on the "original" side immediately; user can drag anywhere (clamp 2 to 98).
- Line: 2 px solid `--signal`, full height. No glow.
- Grip: 16 x 48 px, radius 8, `--panel-raised`, three engraved vertical ridges in `--line-strong`, hard bottom edge `0 2px 0 var(--line-strong)`.
- Labels: small chips inside the image at the top left and top right (`Original`, `Cleaned`), `--well` at 78 percent opacity background with `--well-text` text, `--r-1`, mono. They fade out while dragging.
- Below the well: `.ticks--dark` ruler with mono percentage labels at 0, 25, 50, 75, 100, and a marker triangle that follows the line.

```css
.cmp { position: relative; aspect-ratio: 16 / 10; overflow: hidden; border-radius: var(--r-4); background: var(--well-2); box-shadow: var(--sh-well); touch-action: none; user-select: none; --pos: 62%; }
.cmp img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.cmp .orig { clip-path: inset(0 calc(100% - var(--pos)) 0 0); }
.cmp-line { position: absolute; top: 0; bottom: 0; left: var(--pos); width: 2px; margin-left: -1px; background: var(--signal); }
.cmp-line::before { content: ""; position: absolute; inset: 0 -20px; cursor: ew-resize; }
.cmp-grip { position: absolute; top: 50%; left: 50%; width: 16px; height: 48px; margin: -24px 0 0 -8px; border-radius: 8px;
  background:
    linear-gradient(90deg, transparent 4px, var(--line-strong) 4px 5px, transparent 5px 7px, var(--line-strong) 7px 8px, transparent 8px 10px, var(--line-strong) 10px 11px, transparent 11px) center / 100% 24px no-repeat,
    var(--panel-raised);
  box-shadow: 0 2px 0 var(--line-strong), 0 8px 14px -8px rgba(0,0,0,.6); }
```

### 10.3 Pixel loupe (the proof)

Two square wells stacked, each 100 percent of the right column width, `aspect-ratio: 1`.

- Each shows the **same 96 x 96 pixel region** where the mark sits (bottom right), enlarged 6x with `image-rendering: pixelated`.
- Top well label: "Before". Bottom well label: "After". Labels are mono, `--well-text-2`, inside the top left.
- Under both, one mono line: `x 1136  y 576  96 px` (taken from the sample's known position; if unknown, use the real values from the preset).
- The loupe does **not** follow the pointer. It is fixed at the mark, so the visitor always sees the proof.
- A 1 px `--well-line` pixel grid overlay appears on hover of either well (opacity transition 200 ms).

```css
.loupe { aspect-ratio: 1; border-radius: var(--r-3); overflow: hidden; background-color: var(--well-2); box-shadow: var(--sh-well);
  background-repeat: no-repeat; image-rendering: pixelated; background-size: calc(var(--iw) * 6) auto; background-position: calc(var(--mx) * -6) calc(var(--my) * -6); }
```

`--iw`, `--mx`, `--my` are set once from the sample image's natural width and the mark's top left coordinates. Two small inline script lines are acceptable here; do not add a library.

### 10.4 Honesty and intro motion

- Do not caption images with "100% lossless" or "zero blur". Use: "Pixel values restored by reversing the blend." Say nothing about exactness if the sample is JPEG.
- When the band first enters the viewport, the line animates from 100 to 62 percent over 700 ms, once. No loop, no auto sweeping.

---

## 11. How it works

### 11.1 Layout

On `.band-panel`. Left: heading and short text. Right: the equation block, then three pixel diagrams in a row.

### 11.2 Equation block

- Two lines in `--font-mono`, 20 px, inside a `--panel-raised` panel with `--sh-panel`, `--r-3`, padding 28 px.
- Symbols: use real characters: `α`, `×`, `−`, `÷`. Wrap `α` in a `<span>` colored `--signal`... **only** that one symbol. This is the single colored thing in the block.
- Legend under: `W watermarked pixel`, `O original pixel`, `L logo color`, `α mask opacity` in `--t-mono`, `--ink-3`.

### 11.3 Three pixel diagrams

Inline SVG, 8 x 8 grid, each cell 18 px (so 144 px square), 1 px gaps.

| Diagram | Content |
| --- | --- |
| Watermarked | Photo-like cells in muted blues and greys with a pale four point star made of lighter cells |
| Mask | Same grid, star cells in orange tints by opacity, the rest transparent grid |
| Restored | Same photo-like cells with no star |

- Static. No animation. Each has a mono caption underneath and a thin `−` or `=` operator between them in `--ink-3`.
- Use hand written `<rect>` cells, not a script.

---

## 12. Modes section

### 12.1 Layout: a spec sheet, not cards

Three full-width rows separated by hairlines on the grey page: name (Bricolage 600, 32 px), one-line description, accepted types, and an "Open" link with its key chip (1, 2, 3). Grid `180px 1fr 200px 120px`, gap 24 px, 28 px vertical padding. The top border of the list is 1 px `--ink`, row separators are `--edge`. Hover: `--panel` background and 16 px side padding over 200 ms.

```text
Image  |  One file. Auto match, fine tuning, compare.      |  PNG, JPG, WEBP  |  Open  1
Video  |  One clip. Locks the mark, keeps original audio.  |  MP4             |  Open  2
Batch  |  Many files, folders or a ZIP. One ZIP back.      |  Images and MP4  |  Open  3
```

- "Open" switches the mode tab, scrolls to the top and focuses the dropzone.
- The two sample photos from the old hero sit on the right of the heading as a straight strip (4:5, `--r-3`, crop marks). No tag chips. Maximum two images.

---

## 13. FAQ

### 13.1 Design

- Heading left (4 columns), list right (8 columns).
- No grey boxes. Hairline separators only. Top border of the list is 1 px `--ink`.
- Question: Bricolage 600, 20 px. Answer: Figtree 16 / 26, `--ink-2`, `max-width: 62ch`.
- Custom plus icon (no browser triangle) that rotates 45 degrees to become a cross when open.
- Inline formulas use `.mono` with a `--panel` background, 2 px 6 px padding, `--r-1`.

```css
.faq details { border-bottom: var(--edge); }
.faq details:first-child { border-top: 1px solid var(--ink); }
.faq summary { list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 24px;
  padding: 24px 0; cursor: pointer; font: 600 20px/28px var(--font-display); letter-spacing: -0.01em; }
.faq summary::-webkit-details-marker { display: none; }
.faq summary::after { content: ""; flex: none; width: 16px; height: 16px;
  background: linear-gradient(currentColor, currentColor) center / 100% 2px no-repeat, linear-gradient(currentColor, currentColor) center / 2px 100% no-repeat;
  transition: transform var(--d-3) var(--ease); }
.faq details[open] summary::after { transform: rotate(45deg); }
.faq summary:hover { color: var(--signal-press); }
.faq .answer { padding: 0 48px 28px 0; color: var(--ink-2); max-width: 62ch; }

@supports (interpolate-size: allow-keywords) {
  .faq details { interpolate-size: allow-keywords; }
  .faq details::details-content { block-size: 0; overflow: clip; transition: block-size var(--d-3) var(--ease), content-visibility var(--d-3) allow-discrete; }
  .faq details[open]::details-content { block-size: auto; }
}
```

Questions: keep the existing three and add two (answers in 23.4).

---

## 14. Footer

Full-bleed `.band-dark`. Three columns: wordmark with one sentence, quick links (Image, Video, Batch, FAQ) as plain text links, and the engine status LED. Bottom line in mono: "Runs in your browser. Files are not uploaded." No newsletter form, no social icons.

---

## 15. Workspace states

When a file is added, the hero is replaced by the workspace. The proof band and the sections below stay in the page but the workspace is the focus: scroll to the top and lock focus there.

### 15.1 Image result

```text
+-----------------------------------------------+   +------------------------+
|  ( Slider | Side by side | Flip )   loupe  eye |   |  Result                |
|  +-----------------------------------------+  |   |  LED meter  9/10       |
|  |                                         |  |   |  2048 x 2048   PNG     |
|  |            compare in a well            |  |   |------------------------|
|  |                                         |  |   |  Strength   ----[|]--  |
|  +-----------------------------------------+  |   |  Size       --[|]----  |
|  ticks ruler                                  |   |  Position   x 0  y 0   |
|  [thumb][thumb][thumb][ + ]                   |   |------------------------|
+-----------------------------------------------+   |  Match  Auto  >        |
                                                    |  [ Download PNG ]      |
                                                    +------------------------+
```

- Stage: `.marks`, well with the compare from section 10 (default 50 percent here).
- Toolbar above the well: segmented control (compare mode), loupe toggle, hold-to-see-original. All controls are 36 px, `--r-2`.
- Filmstrip below the ruler: 56 px thumbnails, `--r-2`, selected has a 2 px `--signal` outline with 2 px gap.
- Inspector: `--panel`, `--edge`, `--r-4`, `--sh-panel`, 340 px, padding 24 px.

**Confidence meter** (replaces any ring): 10 vertical cells, 8 x 18 px, 3 px gap, `--r-1`. Filled cells `--ok` (or `--warn` below 7). Value in mono next to it: `9 / 10`. Fill animates left to right at 40 ms per cell once.

**Faders** (sliders):

```css
.fader { --fill: 50%; -webkit-appearance: none; appearance: none; width: 100%; height: 44px; background: transparent; cursor: pointer; }
.fader::-webkit-slider-runnable-track { height: 6px; border-radius: 3px;
  background: linear-gradient(90deg, var(--signal) var(--fill), var(--bg-deep) var(--fill)); box-shadow: inset 0 1px 2px rgba(20,21,24,.3); }
.fader::-webkit-slider-thumb { -webkit-appearance: none; width: 28px; height: 20px; margin-top: -7px; border-radius: 5px;
  background:
    repeating-linear-gradient(90deg, transparent 0 4px, var(--line-strong) 4px 5px) center / 16px 10px no-repeat,
    var(--panel-raised);
  box-shadow: 0 2px 0 var(--line-strong), 0 6px 10px -6px rgba(20,21,24,.6); }
.fader:active::-webkit-slider-thumb { transform: translateY(1px); box-shadow: 0 1px 0 var(--line-strong); }
.fader::-moz-range-track { height: 6px; border-radius: 3px; background: var(--bg-deep); }
.fader::-moz-range-progress { height: 6px; border-radius: 3px; background: var(--signal); }
.fader::-moz-range-thumb { width: 24px; height: 18px; border-radius: 5px; border: 0; background: var(--panel-raised); box-shadow: 0 2px 0 var(--line-strong); }
```

- Each fader has a mono readout on the right (`0.82x`), a `.ticks` strip under the track, min and max in `--t-mono`.
- Reset restores auto values. Undo and redo are supported for the last 30 changes.

**Primary action:** full width, 56 px, `.btn-primary`, label "Download PNG". After click it reads "Saved" with a check for 2 s.

### 15.2 Reveal (no bursts, no particles)

When the first result is ready for a file, the compare line wipes from the left edge to its resting position in 600 ms and the LED meter fills. That is the whole celebration.

### 15.3 No mark found

Inspector title "No mark found", body "The five known positions were checked. This image may already be clean." Actions: "Search all corners", "Place by hand". Download becomes "Download original" (secondary). Status LED is amber, not red.

### 15.4 Video

- Same stage. Transport row under the well: 44 px square play key (`--signal`, ink glyph, hard edge), mono time, frame step keys.
- Timeline is a recorder tape: 10 px track in `--bg-deep`, played portion `--signal`, `.ticks` beneath with a second every 40 px, playhead is the same grip as the compare.
- Inspector lists "Find the mark" as three real steps with mono numbers and LEDs (grey, orange, green).
- Processing block replaces the primary button: label "Cleaning video", progress bar 10 px high in `--signal` with square ends, mono "Frame 1488 of 2400" and "14 s left", Cancel as secondary.
- Complete: LED green, "Video is clean", `.btn-primary` "Download MP4".

### 15.5 Batch

- Summary strip (one row, not four tiles): four mono readouts separated by hairlines: `24 files`, `18 cleaned`, `1 needs a look`, `5 waiting`. Each has an LED.
- Overall progress: 6 px bar, `--signal`.
- Queue is a **ledger table**: header row in `--bg-deep`, 56 px rows, hairline separators, columns: thumbnail 40 px (`--r-1`), name (middle truncate), type, size (mono, right aligned), status (LED plus text), action (text button).
- Row hover: `--signal-tint` background. Selected: 2 px `--signal` left edge.
- Footer actions: "Pause" or "Start", "Download all as ZIP" (primary, only when at least one is cleaned).

### 15.6 Preview modal

`--well` surface, `--r-4`, `--sh-well`. Header: file name and a Cleaned or Original switch. Footer: mono metadata and the Download button. Backdrop `rgba(20,21,24,.6)`, no blur.

---

## 16. Component library

### 16.1 Buttons

```css
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; height: 44px; padding: 0 20px; border-radius: var(--r-2);
  font: 600 15px/1 var(--font-ui); transition: transform var(--d-1) var(--ease), box-shadow var(--d-1) var(--ease), background var(--d-2); }
.btn-primary { height: 52px; padding: 0 26px; background: var(--signal); color: var(--ink); box-shadow: var(--highlight), var(--sh-key); }
.btn-primary:hover { background: #ff5e33; }
.btn-primary:active { transform: translateY(2px); box-shadow: var(--highlight), 0 0 0 var(--signal-press), 0 4px 8px -6px rgba(20,21,24,.45); }
.btn-secondary { background: var(--panel-raised); color: var(--ink); box-shadow: var(--highlight), 0 0 0 1px var(--line-strong), 0 2px 0 var(--line-strong); }
.btn-secondary:active { transform: translateY(1px); box-shadow: 0 0 0 1px var(--line-strong); }
.btn-ghost { color: var(--ink-2); } .btn-ghost:hover { background: var(--signal-tint); color: var(--ink); }
.btn[disabled] { background: var(--bg-deep); color: var(--ink-3); box-shadow: none; pointer-events: none; }
```

Rules: one `.btn-primary` per view. No icons inside primary buttons except the check after saving. No arrows.

### 16.2 Segmented control

Same construction as the mode switch (8.4) at 36 px height, no LED dot.

### 16.3 Chips, toggle, tooltip, toast, inputs

- **Chip:** rectangular `--r-1`, 24 px high, mono 12 px, status tint plus ink text, optional LED.
- **Toggle:** 44 x 24, `--r-2`, inset `--bg-deep` track, 18 px raised thumb with hard edge, on state `--signal`.
- **Tooltip:** `--well` background, `--well-text`, `--r-1`, mono 12 px, 400 ms delay, key chip when a shortcut exists.
- **Toast:** `--well` background, bottom center, `--r-3`, LED, one line, optional "Undo" text button in `--signal`; 4 s (8 s with action).
- **Input:** 40 px, `--panel-raised`, `--r-2`, inset shadow, 1 px `--line-strong`; focus is a 2 px `--ink` outline plus a 2 px `--signal` underline.

---

## 17. Motion

### 17.1 Rules

Motion answers an action or marks a state change; no decorative loops. Animate only `transform`, `opacity` and `clip-path` (plus `block-size` on the FAQ and progress width). Durations: 120 ms press, 200 ms hover, 320 ms panel, 600 ms reveal.

### 17.2 Inventory

- **Page load:** nav fades in 200 ms; H1, sub and ledger rise 12 px and fade with a 70 ms stagger; the dropzone rises 16 px at 180 ms. Under 600 ms, once.
- **Press:** button moves down 2 px and its hard shadow collapses.
- **Tabs:** active segment slides 200 ms and its LED turns orange.
- **Drag over:** crop marks travel inward 6 px and turn orange.
- **Proof band enters:** compare line settles from 100 to 62 percent, once.
- **Result ready:** line wipe 600 ms, LED cells fill at 40 ms each.
- **FAQ:** icon rotates 45 degrees, height eases 320 ms.
- **Processing:** logo mark turns 4 s per turn and the progress bar advances. Nothing else moves.

### 17.3 Not allowed

Parallax, scroll-linked animation, cursor followers, tilt on hover, looping floating elements.

---

## 18. Responsive

- **1024 to 1239 px:** hero columns stay 5 : 7; inspector 320 px.
- **760 to 1023 px:** hero stacks as headline, sub, dropzone, ledger. Proof band: compare full width, loupes side by side below. Spec rows drop the type column.
- **Below 760 px:** single column. Nav: logo and engine chip on row one, mode switch full width on row two. Inspector becomes a bottom sheet (collapsed 160 px, primary button always visible). The table collapses to name plus status. Crop marks shrink to 12 px. Dropzone ratio becomes `4 / 3`.
- Touch targets are at least 44 px everywhere.

---

## 19. Accessibility

- Contrast 4.5 : 1 minimum. Verified: `--ink` on `--bg` 14.7, `--ink-3` on `--panel` 4.7, `--well-text-2` on `--well` 7.9, `--ink` on `--signal` 5.8. **Never white text on `--signal`.**
- Focus ring: 2 px `--ink` with 3 px offset on light, `--signal` on dark. Never removed.
- Mode switch is a `tablist` (arrows, `Home`, `End`). Compare is a `role="slider"` with `aria-valuemin="2"`, `aria-valuemax="98"`, `aria-valuenow` and `aria-valuetext`; arrows move 1, shift plus arrows 10.
- Status is always LED plus text. FAQ uses native `<details>`. Loupe wells are `role="img"` with labels like "Before, mark region enlarged six times".
- One polite live region announces file added, result ready, progress at 25 percent steps, done and failed. Decorative SVG is `aria-hidden="true"`.

---

## 20. Performance

Reserve the dropzone and compare aspect ratios in CSS (no layout shift). Preload only Bricolage 700 and Figtree 500. Proof images get real `width` and `height` and `decoding="async"`; only the compare pair loads eagerly. The noise texture is a data URI under 1 KB. Lighthouse on the landing view: Performance 90 or more, Accessibility 100, CLS under 0.02.

---

## 21. Build phases

Work in order. After each phase open the page in a browser, test a real file drop, and compare screenshots at 1440, 1024 and 390 px.

1. Tokens, base, fonts, noise texture, container.
2. Nav bar and mode switch (opaque bar, LED tabs, keyboard).
3. Hero: left column, viewfinder dropzone, HUD, delete old decoration. Drop and choose must still work.
4. Proof band: compare, ruler, pixel loupes. Mouse, touch and keyboard drag.
5. How it works and the modes spec sheet.
6. FAQ rewrite and footer (custom accordion, no default markers).
7. Workspace restyle: image, video, batch, modal. Processing must behave exactly as before.
8. Motion, reduced motion, responsive and accessibility pass. Section 22 must pass.

---

## 22. Acceptance criteria

### 22.1 Functional (must be unchanged)

- [ ] Drop, click, paste and folder input add files.
- [ ] Image, video and batch processing give the same output as before the redesign.
- [ ] All ids and event hooks used by `main.js` are intact.
- [ ] Mode switch, engine chip, settings still open and work.
- [ ] No console errors.

### 22.2 Visual

- [ ] The squint test shows the headline, the dropzone and the section bands.
- [ ] One saturated accent (orange) plus status colors only where a status exists.
- [ ] The hero has no cards, tilted photos or chips; the dropzone is its largest object.
- [ ] Sections alternate light, dark, light, grey, light, dark.
- [ ] Crop marks surround every well; ticks sit beside the compare and the faders.
- [ ] No `backdrop-filter`, no emoji, no uppercase text, no white text on orange.
- [ ] No gradients except the faint mask inside the dropzone grid and slider fills.

### 22.3 Content and quality

- [ ] Only copy from section 23 or the original text is used; no invented numbers, logos or testimonials.
- [ ] 390, 768, 1024, 1440 and 1920 px verified with no horizontal scroll.
- [ ] Keyboard-only, reduced-motion and contrast passes done; Lighthouse targets in section 20 met.

### 22.4 Report back

Output a short report: files changed, phases completed, anything skipped and why, screenshots captured.

---

## 23. Copy deck

### 23.1 Hero and dropzone

| Place | Text |
| --- | --- |
| H1 | Drop a file. Get it back clean. |
| Sub | Removes the visible sparkle mark from AI images and videos by reversing the blend, not painting over it. |
| Ledger 1 | Add. Image, video or a whole folder |
| Ledger 2 | Clean. The mark is reversed, not painted over |
| Ledger 3 | Save. Same resolution as the source |
| Drop title | Drop an image, video or folder |
| Drop title (drag) | Release to add |
| Drop title (invalid) | That file type is not supported |
| Button | Choose files |
| Types | PNG  JPG  WEBP  MP4  ZIP |
| HUD left | Ready |
| HUD right | Runs in this browser. Nothing is uploaded. |

### 23.2 Proof band

| Place | Text |
| --- | --- |
| Heading | See the mark come off. |
| Sub | Drag the line. The mark sits in the bottom right corner. |
| Labels | Original, Cleaned |
| Loupe labels | Before, After |
| Caption | Pixel values restored by reversing the blend. |

### 23.3 How it works

| Place | Text |
| --- | --- |
| Heading | Reversing a blend |
| Body | The mark was added with a known blend. Run the blend backwards and the original pixel value comes back. |
| Legend | W watermarked pixel. O original pixel. L logo color. α mask opacity. |
| Captions | Watermarked, Mask, Restored |

### 23.4 FAQ answers

1. **How does the blend reversal work?** "The mark is a semi-transparent layer blended over the picture. The tool knows its shape and opacity, so it solves the blend equation for the original pixel instead of painting over it." Then show the equation in mono.
2. **Are my files uploaded to a server?** "No. By default everything runs in your browser and nothing leaves your device. If you choose a local engine, files go only to the address you set."
3. **Can I process many images and videos at once?** "Yes. Use Batch to add files, folders or a ZIP. You get one ZIP of cleaned files back."
4. **Does this remove invisible watermarks?** "No. It reverses only the visible sparkle mark. Any invisible provenance data stays in the pixels."
5. **What can go wrong?** "Heavily compressed or resized files may not restore perfectly because the pixel values no longer match the known blend. Use the fine tuning controls and compare to check the result."

### 23.5 Words that must not appear

revolutionary, seamless, magical, cutting-edge, supercharge, unleash, next-gen, AI-powered, one click, 100% lossless, zero blur.

---

End of brief.