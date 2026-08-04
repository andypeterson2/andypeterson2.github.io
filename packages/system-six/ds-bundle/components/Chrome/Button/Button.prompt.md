# <s6-button>

A push button. Emits system.css `.btn`.

## Attributes
- `disabled` (boolean?) — present = disabled

## Usage
```html
<s6-button>OK</s6-button>
<s6-button disabled>Disabled</s6-button>
```

## Rules (from the design system)
- Load `styles.css` and `_ds_bundle.js`; the element registers itself and is styled by the closure.
- Color appears only via `<s6-status>`; everything else is 1-bit black/white.
- Grays are `<s6-dither>`, never flat. `light` is the only density readable behind text.
