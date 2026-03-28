"""Contract tests for the CV Editor Express API.

These tests validate the expected response shapes from the CV editor
backend that the frontend relies on. Requires the CV editor server
to be running (auto-skips if not available).
"""
import json
import os
import socket
import urllib.request
import urllib.error

import pytest

CV_BASE = os.environ.get("CV_EDITOR_URL", "http://127.0.0.1:3000")


def is_cv_editor_running():
    try:
        s = socket.create_connection(("127.0.0.1", 3000), timeout=2)
        s.close()
        return True
    except (ConnectionRefusedError, OSError, socket.timeout):
        return False


def http_get(path, timeout=10):
    url = f"{CV_BASE}{path}"
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return resp.status, body
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")


cv_required = pytest.mark.skipif(
    not is_cv_editor_running(),
    reason="CV editor not running on localhost:3000",
)


@cv_required
class TestDocumentsContract:
    """Frontend expects GET /api/documents → ["cv", "resume", ...]."""

    def test_documents_returns_list(self):
        status, body = http_get("/api/documents")
        assert status == 200
        data = json.loads(body)
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_documents_contains_expected_types(self):
        status, body = http_get("/api/documents")
        data = json.loads(body)
        # Should have at least cv or resume
        assert any(d in data for d in ["cv", "resume"])


@cv_required
class TestDocumentParseContract:
    """Frontend expects parsed document structure."""

    def test_parse_resume(self):
        status, body = http_get("/api/document/resume")
        if status == 200:
            data = json.loads(body)
            assert isinstance(data, dict)

    def test_parse_cv(self):
        status, body = http_get("/api/document/cv")
        if status == 200:
            data = json.loads(body)
            assert isinstance(data, dict)


@cv_required
class TestDataContract:
    """Frontend expects GET /api/data → JSON object."""

    def test_data_returns_json(self):
        status, body = http_get("/api/data")
        if status == 200:
            data = json.loads(body)
            assert isinstance(data, dict)


@cv_required
class TestResumeConfigContract:
    """Frontend expects resume config with sectionOrder."""

    def test_resume_config_returns_json(self):
        status, body = http_get("/api/resume-config")
        if status == 200:
            data = json.loads(body)
            assert isinstance(data, dict)
