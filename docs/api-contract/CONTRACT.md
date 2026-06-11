# Backend API Contract

The four project backends — **cv**, **nonogram**, **classifiers** (quantum-protein-kernel), and **qvc** — each run as a standalone HTTP service that **functions with no frontend**. This document plus the JSON Schemas in [`schemas/`](./schemas/) are the cross-repo source of truth for the conventions every backend shares.

Because the backends live in **separate repos** and **two languages** (cv is Node/Express; the others are Python/Flask), the contract cannot be a shared code import. Instead it is this written artifact: the portal owns the canonical [`schemas/`](./schemas/), and **each app's own CI** enforces it — a `tests/contract/` live-HTTP test boots the service and validates real responses against a vendored copy of the schemas.

## Conventions

1. **JSON over HTTP.** All API routes live under `/api/...` and speak `application/json` (binary exceptions are explicit, e.g. CV's `GET /api/variants/:id/pdf`).
2. **Curl-able rule.** *Every operation is reachable over plain synchronous HTTP.* Real-time transports (Socket.IO / SSE / WebRTC) are an **optional additive layer** for live updates — never the only way to obtain a result. Where an operation was streaming-only, a synchronous `/...sync` equivalent is added that returns the full result in the HTTP response.
3. **Three well-known routes** on every service: `GET /health`, `GET /api` (discovery), and the error envelope on every failure.
4. **CORS via env.** Allowed origins come from one environment variable per service; no hard-coded origin lists.
5. **Stateless reads.** Health and discovery require no auth and no prior state.

## `GET /health` — [`schemas/health.schema.json`](./schemas/health.schema.json)

Liveness probe. Required keys `status` and `service`; when `status` is `ok`, `version` and `uptime_s` are also required. Extra service-specific keys are allowed.

```json
{ "status": "ok", "service": "nonogram", "version": "1.4.0", "uptime_s": 132.7 }
```

| Service | Current | Target delta |
|---|---|---|
| cv | `GET /api/health` → `{status, service:'cv', persons}` | add `version`, `uptime_s`; also expose at `/health` (keep `/api/health` as alias) |
| classifiers | `GET /health` → `{status, uptime, clients, timestamp}` | add `service:'classifiers'`, `version`; rename/duplicate `uptime` → `uptime_s` |
| qvc (middleware) | `GET /health` → JSON | add `service:'qvc'`, `version`, `uptime_s` |
| **nonogram** | **none** | **add `GET /health`** — the one true gap |

## Error envelope — [`schemas/error.schema.json`](./schemas/error.schema.json)

Every 4xx/5xx response body is exactly:

```json
{ "error": { "code": "invalid_dimensions", "message": "rows must be between 1 and 30", "details": { "rows": 100 } } }
```

- `code` — stable `snake_case` slug clients may switch on. `message` — human text, not stable. `details` — optional, any JSON.
- The HTTP status carries the class (400/404/409/422/500); the envelope never restates it.
- Centralize per repo: classifiers already has `routes/errors.py:error_response()` (change its body); nonogram adds a `respond_error()` helper + Flask errorhandler; cv adds an Express error-handling middleware in `editor/server.js` with a `sendError(res, status, code, msg)` helper.

## `GET /api` — discovery — [`schemas/manifest.schema.json`](./schemas/manifest.schema.json)

A self-description of the service so the whole surface is discoverable with no frontend:

```json
{
  "service": "nonogram",
  "version": "1.4.0",
  "endpoints": [
    { "method": "POST", "path": "/api/solve/classical/sync", "summary": "Solve synchronously; returns solutions in the response." }
  ],
  "streaming": [
    { "protocol": "socket.io", "event": "cl_done", "description": "Classical solve result (live equivalent of /sync)." }
  ]
}
```

- Flask services build `endpoints` by iterating `app.url_map.iter_rules()` (near-zero maintenance); cv iterates its Express router stack.
- `streaming[]` is hand-listed (Socket.IO events, SSE channels, WebRTC signaling) since those are not in the HTTP url-map.

## CORS via env

One comma-separated variable per service; default allows localhost (any port) plus the production domain.

| Service | Env var | Default |
|---|---|---|
| cv | `CV_CORS_ORIGINS` | `http://localhost:*,https://andypeterson.dev` |
| nonogram | `NONOGRAM_CORS_ORIGINS` | `http://localhost:*,https://andypeterson.dev` |
| classifiers | `CLASSIFIERS_CORS_ORIGINS` | `http://localhost:*,https://andypeterson.dev` |
| qvc | `QVC_CORS_ORIGINS` | `http://localhost:*,https://andypeterson.dev` |

Three of four already read these; cv's hard-coded fallback list in `editor/server.js` is the one substantive change (its `cors` package needs a function/regex origin to honor the `:*` wildcard).

## Per-service summary

Ports are the canonical defaults, configurable via `PORT`/env. The frontend resolves each backend's URL at runtime via `ServiceConfig` — URL param > `localStorage` > the per-page `<meta name="site-backend" data-port>` default, which is the authored source of truth for the port. `site-manifest.json` is a generated catalog of app entry points (built by `scripts/generate-manifest.py`), not the runtime port source.

| Service | Lang | Default port | Streaming layer | Sync routes added (Phase B) |
|---|---|---|---|---|
| cv | Node/Express | **3001** | — (already synchronous CRUD + PDF) | none needed |
| nonogram | Python/Flask | 5055 | Socket.IO (`cl_done`,`qu_done`,`bench_done`) | `/api/solve/{classical,quantum}/sync`, `/api/benchmark/sync` |
| classifiers | Python/Flask | 5001 | SSE (train/eval streams) | `/train/sync`, `/evaluate/sync` |
| qvc | Python/Flask | 5050 (signaling) | WebRTC + signaling WS | none — see exemption below |

**qvc exemption.** qvc's "operation" is connection brokering, which is already synchronous REST (`/health`, `/peer_connection`, `/disconnect`, `/peer_disconnected`, signaling `/admin/*`). The media + BB84/QKD path is inherently peer-to-peer in the browser; it is the explicit live-only layer and is exempt from the curl-able rule. This is documented, not a gap.

## Enforcement

- Each app repo has its own `tests/contract/test_<service>_api.py` that hits its **live** backend over HTTP (`<SERVICE>_URL` env, `skipif` when down) and validates `/health`, `/api`, the error envelope, and the `/sync` routes against a vendored copy of [`schemas/`](./schemas/) via `jsonschema`.
- Each app's CI runs a `contract` job that boots the service on a temp port, curls `/health`, then runs that contract test — so removing or breaking a route fails that app's PR. The portal's CI separately validates that the canonical schemas are well-formed JSON Schemas.

## Versioning

This contract is versioned with the repo. Breaking changes to a shared shape (health/error/manifest) require updating the schema, the four backends, and this document in lockstep — the contract tests will fail until all agree.
