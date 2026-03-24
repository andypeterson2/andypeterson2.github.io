"""Tests for the project scanner."""

from __future__ import annotations

from pathlib import Path

import yaml

from dashboard.scanner import (
    ProjectInfo,
    _detect_languages,
    _get_description,
    _parse_compose_services,
    _parse_dashboard_manifest,
    scan_project,
    scan_projects,
)


class TestProjectInfo:
    def test_to_dict_round_trip(self) -> None:
        info = ProjectInfo(name="test", path="/tmp/test")
        d = info.to_dict()
        assert d["name"] == "test"
        assert d["path"] == "/tmp/test"
        assert d["has_git"] is False
        assert d["languages"] == []

    def test_to_dict_with_all_fields(self) -> None:
        info = ProjectInfo(
            name="myapp",
            path="/projects/myapp",
            has_git=True,
            has_dockerfile=True,
            has_compose=True,
            has_dashboard_manifest=True,
            git_branch="main",
            git_dirty=True,
            git_commit_count=42,
            git_last_commit="fix: something (2 days ago)",
            git_remote="https://github.com/user/myapp.git",
            compose_services=["web", "db"],
            dashboard_services=[{"name": "web"}],
            languages=["Python", "JavaScript"],
            description="A web application",
        )
        d = info.to_dict()
        assert d["git_branch"] == "main"
        assert d["git_dirty"] is True
        assert d["git_commit_count"] == 42
        assert len(d["compose_services"]) == 2
        assert d["description"] == "A web application"


class TestDetectLanguages:
    def test_detects_python(self, tmp_path: Path) -> None:
        (tmp_path / "main.py").write_text("print('hello')")
        assert "Python" in _detect_languages(tmp_path)

    def test_detects_javascript(self, tmp_path: Path) -> None:
        (tmp_path / "app.js").write_text("console.log('hi')")
        assert "JavaScript" in _detect_languages(tmp_path)

    def test_detects_typescript(self, tmp_path: Path) -> None:
        (tmp_path / "app.ts").write_text("const x: number = 1")
        assert "TypeScript" in _detect_languages(tmp_path)

    def test_detects_nested_files(self, tmp_path: Path) -> None:
        sub = tmp_path / "src"
        sub.mkdir()
        (sub / "lib.rs").write_text("fn main() {}")
        assert "Rust" in _detect_languages(tmp_path)

    def test_empty_dir(self, tmp_path: Path) -> None:
        assert _detect_languages(tmp_path) == []

    def test_detects_multiple_languages(self, tmp_path: Path) -> None:
        (tmp_path / "main.py").write_text("")
        (tmp_path / "index.html").write_text("")
        (tmp_path / "style.css").write_text("")
        langs = _detect_languages(tmp_path)
        assert "Python" in langs
        assert "HTML" in langs
        assert "CSS" in langs


class TestParseComposeServices:
    def test_valid_compose(self, tmp_path: Path) -> None:
        compose = tmp_path / "docker-compose.yml"
        compose.write_text(
            yaml.dump({"services": {"web": {"image": "nginx"}, "db": {"image": "postgres"}}})
        )
        services = _parse_compose_services(compose)
        assert set(services) == {"web", "db"}

    def test_invalid_yaml(self, tmp_path: Path) -> None:
        compose = tmp_path / "docker-compose.yml"
        compose.write_text("not: valid: yaml: [")
        assert _parse_compose_services(compose) == []

    def test_missing_services_key(self, tmp_path: Path) -> None:
        compose = tmp_path / "docker-compose.yml"
        compose.write_text(yaml.dump({"version": "3"}))
        assert _parse_compose_services(compose) == []

    def test_nonexistent_file(self, tmp_path: Path) -> None:
        assert _parse_compose_services(tmp_path / "nope.yml") == []


class TestParseDashboardManifest:
    def test_valid_manifest(self, tmp_path: Path) -> None:
        manifest = tmp_path / ".dashboard.yaml"
        manifest.write_text(
            yaml.dump(
                {
                    "services": [
                        {
                            "name": "api",
                            "display_name": "API Server",
                            "compose_service": "api",
                            "default_port": 4000,
                        }
                    ]
                }
            )
        )
        services = _parse_dashboard_manifest(manifest)
        assert len(services) == 1
        assert services[0]["name"] == "api"
        assert services[0]["default_port"] == 4000

    def test_invalid_manifest(self, tmp_path: Path) -> None:
        manifest = tmp_path / ".dashboard.yaml"
        manifest.write_text("not valid yaml [")
        assert _parse_dashboard_manifest(manifest) == []

    def test_no_browser_flag(self, tmp_path: Path) -> None:
        manifest = tmp_path / ".dashboard.yaml"
        manifest.write_text(
            yaml.dump(
                {
                    "services": [
                        {
                            "name": "worker",
                            "display_name": "Worker",
                            "default_port": 9090,
                            "no_browser": True,
                        }
                    ]
                }
            )
        )
        services = _parse_dashboard_manifest(manifest)
        assert services[0]["no_browser"] is True


