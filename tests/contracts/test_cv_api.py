"""Contract tests for the CV Editor REST API (normalized, stateless model).

Validates the stable read-endpoint shapes that API clients (the editor UI, the
MCP server) rely on. Requires the CV editor running — auto-skips if not reachable;
point CV_EDITOR_URL at it (the CI integration job sets this).

NOTE: rewritten for the normalized API. The pre-normalization endpoints this file
used to assert (/api/documents, /api/document/<kind>, /api/data, /api/resume-config)
no longer exist — content is now persons → sections → entries → items + variants.
"""
import json
import os
import socket
import urllib.error
import urllib.request
from urllib.parse import urlparse

import pytest

CV_BASE = os.environ.get("CV_EDITOR_URL", "http://127.0.0.1:3000")


def _host_port():
    parsed = urlparse(CV_BASE)
    return parsed.hostname or "127.0.0.1", parsed.port or 80


def is_cv_editor_running():
    host, port = _host_port()
    try:
        sock = socket.create_connection((host, port), timeout=2)
        sock.close()
        return True
    except (ConnectionRefusedError, OSError, socket.timeout):
        return False


def http_get(path, timeout=10):
    url = f"{CV_BASE}{path}"
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")


cv_required = pytest.mark.skipif(
    not is_cv_editor_running(),
    reason=f"CV editor not reachable at {CV_BASE} (set CV_EDITOR_URL)",
)


@cv_required
class TestHealthContract:
    """GET /api/health → {status: 'ok', ...}."""

    def test_health_ok(self):
        status, body = http_get("/api/health")
        assert status == 200, f"/api/health returned {status}"
        data = json.loads(body)
        assert data.get("status") == "ok"


@cv_required
class TestPersonsContract:
    """GET /api/persons → {persons: [...]}, and GET /api/persons/:id → master."""

    def test_persons_list_shape(self):
        status, body = http_get("/api/persons")
        assert status == 200
        data = json.loads(body)
        assert isinstance(data, dict)
        assert isinstance(data.get("persons"), list)

    def test_person_master_shape(self):
        persons = json.loads(http_get("/api/persons")[1]).get("persons", [])
        if not persons:
            pytest.skip("no persons available to read a master")
        pid = persons[0]["id"]
        status, body = http_get(f"/api/persons/{pid}")
        assert status == 200
        data = json.loads(body)
        for key in ("person", "personal", "sections", "variants"):
            assert key in data, f"master is missing '{key}'"
        assert isinstance(data["sections"], list)
        assert isinstance(data["variants"], list)


@cv_required
class TestCatalogContract:
    """GET /api/catalog → {validSectionTypes: [...]}."""

    def test_catalog_section_types(self):
        status, body = http_get("/api/catalog")
        assert status == 200
        data = json.loads(body)
        assert isinstance(data.get("validSectionTypes"), list)
        assert "experience" in data["validSectionTypes"]
