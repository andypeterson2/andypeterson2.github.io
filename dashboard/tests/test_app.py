"""Integration tests using Textual's pilot API."""

from __future__ import annotations

import textwrap
from pathlib import Path

import pytest
import yaml

from dashboard.app import DashboardApp
from dashboard.config import load_config
from dashboard.widgets.service_card import ServiceCard
from tests.conftest import _make_repo


@pytest.fixture()
def app_config(tmp_path: Path) -> Path:
    """Config with repos for integration testing."""
    _make_repo(
        tmp_path,
        "echo-svc-repo",
        svc_name="echo-svc",
        display_name="Echo Service",
        compose_service="echo",
        default_port=9000,
        compose_yml=textwrap.dedent("""\
            services:
              echo:
                image: alpine
                command: echo running on ${PORT:-9000}
        """),
    )
    _make_repo(
        tmp_path,
        "echo-svc-2-repo",
        svc_name="echo-svc-2",
        display_name="Echo Service 2",
        compose_service="echo",
        default_port=9100,
        compose_yml=textwrap.dedent("""\
            services:
              echo:
                image: alpine
                command: echo second on ${PORT:-9100}
        """),
    )

    data = {"projects_root": str(tmp_path)}
    cfg = tmp_path / "config.yaml"
    cfg.write_text(yaml.dump(data))
    return cfg


def _make_app(config_path: Path, **kwargs) -> DashboardApp:
    """Helper to build a DashboardApp from a config file."""
    cfg = load_config(config_path)
    return DashboardApp(
        config=cfg,
        open_browser=kwargs.pop("open_browser", lambda url: None),
        **kwargs,
    )


class TestDashboardApp:
    @pytest.mark.asyncio
    async def test_app_starts_and_shows_cards(self, app_config: Path) -> None:
        app = _make_app(app_config)
        async with app.run_test():
            cards = app.query(ServiceCard)
            assert len(cards) == 2
            names = {c.service_name for c in cards}
            assert names == {"echo-svc", "echo-svc-2"}

    @pytest.mark.asyncio
    async def test_start_stop_service(self, app_config: Path) -> None:
        app = _make_app(app_config)
        async with app.run_test() as pilot:
            card = app.query_one("#card-echo-svc", ServiceCard)
            assert card.status == "stopped"

            start_btn = app.query_one("#btn-toggle-echo-svc")
            await pilot.click(start_btn)
            await pilot.pause()
            await pilot.pause(delay=0.2)

    @pytest.mark.asyncio
    async def test_initial_card_state(self, app_config: Path) -> None:
        app = _make_app(app_config)
        async with app.run_test():
            card = app.query_one("#card-echo-svc", ServiceCard)
            assert card.port == 9000
            assert card.status == "stopped"
            assert card.pid is None

    @pytest.mark.asyncio
    async def test_open_browser_calls_injected(self, app_config: Path) -> None:
        opened_urls: list[str] = []
        app = _make_app(app_config, open_browser=opened_urls.append)
        async with app.run_test() as pilot:
            card = app.query_one("#card-echo-svc", ServiceCard)
            card.post_message(ServiceCard.OpenBrowserRequested("echo-svc", 9000))
            await pilot.pause()
            assert "http://localhost:9000" in opened_urls

    @pytest.mark.asyncio
    async def test_restart_when_not_running_starts(self, app_config: Path) -> None:
        app = _make_app(app_config)
        async with app.run_test() as pilot:
            card = app.query_one("#card-echo-svc", ServiceCard)
            assert card.status == "stopped"
            restart_btn = app.query_one("#btn-restart-echo-svc")
            await pilot.click(restart_btn)
            await pilot.pause(delay=0.3)

    @pytest.mark.asyncio
    async def test_port_button_exists(self, app_config: Path) -> None:
        app = _make_app(app_config)
        async with app.run_test():
            from textual.widgets import Button

            port_btn = app.query_one("#btn-port-echo-svc", Button)
            assert port_btn is not None