class TestGetDescription:
    def test_extracts_from_readme(self, tmp_path: Path) -> None:
        readme = tmp_path / "README.md"
        readme.write_text("# My Project\n\nThis is a great project that does many things.\n")
        desc = _get_description(tmp_path)
        assert "great project" in desc

    def test_no_readme(self, tmp_path: Path) -> None:
        assert _get_description(tmp_path) == ""

    def test_empty_readme(self, tmp_path: Path) -> None:
        (tmp_path / "README.md").write_text("")
        assert _get_description(tmp_path) == ""

    def test_truncates_long_description(self, tmp_path: Path) -> None:
        (tmp_path / "README.md").write_text("# Title\n\n" + "x" * 300 + "\n")
        desc = _get_description(tmp_path)
        assert len(desc) <= 200


class TestScanProject:
    def test_basic_project(self, tmp_path: Path) -> None:
        project = tmp_path / "myapp"
        project.mkdir()
        (project / "main.py").write_text("print('hi')")
        info = scan_project(project)
        assert info.name == "myapp"
        assert "Python" in info.languages
        assert info.has_git is False

    def test_project_with_dockerfile(self, tmp_path: Path) -> None:
        project = tmp_path / "dockerapp"
        project.mkdir()
        (project / "Dockerfile").write_text("FROM python:3.12")
        info = scan_project(project)
        assert info.has_dockerfile is True

    def test_project_with_compose(self, tmp_path: Path) -> None:
        project = tmp_path / "composeapp"
        project.mkdir()
        (project / "docker-compose.yml").write_text(
            yaml.dump({"services": {"web": {"image": "nginx"}}})
        )
        info = scan_project(project)
        assert info.has_compose is True
        assert "web" in info.compose_services

    def test_project_with_manifest(self, tmp_path: Path) -> None:
        project = tmp_path / "manifestapp"
        project.mkdir()
        (project / ".dashboard.yaml").write_text(
            yaml.dump({"services": [{"name": "api", "display_name": "API", "default_port": 5000}]})
        )
        info = scan_project(project)
        assert info.has_dashboard_manifest is True
        assert len(info.dashboard_services) == 1


class TestScanProjects:
    def test_scans_subdirectories(self, tmp_path: Path) -> None:
        # Create a project with a .git dir
        proj = tmp_path / "myrepo"
        proj.mkdir()
        (proj / ".git").mkdir()

        projects = scan_projects(tmp_path)
        assert len(projects) == 1
        assert projects[0].name == "myrepo"

    def test_skips_hidden_dirs(self, tmp_path: Path) -> None:
        hidden = tmp_path / ".hidden"
        hidden.mkdir()
        (hidden / ".git").mkdir()
        assert scan_projects(tmp_path) == []

    def test_skips_non_project_dirs(self, tmp_path: Path) -> None:
        noproject = tmp_path / "randomdir"
        noproject.mkdir()
        (noproject / "notes.txt").write_text("nothing here")
        assert scan_projects(tmp_path) == []

    def test_nonexistent_root(self, tmp_path: Path) -> None:
        assert scan_projects(tmp_path / "nope") == []

    def test_multiple_projects(self, tmp_path: Path) -> None:
        for name in ("alpha", "beta", "gamma"):
            proj = tmp_path / name
            proj.mkdir()
            (proj / ".git").mkdir()
        projects = scan_projects(tmp_path)
        assert len(projects) == 3
        names = [p.name for p in projects]
        assert "alpha" in names
        assert "beta" in names
        assert "gamma" in names

    def test_docker_only_project(self, tmp_path: Path) -> None:
        proj = tmp_path / "dockeronly"
        proj.mkdir()
        (proj / "Dockerfile").write_text("FROM alpine")
        projects = scan_projects(tmp_path)
        assert len(projects) == 1

    def test_manifest_only_project(self, tmp_path: Path) -> None:
        proj = tmp_path / "manifestonly"
        proj.mkdir()
        (proj / ".dashboard.yaml").write_text(
            yaml.dump({"services": [{"name": "svc", "display_name": "Svc", "default_port": 8000}]})
        )
        projects = scan_projects(tmp_path)
        assert len(projects) == 1
