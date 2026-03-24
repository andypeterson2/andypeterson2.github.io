"""Tests for the Flask web API."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from dashboard.web import (
    _find_free_port,
    _safe_project_path,
    _validate_name,
    create_app,
)

# ── Input validation ───────────────────────────────────────────────────────


class TestValidateName:
    def test_valid_names(self) -> None:
        assert _validate_name("my-project") is True
        assert _validate_name("project_1") is True
        assert _validate_name("my.app") is True
        assert _validate_name("CamelCase") is True

    def test_rejects_empty(self) -> None:
        assert _validate_name("") is False

    def test_rejects_path_traversal(self) -> None:
        assert _validate_name("..") is False
        assert _validate_name("../etc") is False
        assert _validate_name("foo/..") is False

    def test_rejects_slashes(self) -> None:
        assert _validate_name("a/b") is False
        assert _validate_name("a\\b") is False

    def test_rejects_special_chars(self) -> None:
        assert _validate_name("a b") is False
        assert _validate_name("a;b") is False
        assert _validate_name("$(cmd)") is False


class TestSafeProjectPath:
    def test_valid_project(self, tmp_path: Path) -> None:
        proj = tmp_path / "myproject"
        proj.mkdir()
        result = _safe_project_path(tmp_path, "myproject")
        assert result is not None
        assert result.name == "myproject"

    def test_nonexistent_project(self, tmp_path: Path) -> None:
        assert _safe_project_path(tmp_path, "nope") is None

    def test_rejects_traversal(self, tmp_path: Path) -> None:
        assert _safe_project_path(tmp_path, "..") is None

    def test_rejects_invalid_name(self, tmp_path: Path) -> None:
        assert _safe_project_path(tmp_path, "a/b") is None


# ── Flask test client ──────────────────────────────────────────────────────


@pytest.fixture()
def projects_dir(tmp_path: Path) -> Path:
    """Create a test projects directory with mock projects."""
    proj = tmp_path / "test-project"
    proj.mkdir()
    (proj / ".git").mkdir()
    (proj / "main.py").write_text("print('hello')")

    # Add a dashboard manifest
    (proj / ".dashboard.yaml").write_text(
        yaml.dump(
            {
                "services": [
                    {
                        "name": "web",
                        "display_name": "Web Server",
                        "compose_service": "web",
                        "default_port": 8080,
                    }
                ]
            }
        )
    )
    (proj / "docker-compose.yml").write_text(yaml.dump({"services": {"web": {"image": "nginx"}}}))
    return tmp_path


@pytest.fixture()
def client(projects_dir: Path):
    app = create_app(str(projects_dir))
    app.config["TESTING"] = True
    yield app.test_client()


class TestHealthEndpoint:
    def test_returns_ok(self, client) -> None:
        res = client.get("/api/health")
        assert res.status_code == 200
        data = res.get_json()
        assert data["status"] == "ok"
        assert "version" in data

    def test_health_json_content_type(self, client) -> None:
        res = client.get("/api/health")
        assert "application/json" in res.content_type


class TestProjectsEndpoint:
    def test_lists_projects(self, client) -> None:
        res = client.get("/api/projects")
        assert res.status_code == 200
        data = res.get_json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["name"] == "test-project"

    def test_project_has_expected_fields(self, client) -> None:
        res = client.get("/api/projects")
        project = res.get_json()[0]
        expected_fields = [
            "name",
            "path",
            "has_git",
            "has_dockerfile",
            "has_compose",
            "languages",
            "description",
        ]
        for field in expected_fields:
            assert field in project, f"Missing field: {field}"

    def test_single_project(self, client) -> None:
        res = client.get("/api/projects/test-project")
        assert res.status_code == 200
        data = res.get_json()
        assert data["name"] == "test-project"

    def test_single_project_not_found(self, client) -> None:
        res = client.get("/api/projects/nonexistent")
        assert res.status_code == 404


class TestServiceStartEndpoint:
    def test_rejects_missing_fields(self, client) -> None:
        res = client.post("/api/services/start", json={})
        assert res.status_code == 400

    def test_rejects_invalid_project_name(self, client) -> None:
        res = client.post(
            "/api/services/start",
            json={"project": "../etc", "service": "web"},
        )
        assert res.status_code == 400

    def test_rejects_invalid_service_name(self, client) -> None:
        res = client.post(
            "/api/services/start",
            json={"project": "test-project", "service": "$(evil)"},
        )
        assert res.status_code == 400

    def test_project_not_found(self, client) -> None:
        res = client.post(
            "/api/services/start",
            json={"project": "nonexistent", "service": "web"},
        )
        assert res.status_code == 404


class TestServiceStopEndpoint:
    def test_project_not_found(self, client) -> None:
        res = client.post(
            "/api/services/stop",
            json={"project": "nonexistent", "service": "web"},
        )
        assert res.status_code == 404


class TestServiceLogsEndpoint:
    def test_rejects_invalid_names(self, client) -> None:
        res = client.get("/api/services/../etc/logs")
        assert res.status_code in (400, 404)

    def test_project_not_found(self, client) -> None:
        res = client.get("/api/services/nonexistent/web/logs")
        assert res.status_code == 404


class TestStatusEndpoint:
    def test_returns_dict(self, client) -> None:
        res = client.get("/api/services/status")
        assert res.status_code == 200
        data = res.get_json()
        assert isinstance(data, dict)


# ── Utility functions ──────────────────────────────────────────────────────


class TestFindFreePort:
    def test_returns_preferred_when_available(self) -> None:
        # Use a high port that's likely free
        port = _find_free_port(59999)
        assert isinstance(port, int)
        assert port > 0

    def test_finds_alternative_when_busy(self) -> None:
        import socket

        # Bind a port to make it unavailable
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 0))
            busy_port = s.getsockname()[1]
            # The port is still bound, so _find_free_port should find another
            alt_port = _find_free_port(busy_port)
            assert alt_port != busy_port
            assert alt_port > 0
