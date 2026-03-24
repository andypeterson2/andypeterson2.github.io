"""ServiceCard widget — per-service control card with logs."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from textual.app import ComposeResult
from textual.containers import Container, Horizontal
from textual.css.query import NoMatches
from textual.message import Message
from textual.reactive import reactive
from textual.widgets import Button, RichLog, Static

CardStatus = Literal["stopped", "starting", "running", "stopping", "crashed"]


class ServiceCard(Container):
    """Card for a single service with controls and inline log."""

    DEFAULT_CSS = """
    ServiceCard {
        border: solid $accent;
        height: 1fr;
        padding: 0 1;
        margin: 0;
    }
    ServiceCard .card-header {
        height: 1;
        margin: 0 0 1 0;
    }
    ServiceCard .card-title {
        text-style: bold;
    }
    ServiceCard .status-dot {
        width: 3;
    }
    ServiceCard .card-info {
        height: 1;
        color: $text-muted;
        margin: 0 0 1 0;
    }
    ServiceCard .card-buttons {
        height: 3;
        margin: 0 0 1 0;
    }
    ServiceCard .card-buttons Button {
        margin: 0 1 0 0;
        min-width: 10;
    }
    ServiceCard RichLog {
        height: 1fr;
        border: tall $surface;
        scrollbar-size: 1 1;
    }
    """

    status: reactive[CardStatus] = reactive("stopped")
    port: reactive[int] = reactive(0)
    pid: reactive[int | None] = reactive(None)

    # ── Messages ──────────────────────────────────────────────────────────

    @dataclass
    class StartRequested(Message):
        service_name: str
        port: int

    @dataclass
    class StopRequested(Message):
        service_name: str
        port: int

    @dataclass
    class RestartRequested(Message):
        service_name: str
        port: int

    @dataclass
    class NewInstanceRequested(Message):
        service_name: str

    @dataclass
    class OpenBrowserRequested(Message):
        service_name: str
        port: int

    @dataclass
    class PortEditRequested(Message):
        service_name: str
        current_port: int

    # ── Init ──────────────────────────────────────────────────────────────

    def __init__(
        self,
        service_name: str,
        display_name: str,
        default_port: int,
        no_browser: bool = False,
        **kwargs,
    ) -> None:
        super().__init__(**kwargs)
        self.service_name = service_name
        self.display_name = display_name
        self.port = default_port
        self._no_browser = no_browser

    # ── Compose ───────────────────────────────────────────────────────────

    def compose(self) -> ComposeResult:
        with Horizontal(classes="card-header"):
            yield Static("", classes="status-dot", id=f"dot-{self.service_name}")
            yield Static(f"[bold]{self.display_name}[/]", classes="card-title")
        yield Static("", classes="card-info", id=f"info-{self.service_name}")
        with Horizontal(classes="card-buttons"):
            yield Button(
                "Start",
                variant="success",
                id=f"btn-toggle-{self.service_name}",
            )
            yield Button(
                "Restart",
                variant="warning",
                id=f"btn-restart-{self.service_name}",
            )
            yield Button(
                "+Instance",
                variant="default",
                id=f"btn-instance-{self.service_name}",
            )
            yield Button(
                "Port",
                variant="default",
                id=f"btn-port-{self.service_name}",
            )
            if not self._no_browser:
                yield Button(
                    "Open",
                    variant="primary",
                    id=f"btn-open-{self.service_name}",
                )
        yield RichLog(id=f"log-{self.service_name}", wrap=True, markup=True)

    # ── Reactive watchers ─────────────────────────────────────────────────

    def watch_status(self, value: str) -> None:
        self._update_display()

    def watch_port(self, value: int) -> None:
        self._update_display()

    def watch_pid(self, value: int | None) -> None:
        self._update_display()

    def _update_display(self) -> None:
        try:
            dot = self.query_one(f"#dot-{self.service_name}", Static)
            info = self.query_one(f"#info-{self.service_name}", Static)
            toggle = self.query_one(f"#btn-toggle-{self.service_name}", Button)
            restart_btn = self.query_one(f"#btn-restart-{self.service_name}", Button)
            instance_btn = self.query_one(f"#btn-instance-{self.service_name}", Button)
        except NoMatches:
            return

        transitioning = self.status in ("starting", "stopping")

        if self.status == "running":
            dot.update("[green]\u25cf[/]")
            toggle.label = "Stop"
            toggle.variant = "error"
        elif transitioning:
            dot.update("[yellow]\u25cf[/]")
            toggle.label = "..."
            toggle.variant = "warning"
        elif self.status == "crashed":
            dot.update("[bold red]\u25cf[/]")
            toggle.label = "Start"
            toggle.variant = "success"
        else:
            dot.update("[dim]\u25cf[/]")
            toggle.label = "Start"
            toggle.variant = "success"

        # Disable buttons during transitions to prevent race conditions
        toggle.disabled = transitioning
        restart_btn.disabled = transitioning
        instance_btn.disabled = transitioning

        pid_str = str(self.pid) if self.pid else "\u2014"
        info.update(
            f"  Port [bold]{self.port}[/] \u2502 Status: {self.status} \u2502 PID: {pid_str}"
        )

    def on_mount(self) -> None:
        self._update_display()

    # ── Log helper ────────────────────────────────────────────────────────

    def write_log(self, line: str) -> None:
        try:
            log = self.query_one(RichLog)
            log.write(line)
        except NoMatches:
            pass

    def clear_log(self) -> None:
        try:
            log = self.query_one(RichLog)
            log.clear()
        except NoMatches:
            pass

    # ── Button handlers ───────────────────────────────────────────────────

    def on_button_pressed(self, event: Button.Pressed) -> None:
        btn_id = event.button.id or ""
        if btn_id == f"btn-toggle-{self.service_name}":
            if self.status == "running":
                self.post_message(self.StopRequested(self.service_name, self.port))
            elif self.status in ("stopped", "crashed"):
                self.post_message(self.StartRequested(self.service_name, self.port))
        elif btn_id == f"btn-restart-{self.service_name}":
            self.post_message(self.RestartRequested(self.service_name, self.port))
        elif btn_id == f"btn-instance-{self.service_name}":
            self.post_message(self.NewInstanceRequested(self.service_name))
        elif btn_id == f"btn-port-{self.service_name}":
            self.post_message(self.PortEditRequested(self.service_name, self.port))
        elif btn_id == f"btn-open-{self.service_name}":
            self.post_message(self.OpenBrowserRequested(self.service_name, self.port))
