# <s6-finder-icon>

A single Finder icon — a 1-bit glyph over a label, invert-on-hover.

## Attributes
- `src` (string) — glyph URL (1-bit SVG so it inverts with the theme)
- `label` (string) — caption
- `href` (string?) — link target

## Usage
```html
<s6-finder-icon src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 4 4' fill='%23000'%3E%3Crect width='1.6' height='1.6'/%3E%3Crect x='2.4' width='1.6' height='1.6'/%3E%3Crect y='2.4' width='1.6' height='1.6'/%3E%3Crect x='2.4' y='2.4' width='1.6' height='1.6'/%3E%3C/svg%3E" label="Nonogram" href="#"></s6-finder-icon>
```

## Rules (from the design system)
- Load `styles.css` and `_ds_bundle.js`; the element registers itself and is styled by the closure.
- Color appears only via `<s6-status>`; everything else is 1-bit black/white.
- Grays are `<s6-dither>`, never flat. `light` is the only density readable behind text.
