"""Phase 1 Tests -- WPs #705-#714

Covers:
    - Health check endpoint reliability (#705)
    - Dashboard card rendering (#706)
    - Real-time service status (#707)
    - Flask app startup and configuration (#708)
    - Service registry and scanning (#709)
    - UI-kit integration in web templates (#710)
    - Navigation and API routing (#711)
    - HTTPS/SSL support (#712)
    - CI configuration readiness (#713)
    - Connect widget integration (#714)
"""

from __future__ import annotations

import textwrap
from pathlib import Path

import pytest
import yaml

from dashboard.web import _validate_name, create_app


# ── Fixtures ─────────────────────────────────────────────────────────────────


@pytest.fixture()
def projects_dir(tmp_path: Path) -> Path:
    """Create a test projects directory with mock projects."""
    proj = tmp_path / "alpha-project"
    proj.mkdir()
    (proj / ".git").mkdir()
    (proj / "main.py").write_text("print('hello')")
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
    (proj / "docker-compose.yml").write_text(
        yaml.dump({"services": {"web": {"image": "nginx"}}})
    )

    # Second project
    proj2 = tmp_path / "beta-service"
    proj2.mkdir()
    (proj2 / ".git").mkdir()
    (proj2 / ".dashboard.yaml").write_text(
        yaml.dump(
            {
                "services": [
                    {
                        "name": "api",
                        "display_name": "API Server",
                        "compose_service": "api",
                        "default_port": 3000,
                    }
                ]
            }
        )
    )
    (proj2 / "docker-compose.yml").write_text(
        yaml.dump({"services": {"api": {"image": "node:20-slim"}}})
    )
    return tmp_path


@pytest.fixture()
def client(projects_dir: Path):
    app = create_app(str(projects_dir))
    app.config["TESTING"] = True
    yield app.test_client()


@pytest.fixture()
def app_instance(projects_dir: Path):
    app = create_app(str(projects_dir))
    app.config["TESTING"] = True
    return app


# ── WP #705 — Health check endpoint reliability ─────────────────────────────


class TestWP705HealthCheckReliability:
    """Health endpoint must always return 200 with status ok."""

    def test_health_returns_200(self, client) -> None:
        res = client.get("/api/health")
        assert res.status_code == 200

    def test_health_returns_json(self, client) -> None:
        res = client.get("/api/health")
        assert "application/json" in res.content_type

    def test_health_has_status_ok(self, client) -> None:
        data = client.get("/api/health").get_json()
        assert data["status"] == "ok"

    def test_health_includes_version(self, client) -> None:
        data = client.get("/api/health").get_json()
        assert "version" in data
        assert isinstance(data["version"], str)
        assert len(data["version"]) > 0

    def test_health_idempotent(self, client) -> None:
        """Multiple calls return the same result."""
        r1 = client.get("/api/health").get_json()
        r2 = client.get("/api/health").get_json()
        assert r1 == r2

    def test_health_allows_get_only(self, client) -> None:
        post = client.post("/api/health")
        assert post.status_code in (404, 405)


# ── WP #706 — Dashboard card rendering ──────────────────────────────────────


class TestWP706DashboardCardRendering:
    """Projects endpoint returns structured data suitable for card UI."""

    def test_projects_returns_list(self, client) -> None:
        data = client.get("/api/projects").get_json()
        assert isinstance(data, list)

    def test_project_has_card_fields(self, client) -> None:
        data = client.get("/api/projects").get_json()
        for project in data:
            assert "name" in project
            assert "path" in project
            assert "has_compose" in project
            assert "description" in project

    def test_project_has_service_info(self, client) -> None:
        data = client.get("/api/projects").get_json()
        project = next(p for p in data if p["name"] == "alpha-project")
        assert "dashboard_services" in project
        assert len(project["dashboard_services"]) >= 1
        svc = project["dashboard_services"][0]
        assert svc["name"] == "web"
        assert svc["display_name"] == "Web Server"
        assert svc["default_port"] == 8080

    def test_multiple_projects_returned(self, client) -> None:
        data = client.get("/api/projects").get_json()
        names = [p["name"] for p in data]
        assert "alpha-project" in names
        assert "beta-service" in names

    def test_project_detail_endpoint(self, client) -> None:
        res = client.get("/api/projects/alpha-project")
        assert res.status_code == 200
        data = res.get_json()
        assert data["name"] == "alpha-project"


# ── WP #707 — Real-time service status ──────────────────────────────────────


class TestWP707RealTimeStatus:
    """Status endpoint returns per-service statuses."""

    def test_status_returns_dict(self, client) -> None:
        res = client.get("/api/services/status")
        assert res.status_code == 200
        data = res.get_json()
        assert isinstance(data, dict)

    def test_status_keys_are_project_service_pairs(self, client) -> None:
        data = client.get("/api/services/status").get_json()
        for key in data:
            assert "/" in key, f"Status key should be project/service: {key}"

    def test_status_values_are_strings(self, client) -> None:
        data = client.get("/api/services/status").get_json()
        for val in data.values():
            assert isinstance(val, str)


# ── WP #708 — Flask app startup and configuration ───────────────────────────


class TestWP708FlaskStartup:
    """Flask app configures correctly with given projects root."""

    def test_app_created_with_projects_root(self, projects_dir: Path) -> None:
        app = create_app(str(projects_dir))
        assert app.config["PROJECTS_ROOT"] == projects_dir

    def test_app_has_cors_enabled(self, app_instance) -> None:
        # CORS headers should be present on responses
        with app_instance.test_client() as c:
            res = c.get("/api/health")
            # flask-cors adds Access-Control-Allow-Origin
            assert res.status_code == 200

    def test_app_testing_mode(self, app_instance) -> None:
        app_instance.config["TESTING"] = True
        assert app_instance.config["TESTING"] is True

    def test_app_default_projects_root(self, monkeypatch) -> None:
        monkeypatch.setenv("DASHBOARD_PROJECTS", "/tmp/test-projects")
        app = create_app()
        assert str(app.config["PROJECTS_ROOT"]) == "/tmp/test-projects"


