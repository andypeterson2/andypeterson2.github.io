from __future__ import annotations

import subprocess
import textwrap
from pathlib import Path

import pytest
import yaml


def _docker_available() -> bool:
    try:
        subprocess.run(
            ["docker", "info"],
            capture_output=True,
            check=True,
            timeout=5,
        )
        return True
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
        return False


def _make_repo(
    parent: Path,
    dirname: str,
    *,
    svc_name: str,
    display_name: str,
    compose_service: str,
    default_port: int,
    compose_yml: str,
    submodule_path: str | None = None,
) -> Path:
    """Create a repo dir with .dashboard.yaml and docker-compose.yml."""
    repo = parent / dirname
    repo.mkdir(parents=True, exist_ok=True)

    manifest: dict = {
        "services": [
            {
                "name": svc_name,
                "display_name": display_name,
                "compose_service": compose_service,
                "default_port": default_port,
            }
        ]
    }
    if submodule_path is not None:
        manifest["services"][0]["submodule_path"] = submodule_path

    (repo / ".dashboard.yaml").write_text(yaml.dump(manifest))
    (repo / "docker-compose.yml").write_text(compose_yml)
    return repo


@pytest.fixture()
def tmp_projects(tmp_path: Path) -> Path:
    """Create a minimal projects directory with two repos."""
    _make_repo(
        tmp_path,
        "project-a",
        svc_name="test-svc",
        display_name="Test Service",
        compose_service="svc",
        default_port=9000,
        submodule_path="ui-kit/",
        compose_yml=textwrap.dedent("""\
            services:
              svc:
                image: alpine
                command: echo hello
        """),
    )
    _make_repo(
        tmp_path,
        "project-b",
        svc_name="test-svc-2",
        display_name="Test Service 2",
        compose_service="server",
        default_port=3000,
        compose_yml=textwrap.dedent("""\
            services:
              server:
                image: node:20-slim
                command: node server.js
                environment:
                  PORT: ${PORT:-3000}
        """),
    )
    return tmp_path


@pytest.fixture()
def valid_config_yaml(tmp_path: Path, tmp_projects: Path) -> Path:
    """Write a valid config.yaml and return its path."""
    data = {
        "projects_root": str(tmp_projects),
    }
    cfg_path = tmp_path / "config.yaml"
    cfg_path.write_text(yaml.dump(data))
    return cfg_path


@pytest.fixture()
def minimal_config_yaml(tmp_path: Path) -> Path:
    """Write a minimal config.yaml with one echo service repo."""
    _make_repo(
        tmp_path,
        "echo-repo",
        svc_name="echo",
        display_name="Echo",
        compose_service="echo",
        default_port=8000,
        compose_yml=textwrap.dedent("""\
            services:
              echo:
                image: alpine
                command: echo running on ${PORT:-8000}
        """),
    )
    data = {
        "projects_root": str(tmp_path),
    }
    cfg_path = tmp_path / "config.yaml"
    cfg_path.write_text(yaml.dump(data))
    return cfg_path


@pytest.fixture()
def require_docker():
    """Skip test if Docker is not available."""
    if not _docker_available():
        pytest.skip("Docker not available")
