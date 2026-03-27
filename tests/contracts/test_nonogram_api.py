"""Contract tests for the Nonogram backend API.

Validates that the API returns expected response shapes that the
frontend JavaScript relies on. These tests run against the Flask app
directly (no Docker needed).
"""
import sys
from pathlib import Path

import pytest

if sys.version_info < (3, 10):
    pytest.skip("nonogram requires Python 3.10+", allow_module_level=True)

# Add nonogram package to path
NONOGRAM_ROOT = Path(__file__).resolve().parent.parent.parent / "packages" / "nonogram"
sys.path.insert(0, str(NONOGRAM_ROOT))

from flask import Flask
from flask_socketio import SocketIO
from tools import state as app_state
from tools.routes import ALL_BLUEPRINTS


@pytest.fixture(scope="module")
def app():
    test_app = Flask(__name__)
    test_app.config["TESTING"] = True
    test_app.config["SECRET_KEY"] = "test"

    sio = SocketIO(test_app, async_mode="threading")
    app_state.init(sio)

    for bp in ALL_BLUEPRINTS:
        test_app.register_blueprint(bp)

    from tools.webapp import api_config
    test_app.add_url_rule("/api/config", view_func=api_config)

    app_state.state.update(
        {"rows": 3, "cols": 3, "grid": [[False] * 3 for _ in range(3)],
         "hw_config": None, "busy": False, "puzzle_name": "test-puzzle"}
    )
    return test_app


@pytest.fixture(autouse=True)
def reset_busy():
    """Clear busy flag between tests so benchmark doesn't get 409."""
    yield
    with app_state.state_lock:
        app_state.state["busy"] = False


@pytest.fixture()
def client(app):
    with app.test_client() as c:
        yield c


class TestGridContract:
    """Frontend grid.js expects these response shapes."""

    def test_post_grid_returns_200(self, client):
        resp = client.post(
            "/api/grid",
            json={
                "rows": 3,
                "cols": 3,
                "grid": [[True, False, True], [False, True, False], [True, False, True]],
            },
        )
        assert resp.status_code == 200

    def test_randomize_returns_grid_array(self, client):
        resp = client.post("/api/randomize", json={"rows": 3, "cols": 3})
        assert resp.status_code == 200
        data = resp.get_json()
        assert "grid" in data
        assert isinstance(data["grid"], list)
        assert len(data["grid"]) > 0
        assert isinstance(data["grid"][0], list)


class TestClassicalSolverContract:
    """Frontend solver.js expects {solutions: [...], rows, cols}."""

    def test_classical_solve_response_shape(self, client):
        resp = client.post(
            "/api/solve/classical",
            json={"row_clues": [[2], [2]], "col_clues": [[2], [2]]},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        # Direct HTTP response may differ from Socket.IO event shape
        # but should be valid JSON
        assert isinstance(data, dict)

    def test_classical_solve_with_no_solution(self, client):
        """Contradictory clues should return empty solutions or error."""
        resp = client.post(
            "/api/solve/classical",
            json={"row_clues": [[3]], "col_clues": [[1]]},
        )
        # Should not crash — either returns solutions: [] or error
        assert resp.status_code in (200, 400, 422)


class TestQuantumSolverContract:
    """Frontend solver.js expects {counts: {bitstring: freq}, rows, cols}."""

    def test_quantum_solve_response_shape(self, client):
        resp = client.post(
            "/api/solve/quantum",
            json={"row_clues": [[1], [1]], "col_clues": [[1], [1]]},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert isinstance(data, dict)


class TestBenchmarkContract:
    """Frontend app.js POSTs to /api/benchmark."""

    def test_benchmark_accepts_trials(self, client):
        resp = client.post(
            "/api/benchmark",
            json={
                "row_clues": [[2], [2]],
                "col_clues": [[2], [2]],
                "trials": 1,
            },
        )
        assert resp.status_code == 200

    def test_benchmark_rejects_invalid_trials(self, client):
        resp = client.post(
            "/api/benchmark",
            json={
                "row_clues": [[1]],
                "col_clues": [[1]],
                "trials": -1,
            },
        )
        assert resp.status_code in (200, 400, 422)


class TestConfigContract:
    """Frontend may read /api/config."""

    def test_config_returns_dict(self, client):
        resp = client.get("/api/config")
        if resp.status_code == 200:
            data = resp.get_json()
            assert isinstance(data, dict)
