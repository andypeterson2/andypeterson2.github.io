## Nonogram Solver

**Package location:** `packages/nonogram`

<a id="nonogram-overview"></a>
### Overview

Quantum and classical solver for nonogram (Picross) puzzles with a production-ready web UI, benchmarking infrastructure, and IBM quantum hardware integration. Combines a brute-force SAT solver with Grover's quantum algorithm. Supports puzzle sizes up to 10x10 (lookup table constraint).

<a id="nonogram-core-python-package"></a>
### Core Python Package

**`nonogram/` package structure:**

| Module | Lines | Purpose |
|--------|-------|---------|
| `core.py` | 386 | Boolean SAT encoding, grid helpers, clue computation |
| `classical.py` | 174 | Brute-force exhaustive search solver |
| `quantum.py` | 300+ | Grover's algorithm (local simulator + IBM hardware) |
| `solver.py` | 120 | Solver ABC + 3 concrete implementations |
| `errors.py` | 45 | Custom exception hierarchy |
| `io.py` | 150+ | JSON puzzle I/O (`.non.json` format) |
| `data.py` | 150+ | Precomputed clue-to-pattern lookup table (lines 1-10) |
| `metrics.py` | 200+ | Benchmarking, circuit analysis, comparison reports |
| `__init__.py` | — | 54 public exports |

#### core.py — SAT Encoding & Grid Utilities

| Function | Purpose |
|----------|---------|
| `var_clauses(n, d)` | Maps n*d grid cells to boolean variable indices (row-major). Returns `(row_vars, col_vars)`. |
| `validate(rows, cols, r_clues, c_clues)` | Validates dimensions match clue counts. Raises `ValidationError`. |
| `display_nonogram(bit_string, n, d)` | ASCII box-drawing render (filled: black-square, empty: white-square). |
| `rle(bits)` | Run-length encode boolean sequence to clue tuple. |
| `grid_to_clues(grid)` | Compute row/column clues from completed grid. |
| `parse_clue(text)` | Parse space-separated clue string to tuple. |
| `puzzle_to_boolean(row_clues, col_clues, classical=False)` | Convert nonogram to SAT formula. Classical mode returns `(clause_list, var_count)` with DNF. Quantum mode returns boolean expression string with `~`, `&`, `\|` operators. |

