# Dashboard

[![CI](https://github.com/andypeterson2/dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/andypeterson2/dashboard/actions)

> A local developer dashboard for managing project repositories and Docker
> containers, with both a web UI (Flask) and a terminal UI (Textual).

## What it does

- Scans a configurable projects directory and displays repo health
  (branch status, uncommitted changes, recent activity)
- Manages Docker containers associated with your projects
- Provides both a browser-based dashboard (Flask, port 5050) and
  a rich terminal interface (Textual)
- Runs inside Docker with Docker socket access for container management

## Quick start

```sh
git clone https://github.com/andypeterson2/dashboard.git
cd dashboard
cp .env.example .env        # edit PROJECTS_DIR to your workspace
docker compose up --build
# Open http://localhost:5050
```

## Local development (without Docker)

```sh
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev,tui]"
cp config.example.yaml config.local.yaml  # edit paths
python -m dashboard.web     # web UI
dashboard                   # TUI (via entry point)
```

## Running tests

```sh
pip install -e ".[dev,tui]"
pytest
```

Tests that require Docker are skipped automatically when Docker is unavailable.

## Architecture

```
src/dashboard/
  config.py            Configuration loading (env vars, YAML, defaults)
  scanner.py           Project directory scanning and metadata extraction
  web.py               Flask app factory and JSON API routes
  app.py               Textual TUI application
  process_manager.py   Docker container lifecycle management
  widgets/             Textual UI components (service cards, port editor, summary bar)
  theme.py             TUI theming (Gruvbox-inspired)
```

The web frontend lives in a separate repo and connects to the Flask API via
CORS-enabled JSON endpoints. Services are discovered via `.dashboard.yaml`
manifest files in each project directory.

## API

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Health check (returns version) |
| `/api/projects` | GET | List all scanned projects |
| `/api/projects/<name>` | GET | Single project detail |
| `/api/services/start` | POST | Start a Docker Compose service |
| `/api/services/stop` | POST | Stop a running service |
| `/api/services/<project>/<service>/logs` | GET | Fetch container logs (`?tail=100`) |
| `/api/services/status` | GET | Poll running/stopped state of all services |

## `.dashboard.yaml`

Drop a `.dashboard.yaml` in any project to define named services:

```yaml
services:
  - name: web-server
    display_name: Web Server
    compose_service: server
    compose_file: docker-compose.yml
    default_port: 8080
  - name: worker
    display_name: Background Worker
    compose_service: worker
    default_port: 9090
    no_browser: true
```

## Configuration

| Env var | Default | Description |
|---|---|---|
| `DASHBOARD_PROJECTS` | `/projects` (Docker) or `~/Projects` (local) | Path to scan for repos |
| `PORT` | `5050` | Preferred port (falls back to a free port if taken) |
| `DEBUG` | `0` | Set to `1` for Flask debug mode |
| `DEV_CERT_DIR` | *(none)* | Path to TLS cert/key for HTTPS |

## Security considerations

This tool mounts the Docker socket, which grants the container
root-equivalent access to the host's Docker daemon. It is designed
for local development use only and should never be exposed to
untrusted networks. See [SECURITY.md](SECURITY.md) for details.

## License

[MIT](LICENSE)
