from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from dashboard.config import (
    MANIFEST_FILENAME,
    DashboardConfig,
    _parse_manifest,
    discover_services,
    load_config,
)


def _write_manifest(repo_dir: Path, services: list[dict]) -> Path:
    """Helper to write a .dashboard.yaml manifest in a repo dir."""
    repo_dir.mkdir(parents=True, exist_ok=True)
    manifest = repo_dir / MANIFEST_FILENAME
    manifest.write_text(yaml.dump({"services": services}))
    # Also create a minimal compose file so the service is valid
    compose = repo_dir / "docker-compose.yml"
    if not compose.exists():
        compose.write_text("services:\n  default:\n    image: alpine\n")
    return manifest


class TestLoadConfig:
    def test_parses_valid_config(self, valid_config_yaml: Path, tmp_projects: Path) -> None:
        cfg = load_config(valid_config_yaml)
        assert isinstance(cfg, DashboardConfig)
        assert len(cfg.services) == 2
        assert cfg.projects_root == tmp_projects

    def test_service_fields(self, valid_config_yaml: Path, tmp_projects: Path) -> None:
        cfg = load_config(valid_config_yaml)
        svc = cfg.services[0]
        assert svc.name == "test-svc"
        assert svc.display_name == "Test Service"
        assert svc.compose_service == "svc"
        assert svc.compose_file == tmp_projects / "project-a" / "docker-compose.yml"
        assert svc.default_port == 9000
        assert svc.submodule_path == "ui-kit/"

    def test_get_service(self, valid_config_yaml: Path) -> None:
        cfg = load_config(valid_config_yaml)
        svc = cfg.get_service("test-svc")
        assert svc.name == "test-svc"

    def test_get_service_unknown_raises(self, valid_config_yaml: Path) -> None:
        cfg = load_config(valid_config_yaml)
        with pytest.raises(KeyError, match="Unknown service"):
            cfg.get_service("nope")

    def test_no_services_raises(self, tmp_path: Path) -> None:
        data = {
            "projects_root": str(tmp_path),
        }
        cfg_path = tmp_path / "empty.yaml"
        cfg_path.write_text(yaml.dump(data))
        with pytest.raises(ValueError, match="No services found"):
            load_config(cfg_path)

    def test_submodule_path_none(self, valid_config_yaml: Path) -> None:
        cfg = load_config(valid_config_yaml)
        assert cfg.services[1].submodule_path is None


class TestManifestDiscovery:
    def test_parse_manifest(self, tmp_path: Path) -> None:
        repo = tmp_path / "my-app"
        manifest = _write_manifest(
            repo,
            [
                {
                    "name": "my-app",
                    "display_name": "My App",
                    "default_port": 5000,
                }
            ],
        )
        services = _parse_manifest(manifest)
        assert len(services) == 1
        svc = services[0]
        assert svc.name == "my-app"
        assert svc.compose_service == "my-app"  # defaults to name
        assert svc.compose_file == repo / "docker-compose.yml"

    def test_custom_compose_service(self, tmp_path: Path) -> None:
        repo = tmp_path / "my-app"
        manifest = _write_manifest(
            repo,
            [
                {
                    "name": "frontend",
                    "display_name": "Frontend",
                    "compose_service": "web",
                    "default_port": 3000,
                }
            ],
        )
        services = _parse_manifest(manifest)
        assert services[0].compose_service == "web"

    def test_custom_compose_file(self, tmp_path: Path) -> None:
        repo = tmp_path / "my-app"
        repo.mkdir(parents=True)
        (repo / MANIFEST_FILENAME).write_text(
            yaml.dump(
                {
                    "services": [
                        {
                            "name": "api",
                            "display_name": "API",
                            "compose_file": "docker-compose.dev.yml",
                            "default_port": 4000,
                        }
                    ]
                }
            )
        )
        services = _parse_manifest(repo / MANIFEST_FILENAME)
        assert services[0].compose_file == repo / "docker-compose.dev.yml"

    def test_submodule_path(self, tmp_path: Path) -> None:
        repo = tmp_path / "my-app"
        manifest = _write_manifest(
            repo,
            [
                {
                    "name": "api",
                    "display_name": "API",
                    "default_port": 4000,
                    "submodule_path": "lib/ui-kit/",
                }
            ],
        )
        services = _parse_manifest(manifest)
        assert services[0].submodule_path == "lib/ui-kit/"

    def test_manifest_missing_field_raises(self, tmp_path: Path) -> None:
        repo = tmp_path / "bad"
        manifest = _write_manifest(repo, [{"name": "broken"}])
        with pytest.raises(ValueError, match="missing required field"):
            _parse_manifest(manifest)

    def test_discover_services_finds_manifests(self, tmp_path: Path) -> None:
        _write_manifest(
            tmp_path / "alpha",
            [
                {
                    "name": "alpha",
                    "display_name": "Alpha",
                    "default_port": 8000,
                }
            ],
        )
        _write_manifest(
            tmp_path / "beta",
            [
                {
                    "name": "beta",
                    "display_name": "Beta",
                    "default_port": 9000,
                }
            ],
        )
        (tmp_path / "gamma").mkdir()  # no manifest — skipped

        services = discover_services(tmp_path)
        names = [s.name for s in services]
        assert "alpha" in names
        assert "beta" in names
        assert len(services) == 2

    def test_discover_skips_invalid_manifest(self, tmp_path: Path) -> None:
        repo = tmp_path / "bad-repo"
        repo.mkdir()
        (repo / MANIFEST_FILENAME).write_text("not: valid: yaml: [")
        services = discover_services(tmp_path)
        assert services == []

    def test_load_config_discovers_manifests(self, tmp_path: Path) -> None:
        _write_manifest(
            tmp_path / "myrepo",
            [
                {
                    "name": "discovered",
                    "display_name": "Discovered",
                    "default_port": 7000,
                }
            ],
        )
        cfg_data = {
            "projects_root": str(tmp_path),
        }
        cfg_path = tmp_path / "config.yaml"
        cfg_path.write_text(yaml.dump(cfg_data))

        cfg = load_config(cfg_path)
        assert len(cfg.services) == 1
        assert cfg.services[0].name == "discovered"

    def test_manifest_multiple_services(self, tmp_path: Path) -> None:
        """A single manifest can define multiple services."""
        _write_manifest(
            tmp_path / "monorepo",
            [
                {
                    "name": "api",
                    "display_name": "API",
                    "compose_service": "api",
                    "default_port": 4000,
                },
                {
                    "name": "web",
                    "display_name": "Web",
                    "compose_service": "web",
                    "default_port": 3000,
                },
            ],
        )
        services = discover_services(tmp_path)
        assert len(services) == 2
        assert {s.name for s in services} == {"api", "web"}
