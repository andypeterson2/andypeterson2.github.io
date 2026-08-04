# <s6-status>

The status light — a colored dot + label. The ONLY place a hue appears (L3); reactive to state changes (L6).

## Attributes
- `state` ('success'|'warning'|'danger'|'idle') — which status token colors the dot
- `label` (string) — text

## Usage
```html
<s6-status state="success" label="Connected"></s6-status>
<s6-status state="warning" label="Degraded"></s6-status>
<s6-status state="danger" label="Compromised"></s6-status>
<s6-status state="idle" label="Idle"></s6-status>
```

## Rules (from the design system)
- Load `styles.css` and `_ds_bundle.js`; the element registers itself and is styled by the closure.
- Color appears only via `<s6-status>`; everything else is 1-bit black/white.
- Grays are `<s6-dither>`, never flat. `light` is the only density readable behind text.
