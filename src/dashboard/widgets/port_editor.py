"""Port editor modal screen."""

from __future__ import annotations

from textual.app import ComposeResult
from textual.containers import Horizontal, Vertical
from textual.screen import ModalScreen
from textual.widgets import Button, Input, Label, Static


class PortEditor(ModalScreen[int | None]):
    """Modal for editing a service's port number."""

    DEFAULT_CSS = """
    PortEditor {
        align: center middle;
    }
    #port-dialog {
        width: 40;
        height: 12;
        border: thick $accent;
        background: $surface;
        padding: 1 2;
    }
    #port-dialog Label {
        margin: 0 0 1 0;
    }
    #port-dialog Input {
        margin: 0 0 1 0;
    }
    #port-dialog .error {
        color: $error;
        height: 1;
        margin: 0 0 1 0;
    }
    #port-buttons {
        height: 3;
        align: right middle;
    }
    #port-buttons Button {
        margin: 0 0 0 1;
    }
    """

    def __init__(self, service_name: str, current_port: int, **kwargs) -> None:
        super().__init__(**kwargs)
        self.service_name = service_name
        self.current_port = current_port

    def compose(self) -> ComposeResult:
        with Vertical(id="port-dialog"):
            yield Label(f"Edit port for [bold]{self.service_name}[/]")
            yield Input(
                value=str(self.current_port),
                placeholder="1024-65535",
                id="port-input",
            )
            yield Static("", classes="error", id="port-error")
            with Horizontal(id="port-buttons"):
                yield Button("Cancel", variant="default", id="port-cancel")
                yield Button("OK", variant="success", id="port-ok")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "port-cancel":
            self.dismiss(None)
        elif event.button.id == "port-ok":
            self._submit()

    def on_input_submitted(self, event: Input.Submitted) -> None:
        self._submit()

    def _submit(self) -> None:
        inp = self.query_one("#port-input", Input)
        error = self.query_one("#port-error", Static)
        try:
            port = int(inp.value)
        except ValueError:
            error.update("[red]Must be a number[/]")
            return
        if port < 1024 or port > 65535:
            error.update("[red]Port must be 1024-65535[/]")
            return
        self.dismiss(port)
