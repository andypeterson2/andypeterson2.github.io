from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import yaml

MANIFEST_FILENAME = ".dashboard.yaml"

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class ServiceConfig:
    name: str
    display_name: str
    compose_file: Path
    compose_service: str
    default_port: int
    url_path: str = "/"
    no_browser: bool = False
    submodule_path: str | None = None
    environment: dict[str, str] | None = None


@dataclass(frozen=True)
class DashboardConfig:
    services: list[ServiceConfig]
    projects_root: Path

    def get_service(self, name: str) -> ServiceConfig:
        for svc in self.services:
            if svc.name == name:
                return svc
        raise KeyError(f"Unknown service: {name}")


def _parse_manifest(manifest_path: Path) -> list[ServiceConfig]:
    """Parse a per-repo .dashboard.yaml manifest file."""
    repo_root = manifest_path.parent

    with open(manifest_path) as f:
        raw = yaml.safe_load(f)

    if not isinstance(raw, dict):
        raise ValueError(f"Manifest {manifest_path} must be a YAML mapping")

    raw_services = raw.get("services")
    if not raw_services:
        raise ValueError(f"Manifest {manifest_path} must define at least one service")

    services: list[ServiceConfig] = []
    for raw_svc in raw_services:
        for key in ("name", "display_name", "default_port"):
            if key not in raw_svc:
                raise ValueError(f"Service in {manifest_path} missing required field: {key}")

        compose_file_rel = raw_svc.get("compose_file", "docker-compose.yml")
        compose_file = repo_root / compose_file_rel

        raw_env = raw_svc.get("environment")
        env_dict: dict[str, str] | None = None
        if isinstance(raw_env, dict):
            env_dict = {str(k): str(v) for k, v in raw_env.items()}

        services.append(
            ServiceConfig(
                name=raw_svc["name"],
                display_name=raw_svc["display_name"],
                compose_file=compose_file,
                compose_service=raw_svc.get("compose_service", raw_svc["name"]),
                default_port=int(raw_svc["default_port"]),
                url_path=raw_svc.get("url_path", "/"),
                no_browser=bool(raw_svc.get("no_browser", False)),
                submodule_path=raw_svc.get("submodule_path"),
                environment=env_dict,
            )
        )

    return services


def discover_services(projects_root: Path) -> list[ServiceConfig]:
    """Scan immediate subdirectories of projects_root for .dashboard.yaml manifests."""
    if not projects_root.is_dir():
        return []

    discovered: list[ServiceConfig] = []
    for child in sorted(projects_root.iterdir()):
        manifest = child / MANIFEST_FILENAME
        if child.is_dir() and manifest.is_file():
            try:
                discovered.extend(_parse_manifest(manifest))
            except Exception as exc:
                log.warning("Skipping invalid manifest %s: %s", manifest, exc)

    return discovered


def _resolve_projects_root(raw_value: str) -> Path:
    """Resolve a projects_root value, expanding env vars and ~."""
    import os
    import re

    def _expand(match: re.Match[str]) -> str:
        var = match.group(1)
        default = match.group(2) if match.group(2) is not None else ""
        return os.environ.get(var, default)

    resolved = re.sub(r"\$\{(\w+)(?::-([^}]*))?\}", _expand, raw_value)
    return Path(os.path.expanduser(resolved))


def find_config(search_dir: Path | None = None) -> Path:
    """Locate the config file: config.local.yaml > config.yaml > config.example.yaml."""
    if search_dir is None:
        search_dir = Path(__file__).resolve().parents[2]

    for name in ("config.local.yaml", "config.yaml", "config.example.yaml"):
        candidate = search_dir / name
        if candidate.is_file():
            return candidate

    raise FileNotFoundError(
        f"No config file found in {search_dir}. "
        "Copy config.example.yaml to config.local.yaml and edit it."
    )


def load_config(path: Path) -> DashboardConfig:
    """Load dashboard configuration from a YAML file.

    The DASHBOARD_PROJECTS environment variable takes precedence over the
    projects_root value in the config file.
    """
    import os

    with open(path) as f:
        raw = yaml.safe_load(f)

    if not isinstance(raw, dict):
        raise ValueError("Config must be a YAML mapping")

    env_root = os.environ.get("DASHBOARD_PROJECTS")
    if env_root:
        projects_root = Path(env_root)
    else:
        projects_root = _resolve_projects_root(raw.get("projects_root", "."))

    services = discover_services(projects_root)

    if not services:
        raise ValueError(
            "No services found in any .dashboard.yaml manifests under " + str(projects_root)
        )

    return DashboardConfig(
        services=services,
        projects_root=projects_root,
    )
