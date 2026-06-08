"""Live-HTTP API contract tests for the classifiers backend (Flask).

Point ``CLASSIFIERS_URL`` at a running server; auto-skips if unreachable.
Validates the contract surface (``/health``, ``/api`` discovery, error envelope)
against the JSON Schemas, plus the dataset listing the frontend relies on.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from _contract import (  # noqa: E402
    assert_matches,
    base_url,
    http_get,
    skip_unless_reachable,
)

BASE = base_url("CLASSIFIERS_URL", "http://127.0.0.1:5001")
pytestmark = skip_unless_reachable(BASE, "CLASSIFIERS_URL")


class TestContractSurface:
    def test_health(self):
        status, body = http_get(BASE, "/health")
        assert status == 200
        assert_matches("health", body)
        assert body["service"] == "classifiers"

    def test_discovery(self):
        status, body = http_get(BASE, "/api")
        assert status == 200
        assert_matches("manifest", body)
        assert body["service"] == "classifiers"

    def test_error_envelope(self):
        status, body = http_get(BASE, "/__contract_missing__")
        assert status == 404
        assert_matches("error", body)
        assert body["error"]["code"] == "not_found"


class TestReadShapes:
    def test_datasets(self):
        status, body = http_get(BASE, "/api/datasets")
        assert status == 200
        assert isinstance(body, list)
