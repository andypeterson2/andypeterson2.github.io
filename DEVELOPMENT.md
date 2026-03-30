# Development Guide

## Local Development Workflow

Start the Astro dev server:

```bash
npm run dev
```

This launches Astro on `localhost:4321`. A custom Vite plugin in `astro.config.mjs`
serves sub-apps at their respective paths (`/classifiers/`, `/cv/`,
`/nonogram/`, `/qvc/`), so the full site is navigable from a single dev server.

## Backend Services

Sub-projects with Flask or Express backends can be run two ways:

1. **Individually** -- start a single service from its directory:
   ```bash
   cd packages/quantum-protein-kernel && python -m classifiers
   cd packages/cv/editor && npm start
   cd packages/nonogram && python -m nonogram
   ```

2. **All at once via Docker**:
   ```bash
   make docker-up   # starts all 8 services behind nginx on :8080
   ```

### Service Ports

| Service               | Port | Protocol         |
|-----------------------|------|------------------|
| classifiers           | 5001 | HTTP + SSE       |
| cv-editor             | 3000 | HTTP             |
| nonogram              | 5055 | HTTP + WebSocket |
| videochat-server      | 5050 | HTTP + WebSocket |
| videochat-client-a    | 5002 | HTTP + Socket.IO |

### Service URL Resolution

Backend URLs are resolved at runtime by `packages/shared-js/service-config.js` using
this priority chain:

1. **URL parameters** -- e.g. `?classifiers=http://localhost:5001`
2. **Unified backend param** -- `?backend=http://host:port` (applies to all services)
3. **localStorage** -- previously saved overrides
4. **Defaults** -- hard-coded fallback URLs

This lets you point any sub-app at a local backend without code changes.

## Submodules

Five packages are Git submodules: `cv`, `nonogram`, `quantum-protein-kernel`, `qvc`, `ui-kit`.
After cloning, initialize them:

```bash
git submodule update --init --recursive
```

Or clone with `--recursive` from the start. `make setup` handles this automatically.

## Adding a New Project

1. Create a directory under `packages/` (or add as a submodule).
2. Add build/test targets to the `Makefile`.
3. If the project runs as a service, add it to `docker-compose.yml` and `nginx/nginx.conf`.
4. Register the route in `astro.config.mjs` by adding the path to `subPaths` and `pathRewrites`.
5. Add the project to the CI workflow (`.github/workflows/ci.yml`) -- CI is path-filtered,
   so define which paths should trigger its tests.
6. Add an entry to `src/data/projects.ts` (typed by the `Project` interface) so it appears on the portfolio site.
7. Run `python scripts/generate-manifest.py` to update the site manifest.

## Running Tests

```bash
make test         # everything
make test-py      # Python (pytest)
make test-js      # JavaScript (jest/vitest)
make lint         # ruff + eslint + prettier + stylelint
npm run format    # auto-fix formatting
```

Run `make test && make lint` before pushing to catch issues early.
CI will run the same checks on your pull request.
