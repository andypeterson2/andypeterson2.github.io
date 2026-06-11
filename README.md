# andypeterson.dev

Standalone [Astro](https://astro.build) portal for andypeterson.dev. Each sub-project
lives in its own repository; the portal embeds their built frontends (vendored under
`public/<app>/`) and talks to their optional backends over a shared HTTP API contract.

## Directory Structure

```
src/                      Astro 6 portal (pages, layouts, components, styles)
public/                   Served as-is, including vendored sub-app frontends:
  classifiers/ nonogram/ video-chat/ cv/   built JS/CSS from each app repo
  vendor/ui-kit/                           ui-kit runtime (icons.js, ui-kit.js)
  js/                                      portal scripts (contract client, modal)
packages/shared-js/       Shared browser scripts (service config, nav, theme bootstrap)
docs/api-contract/        The written API contract (CONTRACT.md + JSON schemas)
scripts/                  Manifest generator, vendor-app.sh, CI helpers
tests/                    Vitest (unit) + Playwright (e2e)
```

The sub-app repositories:

| App | Repo | Backend |
|-----|------|---------|
| LaTeX résumé editor | [andypeterson2/cv](https://github.com/andypeterson2/cv) | Express · :3001 |
| Quantum nonogram solver | [quantum-nonogram-solver](https://github.com/Quantum-Interns-at-Qualcomm-Institiute/quantum-nonogram-solver) | Flask · :5055 |
| ML classifier platform | [quantum-machine-learning](https://github.com/andypeterson2/quantum-machine-learning) | Flask · :5001 |
| Quantum video chat | [Quantum-Video-Chat](https://github.com/Quantum-Interns-at-Qualcomm-Institiute/Quantum-Video-Chat) | Flask · :5050 |
| ui-kit design system | [andypeterson2/ui-kit](https://github.com/andypeterson2/ui-kit) | — |

## Quick Start

Requires **Node ≥ 22** (e.g. `nvm use 22`).

```bash
git clone https://github.com/andypeterson2/andypeterson2.github.io.git
cd andypeterson2.github.io
make setup     # npm ci
npm run dev    # Astro dev server on localhost:4321
```

No `--recursive` and no submodules — the portal builds entirely from this repo.

## Running a backend locally

The portal is static and deploys without any backend. To exercise a sub-app's live
backend, clone its repo and run it (see that repo's README), then point the portal at
it with a query param — e.g.
`http://localhost:4321/classifiers/?backend=http://localhost:5001`.
`packages/shared-js/service-config.js` resolves backend URLs (`?backend=`, `?<svc>=`,
localStorage, or the page's default port).

## Refreshing vendored assets

Each app's built frontend is committed under `public/<app>/`. To re-vendor from an
app's own repo:

```bash
scripts/vendor-app.sh <classifiers|nonogram|video-chat|ui-kit>   # or: all
```

(cv's frontend is maintained in this repo and is not synced.) Review the diff, then commit.

## Testing

```bash
make test       # vitest unit tests
make test-e2e   # playwright e2e
make lint       # eslint + prettier + stylelint
npm run format  # auto-fix formatting
```

## Deployment

Pushed to GitHub Pages (`andypeterson.dev`) by `.github/workflows/deploy.yml` after CI
passes — a portal-only static build, no submodules.

## Tech Stack

| Layer    | Tools                            |
|----------|----------------------------------|
| Frontend | Astro 6, TypeScript, system.css  |
| Testing  | Vitest, Playwright               |
| Infra    | GitHub Actions, GitHub Pages     |
| Linting  | ESLint, Prettier, Stylelint      |

## License

MIT -- see [LICENSE](LICENSE).
