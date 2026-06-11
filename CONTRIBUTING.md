# Contributing

## Workflow

- Branch from `main` and open PRs back to `main`.
- Run `make test && make lint` before pushing.
- CI lints, unit-tests, builds, runs Playwright e2e, validates the API-contract JSON
  schemas, and checks Lighthouse budgets.
- Sub-app backends live in their own repositories; this repo **owns** each app's frontend
  under `public/<app>/` (edit it here directly) and talks to the backends over the API
  contract.

## Design System

This project uses a Mac System 6-inspired design system with strict token-based
styling rules. See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for the full
specification including color, spacing, typography, border, and component rules.
