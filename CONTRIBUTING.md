# Contributing — Design System Rules

## Token Workflow

1. Edit `src/styles/tokens.css` directly — this is the hand-maintained source of truth
2. `tokens.json` and `scripts/build-tokens.js` exist but the generation pipeline is not in use
3. Do not run `npm run tokens` — the generated files have been removed

## Color Rules

- **No raw hex values** in component or page CSS. Always use `var(--color-*)` tokens.
- The token file (`src/styles/tokens.css`) is the only place hex values should appear.
- Pure monochrome palette: black (#000), white (#fff), and minimal grays (#666, #eee, #ccc, #ddd). No blue accent, no green status — all semantic colors map to black.
- Color never carries meaning alone — always paired with text, icon, or position.

## Spacing Rules

- All spacing values must be multiples of 4px, using `var(--space-*)` tokens.
- No magic numbers: `5px`, `10px`, `15px` are not valid spacing values.

## Border Radius

- `0px` — containers, cards, sections, code blocks (structural elements)
- `2px` — buttons, inputs, tags/badges (interactive controls)
- `3px` — nav active backgrounds, dropdowns (system UI elements)
- `50%` — avatar only
- No other radius values are permitted.

## Typography

- Geneva (`--font-sans`) for body text and headings
- Chicago (`--font-ui`) for window chrome / title bars only
- Monaco (`--font-mono`) for labels, tags, code, metadata
- All fonts loaded via system.css @font-face declarations
- Mono text never exceeds `--text-sm` in size
- All caps only for section labels and category tags (Monaco, `--text-xs`)

## Components

When a design system component exists, use it instead of raw HTML:

| Raw HTML | Use Instead |
|----------|-------------|
| `<button>` | `<Button>` component |
| `<a>` (styled card) | `<Card href="...">` component |
| `<span class="tag">` | `<Tag>` component |
| `<code>` (block) | `<CodeBlock>` component |

Override with an eslint-disable comment + justification when genuinely needed.

## New Component Checklist

1. Define in `src/components/` as an Astro component
2. Use scoped `<style>` with only token-based values
3. Include proper TypeScript interface for props
4. Ensure 48px minimum touch targets for interactive elements
5. Add `aria-label` for elements without visible text
6. Test in both light and dark modes

## Images

- Use Astro's `<Image>` component from `astro:assets` — never raw `<img>` tags
- Store source images in `src/assets/` (not `public/`) so Astro can optimize them
- Sharp generates WebP/AVIF at build time; no manual format conversion needed
- Always provide descriptive `alt` text:
  - Screenshots/diagrams: describe what's shown ("QKD key exchange sequence diagram")
  - Decorative images: use `alt=""` with `aria-hidden="true"`
  - Avoid "image of" or "photo of" prefixes — screen readers already announce it as an image
- Use `loading="lazy"` for below-fold images (Astro Image does this by default)
- Provide `width` and `height` to prevent layout shift

## Shadows

- Nav bar: `0 1px 3px rgba(0, 0, 0, 0.06)` (always present)
- Modals: `0 4px 16px rgba(0, 0, 0, 0.10)` (only substantial shadow)
- Everything else: no shadow
