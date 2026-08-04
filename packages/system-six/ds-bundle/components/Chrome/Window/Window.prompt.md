# <s6-window>

A System 6 window — title bar, optional details bar, and a body your content projects into.

## Attributes
- `title` (string) — text shown in the title bar
- `details` (string?) — optional details-bar text

## Usage
```html
<s6-window title="Panel" details="/ status">
  <s6-section-rule>Health</s6-section-rule>
  <p>Body content projects into the window.</p>
  <s6-status state="success" label="Connected"></s6-status>
</s6-window>
```

## Rules (from the design system)
- Load `styles.css` and `_ds_bundle.js`; the element registers itself and is styled by the closure.
- Color appears only via `<s6-status>`; everything else is 1-bit black/white.
- Grays are `<s6-dither>`, never flat. `light` is the only density readable behind text.