Bitstring convention: Bit 0 = leftmost cell (differs from Qiskit's little-endian).

#### classical.py — Brute-Force Solver

**`ExecutionCounts` dataclass** — Fine-grained instrumentation:
- `candidates_evaluated`, `clause_evaluations`, `subclause_evaluations`, `literal_evaluations`
- `early_terminations`, `solutions_found`
- Computed: `literals_per_candidate`, `clauses_per_candidate`

**`classical_solve(puzzle, manual_check=None, verbose=False, collect_counts=False)`:**
- Iterates through all 2^(n*d) candidates
- `manual_check` validates a single bitstring
- Returns list of satisfying bitstrings, optionally with `ExecutionCounts`
- Complexity: O(2^(n*d) * C)

#### quantum.py — Grover's Algorithm

**Local Simulator (`quantum_solve`):**
- Uses `StatevectorSampler` (exact noiseless simulation)
- Constructs boolean expression via `puzzle_to_boolean()`
- Wraps oracle in `PhaseOracleGate` -> `AmplificationProblem` -> `Grover.amplify()`
- Returns `GroverResult` with probability distribution
- No IBM account needed

**Hardware Integration (`quantum_solve_hardware`):**

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `token` | required | IBM Quantum API token |
| `backend_name` | None (auto) | Specific backend or least-busy auto-selection |
| `channel` | `ibm_quantum_platform` | IBM service channel |
| `shots` | 1024 | Measurement repetitions |
| `iterations` | 1 | Grover iterations |
| `dynamical_decoupling` | True | XpXm sequence to suppress idle-qubit decoherence |
| `twirling` | True | Pauli twirling to convert coherent errors to depolarizing noise |

Transpiles with `optimization_level=3` (aggressive gate reduction).

**Iteration guidance:**

| Grid | Qubits | Search Space | k=1 | k=3 | k=5 | k=9 |
|------|--------|-------------|------|------|------|------|
| 2x2 | 4 | 16 | — | — | — | — |
| 3x3 | 9 | 512 | 1.8% | 9.3% | 22.6% | 64.2% |

**NISQ depth constraints:** 2x2 ~142 depth (feasible), 3x3 ~2900 (noise dominates), 4x4+ >10000 (beyond current hardware).

Additional: `list_backends(token, channel)`, `extract_counts(data, creg_names)`.

Bitstring convention: Qiskit uses little-endian; all returned bitstrings must be reversed (`bs[::-1]`) for row-major grid interpretation.

#### solver.py — Solver Interface

| Class | Name | Backend |
|-------|------|---------|
| `Solver` (ABC) | — | Abstract: `name` property + `solve(puzzle)` method |
| `ClassicalSolver` | "Classical" | `classical_solve()` |
| `QuantumSimulatorSolver` | "Quantum (Simulator)" | `quantum_solve()` |
| `QuantumHardwareSolver` | "Quantum (Hardware: {backend})" | `quantum_solve_hardware()` |

#### errors.py — Exception Hierarchy

```
NonogramError (root)
+-- ValidationError          (also: ValueError)
+-- SolverError
|   +-- ClassicalSolverError
|   +-- QuantumSolverError
|       +-- HardwareError
+-- PuzzleIOError            (also: OSError)
```

Multiple inheritance allows `ValidationError` to be caught by both `except NonogramError` and `except ValueError`.

#### io.py — Puzzle Serialization

File format: `.non.json`

```json
{
  "name": "Puzzle Name",
  "rows": 4, "cols": 6,
  "row_clues": [[1,1], [2,2], [1,2,1], [1,1]],
  "col_clues": [[4], [1], [1], [1], [1], [4]],
  "created": "2026-03-11T12:00:00+00:00",
  "tags": []
}
```

Functions: `save_puzzle`, `load_puzzle`, `save_batch`, `load_batch`. Max size: 10x10.

#### data.py — Clue Lookup Table

Precomputed constraint database for O(1) pattern enumeration.

- **`possible_d`** — Main lookup table. Keys: `"length/clue1;clue2;..."`. Values: list of valid bitstring patterns as integers. Coverage: line lengths 1-10.
- **`valid_line_configs(line_len, clue)`** — Count of valid configurations per line.
- **`constraint_density(row_clues, col_clues)`** — Puzzle difficulty metric.

#### metrics.py — Benchmarking & Analysis

**Dataclasses:**

| Class | Key Fields |
|-------|-----------|
| `ClassicalMetrics` | `solve_time_s`, `configurations_evaluated`, `solutions_found`, `peak_memory_kb`, `clause/subclause/literal_evaluations`, `early_terminations`. Computed: `configs_per_second`, `early_termination_rate`. |
| `QuantumMetrics` | `solve_time_s`, `num_qubits`, `circuit_depth`, `total_gate_count`, `two_qubit_gate_count`, `gate_counts_by_type`, `grover_iterations`, `top_result_probability`, `signal_to_noise`, `distribution_entropy`. |
| `StaticCircuitAnalysis` | `num_qubits`, `circuit_depth`, `total_gate_count`, `two_qubit_gate_count`. Computed: `two_qubit_gate_density`, `depth_per_iteration`, `gates_per_qubit`, `ancilla_ratio`. |
| `ComparisonReport` | All three above + solution space analysis, constraint density, hardware requirements, speedup ratios. |

Functions: `benchmark(puzzle)`, `analyze_circuit(circuit)`, `print_report(report)`.

<a id="nonogram-flask-backend"></a>
### Flask Backend

**`tools/webapp.py`** — Flask + Socket.IO server:

| Feature | Detail |
|---------|--------|
| Transport | Flask-SocketIO (threading async mode) |
| CORS | Regex matching localhost:*, explicit `andypeterson.dev` |
| SSL/TLS | Auto-uses `DEV_CERT_DIR` or `.certs/` for dev HTTPS |
| Port | Auto-assigned free port if `PORT=0` or unset |
| Browser launch | 1.2 second delayed auto-open |

**Environment Variables:**

| Variable | Default | Purpose |
|----------|---------|---------|
| `NONOGRAM_HOST` | `127.0.0.1` | Bind address |
| `PORT` | auto-assigned | Server port |
| `DEV_CERT_DIR` | — | Dev TLS certificate directory |
| `NONOGRAM_SECRET_KEY` | random 32-byte hex | Flask session key |
| `NONOGRAM_CORS_ORIGINS` | — | Extra CORS origins |

**`tools/config.py`** — Shared constants: `MAX_CLUES=3`, `MAX_GRID=10`, `PUZZLES_DIR`, `RUNS_DIR`.

**`tools/state.py`** — Thread-safe server state:

```python
{
  "rows": 4, "cols": 4,
  "grid": [[False]...],
  "hw_config": None,
  "busy": False,
  "puzzle_name": "puzzle",
}
```

Protected by `threading.Lock`. Socket.IO helpers: `emit_status()`, `set_busy()`.

**Routes (Flask Blueprints):**

| Blueprint | Endpoints | Purpose |
|-----------|-----------|---------|
| `grid_bp` | `POST /api/grid`, `POST /api/randomize` | Update/randomize grid (validates 1 <= rows/cols <= 10) |
| `solver_bp` | `POST /api/solve/classical`, `POST /api/solve/quantum`, `POST /api/solve/benchmark` | Trigger solvers in background threads. Socket.IO events: `cl_done`, `qu_done`, `bench_done`, `solver_error`. Error sanitization redacts long alphanumeric strings (likely API tokens). Results persisted to `RUNS_DIR/run_<uuid>.json`. |
| `puzzle_bp` | `POST /api/puzzle/load`, `POST /api/puzzle/save` | Upload/download `.non.json` files |
| `hardware_bp` | `POST /api/hw/backends`, `POST /api/hw/config` | List IBM backends (requires token), connect/disconnect hardware |
| `runs_bp` | `GET /api/runs/info`, `POST /api/runs/delete` | Cache metadata, clear run files |

**`tools/chart.py`** — Matplotlib rendering: `report_to_dict(report)`, `render_chart_b64(report, cl_times, qu_times)` (returns base64-encoded PNG).

<a id="nonogram-frontend"></a>
### Frontend

**`website/index.html`** — Single-page app with three-panel layout:

```
+-------------------+-------------------+--------------------+
| SIDEBAR           | MAIN CONTENT      | SETTINGS PANEL     |
| Draw/Clues Editor | Solution Grid     | Theme toggle       |
|                   | + Log Terminal    | Run log            |
|                   | + Histogram       | IBM Hardware Config|
+-------------------+-------------------+--------------------+
```

**Libraries (CDN):** Socket.IO 4.7.5, Font Awesome 6.5.1, Google Fonts (Atkinson Hyperlegible), UI Kit v1.1

**Frontend modules:**

| Module | Purpose |
|--------|---------|
| `website/static/state.js` | `window.App` namespace: grid state, clues, histogram data, hardware status, UI modes, DOM refs, SVG icon constants |
| `website/static/grid.js` | Grid init, clue computation (`rle`, `computeRowClues`, `computeColClues`), interactive table with corner buttons, pan/zoom, resize handles, random/clear/open/save buttons |
| `website/static/solver.js` | `renderClassical` (solution tables), `renderQuantum` (probability distribution, auto-threshold at 3x random baseline or 0.5%), `drawHistogram` (SVG bar chart with interactive tooltip and draggable threshold line), `renderBenchmark` (multi-trial with navigation) |
| `website/static/ui.js` | Sidebar/settings toggles, Draw/Clues mode switch, theme toggle (dark/light with sun/moon icons, localStorage), hardware status indicator, status terminal (timestamped+color-coded), busy state (disable buttons+spinner), solution grid magnification (S/M/L) |
| `website/static/app.js` | Socket.IO client init, event binding, grid/resize/theme initialization, threshold input handling, tooltip following |

**Socket.IO events:** `status`, `busy`, `cl_done`, `qu_done`, `bench_done`, `solver_error`, `hw_status`. Auto-reconnect on disconnect.

**`website/package.json`:** Vitest + jsdom for frontend tests.

<a id="nonogram-testing"></a>
### Testing

**Python tests (`pytest`):**

| File | Purpose | IBM API Cost |
|------|---------|-------------|
| `test_core.py` | Boolean encoding, variable indexing | None |
| `test_core_edge_cases.py` | Edge cases in SAT formulation | None |
| `test_classical.py` | Classical solver on small puzzles | None |
| `test_classical_verification.py` | Solution correctness | None |
| `test_quantum.py` | Grover algorithm basics | None |
| `test_quantum_robustness.py` | Quantum solver noise/variance | None |
| `test_io.py` | JSON save/load, batch operations | None |
| `test_metrics.py` | Benchmark infrastructure | None |
| `test_errors.py` | Exception hierarchy | None |
| `test_editor_logic.py` | Clue computation, `grid_to_clues` | None |
| `test_solver_abc.py` | Solver interface compliance | None |
| `test_data_validation.py` | Clue validation, constraint density | None |
| `test_encoding_validation.py` | Boolean expression correctness | None |
| `test_constraint_density.py` | Puzzle difficulty metrics | None |
| `test_execution_counts.py` | ExecutionCounts instrumentation | None |
| `test_static_circuit.py` | Static circuit analysis | None |
| `test_hardware_parsing.py` | Backend listing, DataBin extraction | 1 REST call |
| `test_hardware_2x2.py` | 2x2 Grover on real hardware | 1 circuit submission |
| `test_hardware_3x3.py` | 3x3 pipeline on real hardware | 1 circuit submission |
| `test_integration.py` | End-to-end solver workflows | None |
| `test_routes.py` | Flask routes with mocked solvers | None |
| `test_socketio_integration.py` | Socket.IO event flow | None |
| `test_cors.py` | CORS header validation | None |
| `test_api_contract.py` | API endpoint contracts | None |
| `test_api_integration.py` | Full API integration | None |
| `test_benchmark_harness.py` | Benchmarking infrastructure | None |
| `test_chart.py` | Chart rendering | None |
| `test_webapp_config.py` | Flask app configuration | None |
| `test_phase1_solver.py` | Grover solver components (AST structural) | None |
| `test_phase2_infra.py` | Benchmarking infrastructure | None |
| `test_phase3_crosscutting.py` | Cross-cutting concerns | None |

**JS frontend tests (Vitest + jsdom):** `grid.test.js`, `solver.test.js`, `state.test.js` with shared helpers.

**pytest.ini markers:** `slow` (deselect with `-m "not slow"`)

<a id="nonogram-cicd"></a>
### CI/CD

**`.github/workflows/tests.yml`** — CI:
- Trigger: push to main + PRs
- Matrix: Python 3.10, 3.11, 3.12 on ubuntu-latest
- `pytest tests/ -v --tb=short -m "not slow"` (skip expensive classical tests)
- `ruff check .`
- Docker image build

**`.github/workflows/deploy-pages.yml`** — Static site deployment:
- Trigger: push to main
- Uploads `website/` directory to GitHub Pages

<a id="nonogram-docker"></a>
### Docker

**Dockerfile:**
- Base: `python:3.12-slim`
- Generates self-signed dev certificates in `/.certs`
- Entry: `python tools/webapp.py`
- Supports HTTPS in dev mode

**docker-compose.yml:**
- Service: `nonogram`
- Port: `127.0.0.1:${NONOGRAM_PORT}:${NONOGRAM_PORT}` (default 5055)
- Environment: `PORT`, `DEV_CERT_DIR`, `NONOGRAM_HOST`

<a id="nonogram-performance-baselines"></a>
### Performance Baselines

| Grid | Classical | Quantum Simulator | Notes |
|------|-----------|-------------------|-------|
| 2x2 | <1 ms | ~ms | Trivial |
| 3x3 | ~50 ms | ~100 ms | Feasible |
| 4x4 | ~2 sec | ~minutes | Slow |
| 4x6 | ~18 min | >hours | Very slow |
| 6x6+ | Impractical | Impractical | Exponential growth |

<a id="nonogram-dependencies"></a>
### Dependencies

| Purpose | Package | Version |
|---------|---------|---------|
| Quantum circuits | qiskit | >=2.2,<3.0 |
| Grover's algorithm | qiskit-algorithms | >=0.3,<1.0 |
| IBM hardware | qiskit-ibm-runtime | >=0.30,<1.0 |
| Web framework | flask | >=3.0,<4.0 |
| CORS | flask-cors | >=4.0,<5.0 |
| WebSocket | flask-socketio | >=5.3,<6.0 |
| Arrays | numpy | >=1.24,<3.0 |
| Charts | matplotlib | >=3.7,<4.0 |
| Dev: lint | ruff | >=0.4 |
| Dev: tests | pytest | >=7.0,<9.0 |

---

<a id="quantum-protein-kernel"></a>
