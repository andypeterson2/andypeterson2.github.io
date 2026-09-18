# system-six

The [System 6](https://en.wikipedia.org/wiki/System_6) design-system **CSS closure** —
tokens, base idiom, dither textures, and element styles — consumed by the site as a
single import. The design lives entirely in the stylesheet; pages write plain
System-6 markup (`system.css` classes + these tokens).

The tokens in `styles/tokens.css` are the class and token vocabulary; every hex
value lives there and everything else refers to it.

## Usage

One import in the host layout (the site does this in `BaseLayout.astro`, after the
vendored `@sakun/system.css` chrome):

```css
@import '../../packages/system-six/styles/styles.css';
```

`styles/styles.css` is the closure: `tokens.css` → `base.css` → `dither.css` →
`elements.css`, in that order.

## Files

| File | Owns |
|------|------|
| `styles/tokens.css` | The ink scale, type/space scales, z-index ladder, status hues |
| `styles/base.css` | Resets, the invert idiom, dark mode (page-scale filter) |
| `styles/dither.css` | The Mac-dither background textures |
| `styles/elements.css` | The apps' shared `.s6-btn` button (all that remains of the element tier) |

## History

This package once carried a Web-Components tier (light-DOM `<s6-*>` elements
emitting the same classes) plus its own esbuild/tsc toolchain. Nothing on the site
used it, so it was removed; the CSS closure was always the part doing the work.
