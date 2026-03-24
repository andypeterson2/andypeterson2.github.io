"""Integration tests: verify each service actually serves web content.

These tests start real Docker containers and make HTTP requests to verify
that each service responds with the expected HTML content. They require
Docker and are skipped automatically when Docker is not available.

Run with:
    pytest tests/test_integration_web_content.py -v
    pytest tests/test_integration_web_content.py -v -k test_website_serves_index
"""

from __future__ import annotations

import asyncio
import time
import urllib.error
import urllib.request
from pathlib import Path

import pytest
import yaml

from dashboard.config import DashboardConfig, discover_services, load_config
from dashboard.process_manager import ProcessManager

# ── Real-project fixtures ──────────────────────────────────────────────

REAL_PROJECTS_ROOT = Path.home() / "Projects"


def _real_projects_available() -> bool:
    if not REAL_PROJECTS_ROOT.is_dir():
        return False
    return len(discover_services(REAL_PROJECTS_ROOT)) > 0


@pytest.fixture()
def real_config(tmp_path: Path) -> Path:
    cfg_path = tmp_path / "config.yaml"
    cfg_path.write_text(yaml.dump({"projects_root": str(REAL_PROJECTS_ROOT)}))
    return cfg_path


@pytest.fixture()
def real_dashboard_config(real_config: Path) -> DashboardConfig:
    return load_config(real_config)


# ── HTTP helpers ───────────────────────────────────────────────────────


def _wait_for_http(url: str, timeout: float = 60, interval: float = 2) -> str:
    """Poll a URL until it returns 200, then return the response body."""
    deadline = time.monotonic() + timeout
    last_error: Exception | None = None
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=5) as resp:
                if resp.status == 200:
                    return resp.read().decode("utf-8", errors="replace")
        except (urllib.error.URLError, urllib.error.HTTPError, OSError) as exc:
            last_error = exc
        time.sleep(interval)
    raise TimeoutError(
        f"Service at {url} did not respond within {timeout}s. Last error: {last_error}"
    )


# ── Service-specific expected content ─────────────────────────────────

SERVICE_EXPECTATIONS: dict[str, dict] = {
    "website": {
        "port": 8000,
        "title_fragment": "Andrew Peterson",
        "body_fragments": ["Andrew Peterson"],
    },
    "tech-tree": {
        "port": 8080,
        "title_fragment": "Knowledge Tech Tree",
        "body_fragments": ["Tech Tree"],
    },
    "cv-editor": {
        "port": 3001,
        "title_fragment": "CV Editor",
        "body_fragments": ["CV Editor"],
    },
    "protein-kernel": {
        "port": 5001,
        "title_fragment": "Classifiers",
        "body_fragments": ["Classifiers"],
    },
    "nonogram-solver": {
        "port": 5055,
        "title_fragment": "Nonogram",
        "body_fragments": ["Nonogram"],
    },
}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Docker integration tests — verify web content is served
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.skipif(
    not _real_projects_available(),
    reason="No real projects with .dashboard.yaml found under ~/Projects",
)
class TestWebContentServing:
    """Start each service and verify its index page is accessible via HTTP."""

    @pytest.fixture(autouse=True)
    def _require_docker(self, require_docker):
        """Skip the whole class when Docker is not available."""

    @pytest.mark.asyncio
    @pytest.mark.timeout(120)
    async def test_website_serves_index(self, real_dashboard_config: DashboardConfig) -> None:
        await self._verify_service(real_dashboard_config, "website")

    @pytest.mark.asyncio
    @pytest.mark.timeout(120)
    async def test_tech_tree_serves_index(self, real_dashboard_config: DashboardConfig) -> None:
        await self._verify_service(real_dashboard_config, "tech-tree")

    @pytest.mark.asyncio
    @pytest.mark.timeout(120)
    async def test_cv_editor_serves_index(self, real_dashboard_config: DashboardConfig) -> None:
        await self._verify_service(real_dashboard_config, "cv-editor")

    @pytest.mark.asyncio
    @pytest.mark.timeout(180)
    async def test_protein_kernel_serves_index(
        self, real_dashboard_config: DashboardConfig
    ) -> None:
        await self._verify_service(real_dashboard_config, "protein-kernel")

    @pytest.mark.asyncio
    @pytest.mark.timeout(180)
    async def test_nonogram_solver_serves_index(
        self, real_dashboard_config: DashboardConfig
    ) -> None:
        await self._verify_service(real_dashboard_config, "nonogram-solver")

    async def _verify_service(self, config: DashboardConfig, service_name: str) -> None:
        """Start a service, verify HTTP content, then tear down."""
        expect = SERVICE_EXPECTATIONS[service_name]
        port = expect["port"]
        pm = ProcessManager(config.get_service)

        try:
            instance = await pm.start(service_name, port)
            container_status = await pm.check_container_status(instance)
            assert container_status == "running", (
                f"{service_name} container is {container_status}, not running"
            )

            # Verify the host URL resolves correctly via Docker inspect
            url = await pm.get_host_url(instance)
            assert "localhost" in url or "127.0.0.1" in url, (
                f"URL should point to localhost, got: {url}"
            )

            # Wait for HTTP and verify content (run in thread to not block)
            body = await asyncio.to_thread(_wait_for_http, url, timeout=60)

            assert expect["title_fragment"].lower() in body.lower(), (
                f"Expected title containing '{expect['title_fragment']}' "
                f"in {service_name} response. Got first 500 chars:\n{body[:500]}"
            )
            for fragment in expect["body_fragments"]:
                assert fragment.lower() in body.lower(), (
                    f"Expected '{fragment}' in {service_name} body. "
                    f"Got first 500 chars:\n{body[:500]}"
                )
        finally:
            await pm.shutdown_all()


