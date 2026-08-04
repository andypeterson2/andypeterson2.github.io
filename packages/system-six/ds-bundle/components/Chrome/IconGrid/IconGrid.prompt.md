# <s6-icon-grid>

The Finder desktop — a responsive grid of icons (L7).

## Attributes
_None._

## Usage
```html
<s6-icon-grid>
  <s6-finder-icon src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 4 4' fill='%23000'%3E%3Crect width='1.6' height='1.6'/%3E%3Crect x='2.4' width='1.6' height='1.6'/%3E%3Crect y='2.4' width='1.6' height='1.6'/%3E%3Crect x='2.4' y='2.4' width='1.6' height='1.6'/%3E%3C/svg%3E" label="Alpha" href="#"></s6-finder-icon>
  <s6-finder-icon src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 4 4' fill='%23000'%3E%3Crect width='1.6' height='1.6'/%3E%3Crect x='2.4' width='1.6' height='1.6'/%3E%3Crect y='2.4' width='1.6' height='1.6'/%3E%3Crect x='2.4' y='2.4' width='1.6' height='1.6'/%3E%3C/svg%3E" label="Beta" href="#"></s6-finder-icon>
  <s6-finder-icon src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 4 4' fill='%23000'%3E%3Crect width='1.6' height='1.6'/%3E%3Crect x='2.4' width='1.6' height='1.6'/%3E%3Crect y='2.4' width='1.6' height='1.6'/%3E%3Crect x='2.4' y='2.4' width='1.6' height='1.6'/%3E%3C/svg%3E" label="Gamma" href="#"></s6-finder-icon>
</s6-icon-grid>
```

## Rules (from the design system)
- Load `styles.css` and `_ds_bundle.js`; the element registers itself and is styled by the closure.
- Color appears only via `<s6-status>`; everything else is 1-bit black/white.
- Grays are `<s6-dither>`, never flat. `light` is the only density readable behind text.
