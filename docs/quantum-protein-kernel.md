## Quantum Protein Kernel

**Package location:** `packages/quantum-protein-kernel`

<a id="qpk-overview"></a>
### Overview

Multi-dataset classifier platform comparing classical and quantum-hybrid neural network approaches. Plugin architecture for datasets (MNIST, Iris). Features live training via SSE, real-time loss curves, draw-to-predict (MNIST), form-to-predict (Iris), model persistence, early stopping, knowledge distillation, ensemble evaluation, and ablation studies.

<a id="qpk-core-abstractions"></a>
### Core Abstractions

#### BaseModel ABC (`base_model.py`)

| Method | Signature | Default |
|--------|-----------|---------|
| `forward` | `(x: torch.Tensor) -> torch.Tensor` | Abstract — returns logits |
| `loss_fn` | `(output, target) -> torch.Tensor` | Cross-entropy |

Subclasses: MNISTNet, LinearNet, SVMNet, Quadratic, Polynomial, QVC, QiskitCNN, QiskitLinear, IrisLinear, IrisSVM, IrisQVC.

#### DatasetPlugin ABC (`dataset_plugin.py`)

**Required attributes:**

| Attribute | Type | Purpose |
|-----------|------|---------|
| `name` | str | URL slug ("mnist", "iris") |
| `display_name` | str | UI label |
| `input_type` | `Literal["image", "tabular"]` | Input modality |
| `num_classes` | int | Number of output classes |
| `class_labels` | list[str] | Human-readable labels |
| `image_size` | tuple[int,int] \| None | Image dimensions |
| `image_channels` | int \| None | Channel count |
| `feature_names` | list[str] \| None | Tabular feature names |

**Required methods:**

| Method | Purpose |
|--------|---------|
| `get_train_loader(batch_size)` | Training DataLoader |
| `get_test_loader(batch_size)` | Test DataLoader |
| `preprocess(raw_input)` | PIL.Image or dict -> tensor |
| `get_model_types()` | `dict[str, type[BaseModel]]` |

**Optional methods:** `get_val_loader` (enables early stopping), `get_default_hyperparams`, `get_ui_config`.

<a id="qpk-dataset-plugins"></a>
### Dataset Plugins

#### MNIST Plugin

| Property | Value |
|----------|-------|
| Name | `mnist` |
| Display name | MNIST Handwritten Digits |
| Input type | image |
| Classes | 10 (digits 0-9) |
| Image size | 28x28, 1 channel |
| Train/Val/Test | 55,000 / 5,000 / 10,000 |
| Normalization | z-score (mean=0.1307, std=0.3081) |

**Model types (7):**

| Model | Architecture | Approx Accuracy |
|-------|-------------|-----------------|
| CNN (MNISTNet) | Conv2d(1->32) + Conv2d(32->64) + FC(9216->128->10) | ~99% |
| Linear (LinearNet) | Flatten + Linear(784->10) | ~92% |
| SVM (SVMNet) | Flatten + Linear(784->10) + hinge loss | ~91-92% |
| Quadratic | CNN + Quadratic(32->16) + FC(16->10) | ~98-99% |
| Polynomial | CNN + Polynomial layer + FC(->10) | ~98-99% |
| Qiskit-CNN | CNN + QiskitQLayer quantum circuit | Optional |
| Qiskit-Linear | Linear + QiskitQLayer quantum circuit | Optional |

#### Iris Plugin

| Property | Value |
|----------|-------|
| Name | `iris` |
| Display name | Iris Flower Classification |
| Input type | tabular |
| Classes | 3 (setosa, versicolor, virginica) |
| Features | sepal_length, sepal_width, petal_length, petal_width |
| Train/Val/Test | 96 / 24 / 30 (stratified, seed 42) |
| Normalization | z-score per training set statistics |

**Model types (3):**

| Model | Architecture | Approx Accuracy |
|-------|-------------|-----------------|
| Linear (IrisLinear) | Linear(4->3) | ~95-97% |
| SVM (IrisSVM) | Linear(4->3) + hinge loss | ~94-96% |
| QVC (IrisQVC) | 4 qubits, AngleEmbedding(Y) -> StronglyEntanglingLayers(2) -> measure Z0,Z1,Z2 | ~93-96% |

IrisQVC uses PennyLane: 24 trainable parameters (2 layers x 4 qubits x 3 rotations).

<a id="qpk-training-evaluation-prediction"></a>
### Training, Evaluation, Prediction

#### Trainer (`trainer.py`)

Constructor: `model_cls`, `train_loader`, `dataset`, `epochs=3`, `lr=1e-3`, `config=TrainingConfig?`, `val_loader?`, `early_stop_min_accuracy=0.6`

`train(on_status)` loop:
1. Instantiate model, create Adam optimizer
2. For each epoch -> for each batch -> forward -> loss -> backward -> step
3. **Distillation:** blends student loss with teacher output (MSE) via `distill_weight`
4. **Regularization:** adds `regularization_fn(model)` to loss if provided
5. **Validation checkpoints:** runs `val_loader` every `val_gap` batches
6. **Early stopping:** halts if no improvement for `patience` epochs (after `early_stop_min_accuracy` met)

