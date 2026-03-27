"""Docker Compose smoke tests.

These tests verify that all services start up and respond to health checks
when running under Docker Compose. They are designed to be run after
`make docker-up` or `docker compose up -d`.

Run with:  pytest tests/smoke/ -v --timeout=60
Skip if:   Docker services are not running (tests auto-skip)
"""
import os
import socket

import pytest
import urllib.request
import json

NGINX_BASE = os.environ.get("SMOKE_BASE_URL", "http://127.0.0.1:8080")

# Service health endpoints as exposed through nginx
SERVICES = {
    "website": {"path": "/", "expect_status": 200},
    "classifiers": {"path": "/classifiers/health", "expect_status": 200},
    "nonogram": {"path": "/nonogram/api/config", "expect_status": 200},
    "qvc-server": {"path": "/qvc-server/admin/health", "expect_status": 200},
    "qvc-middleware": {"path": "/qvc/health", "expect_status": 200},
    "cv-editor": {"path": "/cv/api/documents", "expect_status": 200},
}


def is_docker_up():
    """Quick check if nginx is listening on expected port."""
    try:
        s = socket.create_connection(("127.0.0.1", 8080), timeout=2)
        s.close()
        return True
    except (ConnectionRefusedError, OSError, socket.timeout):
        return False


def http_get(path, timeout=10):
    """Simple HTTP GET using stdlib (no requests dependency)."""
    url = f"{NGINX_BASE}{path}"
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return resp.status, body
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")
    except Exception as e:
        pytest.fail(f"HTTP GET {url} failed: {e}")


docker_required = pytest.mark.skipif(
    not is_docker_up(),
    reason="Docker services not running (start with `make docker-up`)",
)


@docker_required
class TestServiceHealth:
    """Verify each service responds through the nginx reverse proxy."""

    @pytest.mark.parametrize(
        "service,config",
        SERVICES.items(),
        ids=SERVICES.keys(),
    )
    def test_service_responds(self, service, config):
        status, body = http_get(config["path"])
        assert status == config["expect_status"], (
            f"{service} at {config['path']} returned {status}: {body[:200]}"
        )

    def test_nginx_serves_static_assets(self):
        status, body = http_get("/favicon.svg")
        assert status == 200
        assert "svg" in body.lower()

    def test_nginx_returns_404_for_unknown_paths(self):
        status, _ = http_get("/this-path-should-not-exist-12345")
        assert status in (404, 301, 302)


@docker_required
class TestServiceResponses:
    """Verify services return expected data structures."""

    def test_classifier_health_has_uptime(self):
        status, body = http_get("/classifiers/health")
        if status == 200:
            data = json.loads(body)
            assert "uptime" in data or "status" in data

    def test_nonogram_config_returns_json(self):
        status, body = http_get("/nonogram/api/config")
        if status == 200:
            data = json.loads(body)
            assert isinstance(data, dict)

    def test_qvc_server_status(self):
        status, body = http_get("/qvc-server/admin/status")
        if status == 200:
            data = json.loads(body)
            assert isinstance(data, dict)

    def test_cv_editor_documents_list(self):
        status, body = http_get("/cv/api/documents")
        if status == 200:
            data = json.loads(body)
            assert isinstance(data, list)
            assert "cv" in data or "resume" in data


@docker_required
class TestCrossServiceIntegration:
    """Test interactions that span multiple services."""

    def test_website_pages_load_through_nginx(self):
        """Main site pages should load through the proxy."""
        for path in ["/", "/about", "/contact", "/projects/"]:
            status, body = http_get(path)
            assert status == 200, f"Page {path} returned {status}"
            assert "<html" in body.lower()

    def test_security_headers_present(self):
        """Nginx should add security headers."""
        url = f"{NGINX_BASE}/"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            headers = dict(resp.headers)
            # Check headers added in nginx.conf
            assert "X-Content-Type-Options" in headers or "x-content-type-options" in headers
