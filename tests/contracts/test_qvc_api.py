"""Live-HTTP API contract tests for the qvc signaling backend (Flask).

Point ``QVC_SIGNALING_URL`` at a running server; auto-skips if unreachable.
Validates the contract surface (``/health``, ``/api`` discovery, error envelope)
against the JSON Schemas, plus the ``/admin/status`` shape the dashboard uses.

Note: the encrypted media + BB84/QKD path is peer-to-peer in the browser (the
documented live-only layer), so it is intentionally not covered here.
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

BASE = base_url("QVC_SIGNALING_URL", "http://127.0.0.1:5050")
pytestmark = skip_unless_reachable(BASE, "QVC_SIGNALING_URL")


class TestContractSurface:
    def test_health(self):
        status, body = http_get(BASE, "/health")
        assert status == 200
        assert_matches("health", body)
        assert body["service"] == "qvc"

    def test_discovery(self):
        status, body = http_get(BASE, "/api")
        assert status == 200
        assert_matches("manifest", body)
        assert body["service"] == "qvc"

    def test_error_envelope(self):
        status, body = http_get(BASE, "/__contract_missing__")
        assert status == 404
        assert_matches("error", body)
        assert body["error"]["code"] == "not_found"


class TestReadShapes:
    def test_admin_status(self):
        status, body = http_get(BASE, "/admin/status")
        assert status == 200
        assert body["status"] == "ok"
        assert "rooms" in body
        assert "peers" in body
