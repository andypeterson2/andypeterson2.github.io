"""Integration tests: discover and start every configured project.

These tests use the real projects under ~/Projects that have a
.dashboard.yaml manifest.  They require Docker and are skipped
automatically when Docker is not available.

Run with:
    pytest tests/test_integration_start_all.py -v
    pytest tests/test_integration_start_all.py -v -k test_start_all_services
"""

from __future__ import annotations

import textwrap
from pathlib import Path

import pytest
import yaml
from textual.widgets import Button

from dashboard.app import DashboardApp
from dashboard.config import DashboardConfig, discover_services, load_config
from dashboard.process_manager import ProcessManager
from dashboard.widgets.service_card import ServiceCard
from tests.conftest import _make_repo

# ── Real-project fixtures ──────────────────────────────────────────────

REAL_PROJECTS_ROOT = Path.home() / "Projects"
REAL_CONFIG = REAL_PROJECTS_ROOT / ".." / "Projects" / ".." / "Projects"
# Normalise to the canonical path
REAL_PROJECTS_ROOT = REAL_PROJECTS_ROOT.resolve()


def _real_projects_available() -> bool:
    """Check that we have at least one .dashboard.yaml under ~/Projects."""
    if not REAL_PROJECTS_ROOT.is_dir():
        return False
    return len(discover_services(REAL_PROJECTS_ROOT)) > 0


@pytest.fixture()
def real_config(tmp_path: Path) -> Path:
    """Write a config.yaml pointing at the real ~/Projects directory."""
    cfg_path = tmp_path / "config.yaml"
    cfg_path.write_text(yaml.dump({"projects_root": str(REAL_PROJECTS_ROOT)}))
    return cfg_path


@pytest.fixture()
def real_dashboard_config(real_config: Path) -> DashboardConfig:
    return load_config(real_config)


# ── Synthetic multi-service fixture for fast CI ────────────────────────


@pytest.fixture()
def multi_service_config(tmp_path: Path) -> Path:
    """Create 4 synthetic services for Start-All testing without Docker."""
    for _i, (name, display, port) in enumerate(
        [
            ("alpha", "Alpha Service", 9100),
            ("bravo", "Bravo Service", 9200),
            ("charlie", "Charlie Service", 9300),
            ("delta", "Delta Service", 9400),
        ]
    ):
        _make_repo(
            tmp_path,
            f"{name}-repo",
            svc_name=name,
            display_name=display,
            compose_service=name,
            default_port=port,
            compose_yml=textwrap.dedent(f"""\
                services:
                  {name}:
                    image: alpine
                    command: echo running {name} on ${{PORT:-{port}}}
            """),
        )
    cfg_path = tmp_path / "config.yaml"
    cfg_path.write_text(yaml.dump({"projects_root": str(tmp_path)}))
    return cfg_path


