"""Main Textual dashboard application."""

from __future__ import annotations

import asyncio
import webbrowser
from collections.abc import Callable
from datetime import UTC, datetime

from textual.app import App, ComposeResult
from textual.containers import Horizontal
from textual.css.query import NoMatches
from textual.widgets import (
    Button,
    Footer,
    Header,
    Static,
    TabbedContent,
    TabPane,
)

from dashboard.config import DashboardConfig
from dashboard.process_manager import ProcessManager, ServiceInstance
from dashboard.theme import DASHBOARD_CSS
from dashboard.widgets.port_editor import PortEditor
from dashboard.widgets.service_card import ServiceCard
from dashboard.widgets.summary_bar import ServiceSummaryBar


class DashboardApp(App):
    TITLE = "Dashboard"
    SUB_TITLE = "dev environment"
    CSS = DASHBOARD_CSS

    BINDINGS = [
        ("q", "quit", "Quit"),
        ("a", "start_all", "Start All"),
        ("x", "stop_all", "Stop All"),
    ]

    def __init__(
        self,
        config: DashboardConfig,
        process_manager: ProcessManager | None = None,
        open_browser: Callable[[str], None] = webbrowser.open,
        **kwargs,
    ) -> None:
        super().__init__(**kwargs)
        self.config = config
        self.pm = process_manager or ProcessManager(config.get_service)
        self._open_browser = open_browser
        self._stream_tasks: dict[str, asyncio.Task] = {}
        self._exit_tasks: dict[str, asyncio.Task] = {}

    def compose(self) -> ComposeResult:
        yield Header()
        with Horizontal(id="toolbar"):
            yield Button("Start All", variant="success", id="btn-start-all")
            yield Button("Stop All", variant="error", id="btn-stop-all")
            yield Static("", id="toolbar-status")
        yield ServiceSummaryBar(self.config.services, id="summary-bar")
        with TabbedContent(id="service-tabs"):
            for svc in self.config.services:
                with TabPane(svc.display_name, id=f"tab-{svc.name}"):
                    yield ServiceCard(
                        service_name=svc.name,
                        display_name=svc.display_name,
                        default_port=svc.default_port,
                        no_browser=svc.no_browser,
                        id=f"card-{svc.name}",
                    )
        yield Footer()

    def on_mount(self) -> None:
        self._update_summary()

    async def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "btn-start-all":
            event.stop()
            await self.action_start_all()
        elif event.button.id == "btn-stop-all":
            event.stop()
            await self.action_stop_all()

    # ── Summary bar ────────────────────────────────────────────────────

    def _update_summary(self) -> None:
        """Refresh the persistent summary bar with current statuses."""
        try:
            bar = self.query_one("#summary-bar", ServiceSummaryBar)
        except NoMatches:
            return
        statuses: dict[str, str] = {}
        for card in self.query(ServiceCard):
            statuses[card.service_name] = card.status
        bar.refresh_summary(statuses)

    # ── Service card events ───────────────────────────────────────────────

    async def on_service_card_start_requested(self, message: ServiceCard.StartRequested) -> None:
        card = self._get_card(message.service_name)
        card.status = "starting"
        self._update_summary()
        try:
            instance = await self.pm.start(message.service_name, message.port)
            # Verify the container is actually running
            actual_status = await self.pm.check_container_status(instance)
            if actual_status != "running":
                card.status = "crashed"
                card.pid = None
                # Fetch any error logs from the short-lived container
                await self._fetch_container_logs(instance, card)
                card.write_log(
                    f"[bold red]Container exited immediately (state: {actual_status})[/]"
                )
                self._update_summary()
                return
            card.status = "running"
            card.pid = instance.pid
            self._start_log_stream(instance, card)
            self._watch_exit(instance, card)
        except Exception as exc:
            card.status = "stopped"
            card.write_log(f"[red]Start failed: {exc}[/]")
        self._update_summary()

    async def on_service_card_stop_requested(self, message: ServiceCard.StopRequested) -> None:
        card = self._get_card(message.service_name)
        instances = self.pm.get_instances(message.service_name)
        if not instances:
            return
        card.status = "stopping"
        self._update_summary()
        self._cancel_stream(message.service_name)
        self._cancel_exit_watch(message.service_name)
        try:
            await self.pm.stop(instances[-1])
        except Exception as exc:
            card.write_log(f"[red]Stop failed: {exc}[/]")
        card.status = "stopped"
        card.pid = None
        self._update_summary()

    async def on_service_card_restart_requested(
        self, message: ServiceCard.RestartRequested
    ) -> None:
        card = self._get_card(message.service_name)
        instances = self.pm.get_instances(message.service_name)
        if not instances:
            await self.on_service_card_start_requested(
                ServiceCard.StartRequested(message.service_name, message.port)
            )
            return
        card.status = "stopping"
        self._update_summary()
        self._cancel_stream(message.service_name)
        self._cancel_exit_watch(message.service_name)
        try:
            new_instance = await self.pm.restart(instances[-1])
            # Verify the container is actually running
            actual_status = await self.pm.check_container_status(new_instance)
            if actual_status != "running":
                card.status = "crashed"
                card.pid = None
                await self._fetch_container_logs(new_instance, card)
                msg = f"Container exited immediately after restart (state: {actual_status})"
                card.write_log(f"[bold red]{msg}[/]")
                self._update_summary()
                return
            card.status = "running"
            card.pid = new_instance.pid
            self._start_log_stream(new_instance, card)
            self._watch_exit(new_instance, card)
        except Exception as exc:
            card.status = "stopped"
            card.pid = None
            card.write_log(f"[red]Restart failed: {exc}[/]")
        self._update_summary()

    async def on_service_card_new_instance_requested(
        self, message: ServiceCard.NewInstanceRequested
    ) -> None:
        svc = self.config.get_service(message.service_name)
        existing = self.pm.get_instances(message.service_name)
        next_port = svc.default_port + len(existing)
        card = self._get_card(message.service_name)
        try:
            instance = await self.pm.start(message.service_name, next_port)
            card.write_log(f"[green]New instance on port {next_port} (PID {instance.pid})[/]")
        except Exception as exc:
            card.write_log(f"[red]+Instance failed: {exc}[/]")

    def on_service_card_port_edit_requested(self, message: ServiceCard.PortEditRequested) -> None:
        def _on_port(new_port: int | None) -> None:
            if new_port is not None:
                card = self._get_card(message.service_name)
                card.port = new_port
                card.write_log(f"Port changed to {new_port}")

        self.push_screen(
            PortEditor(message.service_name, message.current_port),
            callback=_on_port,
        )

    async def on_service_card_open_browser_requested(
        self, message: ServiceCard.OpenBrowserRequested
    ) -> None:
        # Resolve the actual host URL from Docker port bindings
        svc = self.config.get_service(message.service_name)
        instances = self.pm.get_instances(message.service_name)
        if instances:
            url = await self.pm.get_host_url(instances[-1])
        else:
            url = f"http://localhost:{message.port}"
        # Append the service's url_path (e.g. /dashboard for admin UIs)
        path = svc.url_path.rstrip("/")
        if path and path != "/":
            url = url.rstrip("/") + path
        self._open_browser(url)
        card = self._get_card(message.service_name)
        card.write_log(f"Opened {url} in browser")

    # ── Log streaming ─────────────────────────────────────────────────────

    def _start_log_stream(self, instance: ServiceInstance, card: ServiceCard) -> None:
        self._cancel_stream(instance.service_name)

        async def _stream() -> None:
            async for line, stream in self.pm.stream_output(instance):
                ts = datetime.now(UTC).strftime("%H:%M:%S")
                if stream == "stderr":
                    card.write_log(f"[dim]{ts}[/] [red]{line}[/]")
                else:
                    card.write_log(f"[dim]{ts}[/] {line}")

        self._stream_tasks[instance.service_name] = asyncio.create_task(_stream())

    def _cancel_stream(self, service_name: str) -> None:
        task = self._stream_tasks.pop(service_name, None)
        if task and not task.done():
            task.cancel()

    def _watch_exit(self, instance: ServiceInstance, card: ServiceCard) -> None:
        exit_task = self.pm.watch_for_exit(instance)
        key = instance.service_name

        async def _on_exit() -> None:
            returncode = await exit_task
            if instance.status == "crashed":
                # Cancel the live log stream — we'll fetch final logs instead
                self._cancel_stream(instance.service_name)
                card.status = "crashed"
                card.pid = None
                card.write_log(f"[bold red]Process exited with code {returncode}[/]")
                # Fetch any remaining error logs from the dead container
                await self._fetch_container_logs(instance, card)
                self._update_summary()

        self._exit_tasks[key] = asyncio.create_task(_on_exit())

    def _cancel_exit_watch(self, service_name: str) -> None:
        task = self._exit_tasks.pop(service_name, None)
        if task and not task.done():
            task.cancel()

    async def _fetch_container_logs(self, instance: ServiceInstance, card: ServiceCard) -> None:
        """Fetch recent logs from a stopped/crashed container."""
        try:
            async for line, stream in self.pm.fetch_recent_logs(instance, tail=20):
                ts = datetime.now(UTC).strftime("%H:%M:%S")
                if stream == "stderr":
                    card.write_log(f"[dim]{ts}[/] [red]{line}[/]")
                else:
                    card.write_log(f"[dim]{ts}[/] {line}")
        except Exception:
            pass

    # ── Bulk actions ─────────────────────────────────────────────────────

    async def action_start_all(self) -> None:
        """Start every service that is currently stopped or crashed."""
        for svc in self.config.services:
            card = self._get_card(svc.name)
            if card.status in ("stopped", "crashed"):
                await self.on_service_card_start_requested(
                    ServiceCard.StartRequested(svc.name, card.port)
                )
        self._update_summary()

    async def action_stop_all(self) -> None:
        """Stop every service that is currently running."""
        for svc in self.config.services:
            card = self._get_card(svc.name)
            if card.status == "running":
                await self.on_service_card_stop_requested(
                    ServiceCard.StopRequested(svc.name, card.port)
                )
        self._update_summary()

    # ── Helpers ───────────────────────────────────────────────────────────

    def _get_card(self, service_name: str) -> ServiceCard:
        return self.query_one(f"#card-{service_name}", ServiceCard)

    # ── Shutdown ──────────────────────────────────────────────────────────

    async def action_quit(self) -> None:
        for task in self._stream_tasks.values():
            task.cancel()
        self._stream_tasks.clear()
        for task in self._exit_tasks.values():
            task.cancel()
        self._exit_tasks.clear()
        await self.pm.shutdown_all()
        self.exit()
