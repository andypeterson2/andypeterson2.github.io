"""Extended tests for config loading: find_config, env var override, _resolve_projects_root."""

from __future__ import annotations

import os
from pathlib import Path
from unittest import mock

import pytest
import yaml

from dashboard.config import (
    _resolve_projects_root,
    find_config,
    load_config,
)


class TestResolveProjectsRoot:
    def test_plain_path(self) -> None:
        result = _resolve_projects_root("/tmp/projects")
        assert result == Path("/tmp/projects")

    def test_tilde_expansion(self) -> None:
        result = _resolve_projects_root("~/Projects")
        assert str(result).startswith("/")
        assert "~" not in str(result)

    def test_env_var_with_default(self) -> None:
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("DASHBOARD_PROJECTS", None)
            result = _resolve_projects_root("${DASHBOARD_PROJECTS:-~/Projects}")
            assert "~" not in str(result)
            assert str(result).endswith("/Projects") or str(result).endswith("\\Projects")

    def test_env_var_set(self) -> None:
        with mock.patch.dict(os.environ, {"DASHBOARD_PROJECTS": "/custom/path"}):
            result = _resolve_projects_root("${DASHBOARD_PROJECTS:-~/Projects}")
            assert result == Path("/custom/path")

    def test_env_var_no_default(self) -> None:
        with mock.patch.dict(os.environ, {"MY_VAR": "/some/path"}):
            result = _resolve_projects_root("${MY_VAR}")
            assert result == Path("/some/path")

    def test_env_var_unset_no_default(self) -> None:
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("UNSET_VAR", None)
            result = _resolve_projects_root("${UNSET_VAR}")
            assert result == Path("")


class TestFindConfig:
    def test_finds_config_local(self, tmp_path: Path) -> None:
        (tmp_path / "config.local.yaml").write_text("projects_root: /tmp")
        (tmp_path / "config.yaml").write_text("projects_root: /other")
        result = find_config(tmp_path)
        assert result.name == "config.local.yaml"

    def test_falls_back_to_config_yaml(self, tmp_path: Path) -> None:
        (tmp_path / "config.yaml").write_text("projects_root: /tmp")
        result = find_config(tmp_path)
        assert result.name == "config.yaml"

    def test_falls_back_to_example(self, tmp_path: Path) -> None:
        (tmp_path / "config.example.yaml").write_text("projects_root: /tmp")
        result = find_config(tmp_path)
        assert result.name == "config.example.yaml"

    def test_raises_when_no_config(self, tmp_path: Path) -> None:
        with pytest.raises(FileNotFoundError, match="No config file found"):
            find_config(tmp_path)


class TestLoadConfigEnvOverride:
    def test_env_var_overrides_yaml(self, tmp_path: Path) -> None:
        """DASHBOARD_PROJECTS env var should take precedence over config file."""
        # Create a projects dir with a service
        svc_dir = tmp_path / "env-projects" / "my-svc"
        svc_dir.mkdir(parents=True)
        (svc_dir / ".dashboard.yaml").write_text(
            yaml.dump(
                {
                    "services": [
                        {
                            "name": "test",
                            "display_name": "Test",
                            "default_port": 8000,
                        }
                    ]
                }
            )
        )
        (svc_dir / "docker-compose.yml").write_text("services:\n  test:\n    image: alpine\n")

        # Config points to a different path
        cfg_path = tmp_path / "config.yaml"
        cfg_path.write_text(yaml.dump({"projects_root": "/nonexistent"}))

        with mock.patch.dict(os.environ, {"DASHBOARD_PROJECTS": str(tmp_path / "env-projects")}):
            cfg = load_config(cfg_path)
            assert cfg.projects_root == tmp_path / "env-projects"
            assert len(cfg.services) == 1

    def test_yaml_path_used_when_no_env(self, tmp_path: Path) -> None:
        """Without env var, should use config file projects_root."""
        svc_dir = tmp_path / "yaml-projects" / "svc"
        svc_dir.mkdir(parents=True)
        (svc_dir / ".dashboard.yaml").write_text(
            yaml.dump(
                {
                    "services": [
                        {
                            "name": "svc",
                            "display_name": "Svc",
                            "default_port": 9000,
                        }
                    ]
                }
            )
        )
        (svc_dir / "docker-compose.yml").write_text("services:\n  svc:\n    image: alpine\n")

        cfg_path = tmp_path / "config.yaml"
        cfg_path.write_text(yaml.dump({"projects_root": str(tmp_path / "yaml-projects")}))

        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("DASHBOARD_PROJECTS", None)
            cfg = load_config(cfg_path)
            assert cfg.projects_root == Path(str(tmp_path / "yaml-projects"))