@pytest.mark.skipif(
    not _real_projects_available(),
    reason="No real projects with .dashboard.yaml found under ~/Projects",
)
class TestAllServicesWebContent:
    """Start ALL services together and verify they all serve content."""

    @pytest.fixture(autouse=True)
    def _require_docker(self, require_docker):
        """Skip the whole class when Docker is not available."""

    @pytest.mark.asyncio
    @pytest.mark.timeout(300)
    async def test_all_services_serve_content_simultaneously(
        self, real_dashboard_config: DashboardConfig
    ) -> None:
        """Start every service, then verify all serve expected web content."""
        pm = ProcessManager(real_dashboard_config.get_service)
        started: dict[str, dict] = {}

        try:
            # Start all services
            for svc in real_dashboard_config.services:
                if svc.name not in SERVICE_EXPECTATIONS:
                    continue
                try:
                    instance = await pm.start(svc.name, svc.default_port)
                    status = await pm.check_container_status(instance)
                    url = await pm.get_host_url(instance)
                    started[svc.name] = {
                        "instance": instance,
                        "status": status,
                        "url": url,
                    }
                except Exception as exc:
                    started[svc.name] = {
                        "instance": None,
                        "status": "error",
                        "url": None,
                        "error": str(exc),
                    }

            # Verify all containers are running
            failures: list[str] = []
            for name, info in started.items():
                if info["status"] != "running":
                    failures.append(
                        f"{name}: container status={info['status']}, "
                        f"error={info.get('error', 'n/a')}"
                    )
            assert not failures, "Some services failed to start:\n" + "\n".join(failures)

            # Verify HTTP content for all running services
            for name, info in started.items():
                expect = SERVICE_EXPECTATIONS[name]
                try:
                    body = await asyncio.to_thread(_wait_for_http, info["url"], timeout=60)
                    assert expect["title_fragment"].lower() in body.lower(), (
                        f"{name}: expected title '{expect['title_fragment']}' "
                        f"not found. First 300 chars: {body[:300]}"
                    )
                except Exception as exc:
                    failures.append(f"{name}: HTTP check failed — {exc}")

            assert not failures, "Some services failed HTTP verification:\n" + "\n".join(failures)
        finally:
            await pm.shutdown_all()
