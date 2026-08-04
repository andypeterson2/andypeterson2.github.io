# Design system — conventions (how to build with it)

The concrete companion to [`design-ethos.md`](./design-ethos.md): that file is the *why*
(the eight laws and the L2 ≡ L6 center); this is the *how* — the real vocabulary, named,
so anyone (or an agent) can build on-brand without guessing. **In one line: an honest,
1-bit, System-6 interface — black ink on white, grays are dithered not flat, and color
appears only to report machine state.** Every name below is verified present in the build.

## Setup — what's on the page

- **Base chrome:** [`@sakun/system.css@0.1.11`](https://unpkg.com/@sakun/system.css@0.1.11)
  (a faithful **Apple System 6**), CDN-loaded with SRI in `BaseLayout.astro`. It owns the
  chrome classes: **`.window`**, **`.title-bar`** (+ `.title`), **`.details-bar`**,
  **`.window-body`**, **`.btn`**, plus scrollbars, inputs, menus, dialogs. Bootstrap-icons
  (`<i class="bi bi-…">`) is also loaded.
- **Local layers**, imported by `BaseLayout.astro` in this order — read them before styling:
  1. `src/styles/tokens.css` — the entire token vocabulary (short; authoritative).
  2. `src/styles/base.css` — resets, the invert idiom, **dark mode**, `.section-rule`,
     `.finder-icon` / `.icon-grid`, print + reduced-motion.
  3. `src/styles/dither.css` — the 1-bit ordered fills.
- **No provider/wrapper framework** — it's CSS classes + tokens. The "wrapper" is a System-6
  window: `.window` › `.title-bar` › `.window-body`.
- **Fonts** (loaded by system.css `@font-face`): Chicago = chrome titles only, Geneva = body,
  Monaco = data/code. Reach for them via the `--font-*` tokens, never by raw family.

## The styling idiom — token + system.css class

Not utility-first (no Tailwind), not prop-based. You compose **system.css chrome classes** and
reach for **`var(--*)` tokens** for the local vocabulary. The rules:

**Color — monochrome ink, plus a status light.**
- Ink `var(--color-text)` `#000` · ground `var(--color-bg)` `#fff` · edges `var(--color-border)`
  `#000` · one gray `var(--color-text-muted)` `#666` for **de-emphasized text only**.
- The **only** hues are the status scale — `var(--color-success)` · `var(--color-warning)` ·
  `var(--color-danger)` — used **exclusively** to report machine state (connected, warning,
  error/compromised). Never add a color; never use color for hierarchy or decoration. There is
  deliberately **no** `--color-surface`, `--color-accent`, or `--color-secondary`.

**Grays are dither, never flat.**
- Fills use the 1-bit ramp — classes `.dither-light` (~12.5%) · `.dither-25` · `.dither-50`
  (the classic Mac gray) · `.dither-75` · `.dither-hatch`, or the `var(--dither-*)` tokens as a
  `background`.
- **Density is a legibility budget:** only `.dither-light` behind running text; `.dither-25`
  and denser are for chrome/decorative fills. Dense text (inline `code`) gets a **white inset**
  (`background:#fff` + `1px solid #000`), not dither.

**Interaction = inversion.** Every hover / selection / active state is a black↔white flip —
`a:hover{background:#000;color:#fff}`, `::selection{background:#000;color:#fff}`, icons
`filter:invert(1)`. Style interactive states as inversion, **never** a color-shift, glow, or
elevation.

**Hard edges.** 1–2px solid `#000` borders, **no border-radius**, hard shadow
`var(--shadow-focus)` (`2px 2px 0 #000`). Never blur or soften.

**Hierarchy is typographic and spatial, never chromatic.** Rank by weight, size (`--text-*`),
uppercase + `--tracking-wide`, dither density, chrome, and whitespace (`--space-*`). If you
reach for a color to show importance, stop — that's not this system.

**Type roles:** `--font-ui` (Chicago) for window/section titles only · `--font-sans` (Geneva)
for body + headings · `--font-mono` (Monaco) for data/code.

## Dark mode — do nothing special

Set `data-theme="dark"` on `<html>` and the whole page inverts as one filter
(`html[data-theme=dark]{filter:invert(1) hue-rotate(180deg)}`). **Write no per-element dark
rules and no dark colors** — everything (text, borders, dither, the desktop pattern, the status
scale) flips correctly because the design is honestly 1-bit + monochrome-SVG. Just don't
introduce raster images or off-scale colors, or you'll break the single-negative guarantee.

## One idiomatic build

```html
<div class="window">
  <div class="title-bar"><h2 class="title">Panel</h2></div>
  <div class="window-body">
    <p style="font-family: var(--font-sans)">Monochrome body — hierarchy by type, not hue.</p>

    <!-- a dithered inset: chrome fill, not behind prose -->
    <div class="dither-25" style="height: 48px; border: 2px solid var(--color-border)"></div>

    <!-- color appears ONLY to report state -->
    <p><span style="color: var(--color-success)">●</span> Connected</p>

    <button class="btn">OK</button>
  </div>
</div>
```

## Where the truth lives

`src/styles/{tokens,base,dither}.css` (the vocabulary) · the CDN `system.css` (the chrome) ·
[`design-ethos.md`](./design-ethos.md) (the laws — read it to know what a *correct* choice is
here; the razor is *"does this make the interface more honestly 1-bit?"*, which answers "does it
look right" and "is it truer" at once).

> If this repo ever grows a real component library and runs `/design-sync` for real, this file
> is what `readmeHeader` should point at — it's already the agent-facing conventions header.


---

## Components in this project

- **<s6-window>** (Chrome) — A System 6 window — title bar, optional details bar, and a body your content projects into.
- **<s6-button>** (Chrome) — A push button. Emits system.css `.btn`.
- **<s6-section-rule>** (Chrome) — A centered uppercase label between hairlines — structure without color (L5).
- **<s6-icon-grid>** (Chrome) — The Finder desktop — a responsive grid of icons (L7).
- **<s6-finder-icon>** (Chrome) — A single Finder icon — a 1-bit glyph over a label, invert-on-hover.
- **<s6-dither>** (Signal) — A 1-bit dithered fill — the honest System 6 gray (L2). Size the element; the fill fills it. `light` is the only density safe behind text.
- **<s6-status>** (Signal) — The status light — a colored dot + label. The ONLY place a hue appears (L3); reactive to state changes (L6).
- **<s6-theme-toggle>** (Signal) — The dark-mode control (L4). Flips data-theme on <html> and persists; the page inverts via one filter.
