"""CORS header tests for the dashboard Flask API."""

from __future__ import annotations

import pytest

from dashboard.web import create_app


@pytest.fixture()
def client(tmp_path):
    app = create_app(str(tmp_path))
    app.config["TESTING"] = True
    yield app.test_client()


class TestCORS:
    def test_cors_on_projects(self, client):
        res = client.get("/api/projects", headers={"Origin": "https://andypeterson2.github.io"})
        assert res.headers.get("Access-Control-Allow-Origin") is not None

    def test_options_preflight(self, client):
        res = client.options(
            "/api/projects",
            headers={
                "Origin": "https://andypeterson2.github.io",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert res.status_code == 200
        assert "Access-Control-Allow-Origin" in res.headers