Returns: `TrainResult` with model, epochs_completed, best_val_accuracy, history, num_params, stopped_early.

#### Evaluator (`evaluator.py`)

| Mode | Input | Output |
|------|-------|--------|
| Single | `evaluate(model, test_loader, ...)` | `EvalResult`: accuracy, avg_loss, per_class_accuracy, num_params |
| Ensemble | `ensemble_evaluate(models, test_loader, ...)` | Majority vote with logit-sum tie-breaking |
| Ablation | `ablation_evaluate(model, test_loader, ...)` | Per-layer accuracy drop (deep-copies model, zeros each layer's params) |

#### Predictor (`predictor.py`)

`Predictor(model, plugin)` -> `predict(raw_input)`:
- Delegates preprocessing to plugin
- Runs model in eval mode (no gradients)
- Applies softmax to logits
- Returns probability array of shape `(num_classes,)`

<a id="qpk-model-registry--persistence"></a>
### Model Registry & Persistence

#### ModelRegistry (`model_registry.py`)

Thread-safe in-memory store, namespaced by dataset.

| Method | Purpose |
|--------|---------|
| `add(dataset, name, model, ...)` | Register trained model |
| `remove(dataset, name)` | Delete model |
| `get(dataset, name)` | Retrieve `ModelEntry` |
| `names(dataset)` | List model names |
| `items(dataset)` | List all entries |
| `update_eval_result(...)` | Attach evaluation results |
| `next_name(dataset)` | Auto-increment ("Model 1", "Model 2", ...) |

`ModelEntry` fields: model, model_type, dataset, epochs, batch_size, lr, eval_result, training_history, num_params.

#### ModelPersistence (`persistence.py`)

| Method | Purpose |
|--------|---------|
| `save(name, entry)` | Write `.pt` checkpoint (state_dict, metadata, history). Sanitizes filename. |
| `load(filename)` | Read checkpoint, reconstruct model via `plugin_registry.create_model()`, set eval mode. Uses `weights_only=True`. |
| `list_files()` | List available checkpoints with metadata. |

<a id="qpk-rest-api--routes"></a>
### REST API & Routes

**Request hook:** `url_value_preprocessor` resolves dataset slug -> plugin lookup on `g.plugin`. Unknown datasets return 404.

#### Main Routes

| Endpoint | Purpose |
|----------|---------|
| `GET /` | Redirect to first dataset's index |
| `GET /d/<dataset>/` | Render SPA (`index.html` with Jinja2 `UI_CONFIG`) |
| `GET /api/datasets` | JSON list of `{name, display_name, input_type}` |
| `GET /api/datasets/<name>/config` | `{ui_config, model_types}` |
| `GET /health` | `{status, uptime, clients, timestamp}` |

#### Training Route

`POST /d/<dataset>/train`

```json
{
  "model_type": "CNN",
  "epochs": 3,
  "batch_size": 64,
  "lr": 0.001,
  "name": "My Model",
  "patience": 5,
  "val_gap": 50,
  "teacher": "Model 1",
  "distill_weight": 0.5
}
```

Response: **SSE stream** of events:
- `{"type": "status", "msg": "Epoch 1/3 - batch 50/938 - loss: 0.4521"}`
- `{"type": "history", "epoch": 0, "batch": 50, "train_loss": 0.45, "val_accuracy": 0.95}`
- `{"type": "done", "name": "...", "model_type": "...", "num_params": 123456, ...}`
- `{"type": "error", "msg": "..."}`

Spawns daemon thread, queues events, streams via `sse_response(queue)`.

#### Evaluation Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/d/<dataset>/evaluate` | POST | SSE stream evaluating all registered models |
| `/d/<dataset>/ensemble` | POST | `{"model_names": [...]}` -> ensemble accuracy |
| `/d/<dataset>/ablation` | POST | `{"model_name": "..."}` -> SSE stream of per-layer accuracy drops |

#### Model Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/d/<dataset>/predict` | POST | `{"image": "<b64>"}` or `{"features": {...}}` -> per-model predictions |
| `/d/<dataset>/models` | GET | List all session models with metadata |
| `/d/<dataset>/models/<name>` | DELETE | Remove model from session |
| `/d/<dataset>/models/<name>/export` | POST | Save to disk as `.pt` |
| `/d/<dataset>/models/disk` | GET | List `.pt` files for this dataset |
| `/d/<dataset>/models/disk/<filename>/load` | POST | Load checkpoint into session (auto-dedup names) |
| `/d/<dataset>/model-info/<model_type>` | GET | Render MODELS.md section as HTML |

<a id="qpk-special-layers--loss-functions"></a>
### Special Layers & Loss Functions

#### Quadratic Layer (`layers.py`)

```
forward(x):  z = concat(x^T * x, x)  ->  fc(z)
```
Includes pairwise products + original linear terms. `input_dim * (input_dim + 1)` features.

#### Polynomial Layer (`layers.py`)

```
forward(x):  y = exp(W * log(|x| + 1))
```
With clamping at [-10, 10] to prevent overflow.

#### Multi-class Hinge Loss (`losses.py`)

Crammer-Singer formulation: `sum of max(0, score_j - score_correct + margin)` for j != correct. Used by SVM models.

#### Qiskit Quantum Layer (`qiskit_layers.py`)

`QiskitQLayer` — Multi-headed parametric quantum circuit:
- Feature encoding via parameterized RX gates
- Linear entanglement topology (reduced depth)
- Measurement with finite-difference gradient estimation (parameter-shift rule)
- Integration into PyTorch backpropagation

<a id="qpk-frontend"></a>
### Frontend

**Templates:** `classifiers/templates/index.html` — SPA with Jinja2 `UI_CONFIG` injection (plugin metadata, model types, default hyperparams). Renders dataset-specific input widget (canvas for MNIST, form for Iris). Two-column layout: left (train/config), right (canvas/form + model table).

**Static JS:**

| File | Purpose |
|------|---------|
| `js/app.js` | State management, canvas drawing, model table, form handling, localStorage persistence |
| `js/sse.js` | SSE event consumer, progress streaming, queue handling |
| `js/chart.js` | Canvas-based training curve rendering (loss/accuracy plots) |

**Static CSS:** `css/app.css` — dark/light theming, layout, canvas styles, chart rendering.

<a id="qpk-testing"></a>
### Testing

**425+ tests:**

| File | Coverage |
|------|----------|
| `test_base_model.py` | BaseModel construction, forward passes |
| `test_model.py` | Individual model architecture tests |
| `test_all_models_train.py` | Training loop for all architectures |
| `test_trainer.py` | Trainer with early stopping, distillation, history |
| `test_evaluator.py` | Single, ensemble, ablation evaluation |
| `test_predictor.py` | Inference pipeline, preprocessing |
| `test_model_registry.py` | Registry CRUD, namespacing |
| `test_persistence.py` | Save/load checkpoints, filename safety |
| `test_routes.py` | Flask endpoints, request/response formats |
| `test_plugin_registry.py` | Plugin discovery, registration |
| `test_iris.py` | Iris plugin data loading, models |
| `test_layers.py` | Quadratic, Polynomial forward/backward |
| `test_qiskit_layers.py` | Qiskit circuit layer (conditional) |
| `test_integration.py` | Full training -> evaluation -> prediction pipeline |
| `dom/test_dom_integration.py` | DOM-based integration tests |
| `test_documentation.py` | Docstring completeness, examples |

<a id="qpk-cicd"></a>
### CI/CD

**`.github/workflows/ci.yml`** — 3 jobs:

1. **test** (Python 3.12): `pip install -r requirements.txt pytest`, `pytest tests/ -v`
2. **lint** (Python 3.12): `ruff check classifiers/ tests/`
3. **docker**: `docker build -t qml-classifiers .`

<a id="qpk-docker"></a>
### Docker

**Dockerfile:**
- Base: `python:3.12-slim`
- Installs PyTorch 2.2.2+cpu from official PyTorch wheels (no GPU)
- Mounts `.certs/` for optional HTTPS
- Entry: `python -m classifiers`

**docker-compose.yml:**
- Service: `classifier`
- Port: `127.0.0.1:${CLASSIFIER_PORT}:${CLASSIFIER_PORT}`
- Environment: `CLASSIFIERS_PORT`, `CLASSIFIERS_HOST=0.0.0.0`, `CLASSIFIERS_CORS_ORIGINS`, `DEV_CERT_DIR=""`

<a id="qpk-dependencies"></a>
### Dependencies

| Purpose | Package | Version |
|---------|---------|---------|
| Web framework | flask | >=3.0 |
| CORS | flask-cors | >=6.0 |
| Deep learning | torch | >=2.2 |
| Vision | torchvision | >=0.17 |
| Arrays | numpy | >=1.26 |
| Images | Pillow | >=12.0 |
| Markdown | mistune | >=3.0 |
| ML utilities | scikit-learn | >=1.5 |
| Quantum (optional) | qiskit | >=1.0 |
| Quantum (optional) | qiskit-aer | >=0.13 |
| Quantum (optional) | pennylane | >=0.35 |
| Dev: tests | pytest | >=8.0 |
| Dev: e2e | pytest-playwright | >=0.5 |
| Dev: lint | ruff | >=0.3 |

<a id="qpk-architectural-patterns"></a>
### Architectural Patterns

1. **Plugin Architecture (OCP):** `DatasetPlugin` ABC is the sole extension point; new datasets require only a new subpackage under `classifiers/datasets/`
2. **Dependency Inversion (DIP):** Services in `app.extensions[...]`; routes access via `current_app.extensions[key]`
3. **Single Responsibility (SRP):** Trainer, Evaluator, Predictor, Registry, Persistence are each separate modules
4. **SSE for long operations:** Training, evaluation, ablation stream progress via queue -> Flask streaming response
5. **Daemon threads:** Long-running ops execute in background threads with queue-based progress
6. **Thread safety:** `ModelRegistry` uses `threading.Lock`; `ConnectionTracker` tracks SSE clients
7. **Lazy imports:** Qiskit and PennyLane imported only when quantum models instantiated

---

<a id="quantum-video-chat-qvc"></a>
