# Contributing

## Workflow

- Branch from `main` and open PRs back to `main`.
- Run `make test && make lint && npm run typecheck` before pushing.
- CI audits dependencies, lints, typechecks, unit-tests, builds (with a CSP check on the
  output), runs the integration suite against the built `dist/`, runs Playwright e2e,
  validates the API-contract JSON schemas, and checks Lighthouse budgets.
- Sub-app backends live in their own repositories; this repo **owns** each app's
  frontend (the classifier and nonogram under `public/<app>/`, the CV editor as a
  Svelte island under `src/editor/`) and talks to the backends over the API contract.

## Design System

This project uses a Mac System 6-inspired design system with strict token-based
styling rules. See [docs/design-system.md](docs/design-system.md) for the full
specification including color, spacing, typography, border, and component rules.
