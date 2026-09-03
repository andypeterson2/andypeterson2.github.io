# andypeterson.dev

Standalone [Astro](https://astro.build) portal for andypeterson.dev. Each sub-project
lives in its own repository; the portal owns their built frontends under `public/<app>/`
and talks to their optional backends over a shared HTTP API contract.

## Directory Structure

```
src/                      Astro 7 portal (pages, layouts, components)
src/editor/               The CV editor — a Svelte 5 island (components + runes stores)
src/apps/                 App frontends as typed modules (shared portal scripts,
                          ui-kit runtime, classifier + nonogram apps), bundled per page
public/                   Served as-is: model weights, the nonogram gallery, vendored socket.io
packages/system-six/      The portal's design-system CSS (tokens + element styles)
docs/api-contract/        The written API contract (CONTRACT.md + JSON schemas)
scripts/                  Manifest generator, CI helpers
tests/                    Vitest (unit + integration) + Playwright (e2e)
```

The sub-app repositories:

| App | Repo | Backend |
|-----|------|---------|
| LaTeX resume editor | [andypeterson2/cv](https://github.com/andypeterson2/cv) | Express · :3001 |
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
`http://localhost:4321/projects/ai-ml/app/?backend=http://localhost:5001`.
`src/apps/shared/service-config.ts` resolves backend URLs (`?backend=`, `?<svc>=`,
localStorage, or the page's default port).

## Frontends

Each sub-app's frontend is **owned by this repo** and edited here directly (no
submodules, no vendoring): the classifier and nonogram frontends are TypeScript
modules under `src/apps/<app>/` (static assets under `public/<app>/`), and the CV
editor is a Svelte 5 island under `src/editor/`. Backends live in their own repos;
the frontends talk to them over the API contract.

## Testing

```bash
make test          # vitest unit tests
make test-e2e      # playwright e2e
make lint          # eslint + prettier + stylelint
npm run typecheck  # astro check
npm run format     # auto-fix formatting
```

## Deployment

Deployed to Cloudflare Pages (`andypeterson.dev`) by `.github/workflows/deploy.yml`
after CI passes — a portal-only static build (prebuilt `dist/` uploaded via wrangler),
no submodules.

## Tech Stack

| Layer    | Tools                                     |
|----------|-------------------------------------------|
| Frontend | Astro 7, Svelte 5, TypeScript, system.css |
| Testing  | Vitest, Playwright                        |
| Infra    | GitHub Actions, Cloudflare Pages          |
| Linting  | ESLint, Prettier, Stylelint, astro check  |

## License

MIT -- see [LICENSE](LICENSE).
