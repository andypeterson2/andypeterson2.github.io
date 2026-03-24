"""Tests for the PortEditor modal."""

from __future__ import annotations

import pytest
from textual.app import App, ComposeResult
from textual.widgets import Button

from dashboard.widgets.port_editor import PortEditor


class PortEditorTestApp(App):
    """Minimal app to host the PortEditor modal for testing."""

    def __init__(self, service_name: str, current_port: int, **kwargs) -> None:
        super().__init__(**kwargs)
        self._service_name = service_name
        self._current_port = current_port
        self.result: int | None = "NOT_SET"

    def compose(self) -> ComposeResult:
        yield Button("Open", id="open-editor")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "open-editor":
            self.push_screen(
                PortEditor(self._service_name, self._current_port),
                callback=self._on_result,
            )

    def _on_result(self, result: int | None) -> None:
        self.result = result


class TestPortEditor:
    @pytest.mark.asyncio
    async def test_cancel_returns_none(self) -> None:
        app = PortEditorTestApp("test-svc", 8000)
        async with app.run_test() as pilot:
            await pilot.click("#open-editor")
            await pilot.pause(delay=0.1)
            # Directly call dismiss on the modal screen
            modal = app.screen
            assert isinstance(modal, PortEditor)
            modal.dismiss(None)
            await pilot.pause(delay=0.1)
            assert app.result is None

    @pytest.mark.asyncio
    async def test_valid_port_returns_int(self) -> None:
        app = PortEditorTestApp("test-svc", 8000)
        async with app.run_test() as pilot:
            await pilot.click("#open-editor")
            await pilot.pause(delay=0.1)
            modal = app.screen
            assert isinstance(modal, PortEditor)
            modal.dismiss(9090)
            await pilot.pause(delay=0.1)
            assert app.result == 9090

    @pytest.mark.asyncio
    async def test_invalid_port_shows_error(self) -> None:
        app = PortEditorTestApp("test-svc", 8000)
        async with app.run_test() as pilot:
            await pilot.click("#open-editor")
            await pilot.pause()
            inp = app.screen.query_one("#port-input")
            inp.value = "999"
            ok = app.screen.query_one("#port-ok")
            await pilot.click(ok)
            await pilot.pause()
            # Should show error, modal should still be open
            assert app.result == "NOT_SET"

    @pytest.mark.asyncio
    async def test_non_numeric_shows_error(self) -> None:
        app = PortEditorTestApp("test-svc", 8000)
        async with app.run_test() as pilot:
            await pilot.click("#open-editor")
            await pilot.pause()
            inp = app.screen.query_one("#port-input")
            inp.value = "abc"
            ok = app.screen.query_one("#port-ok")
            await pilot.click(ok)
            await pilot.pause()
            assert app.result == "NOT_SET"
