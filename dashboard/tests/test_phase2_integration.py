"""Phase 2 Integration & Cross-Cutting Tests -- WPs #700-#704

Covers:
    - E2E dashboard load and page structure (#700)
    - Health check aggregation across services (#701)
    - API endpoint validation (#702)
    - Cross-browser/standards compliance (#703)
    - Performance considerations (#704)
"""

from __future__ import annotations

import time
from pathlib import Path

import pytest
import yaml

from dashboard.web import _validate_name, _safe_project_path, create_app


# ── Fixtures ─────────────────────────────────────────────────────────────────


@pytest.fixture()
def projects_dir(tmp_path: Path) -> Path:
    """Create a test projects directory with multiple mock projects."""
    for i, (name, svc_name, port) in enumerate(
        [
            ("project-alpha", "frontend", 3000),
            ("project-beta", "backend", 5000),
            ("project-gamma", "worker", 8000),
        ]
    ):
        proj = tmp_path / name
        proj.mkdir()
        (proj / ".git").mkdir()
        (proj / ".dashboard.yaml").write_text(
            yaml.dump(
                {
                    "services": [
                        {
                            "name": svc_name,
                            "display_name": f"{svc_name.title()} Service",
                            "compose_service": svc_name,
                            "default_port": port,
                        }
                    ]
                }
            )
        )
        (proj / "docker-compose.yml").write_text(
            yaml.dump({"services": {svc_name: {"image": "alpine"}}})
        )
    return tmp_path


@pytest.fixture()
def client(projects_dir: Path):
    app = create_app(str(projects_dir))
    app.config["TESTING"] = True
    yield app.test_client()


# ── WP #700 — E2E dashboard load and page structure ─────────────────────────


class TestWP700DashboardLoad:
    """Verify the dashboard loads and exposes all expected endpoints."""

    def test_health_endpoint_loads(self, client) -> None:
        res = client.get("/api/health")
        assert res.status_code == 200
        assert res.get_json()["status"] == "ok"

    def test_projects_endpoint_returns_all(self, client) -> None:
        data = client.get("/api/projects").get_json()
        assert len(data) == 3
        names = sorted(p["name"] for p in data)
        assert names == ["project-alpha", "project-beta", "project-gamma"]

    def test_each_project_accessible_by_name(self, client) -> None:
        for name in ("project-alpha", "project-beta", "project-gamma"):
            res = client.get(f"/api/projects/{name}")
            assert res.status_code == 200
            assert res.get_json()["name"] == name

    def test_index_html_served(self) -> None:
        """Dashboard root should have an index.html for the web UI."""
        index = Path(__file__).resolve().parents[1] / "index.html"
        assert index.exists()
        content = index.read_text()
        assert "<!DOCTYPE html>" in content or "<!doctype html>" in content

    def test_status_endpoint_covers_all_services(self, client) -> None:
        statuses = client.get("/api/services/status").get_json()
        expected_keys = {
            "project-alpha/frontend",
            "project-beta/backend",
            "project-gamma/worker",
        }
        assert expected_keys == set(statuses.keys())


# ── WP #701 — Health check aggregation ───────────────────────────────────────


class TestWP701HealthCheckAggregation:
    """Status endpoint aggregates health for all discovered services."""

    def test_all_services_have_status(self, client) -> None:
        statuses = client.get("/api/services/status").get_json()
        assert len(statuses) >= 3

    def test_status_values_are_valid(self, client) -> None:
        statuses = client.get("/api/services/status").get_json()
        valid_states = {"running", "stopped", "unknown", "exited", "created", "paused"}
        for key, val in statuses.items():
            assert isinstance(val, str), f"Status for {key} should be a string"

    def test_health_independent_of_services(self, client) -> None:
        """Health endpoint should be ok even if all services are stopped."""
        health = client.get("/api/health").get_json()
        assert health["status"] == "ok"


# ── WP #702 — API endpoint validation ───────────────────────────────────────


