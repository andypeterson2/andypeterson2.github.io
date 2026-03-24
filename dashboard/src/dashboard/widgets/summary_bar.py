"""Persistent summary bar showing all service statuses."""

from __future__ import annotations

from textual.widgets import Static

from dashboard.config import ServiceConfig

STATUS_COLORS = {
    "running": "green",
    "starting": "yellow",
    "stopping": "yellow",
    "crashed": "bold red",
    "stopped": "dim",
}


class ServiceSummaryBar(Static):
    """Compact status line for all services, visible across every tab."""

    DEFAULT_CSS = """
    ServiceSummaryBar {
        height: 1;
        padding: 0 1;
        background: #3a3830;
        dock: top;
    }
    """

    def __init__(self, services: list[ServiceConfig], **kwargs) -> None:
        super().__init__("", **kwargs)
        self._service_names: list[tuple[str, str]] = [(s.name, s.display_name) for s in services]

    def refresh_summary(self, statuses: dict[str, str]) -> None:
        """Rebuild the summary text from a name -> status mapping."""
        parts: list[str] = []
        for name, display in self._service_names:
            status = statuses.get(name, "stopped")
            color = STATUS_COLORS.get(status, "red")
            parts.append(f"[{color}]\u25cf[/] {display} [{color}]\\[{status}][/]")
        self.update("  ".join(parts))
