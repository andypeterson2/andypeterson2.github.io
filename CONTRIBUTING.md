# Contributing

## Workflow

- Branch from `main` and open PRs back to `main`.
- Run `make test && make lint` before pushing.
- CI lints, unit-tests, builds, runs Playwright e2e, validates the API-contract JSON
  schemas, and checks Lighthouse budgets.
- Sub-app code lives in its own repository; this repo holds the portal plus each app's
  vendored frontend under `public/<app>/`. To pull in upstream app changes, refresh the
  vendored assets with `scripts/vendor-app.sh <app>` and commit the result (review the
  diff — the committed assets are what ships).

## Design System

This project uses a Mac System 6-inspired design system with strict token-based
styling rules. See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for the full
specification including color, spacing, typography, border, and component rules.
