# Design System

The design-system specification lives at **[docs/design-system.md](docs/design-system.md)** —
that file is the single source of truth for color, spacing, typography, border,
shadow, and component rules.

Quick pointers:

- **Tokens:** `packages/system-six/styles/tokens.css` (the only place hex values
  should appear; everything else uses `var(--*)` tokens).
- **Design ethos:** [docs/design-ethos.md](docs/design-ethos.md).
- **Enforcement:** `npm run lint` runs the token/font-size stylelint configs
  (`.stylelintrc.tokens.json`, `.stylelintrc.fontsize.json`) and the local ESLint
  rules in `scripts/eslint-plugin-design-system.js`.

An earlier, pre-`system-six` version of this file described a different palette and
token layout; it was retired because it contradicted the shipped system.
