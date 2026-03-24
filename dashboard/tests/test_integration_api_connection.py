"""Integration tests: verify the static frontend can connect to the dashboard API.

These tests simulate the connection flow between the static website
(https://andypeterson2.github.io/dashboard/) and the dashboard Flask API.
They verify:
  1. CORS allows the GitHub Pages origin
  2. /api/projects returns a valid project list with the expected shape
  3. /api/services/status returns service statuses
  4. The API response shape matches what the frontend JS expects

Run with:
    pytest tests/test_integration_api_connection.py -v
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from dashboard.web import create_app

GITHUB_PAGES_ORIGIN = "https://andypeterson2.github.io"
REAL_PROJECTS_ROOT = Path.home() / "Projects"


# ── Fixtures ──────────────────────────────────────────────────────────


@pytest.fixture()
def client_with_projects(tmp_projects):
    """Flask test client backed by the tmp_projects fixture from conftest."""
    app = create_app(str(tmp_projects))
    app.config["TESTING"] = True
    yield app.test_client()


@pytest.fixture()
def real_client():
    """Flask test client backed by the real ~/Projects directory."""
    if not REAL_PROJECTS_ROOT.is_dir():
        pytest.skip("~/Projects not found")
    app = create_app(str(REAL_PROJECTS_ROOT))
    app.config["TESTING"] = True
    yield app.test_client()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CORS — the static site on GitHub Pages must be allowed
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestCORSFromGitHubPages:
    """Verify CORS headers for requests originating from GitHub Pages."""

    def test_projects_allows_github_pages_origin(self, client_with_projects):
        res = client_with_projects.get(
            "/api/projects",
            headers={"Origin": GITHUB_PAGES_ORIGIN},
        )
        assert res.status_code == 200
        acao = res.headers.get("Access-Control-Allow-Origin")
        assert acao is not None, "Missing Access-Control-Allow-Origin header"
        assert acao == "*" or GITHUB_PAGES_ORIGIN in acao

    def test_preflight_for_post(self, client_with_projects):
        """OPTIONS preflight for POST /api/services/start must succeed."""
        res = client_with_projects.options(
            "/api/services/start",
            headers={
                "Origin": GITHUB_PAGES_ORIGIN,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type",
            },
        )
        assert res.status_code == 200
        assert "Access-Control-Allow-Origin" in res.headers

    def test_preflight_for_get_logs(self, client_with_projects):
        """OPTIONS preflight for GET /api/services/<p>/<s>/logs must succeed."""
        res = client_with_projects.options(
            "/api/services/project-a/test-svc/logs",
            headers={
                "Origin": GITHUB_PAGES_ORIGIN,
                "Access-Control-Request-Method": "GET",
            },
        )
        assert res.status_code == 200
        assert "Access-Control-Allow-Origin" in res.headers

    def test_status_endpoint_cors(self, client_with_projects):
        res = client_with_projects.get(
            "/api/services/status",
            headers={"Origin": GITHUB_PAGES_ORIGIN},
        )
        assert res.status_code == 200
        assert res.headers.get("Access-Control-Allow-Origin") is not None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# API response shape — must match what the frontend JS expects
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


# Keys the frontend reads from each project in /api/projects
REQUIRED_PROJECT_KEYS = {
    "name",
    "has_git",
    "has_compose",
    "has_dashboard_manifest",
    "git_branch",
    "git_dirty",
    "git_commit_count",
    "git_last_commit",
    "git_remote",
    "compose_services",
    "dashboard_services",
    "languages",
    "description",
}

# Keys the frontend reads from each dashboard_services entry
REQUIRED_SERVICE_KEYS = {
    "name",
    "display_name",
    "compose_service",
    "default_port",
}


class TestAPIResponseShape:
    """Ensure /api/projects returns the shape the frontend JS needs."""

    def test_projects_returns_list(self, client_with_projects):
        res = client_with_projects.get("/api/projects")
        assert res.status_code == 200
        data = res.get_json()
        assert isinstance(data, list)

    def test_project_has_required_keys(self, client_with_projects):
        res = client_with_projects.get("/api/projects")
        data = res.get_json()
        assert len(data) > 0, "Expected at least one project from tmp_projects"
        for project in data:
            missing = REQUIRED_PROJECT_KEYS - set(project.keys())
            assert not missing, f"Project '{project.get('name', '?')}' missing keys: {missing}"

    def test_dashboard_services_have_required_keys(self, client_with_projects):
        res = client_with_projects.get("/api/projects")
        data = res.get_json()
        for project in data:
            for svc in project.get("dashboard_services", []):
                missing = REQUIRED_SERVICE_KEYS - set(svc.keys())
                assert not missing, (
                    f"Service '{svc.get('name', '?')}' in project "
                    f"'{project['name']}' missing keys: {missing}"
                )

    def test_services_status_returns_dict(self, client_with_projects):
        res = client_with_projects.get("/api/services/status")
        assert res.status_code == 200
        data = res.get_json()
        assert isinstance(data, dict)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# End-to-end connection flow (simulates what app.js does)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestFrontendConnectionFlow:
    """Simulate the exact sequence of API calls the static frontend makes."""

    def test_full_connection_sequence(self, client_with_projects):
        """Simulate: page load → loadProjects() → render sidebar."""
        # Step 1: Frontend calls GET /api/projects on load
        res = client_with_projects.get(
            "/api/projects",
            headers={"Origin": GITHUB_PAGES_ORIGIN},
        )
        assert res.status_code == 200
        projects = res.get_json()
        assert isinstance(projects, list)
        assert len(projects) >= 1

        # Step 2: Verify project data can populate the sidebar
        p = projects[0]
        assert p["name"], "Project must have a name for sidebar rendering"
        assert isinstance(p["dashboard_services"], list)

        # Step 3: Frontend calls GET /api/services/status to check running state
        res2 = client_with_projects.get(
            "/api/services/status",
            headers={"Origin": GITHUB_PAGES_ORIGIN},
        )
        assert res2.status_code == 200
        statuses = res2.get_json()
        assert isinstance(statuses, dict)

    def test_start_stop_cycle_cors(self, client_with_projects):
        """Verify POST endpoints accept cross-origin JSON from GitHub Pages."""
        # The start will fail (no Docker in unit test) but the request
        # itself should be accepted (not blocked by CORS or 400)
        res = client_with_projects.post(
            "/api/services/start",
            data=json.dumps(
                {
                    "project": "project-a",
                    "service": "test-svc",
                    "compose_service": "svc",
                    "compose_file": "docker-compose.yml",
                }
            ),
            content_type="application/json",
            headers={"Origin": GITHUB_PAGES_ORIGIN},
        )
        # Accept 200 (started), 500 (docker not available), or 409 (already running)
        # But NOT 400 (bad request) or 403 (CORS blocked)
        assert res.status_code in (200, 409, 500, 504), (
            f"Unexpected status {res.status_code}: {res.get_data(as_text=True)}"
        )
        assert res.headers.get("Access-Control-Allow-Origin") is not None

    def test_logs_endpoint_cors(self, client_with_projects):
        """GET /api/services/<project>/<service>/logs should respond with CORS."""
        res = client_with_projects.get(
            "/api/services/project-a/test-svc/logs?tail=200",
            headers={"Origin": GITHUB_PAGES_ORIGIN},
        )
        # May be 200 or 500 (no Docker) — either way CORS must be present
        assert res.headers.get("Access-Control-Allow-Origin") is not None
        data = res.get_json()
        assert data is not None, "Response must be JSON"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Real-project smoke test — runs against ~/Projects if available
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestRealProjectsConnection:
    """Smoke test using the real ~/Projects directory."""

    def test_real_projects_api_returns_data(self, real_client):
        res = real_client.get(
            "/api/projects",
            headers={"Origin": GITHUB_PAGES_ORIGIN},
        )
        assert res.status_code == 200
        projects = res.get_json()
        assert isinstance(projects, list)
        assert len(projects) > 0, "Expected real projects under ~/Projects"

        # At least one project should have dashboard services
        has_dashboard = any(len(p.get("dashboard_services", [])) > 0 for p in projects)
        assert has_dashboard, "Expected at least one project with .dashboard.yaml services"

    def test_real_projects_response_shape(self, real_client):
        res = real_client.get("/api/projects")
        projects = res.get_json()
        for project in projects:
            missing = REQUIRED_PROJECT_KEYS - set(project.keys())
            assert not missing, f"Real project '{project.get('name', '?')}' missing keys: {missing}"
            for svc in project.get("dashboard_services", []):
                missing_svc = REQUIRED_SERVICE_KEYS - set(svc.keys())
                assert not missing_svc, (
                    f"Real service '{svc.get('name', '?')}' missing keys: {missing_svc}"
                )
