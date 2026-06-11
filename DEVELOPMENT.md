# Development Guide

## Local Development Workflow

Requires **Node ≥ 22** (`nvm use 22`). Start the Astro dev server:

```bash
npm run dev
```

This launches Astro on `localhost:4321`. Each sub-app's frontend is vendored as static
assets under `public/<app>/` and embedded by the Astro pages in `src/pages/projects/**`,
so the full site is navigable from a single dev server — no custom dev middleware, no
submodules.

## Backend Services

The portal is static and works without any backend. To exercise a sub-app's live backend,
clone its repo and run it (see that repo's README), then point the portal at it.

| App | Repo | Default port |
|-----|------|--------------|
| classifiers | [quantum-machine-learning](https://github.com/andypeterson2/quantum-machine-learning) | 5001 (HTTP + SSE) |
| cv editor | [cv](https://github.com/andypeterson2/cv) | 3001 (HTTP) |
| nonogram | [quantum-nonogram-solver](https://github.com/Quantum-Interns-at-Qualcomm-Institiute/quantum-nonogram-solver) | 5055 (HTTP + WebSocket) |
| qvc signaling | [Quantum-Video-Chat](https://github.com/Quantum-Interns-at-Qualcomm-Institiute/Quantum-Video-Chat) | 5050 (HTTP + WebSocket) |

### Service URL Resolution

Backend URLs are resolved at runtime by `packages/shared-js/service-config.js`:

1. **URL parameters** -- e.g. `?classifiers=http://localhost:5001`
2. **Unified backend param** -- `?backend=http://host:port` (applies to all services)
3. **localStorage** -- previously saved overrides
4. **Defaults** -- the page's `<meta name="site-backend" data-port>` value

So you can point any sub-app at a local backend without code changes — e.g.
`http://localhost:4321/classifiers/?backend=http://localhost:5001`.

## Backend API Contract

Every backend implements one uniform HTTP contract — the canonical, language-agnostic
spec lives here in [`docs/api-contract/CONTRACT.md`](docs/api-contract/CONTRACT.md):

- `GET /health` → `{status, service, version, uptime_s}` — the portal polls this to drive
  the live status dot beside each backend in the menubar (`window.SiteContract`).
- `GET /api` → discovery manifest `{service, version, endpoints[], streaming[]}`.
- Failures use the envelope `{error: {code, message, details?}}`; the HTTP status carries the class.
- Streaming operations (Socket.IO/SSE) also expose synchronous `/...sync` REST variants;
  the frontend falls back to these when the live transport is unavailable.

The live-HTTP contract tests run in each app's own repo (they boot a backend). CI here
validates that the JSON schemas under `docs/api-contract/schemas/` are well-formed.

## Vendored frontends

Each sub-app's built frontend is committed under `public/<app>/` and served statically.
Refresh it from the app's own repo with:

```bash
scripts/vendor-app.sh <classifiers|nonogram|video-chat|ui-kit>          # or: all
scripts/vendor-app.sh classifiers --from ../quantum-machine-learning    # use a local clone
```

The committed assets are the source of truth for what ships, so a refresh is a real
content change to review and test before committing. (cv's frontend is maintained here
directly and is intentionally not synced.)

## Adding a New Project

1. Build the project in its own repo and vendor its frontend under `public/<slug>/`
   (add a `scripts/vendor-app.sh` entry for it).
2. Add an Astro page under `src/pages/projects/<slug>/` that embeds the assets and, if it
   has a backend, declares it with `<meta name="site-backend" content="<service>" data-port="<port>">`.
3. Add an entry to `src/data/projects.ts` (typed by the `Project` interface).
4. Run `npm run build && python3 scripts/generate-manifest.py dist` to refresh the manifest
   (the pre-commit hook also regenerates it from the latest build).

## Running Tests

```bash
make test       # vitest unit tests
make test-e2e   # playwright e2e
make lint       # eslint + prettier + stylelint
npm run format  # auto-fix formatting
```

Run `make test && make lint` before pushing. CI runs the same checks on your PR.

## UI Kit (design system)

The design system lives in its own repo, [andypeterson2/ui-kit](https://github.com/andypeterson2/ui-kit).
Its runtime (`icons.js`, `ui-kit.js`) is vendored to `public/vendor/ui-kit/`; refresh it with
`scripts/vendor-app.sh ui-kit`. To develop components with Storybook, clone that repo and run
`npm install && npm run storybook`.

## Troubleshooting

### Wrong Node.js version
This project requires **Node >= 22**:
```bash
nvm install 22 && nvm use 22
```

### Docker port conflicts
The dev container uses `ASTRO_PORT` (see `.env`). Adjust it if the port is in use.

### Stale build artifacts
```bash
make clean && npm run build
```
