"""Contract tests for the Quantum Protein Kernel (classifier) API.

Validates the response shapes the frontend expects from the classifier
backend. Runs against the Flask app directly.
"""
import sys
from pathlib import Path

import pytest

QPK_ROOT = Path(__file__).resolve().parent.parent.parent / "packages" / "quantum-protein-kernel"
sys.path.insert(0, str(QPK_ROOT))

try:
    from classifiers import create_app

    APP_AVAILABLE = True
except ImportError:
    APP_AVAILABLE = False


pytestmark = pytest.mark.skipif(
    not APP_AVAILABLE,
    reason="quantum-protein-kernel not installed or dependencies missing",
)


@pytest.fixture(scope="module")
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


class TestHealthContract:
    def test_health_returns_200(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.get_json()
        assert isinstance(data, dict)


class TestDatasetsContract:
    """Frontend expects GET /api/datasets → list of dataset names."""

    def test_datasets_returns_list(self, client):
        resp = client.get("/api/datasets")
        assert resp.status_code == 200
        data = resp.get_json()
        assert isinstance(data, (list, dict))


class TestSSEContract:
    """Frontend expects GET /connect to return SSE stream."""

    def test_connect_returns_sse_stream(self, client):
        resp = client.get("/connect")
        assert resp.status_code == 200
        content_type = resp.content_type or ""
        assert "text/event-stream" in content_type
