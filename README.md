# andypeterson.dev

Monorepo for portfolio site and sub-projects.

## Directory Structure

```
src/                          Astro 6 portfolio site
packages/
  cv/                         [submodule] LaTeX CV/resume editor (Express)
  flask-core/                 Shared Flask CORS/SSL infrastructure
  nonogram/                   [submodule] Quantum nonogram solver (Flask + Qiskit)
  quantum-protein-kernel/     [submodule] ML classifier platform (Flask + PyTorch + Qiskit)
  qvc/                        [submodule] Quantum video chat (Flask + React + BB84)
  shared-js/                  Site navigation, service config, theme bootstrap
  ui-kit/                     [submodule] Design system (CSS components, Storybook)
scripts/                      CI helpers, manifest generator, scaffolding
nginx/                        Reverse proxy config for Docker deployment
tests/                        Vitest test suite (pages, SEO, a11y, design system)
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
make docker-up    # starts all services behind nginx on localhost:8080
make docker-down  # stops all services
```

| Service           | Port  | Description                          |
|-------------------|-------|--------------------------------------|
| nginx             | 8080  | Reverse proxy (entry point)          |
| website           | 8000  | Astro static site                    |
| classifier        | 5001  | Quantum-hybrid ML classifier (SSE)  |
| nonogram          | 5055  | Nonogram solver (WebSocket)          |
| videochat-server  | 5050  | QKD backend server                   |
| videochat-middleware | 5002 | Video chat browser middleware       |
| cv-editor         | 3000  | CV/resume LaTeX editor               |

## Testing

```bash
make test         # all tests
make test-py      # Python only (pytest)
make test-js      # JavaScript only (jest/vitest)
make lint         # ruff + eslint + prettier + stylelint
npm run format    # auto-fix formatting
```

## Tech Stack

| Layer      | Tools                                    |
|------------|------------------------------------------|
| Frontend   | Astro 6, TypeScript, system.css          |
| Backend    | Flask 3, Express 4                       |
| ML / QC    | PyTorch 2.2, Qiskit 2.2, PennyLane      |
| Testing    | Vitest, pytest, Jest                     |
| Infra      | Docker Compose, Nginx, GitHub Actions    |
| Linting    | ESLint, Prettier, Stylelint, Ruff        |

## License

MIT -- see [LICENSE](LICENSE).
