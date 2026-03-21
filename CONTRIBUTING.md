# Contributing to the Portfolio Website

## Design System Rules

### Adding a New Component

1. Create the component in `src/components/`
2. Use only CSS custom properties from `src/styles/tokens.css`
3. Use Astro scoped styles — no global CSS leakage
4. Support both dark and light themes via token variables
5. Test the component renders correctly

### Adding or Modifying Tokens

1. Edit `src/tokens/tokens.json` (the single source of truth)
2. Run `npm run tokens` to regenerate CSS and TypeScript outputs
3. Update `src/styles/tokens.css` to match (or use the generated file)
4. Verify both dark and light themes

### Token Rules

- **Colors:** Only use `var(--color-*)` — no raw hex/rgb values in components
- **Spacing:** Only use `var(--space-*)` — no arbitrary pixel/rem values
- **Typography:** Only use `var(--text-*)` for font sizes, `var(--font-*)` for families
- **Motion:** Only use `var(--duration-*)` for transitions

### Identity Safety

- Never hardcode names, emails, or identity-specific strings
- Always reference `siteConfig` from `src/config/site.ts`
- Run `scripts/check-name-leakage.sh` before committing

## Code Style

- TypeScript strict mode
- ESLint + Prettier formatting (run `npm run lint` and `npm run format`)
- Astro components use scoped `<style>` blocks
