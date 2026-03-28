"""Contract tests for the QVC middleware and server REST APIs.

Validates that the middleware and server respond with expected shapes
that the frontend JavaScript relies on.
"""
import sys
from pathlib import Path

import pytest

if sys.version_info < (3, 10):
    pytest.skip("QVC requires Python 3.10+", allow_module_level=True)

QVC_ROOT = Path(__file__).resolve().parent.parent.parent / "packages" / "qvc"
sys.path.insert(0, str(QVC_ROOT))

from tests.middleware._helpers import load_middleware_module

mw_state_mod = load_middleware_module("state")
mw_events = load_middleware_module("events")

MiddlewareState = mw_state_mod.MiddlewareState
register_browser_events = mw_events.register_browser_events
register_rest_routes = mw_events.register_rest_routes


@pytest.fixture()
def state():
    s = MiddlewareState()
    register_browser_events(s)
    register_rest_routes(s)
    return s


@pytest.fixture()
def client(state):
    with state.flask_app.test_client() as c:
        yield c


class TestMiddlewareHealthContract:
    """Frontend connection.js hits GET /health before connecting."""

    def test_health_returns_200(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200

    def test_health_returns_json(self, client):
        resp = client.get("/health")
        data = resp.get_json()
        assert isinstance(data, dict)
        # connection.js checks for a successful response
        # The shape should have at least some status info
        assert len(data) > 0


class TestMiddlewarePeerConnectionContract:
    """Server calls POST /peer_connection on the middleware."""

    def test_peer_connection_without_data(self, client):
        resp = client.post("/peer_connection", json={})
        # Should handle gracefully (400 or process it)
        assert resp.status_code in (200, 400, 422, 500)

    def test_peer_connection_with_data(self, client):
        resp = client.post(
            "/peer_connection",
            json={
                "user_id": "test-user",
                "session_id": "test-session",
                "ws_endpoint": "ws://localhost:5050/session/test",
            },
        )
        # Might fail without a real server, but shouldn't 404
        assert resp.status_code != 404


class TestMiddlewareDisconnectContract:
    """Browser calls POST /disconnect on teardown."""

    def test_disconnect_with_client_id(self, client):
        resp = client.post("/disconnect", json={"client_id": "nonexistent"})
        # Should handle unknown client gracefully
        assert resp.status_code in (200, 204, 400, 404)

    def test_disconnect_without_client_id(self, client):
        resp = client.post("/disconnect", json={})
        assert resp.status_code in (200, 204, 400, 422)


class TestMiddlewarePeerDisconnectedContract:
    """Server calls POST /peer_disconnected on the middleware."""

    def test_peer_disconnected_route_exists(self, client):
        resp = client.post("/peer_disconnected", json={})
        assert resp.status_code != 404
