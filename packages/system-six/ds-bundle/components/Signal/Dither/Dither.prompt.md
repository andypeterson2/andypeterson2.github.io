# <s6-dither>

A 1-bit dithered fill — the honest System 6 gray (L2). Size the element; the fill fills it. `light` is the only density safe behind text.

## Attributes
- `density` ('light'|'25'|'50'|'75'|'hatch') — ordered dither density

## Usage
```html
<s6-dither density="light" style="display:inline-block;width:90px;height:48px;border:2px solid var(--color-border)"></s6-dither>
<s6-dither density="25" style="display:inline-block;width:90px;height:48px;border:2px solid var(--color-border)"></s6-dither>
<s6-dither density="50" style="display:inline-block;width:90px;height:48px;border:2px solid var(--color-border)"></s6-dither>
<s6-dither density="hatch" style="display:inline-block;width:90px;height:48px;border:2px solid var(--color-border)"></s6-dither>
```

## Rules (from the design system)
- Load `styles.css` and `_ds_bundle.js`; the element registers itself and is styled by the closure.
- Color appears only via `<s6-status>`; everything else is 1-bit black/white.
- Grays are `<s6-dither>`, never flat. `light` is the only density readable behind text.
