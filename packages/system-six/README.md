# system-six

Thin **Web Components** over the [System 6](https://en.wikipedia.org/wiki/System_6) design
system. Each element is a **light-DOM** custom element that emits the real `system.css` classes
and design tokens and carries **no styling of its own** — the design lives entirely in the
stylesheet. So the components stay a few lines each, work in any framework (or none), and render
identically to hand-written System-6 markup.

The *why* behind the design is [`docs/design-ethos.md`](../../docs/design-ethos.md); the class/token
vocabulary is [`docs/design-system.md`](../../docs/design-system.md). This package makes it composable.

## Setup

Load four things on the page, then import the bundle:

```html
<head>
  <!-- 1. no-FOUC theme bootstrap — before the stylesheets -->
  <script>
    try { if (localStorage.getItem('sm-theme') === 'dark') document.documentElement.dataset.theme = 'dark'; } catch (e) {}
  </script>
  <!-- 2. System 6 chrome -->
  <link rel="stylesheet" href="https://unpkg.com/@sakun/system.css@0.1.11/dist/system.css" />
  <!-- 3. the design layer (tokens, base idiom, dark mode, dither, element layout) -->
  <link rel="stylesheet" href="system-six/styles/styles.css" />
</head>

<script type="module">
  import 'system-six'; // registers every element (side effect)
</script>
```

## Elements

| Element | Attributes | Emits |
|---|---|---|
| `<s6-window>` | `title`, `details?` | `.window › .title-bar > .title` (+ `.details-bar`) `› .window-body` |
| `<s6-button>` | `disabled?` | `button.btn` |
| `<s6-section-rule>` | — | `.section-rule` (uppercase label between hairlines) |
| `<s6-icon-grid>` | — | `.icon-grid` |
| `<s6-finder-icon>` | `src`, `label`, `href?` | `a.finder-icon › .icon-box > img.icon-glyph` + `.icon-label` |
| `<s6-dither>` | `density` = `light\|25\|50\|75\|hatch` | `.dither-<density>` |
| `<s6-status>` | `state` = `success\|warning\|danger\|idle`, `label` | a colored dot + label (reactive) |
| `<s6-theme-toggle>` | — | `button.theme-toggle`, flips `data-theme` + persists |

Two rules that come from the design, not the components:

- **Color only reports state.** `<s6-status>` is the one element that carries a hue; everything
  else is 1-bit black/white. Don't reach for color anywhere else.
- **Grays are `<s6-dither>`, never flat.** `light` is the only density readable behind text.

## Example

```html
<s6-window title="Panel" details="/ status">
  <s6-section-rule>Health</s6-section-rule>
  <p>Body content projects into the window.</p>
  <s6-status state="success" label="Connected"></s6-status>
  <s6-dither density="25" style="height: 48px; border: 2px solid var(--color-border)"></s6-dither>
  <s6-button>OK</s6-button>
</s6-window>
```

## Build

```bash
npm install
npm run build   # → dist/system-six.esm.js (import) + dist/system-six.global.js (window.SystemSix) + .d.ts
```

Styling is **not** in the components. To change the look, edit `styles/{tokens,base,dither}.css` —
the single source of truth, consumed by this package and by the site that owns it.
