## Quantum ML Classifier Platform

**Source repo:** [`andypeterson2/quantum-machine-learning`](https://github.com/andypeterson2/quantum-machine-learning) — an **API-only** Flask backend (`create_app()` sets `static_folder=None`; it serves no templates and no static files). The portal (this repo) owns the entire frontend: the page shell in `src/components/ClassifierApp.astro` + `src/components/classifier/`, and the app scripts and demo-model weights under `public/classifiers/`.

<a id="qmc-overview"></a>
### Overview

Multi-dataset classifier platform comparing classical and quantum-hybrid neural network approaches. Plugin architecture for datasets (MNIST, Iris). Live training over Server-Sent Events with real-time loss curves, draw-to-predict (MNIST), form-to-predict (Iris), model persistence, early stopping, knowledge distillation, ensemble evaluation, and ablation studies — plus a **zero-backend demo tier** that runs real inference entirely in the visitor's browser.

<a id="qmc-frontend"></a>
### Frontend (this repo) — two tiers

The page at `/projects/ai-ml/app/` (`src/pages/projects/ai-ml/app.astro`) renders `src/components/ClassifierApp.astro`, which composes the UI from `src/components/classifier/` (`ClassifierNavbar`, `ClassifierTrainCard`, `ClassifierModelsCard`, `ClassifierResultsPanel`, `ClassifierLogDrawer`; styles in `src/styles/classifier.css`) and loads the scripts in this order:

| Script | Purpose |
|--------|---------|
| `/ui-kit/icons.js`, `/ui-kit/ui-kit.js` | Shared UI-kit runtime (defines the global `UIKit`) |
| `/classifiers/js/connection.js` | `ConnectionManager` — backend connection state machine (idle → connecting → connected → degraded → disconnected) driving the status dot |
| `/classifiers/js/sse.js` | SSE stream consumer (POST to an SSE endpoint, dispatch typed events) |
| `/classifiers/js/chart.js` | `MiniChart` — dependency-free dual-axis canvas chart for training curves (loss + accuracy) |
| `/classifiers/js/config.js` | Portal bootstrap — seeds `window.API_BASE` / `window.UI_CONFIG` / `window.CLASSIFIER_DATASETS` (the Flask template used to inject these; as a static embed this file supplies safe defaults and keeps `API_BASE` live against `ServiceConfig` / `navbar:connect`) |
| `/classifiers/js/infer.js` | **In-browser inference** for the demo tier (see below) |
| `/classifiers/js/app.js` | App logic: state, canvas drawing, model table, form handling, train/evaluate/predict flows |

**Tier 1 — live backend.** When a backend is connected (URL resolved by `ServiceConfig`: URL param > `localStorage` > the page's `<meta name="site-backend" content="classifiers" data-port="5001">` default), the app drives the real REST/SSE API below: training with live curves, evaluation, ensembles, ablation, model persistence.

**Tier 2 — zero-backend browser inference (the demo tier).** When no backend is connected (`app.js` checks the `ConnectionManager` state), prediction still works, with nothing running server-side:

- `public/classifiers/js/infer.js` loads a compact linear model from `public/classifiers/models/<dataset>.json` and runs the forward pass in plain JavaScript — normalise → hand-written matmul → softmax → argmax. No backend, no WASM, no libraries. It returns the same `{prediction, confidence, probs}` shape as the server's `/predict` route, so the existing renderers work unchanged.
- The weight files come in two kinds, all provenance-stamped. The linear baselines (`mnist.json`: 784→10, test accuracy 92.06%; `iris.json`: 4→3, test accuracy 90.0%, plus per-feature ranges for the input form) carry `{kind: "linear", classes, normalize (the exact scale/mean/std the browser must reproduce), weight, bias, test_accuracy, provenance}`. The QSVM paper recreations (`qsvm-mnist.json`: 6-vs-9, 91%; `qsvm-iris.json`: setosa-vs-versicolor, 97%) carry `{kind: "qsvm", classes (the binary pair), w, map: {a,b,c,d}, features, raw_input: "pixels"|"features", ink_threshold (mnist), test_accuracy, provenance}` — the paper's solved 2-D rule, no probabilities (the demo shows an honest "—" for confidence). All accuracies are measured, not asserted.
- They are exported **by the classifier repo itself** (`make export-web` in `quantum-machine-learning`, then `make sync-web` to copy them here). The exporter (`classifiers/web_export.py`) trains each dataset's Linear model through the real plugin loaders and Trainer with the plugin's own default hyper-parameters — so "the same models the backend trains" is true by construction — and stamps a `provenance` block (source commit, dirty flag, date, seed, hyper-parameters, framework versions). That repo's CI drift-checks the committed exports against the live plugins on every run, including re-measuring the claimed accuracy from the committed weights.

This is what lets a visitor draw a digit or enter flower measurements and get a real prediction from real trained weights with zero infrastructure awake.

<a id="qmc-core-abstractions"></a>
### The QSVM lane

The QSVM paper recreation (Yang et al. 2019, arXiv:1909.11988) lives in the classifier repo as an executed notebook at `notebooks/qsvm-iris/` (own venv — qiskit 2.x wants numpy 2; the service venv is pinned to torch 2.2 / numpy < 2). It reaches the site two ways: the **narrative** is the QSVM section of this project's writeup modal (with the display equations pre-rendered to native MathML — no math JS, CSP-clean), and the **deployable rule** ships as the `qsvm-*.json` weights above, derived closed-form by that repo's `classifiers/qsvm_export.py` (`make export-qsvm`, shipped by `make sync-web`) and drift-checked in its CI. `infer.js` dispatches on `kind` and computes the paper's ink-ratio features from the 28×28 canvas for MNIST.

### Backend Core Abstractions

All paths below are in the `quantum-machine-learning` repo, under `classifiers/`.

#### BaseModel ABC (`base_model.py`)

Abstract `forward(x) -> logits`; `loss_fn(output, target)` defaults to cross-entropy. Subclasses live with their dataset: `datasets/mnist/models.py` (MNISTNet, LinearNet, SVMNet, MNISTQuadraticNet, MNISTPolynomialNet, QiskitCNN, QiskitLinear) and `datasets/iris/models.py` (IrisLinear, IrisSVM, IrisQVC).

#### DatasetPlugin ABC (`dataset_plugin.py`)

The sole extension point for new datasets.

**Required attributes:** `name` (URL slug), `display_name`, `input_type` (`"image"` | `"tabular"`), `num_classes`, `class_labels`; optional `image_size`, `image_channels`, `feature_names`.

**Required methods:** `get_train_loader(batch_size)`, `get_test_loader(batch_size)`, `preprocess(raw_input)`, `get_model_types()`.

**Optional methods:** `get_val_loader` (enables early stopping), `get_default_hyperparams`, `get_ui_config`.

Plugins register via `plugin_registry.py` (`get_plugin` / `list_plugins` / `create_model`).

<a id="qmc-dataset-plugins"></a>
### Dataset Plugins

#### MNIST (`datasets/mnist/`)

28×28 grayscale, 10 classes, z-score normalization (mean 0.1307, std 0.3081), 55,000 train / 5,000 val / 10,000 test. Model types: `CNN`, `Linear`, `SVM`, `Quadratic`, `Polynomial` always; `Qiskit-CNN` and `Qiskit-Linear` only when qiskit is importable.

#### Iris (`datasets/iris/`)

Tabular, 4 features, 3 classes, z-score per training-set statistics. 80/20 stratified train/test split (seed 42); the val loader further splits the training data 80/20. Model types: `Linear`, `SVM` always; `QVC` (PennyLane variational circuit) only when PennyLane is importable. Iris-tuned defaults: `{epochs: 50, batch_size: 16, lr: 0.01}`.

<a id="qmc-training-evaluation-prediction"></a>
### Training, Evaluation, Prediction

- **Trainer (`trainer.py`):** Adam training loop with optional knowledge distillation (teacher output blended via `distill_weight`), regularization hooks, validation checkpoints every `val_gap` batches, and early stopping (`patience`, gated on `early_stop_min_accuracy`). Returns a `TrainResult` (model, epochs_completed, best_val_accuracy, history, num_params, stopped_early).
- **Evaluator (`evaluator.py`):** `evaluate` (accuracy, avg loss, per-class accuracy), `ensemble_evaluate` (majority vote, logit-sum tie-break), `ablation_evaluate` (per-layer accuracy drop by zeroing each layer on a deep copy).
- **Predictor (`predictor.py`):** delegates preprocessing to the plugin, runs the model in eval mode, softmaxes logits into a probability array.
- **ModelRegistry (`model_registry.py`):** thread-safe in-memory store namespaced by dataset (`add`, `remove`, `get`, `names`, `items`, `next_name`, `update_eval_result`, `update_training_meta`).
- **ModelPersistence (`persistence.py`):** `.pt` checkpoints (state_dict + metadata + history) with filename sanitization/validation; `load()` reconstructs via `plugin_registry.create_model()` with `weights_only=True`.
- **Special layers & losses:** `layers.py` (`Quadratic`: pairwise products + linear terms; `Polynomial`: `exp(W·log(|x|+1))` with clamping), `losses.py` (Crammer-Singer multi-class hinge), `qiskit_layers.py` (parametric quantum circuit layer with parameter-shift gradients, integrated into PyTorch backprop).

<a id="qmc-rest-api--routes"></a>
### REST API & Routes

Route modules live in `classifiers/routes/`. The service follows the shared backend contract ([`docs/api-contract/CONTRACT.md`](./api-contract/CONTRACT.md)): JSON over HTTP, `{error: {code, message, details?}}` envelope on every failure (`routes/errors.py:error_response()`), CORS origins from `CLASSIFIERS_CORS_ORIGINS`, and a synchronous equivalent for every streaming operation.

#### Top-level (`routes/main.py`)

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | `{status, service:'classifiers', version, uptime_s, uptime (legacy alias), clients, timestamp}` |
| `GET /api` | Discovery: every HTTP endpoint (iterated from `url_map`) plus the hand-listed SSE channels |
| `GET /api/datasets` | Registered plugins: `[{name, display_name, input_type}, …]` |
| `GET /api/datasets/<name>/config` | `{ui_config, model_types}` for one dataset |

#### Dataset-scoped (`routes/dataset_routes.py`, prefix `/d/<dataset>`)

A blueprint-level `url_value_preprocessor` resolves the slug to a plugin on `g.plugin`; unknown datasets get a 404 envelope before any view runs. Endpoint groups are registered by sub-modules:

**Training (`train_routes.py`):**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/d/<dataset>/train` | POST | SSE stream of `status` / `history` / `done` / `error` events (daemon thread + queue → `routes/sse.py:sse_response()`). Body: `model_type`, `epochs`, `batch_size`, `lr`, `name?`, `patience?`, `val_gap?`, `teacher?`, `distill_weight?` |
| `/d/<dataset>/train/sync` | POST | Same inputs; trains to completion and returns the final result in the response body (scripts/CI/curl) |

**Evaluation (`eval_routes.py`):**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/d/<dataset>/evaluate` | POST | SSE stream evaluating registered models |
| `/d/<dataset>/evaluate/sync` | POST | Synchronous equivalent — full results in the response |
| `/d/<dataset>/ensemble` | POST | `{"model_names": [...]}` → ensemble accuracy |
| `/d/<dataset>/ablation` | POST | `{"model_name": "..."}` → per-layer accuracy drops |

**Models (`model_routes.py`):**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/d/<dataset>/predict` | POST | `{"image": "<b64>"}` or `{"features": {...}}` → per-model predictions |
| `/d/<dataset>/models` | GET | List session models with metadata |
| `/d/<dataset>/models/<name>` | DELETE | Remove model from session |
| `/d/<dataset>/models/<name>/export` | POST | Save to disk as `.pt` |
| `/d/<dataset>/models/disk` | GET | List `.pt` files for this dataset |
| `/d/<dataset>/models/disk/<filename>/load` | POST | Load a checkpoint into the session |
| `/d/<dataset>/model-info/<model_type>` | GET | `{"html": ...}` — the model's MODELS.md section rendered to HTML |

**Connection lifecycle (`routes/connection_routes.py`):**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/connect` | GET | Persistent SSE heartbeat stream (periodic pings; drives the client-count in `/health`) |
| `/pong` | POST | Heartbeat reply |
| `/disconnect` | POST | Graceful disconnect |

<a id="qmc-running--docker"></a>
### Running & Docker

**Local:** `python -m classifiers` (also `make run`). Binds a **random ephemeral port** unless `CLASSIFIERS_PORT` is set; the chosen port is written back to the env so Werkzeug's reloader child reuses it. Optional dev HTTPS via certs in `DEV_CERT_DIR` / `.certs/`. Host via `CLASSIFIERS_HOST` (default `127.0.0.1`).

**Dockerfile:**
- Base `python:3.12-slim`; installs CPU-only `torch==2.2.2+cpu` / `torchvision==0.17.2+cpu` from the PyTorch wheel index, then `requirements.txt`.
- Installs the pinned quantum extras (`pennylane`, `qiskit`, `qiskit-aer`, with `numpy` re-pinned for torch compatibility — see the Dockerfile comments for the lockstep constraint), so the quantum models light up in the image.
- `CLASSIFIERS_DEBUG=0` (never the Werkzeug debugger in the image).
- **Entry: gunicorn** (not `python -m classifiers`): `gthread` worker class, **1 worker** (the model registry is per-process in-memory state) × 8 threads, `--timeout 0` (SSE/training stream unbounded), binding `$PORT` (default **8080**, `EXPOSE 8080`) to `classifiers.wsgi:app`.

**docker-compose.yml:** service `classifier`, port `127.0.0.1:${CLASSIFIER_PORT}:${CLASSIFIER_PORT}`, env `CLASSIFIERS_PORT`, `CLASSIFIERS_HOST=0.0.0.0`, `CLASSIFIERS_CORS_ORIGINS`, `DEV_CERT_DIR=""`.

<a id="qmc-testing"></a>
### Testing

**454 test functions** at last count (the classifier repo's `test_documentation.py` asserts its README count against reality — check there for the current number), in `tests/`: model/architecture suites (`test_base_model.py`, `test_model.py`, `test_all_models_train.py`, `test_linear_model.py`, `test_svm_model.py`, `test_advanced_models.py`), pipeline (`test_trainer.py`, `test_evaluator.py`, `test_predictor.py`, `test_training_config.py`), registry/persistence (`test_model_registry.py`, `test_persistence.py`), plugins (`test_plugin_registry.py`, `test_iris.py`), layers (`test_layers.py`, `test_qiskit_layers.py` — conditional), routes (`test_routes.py`, `test_routes_advanced.py`, `test_cors.py`), integration (`test_integration.py`, `test_phase2_pipeline.py`, `test_phase3_crosscutting.py`), honesty gates (`test_documentation.py` — README count + path assertions; `test_accuracy_claims.py` is structural), export drift checks (`test_web_export.py` — re-scores the committed browser weights, linear and qsvm, on the real test splits), and the live-HTTP contract suite (`tests/contract/test_classifier_api.py`, validating `/health`, `/api`, the error envelope, and the `/sync` routes against the vendored schemas).

<a id="qmc-cicd"></a>
### CI/CD

**`.github/workflows/ci.yml`** — 4 jobs (Python 3.12):

1. **test** — install deps, `python -m pytest tests/ -v`
2. **contract** — boots the app on port 5001, curls `/health` until up, then runs `tests/contract/` against the live server (`CLASSIFIERS_URL`)
3. **lint** — `ruff check classifiers/ tests/`
4. **docker** — `docker build -t qml-classifiers .`

<a id="qmc-dependencies"></a>
### Dependencies

Pinned in `requirements.txt` (flask, flask-cors, gunicorn, numpy, Pillow, mistune, scikit-learn; torch/torchvision installed separately per environment — CPU wheels in Docker/CI, manual locally). The quantum stack (pennylane, qiskit, qiskit-aer) is optional and pinned in the Dockerfile; the code gates each quantum model on its library being importable. Read the actual pins from `requirements.txt` and the Dockerfile rather than this doc.

<a id="qmc-architectural-patterns"></a>
### Architectural Patterns

1. **API-only service:** the backend owns no UI (`static_folder=None`); the portal owns the frontend and talks to it over the shared contract
2. **Plugin architecture (OCP):** `DatasetPlugin` is the sole extension point; a new dataset is a new subpackage under `classifiers/datasets/`
3. **Dependency inversion (DIP):** services live in `app.extensions[...]`; routes access them via `current_app.extensions[key]`
4. **Single responsibility (SRP):** Trainer, Evaluator, Predictor, Registry, Persistence are separate modules; route groups are separate sub-modules
5. **Streaming is additive:** every SSE operation has a synchronous `/sync` (or plain REST) equivalent — SSE is never the only path to a result
6. **Daemon threads + queues:** long-running ops stream progress through a queue into `sse_response()`
7. **Thread safety:** `ModelRegistry` uses a lock; the connection tracker counts SSE clients
8. **Lazy quantum imports:** Qiskit and PennyLane are imported only when a quantum model is instantiated, so lean deploys work without them
9. **Two-tier frontend:** the same UI runs against the live API or fully client-side on exported weights (the demo tier)

---

<a id="quantum-video-chat-qvc"></a>