def _make_app(config_path: Path, **kwargs) -> DashboardApp:
    cfg = load_config(config_path)
    return DashboardApp(
        config=cfg,
        open_browser=kwargs.pop("open_browser", lambda url: None),
        **kwargs,
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TUI tests (no Docker required — test the Start All / Stop All UI flow)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestStartAllUI:
    """Verify the Start All / Stop All toolbar buttons and keybindings."""

    @pytest.mark.asyncio
    async def test_toolbar_buttons_exist(self, multi_service_config: Path) -> None:
        app = _make_app(multi_service_config)
        async with app.run_test():
            from textual.widgets import Button

            start_all = app.query_one("#btn-start-all", Button)
            stop_all = app.query_one("#btn-stop-all", Button)
            assert start_all is not None
            assert stop_all is not None

    @pytest.mark.asyncio
    async def test_all_cards_rendered(self, multi_service_config: Path) -> None:
        app = _make_app(multi_service_config)
        async with app.run_test():
            cards = app.query(ServiceCard)
            assert len(cards) == 4
            names = {c.service_name for c in cards}
            assert names == {"alpha", "bravo", "charlie", "delta"}

    @pytest.mark.asyncio
    async def test_all_cards_initially_stopped(self, multi_service_config: Path) -> None:
        app = _make_app(multi_service_config)
        async with app.run_test():
            for card in app.query(ServiceCard):
                assert card.status == "stopped"

    @pytest.mark.asyncio
    async def test_start_all_button_triggers_starts(self, multi_service_config: Path) -> None:
        """Clicking Start All should attempt to start every stopped service."""
        started: list[str] = []

        app = _make_app(multi_service_config)

        # Monkey-patch the start handler to record calls without Docker

        async def _fake_start(msg: ServiceCard.StartRequested) -> None:
            started.append(msg.service_name)
            card = app.query_one(f"#card-{msg.service_name}", ServiceCard)
            card.status = "running"

        app.on_service_card_start_requested = _fake_start

        async with app.run_test() as pilot:
            app.query_one("#btn-start-all", Button).press()
            await pilot.pause(delay=0.2)
            assert set(started) == {"alpha", "bravo", "charlie", "delta"}

    @pytest.mark.asyncio
    async def test_stop_all_button_triggers_stops(self, multi_service_config: Path) -> None:
        """Clicking Stop All should attempt to stop every running service."""
        stopped: list[str] = []

        app = _make_app(multi_service_config)

        async def _fake_start(msg: ServiceCard.StartRequested) -> None:
            card = app.query_one(f"#card-{msg.service_name}", ServiceCard)
            card.status = "running"

        async def _fake_stop(msg: ServiceCard.StopRequested) -> None:
            stopped.append(msg.service_name)
            card = app.query_one(f"#card-{msg.service_name}", ServiceCard)
            card.status = "stopped"

        app.on_service_card_start_requested = _fake_start
        app.on_service_card_stop_requested = _fake_stop

        async with app.run_test() as pilot:
            # First start all
            app.query_one("#btn-start-all", Button).press()
            await pilot.pause(delay=0.2)

            # Now stop all
            app.query_one("#btn-stop-all", Button).press()
            await pilot.pause(delay=0.2)
            assert set(stopped) == {"alpha", "bravo", "charlie", "delta"}

    @pytest.mark.asyncio
    async def test_start_all_skips_running(self, multi_service_config: Path) -> None:
        """Start All should skip services that are already running."""
        started: list[str] = []

        app = _make_app(multi_service_config)

        async def _fake_start(msg: ServiceCard.StartRequested) -> None:
            started.append(msg.service_name)
            card = app.query_one(f"#card-{msg.service_name}", ServiceCard)
            card.status = "running"

        app.on_service_card_start_requested = _fake_start

        async with app.run_test() as pilot:
            # Pre-set bravo as running
            card = app.query_one("#card-bravo", ServiceCard)
            card.status = "running"

            app.query_one("#btn-start-all", Button).press()
            await pilot.pause(delay=0.2)
            assert "bravo" not in started
            assert set(started) == {"alpha", "charlie", "delta"}

    @pytest.mark.asyncio
    async def test_stop_all_skips_stopped(self, multi_service_config: Path) -> None:
        """Stop All should skip services that are already stopped."""
        stopped: list[str] = []

        app = _make_app(multi_service_config)

        async def _fake_stop(msg: ServiceCard.StopRequested) -> None:
            stopped.append(msg.service_name)
            card = app.query_one(f"#card-{msg.service_name}", ServiceCard)
            card.status = "stopped"

        app.on_service_card_stop_requested = _fake_stop

        async with app.run_test() as pilot:
            # Mark some as running
            for name in ("alpha", "charlie"):
                card = app.query_one(f"#card-{name}", ServiceCard)
                card.status = "running"

            app.query_one("#btn-stop-all", Button).press()
            await pilot.pause(delay=0.2)
            assert set(stopped) == {"alpha", "charlie"}

    @pytest.mark.asyncio
    async def test_keybinding_a_starts_all(self, multi_service_config: Path) -> None:
        """Pressing 'a' should trigger Start All."""
        started: list[str] = []

        app = _make_app(multi_service_config)

        async def _fake_start(msg: ServiceCard.StartRequested) -> None:
            started.append(msg.service_name)
            card = app.query_one(f"#card-{msg.service_name}", ServiceCard)
            card.status = "running"

        app.on_service_card_start_requested = _fake_start

        async with app.run_test() as pilot:
            await pilot.press("a")
            await pilot.pause(delay=0.2)
            assert len(started) == 4

    @pytest.mark.asyncio
    async def test_keybinding_x_stops_all(self, multi_service_config: Path) -> None:
        """Pressing 'x' should trigger Stop All."""
        stopped: list[str] = []

        app = _make_app(multi_service_config)

        async def _fake_start(msg: ServiceCard.StartRequested) -> None:
            card = app.query_one(f"#card-{msg.service_name}", ServiceCard)
            card.status = "running"

        async def _fake_stop(msg: ServiceCard.StopRequested) -> None:
            stopped.append(msg.service_name)
            card = app.query_one(f"#card-{msg.service_name}", ServiceCard)
            card.status = "stopped"

        app.on_service_card_start_requested = _fake_start
        app.on_service_card_stop_requested = _fake_stop

        async with app.run_test() as pilot:
            await pilot.press("a")
            await pilot.pause(delay=0.2)
            await pilot.press("x")
            await pilot.pause(delay=0.2)
            assert len(stopped) == 4


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Real-project discovery tests (no Docker — just verifies manifest parsing)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.skipif(
    not _real_projects_available(),
    reason="No real projects with .dashboard.yaml found under ~/Projects",
)
class TestRealProjectDiscovery:
    """Verify that all real project manifests are parseable and render cards."""

    def test_discovers_all_expected_services(self, real_dashboard_config: DashboardConfig) -> None:
        names = {s.name for s in real_dashboard_config.services}
        # These are the services currently configured:
        expected = {
            "cv-editor",
            "protein-kernel",
            "nonogram-solver",
            "website",
            "video-chat-server",
            "video-chat-client",
            "tech-tree",
        }
        assert expected.issubset(names), f"Missing services: {expected - names}"

    def test_all_compose_files_exist(self, real_dashboard_config: DashboardConfig) -> None:
        for svc in real_dashboard_config.services:
            assert svc.compose_file.exists(), (
                f"Compose file missing for {svc.name}: {svc.compose_file}"
            )

    def test_all_ports_unique(self, real_dashboard_config: DashboardConfig) -> None:
        ports = [s.default_port for s in real_dashboard_config.services]
        assert len(ports) == len(set(ports)), f"Duplicate default ports: {ports}"

    @pytest.mark.asyncio
    async def test_app_renders_all_real_service_cards(self, real_config: Path) -> None:
        app = _make_app(real_config)
        async with app.run_test():
            cards = app.query(ServiceCard)
            cfg = load_config(real_config)
            assert len(cards) == len(cfg.services)
            card_names = {c.service_name for c in cards}
            expected_names = {s.name for s in cfg.services}
            assert card_names == expected_names


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Docker integration tests (starts real containers)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@pytest.mark.skipif(
    not _real_projects_available(),
    reason="No real projects with .dashboard.yaml found under ~/Projects",
)
class TestStartAllServices:
    """Start every configured service via Docker, verify health, then tear down.

    These tests are slow (they pull images and boot containers) so they
    are grouped in their own class for easy selection:

        pytest tests/test_integration_start_all.py::TestStartAllServices -v
    """

    @pytest.fixture(autouse=True)
    def _require_docker(self, require_docker):
        """Skip the whole class when Docker is not available."""

    @pytest.mark.asyncio
    async def test_start_all_services(self, real_dashboard_config: DashboardConfig) -> None:
        """Start each service, check container status, then shut down."""
        pm = ProcessManager(real_dashboard_config.get_service)
        results: dict[str, dict] = {}

        try:
            for svc in real_dashboard_config.services:
                entry: dict = {
                    "display_name": svc.display_name,
                    "port": svc.default_port,
                    "status": "pending",
                    "error": None,
                }
                try:
                    instance = await pm.start(svc.name, svc.default_port)
                    container_status = await pm.check_container_status(instance)
                    entry["container_status"] = container_status
                    if container_status == "running":
                        entry["status"] = "ok"
                    else:
                        entry["status"] = "failed"
                        entry["error"] = f"container state: {container_status}"
                        # Grab logs for diagnosis
                        logs: list[str] = []
                        async for line, stream in pm.fetch_recent_logs(instance, tail=10):
                            logs.append(f"[{stream}] {line}")
                        entry["logs"] = logs
                except Exception as exc:
                    entry["status"] = "error"
                    entry["error"] = str(exc)

                results[svc.name] = entry
        finally:
            await pm.shutdown_all()

        # Report
        failed = {name: info for name, info in results.items() if info["status"] != "ok"}
        if failed:
            lines = ["The following services failed to start:"]
            for name, info in failed.items():
                lines.append(f"  - {info['display_name']} ({name}): {info['error']}")
                for log_line in info.get("logs", []):
                    lines.append(f"      {log_line}")
            pytest.fail("\n".join(lines))

    @pytest.mark.asyncio
    async def test_start_and_stop_each_service(
        self, real_dashboard_config: DashboardConfig
    ) -> None:
        """Start then cleanly stop each service one-by-one."""
        pm = ProcessManager(real_dashboard_config.get_service)

        for svc in real_dashboard_config.services:
            instance = await pm.start(svc.name, svc.default_port)
            await pm.check_container_status(instance)
            await pm.stop(instance)
            assert instance.status == "stopped", f"{svc.name} did not reach stopped state"
