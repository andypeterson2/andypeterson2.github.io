# andypeterson.dev

Monorepo for portfolio site and sub-projects.

## Directory Structure

```
src/                          Astro 6 portfolio site
packages/
  ui-kit/                     Design system (50 CSS components, Storybook)
  flask-core/                 Shared Flask CORS/SSL infrastructure
  shared-js/                  Site navigation, theme bootstrap
cv/                           LaTeX CV/resume editor (Express)
tech-tree/                    Interactive knowledge graph (Canvas)
quantum-protein-kernel/       ML classifier platform (Flask + PyTorch + Qiskit)
task-randomizer/              Task picker (static)
nonogram/                     [submodule] Quantum nonogram solver
qvc/                          [submodule] Quantum video chat
```

## Quick Start

```bash
git clone --recursive https://github.com/andypeterson2/andypeterson2.github.io.git
cd andypeterson2.github.io
make setup    # installs submodules + all dependencies
npm run dev   # starts Astro dev server on localhost:4321
```

## Running Services (Docker)

```bash
make docker-up   # starts classifiers:5001, cv-editor:3001, tech-tree:8080
```

## Testing

```bash
make test         # all tests
make test-py      # Python only (pytest)
make test-js      # JavaScript only (jest/vitest)
make test-cv      # single project
make lint         # ruff + eslint
```

## Shared Packages

Three shared packages live under `packages/` and are consumed across the monorepo:

- **ui-kit** -- Design system with ~50 CSS components and a Storybook instance.
  Imported by the Astro site and all sub-projects for consistent styling.
- **flask-core** -- Common Flask infrastructure (CORS configuration, SSL setup,
  shared middleware). Used by `quantum-protein-kernel` and any other Flask service.
- **shared-js** -- Client-side utilities for site-wide navigation and theme
  bootstrapping. Bundled into the Astro build and referenced by sub-apps.

## Tech Stack

| Layer      | Tools                                    |
|------------|------------------------------------------|
| Frontend   | Astro 6, TypeScript                      |
| Backend    | Flask 3, Express 4                       |
| ML / QC    | PyTorch 2.2, Qiskit 2.2                 |
| Testing    | Jest, Vitest, pytest                     |
| Infra      | Docker, Nginx, Makefile                  |

## License

MIT -- see [LICENSE](LICENSE).
