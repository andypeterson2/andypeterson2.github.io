# Development Guide

## Local Development Workflow

Start the Astro dev server:

```bash
npm run dev
```

This launches Astro on `localhost:4321`. A custom Vite plugin in `astro.config.mjs`
serves sub-apps at their respective paths (`/classifiers/`, `/cv/`, `/tech-tree/`,
etc.), so the full site is navigable from a single dev server.

## Backend Services

Sub-projects with Flask or Express backends can be run two ways:

1. **Individually** -- start a single service from its directory:
   ```bash
   cd quantum-protein-kernel && python -m classifiers
   cd cv && npm start
   cd tech-tree && npm start
   ```

2. **All at once via Docker**:
   ```bash
   make docker-up
   ```

### Service Ports

| Service       | Port |
|---------------|------|
| classifiers   | 5001 |
| cv-editor     | 3001 |
| tech-tree     | 8080 |
| nonogram      | 5055 |

### Service URL Resolution

Backend URLs are resolved at runtime by `packages/ui-kit/service-config.js` using
this priority chain:

1. **URL parameters** -- e.g. `?classifiers_url=http://localhost:5001`
2. **localStorage** -- previously saved overrides
3. **Defaults** -- hard-coded production URLs

This lets you point any sub-app at a local backend without code changes.

## Submodules

QVC (quantum video chat) and QNS (quantum nonogram solver) are Git submodules.
After cloning, initialize them:

```bash
git submodule update --init --recursive
```

Or clone with `--recursive` from the start. `make setup` handles this automatically.

## Adding a New Project

1. Create a directory at the repo root (or under `packages/` if it is shared).
2. Add build/test targets to the `Makefile`.
3. If the project runs as a service, add it to `docker-compose.yml` and `dockerfiles/`.
4. Register the route in `astro.config.mjs` by adding the path to `subPaths`.
5. Add the project to the CI workflow (`.github/workflows/`) -- CI is path-filtered,
   so define which paths should trigger its tests.
6. Add an entry to `src/data/projects.ts` so it appears on the portfolio site.

## Running Tests

```bash
make test         # everything
make test-py      # Python (pytest)
make test-js      # JavaScript (jest/vitest)
make test-cv      # single project
make lint         # ruff + eslint
```

Run `make test` before pushing to catch issues early. CI will run the same checks
on your pull request.
