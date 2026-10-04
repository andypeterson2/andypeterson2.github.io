# andypeterson.dev

Standalone [Astro](https://astro.build) portal for andypeterson.dev. Each sub-project
lives in its own repository; the portal owns their frontends, written as typed modules
under `src/apps/<app>/` and bundled per page, and talks to their optional backends over
a shared HTTP API contract. There are no submodules.

| App | Repo | Backend |
|-----|------|---------|
| LaTeX resume editor | [andypeterson2/cv](https://github.com/andypeterson2/cv) | Express · :3001 |
| Quantum nonogram solver | [quantum-nonogram-solver](https://github.com/Quantum-Interns-at-Qualcomm-Institiute/quantum-nonogram-solver) | Flask · :5055 |
| ML classifier platform | [quantum-machine-learning](https://github.com/andypeterson2/quantum-machine-learning) | Flask · :5001 |
| Quantum video chat | [andypeterson2/bb84-video-chat](https://github.com/andypeterson2/bb84-video-chat) | not deployed; the portal links the repo |

## Directory structure

```
src/                      Astro 7 portal (pages, layouts, components)
src/editor/               The CV editor — a Svelte 5 island (components + runes stores)
src/apps/                 App frontends as typed modules (shared portal scripts,
                          ui-kit runtime, classifier + nonogram apps), bundled per page
public/                   Served as-is: model weights, the nonogram gallery, icons,
                          vendored socket.io
packages/system-six/      The portal's design-system CSS (tokens + element styles)
docs/api-contract/        JSON schemas, checked in CI, plus the vendored cv route list,
                          compared against what cv serves by the weekly live checks
scripts/                  Build and CI helpers (CSS purge, header checks, route refresh)
tests/                    Vitest (unit + integration) + Playwright (e2e)
```

## Quick start

Requires Node ≥ 22 (e.g. `nvm use 22`).

```bash
git clone https://github.com/andypeterson2/andypeterson2.github.io.git
cd andypeterson2.github.io
make setup     # npm ci
npm run dev    # Astro dev server on localhost:4321
```

## Running a backend locally

The portal is static and deploys without any backend. To exercise a sub-app's live
backend, clone its repo and run it (see that repo's README), then point the portal at
it with a query param — e.g.
`http://localhost:4321/projects/ai-ml/app/?backend=http://localhost:5001`.
`src/apps/shared/service-config.ts` resolves a backend URL in this order, and allows a
localhost target only while the page itself is served from localhost:

1. a per-service parameter, `?classifiers=http://localhost:5001`
2. `?backend=http://host:port`, which applies to every service at once
3. an override previously saved to `localStorage`
4. the page's own `<meta name="site-backend" data-port>`

## The backend contract

Every backend answers the same HTTP contract, specified in
[`docs/api-contract/CONTRACT.md`](docs/api-contract/CONTRACT.md):

- `GET /health` → `{status, service, version, uptime_s}`, which the portal polls to drive
  the status dot beside each backend.
- `GET /api` → a discovery manifest, `{service, version, endpoints[], streaming[]}`.
- Failures carry `{error: {code, message, details?}}`, with the class in the HTTP status.
- Anything streaming also exposes a synchronous `/...sync` variant, and the frontend falls
  back to it when the live transport is unavailable.

The live-HTTP contract tests live in each backend's own repo, since they boot a service.
CI here validates that the schemas under `docs/api-contract/schemas/` are well-formed.

## Testing

```bash
make test          # vitest unit tests
make test-e2e      # playwright e2e
make lint          # eslint + prettier + stylelint
npm run typecheck  # astro check
npm run format     # auto-fix formatting
```

## Deployment

`.github/workflows/deploy.yml` builds `dist/` after CI passes and uploads it to
Cloudflare Pages with wrangler, serving `andypeterson.dev`.

## License

MIT -- see [LICENSE](LICENSE).