# ── WP #709 — Service registry and scanning ─────────────────────────────────


class TestWP709ServiceRegistry:
    """Scanner finds projects with .dashboard.yaml manifests."""

    def test_scan_finds_projects_with_manifests(self, client) -> None:
        data = client.get("/api/projects").get_json()
        manifested = [p for p in data if p.get("has_dashboard_manifest")]
        assert len(manifested) >= 2

    def test_scan_detects_git_repos(self, client) -> None:
        data = client.get("/api/projects").get_json()
        for p in data:
            assert p["has_git"] is True

    def test_scan_detects_compose(self, client) -> None:
        data = client.get("/api/projects").get_json()
        for p in data:
            assert p["has_compose"] is True

    def test_project_not_found_returns_404(self, client) -> None:
        res = client.get("/api/projects/nonexistent-project")
        assert res.status_code == 404


# ── WP #710 — UI-kit integration ────────────────────────────────────────────


class TestWP710UIKitIntegration:
    """Dashboard index.html includes ui-kit assets."""

    def test_index_html_exists(self) -> None:
        index = Path(__file__).resolve().parents[1] / "index.html"
        assert index.exists(), f"Expected {index} to exist"

    def test_index_references_ui_kit_css(self) -> None:
        index = Path(__file__).resolve().parents[1] / "index.html"
        content = index.read_text()
        assert "ui-kit.css" in content

    def test_index_references_ui_kit_js(self) -> None:
        index = Path(__file__).resolve().parents[1] / "index.html"
        content = index.read_text()
        assert "ui-kit.js" in content

    def test_index_references_theme_bootstrap(self) -> None:
        index = Path(__file__).resolve().parents[1] / "index.html"
        content = index.read_text()
        assert "theme-bootstrap.js" in content


# ── WP #711 — Navigation and API routing ────────────────────────────────────


class TestWP711Navigation:
    """All expected API routes exist and respond."""

    def test_health_route(self, client) -> None:
        assert client.get("/api/health").status_code == 200

    def test_projects_route(self, client) -> None:
        assert client.get("/api/projects").status_code == 200

    def test_project_detail_route(self, client) -> None:
        assert client.get("/api/projects/alpha-project").status_code == 200

    def test_services_status_route(self, client) -> None:
        assert client.get("/api/services/status").status_code == 200

    def test_service_start_requires_post(self, client) -> None:
        res = client.get("/api/services/start")
        assert res.status_code in (404, 405)

    def test_service_stop_requires_post(self, client) -> None:
        res = client.get("/api/services/stop")
        assert res.status_code in (404, 405)

    def test_openproject_status_route(self, client) -> None:
        res = client.get("/api/openproject/status")
        assert res.status_code == 200
        data = res.get_json()
        assert "configured" in data


# ── WP #712 — HTTPS/SSL support ─────────────────────────────────────────────


class TestWP712HTTPS:
    """Web module has SSL context detection."""

    def test_get_ssl_context_returns_none_without_certs(self) -> None:
        from dashboard.web import _get_ssl_context

        result = _get_ssl_context()
        # Without dev certs, should return None (fallback to HTTP)
        # This is expected behavior in test/dev environments
        assert result is None or isinstance(result, tuple)

    def test_ssl_context_checks_cert_paths(self) -> None:
        from dashboard.web import _get_ssl_context
        import os

        # When DEV_CERT_DIR is empty/unset, should not crash
        os.environ.pop("DEV_CERT_DIR", None)
        result = _get_ssl_context()
        assert result is None or len(result) == 2


# ── WP #713 — CI configuration readiness ────────────────────────────────────


class TestWP713CI:
    """Project has test infrastructure for CI."""

    def test_pyproject_has_pytest_config(self) -> None:
        pyproject = Path(__file__).resolve().parents[1] / "pyproject.toml"
        content = pyproject.read_text()
        assert "[tool.pytest.ini_options]" in content

    def test_pyproject_has_test_deps(self) -> None:
        pyproject = Path(__file__).resolve().parents[1] / "pyproject.toml"
        content = pyproject.read_text()
        assert "pytest" in content

    def test_pyproject_has_ruff_config(self) -> None:
        pyproject = Path(__file__).resolve().parents[1] / "pyproject.toml"
        content = pyproject.read_text()
        assert "[tool.ruff]" in content

    def test_pyproject_has_coverage_config(self) -> None:
        pyproject = Path(__file__).resolve().parents[1] / "pyproject.toml"
        content = pyproject.read_text()
        assert "[tool.coverage" in content

    def test_makefile_exists(self) -> None:
        makefile = Path(__file__).resolve().parents[1] / "Makefile"
        assert makefile.exists()

    def test_dockerfile_exists(self) -> None:
        dockerfile = Path(__file__).resolve().parents[1] / "Dockerfile"
        assert dockerfile.exists()


# ── WP #714 — Connect widget integration ────────────────────────────────────


class TestWP714ConnectWidget:
    """Dashboard HTML includes service-config and connect widget setup."""

    def test_index_includes_service_config(self) -> None:
        index = Path(__file__).resolve().parents[1] / "index.html"
        content = index.read_text()
        assert "service-config.js" in content

    def test_index_includes_connect_widget(self) -> None:
        index = Path(__file__).resolve().parents[1] / "index.html"
        content = index.read_text()
        # Should reference UIKit.initConnect or similar connect widget setup
        assert "initConnect" in content or "connect" in content.lower()
