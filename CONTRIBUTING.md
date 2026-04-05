# Contributing

## Monorepo Workflow

- Branch from `main` and open PRs back to `main`.
- Run `make test` before pushing to verify nothing is broken.
- CI is path-filtered: only the projects affected by your changes are tested,
  so builds stay fast.
- Changes to shared packages (`packages/ui-kit`, `packages/shared-js`) trigger
  downstream tests for all consumers. Keep this in mind when modifying shared
  code -- a small change can have wide impact.

## Design System

This project uses a Mac System 6-inspired design system with strict token-based
styling rules. See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for the full
specification including color, spacing, typography, border, and component rules.