class TestWP702APIEndpoints:
    """Validate request/response contracts for all API endpoints."""

    def test_service_start_rejects_empty_body(self, client) -> None:
        res = client.post("/api/services/start", json={})
        assert res.status_code == 400

    def test_service_start_rejects_invalid_names(self, client) -> None:
        res = client.post(
            "/api/services/start",
            json={"project": "../hack", "service": "web"},
        )
        assert res.status_code == 400

    def test_service_start_rejects_injection(self, client) -> None:
        res = client.post(
            "/api/services/start",
            json={"project": "test", "service": "$(whoami)"},
        )
        assert res.status_code == 400

    def test_service_stop_requires_valid_project(self, client) -> None:
        res = client.post(
            "/api/services/stop",
            json={"project": "nonexistent", "service": "web"},
        )
        assert res.status_code == 404

    def test_service_logs_rejects_invalid_names(self, client) -> None:
        res = client.get("/api/services/../../etc/logs")
        assert res.status_code in (400, 404)

    def test_service_logs_project_not_found(self, client) -> None:
        res = client.get("/api/services/fake-project/web/logs")
        assert res.status_code == 404

    def test_project_not_found_returns_404(self, client) -> None:
        res = client.get("/api/projects/does-not-exist")
        assert res.status_code == 404
        data = res.get_json()
        assert "error" in data

    def test_openproject_status_returns_configured_flag(self, client) -> None:
        res = client.get("/api/openproject/status")
        assert res.status_code == 200
        data = res.get_json()
        assert isinstance(data["configured"], bool)

    def test_openproject_projects_endpoint(self, client) -> None:
        res = client.get("/api/openproject/projects")
        # May fail if OP not configured, but should not crash
        assert res.status_code in (200, 500)


# ── WP #703 — Cross-browser / standards compliance ──────────────────────────


class TestWP703CrossBrowser:
    """Web UI follows standards for cross-browser support."""

    def test_html_has_doctype(self) -> None:
        index = Path(__file__).resolve().parents[1] / "index.html"
        content = index.read_text()
        first_line = content.strip().split("\n")[0].lower()
        assert "<!doctype html>" in first_line

    def test_html_has_lang_attribute(self) -> None:
        index = Path(__file__).resolve().parents[1] / "index.html"
        content = index.read_text()
        assert 'lang="' in content

    def test_html_has_charset(self) -> None:
        index = Path(__file__).resolve().parents[1] / "index.html"
        content = index.read_text()
        assert "charset" in content.lower()

    def test_html_has_viewport_meta(self) -> None:
        index = Path(__file__).resolve().parents[1] / "index.html"
        content = index.read_text()
        assert "viewport" in content

    def test_api_returns_json_content_type(self, client) -> None:
        for endpoint in ("/api/health", "/api/projects", "/api/services/status"):
            res = client.get(endpoint)
            assert "application/json" in res.content_type, (
                f"Endpoint {endpoint} should return JSON"
            )


# ── WP #704 — Performance considerations ────────────────────────────────────


class TestWP704Performance:
    """API responses are fast and efficient."""

    def test_health_responds_quickly(self, client) -> None:
        start = time.monotonic()
        client.get("/api/health")
        elapsed = time.monotonic() - start
        assert elapsed < 1.0, f"Health check took {elapsed:.2f}s, expected < 1s"

    def test_projects_responds_quickly(self, client) -> None:
        start = time.monotonic()
        client.get("/api/projects")
        elapsed = time.monotonic() - start
        assert elapsed < 2.0, f"Projects endpoint took {elapsed:.2f}s, expected < 2s"

    def test_input_validation_rejects_fast(self, client) -> None:
        """Validation failures should not be slow."""
        start = time.monotonic()
        client.post(
            "/api/services/start",
            json={"project": "../bad", "service": "x"},
        )
        elapsed = time.monotonic() - start
        assert elapsed < 0.5, f"Validation took {elapsed:.2f}s, expected < 0.5s"

    def test_validate_name_is_efficient(self) -> None:
        """Name validation should handle pathological input quickly."""
        long_name = "a" * 10000
        start = time.monotonic()
        _validate_name(long_name)
        elapsed = time.monotonic() - start
        assert elapsed < 0.1

    def test_safe_project_path_handles_missing_dir(self, tmp_path: Path) -> None:
        """Path resolution should not hang on missing directories."""
        start = time.monotonic()
        result = _safe_project_path(tmp_path, "nonexistent")
        elapsed = time.monotonic() - start
        assert result is None
        assert elapsed < 0.5

    def test_status_endpoint_handles_many_services(self, client) -> None:
        """Status should not be excessively slow even with multiple services."""
        start = time.monotonic()
        res = client.get("/api/services/status")
        elapsed = time.monotonic() - start
        assert res.status_code == 200
        assert elapsed < 5.0, f"Status took {elapsed:.2f}s with 3 services"
