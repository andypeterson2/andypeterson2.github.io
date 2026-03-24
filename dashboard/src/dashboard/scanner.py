"""Scan a directory for project repos and extract metadata."""

from __future__ import annotations

import subprocess
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class ProjectInfo:
    name: str
    path: str
    has_git: bool = False
    has_dockerfile: bool = False
    has_compose: bool = False
    has_dashboard_manifest: bool = False
    git_branch: str = ""
    git_dirty: bool = False
    git_commit_count: int = 0
    git_last_commit: str = ""
    git_remote: str = ""
    compose_services: list[str] = field(default_factory=list)
    dashboard_services: list[dict] = field(default_factory=list)
    languages: list[str] = field(default_factory=list)
    description: str = ""

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "path": self.path,
            "has_git": self.has_git,
            "has_dockerfile": self.has_dockerfile,
            "has_compose": self.has_compose,
            "has_dashboard_manifest": self.has_dashboard_manifest,
            "git_branch": self.git_branch,
            "git_dirty": self.git_dirty,
            "git_commit_count": self.git_commit_count,
            "git_last_commit": self.git_last_commit,
            "git_remote": self.git_remote,
            "compose_services": self.compose_services,
            "dashboard_services": self.dashboard_services,
            "languages": self.languages,
            "description": self.description,
        }


def _git(repo: Path, *args: str) -> str:
    """Run a git command in a repo and return stripped stdout."""
    try:
        result = subprocess.run(
            ["git", "-C", str(repo), *args],
            capture_output=True,
            text=True,
            timeout=5,
        )
        return result.stdout.strip()
    except Exception:
        return ""


def _detect_languages(repo: Path) -> list[str]:
    """Detect languages from common file patterns."""
    langs: list[str] = []
    checks = [
        ("Python", ["*.py"]),
        ("JavaScript", ["*.js", "*.mjs"]),
        ("TypeScript", ["*.ts", "*.tsx"]),
        ("HTML", ["*.html"]),
        ("CSS", ["*.css"]),
        ("TeX", ["*.tex"]),
        ("Rust", ["*.rs"]),
        ("Go", ["*.go"]),
    ]
    for lang, patterns in checks:
        for pat in patterns:
            # Only check top 2 levels to keep it fast
            if list(repo.glob(pat)) or list(repo.glob(f"*/{pat}")):
                langs.append(lang)
                break
    return langs


def _parse_compose_services(compose_path: Path) -> list[str]:
    """Extract service names from a docker-compose file."""
    try:
        import yaml

        with open(compose_path) as f:
            data = yaml.safe_load(f)
        if isinstance(data, dict) and "services" in data:
            return list(data["services"].keys())
    except Exception:
        pass
    return []


def _parse_dashboard_manifest(manifest_path: Path) -> list[dict]:
    """Extract service info from .dashboard.yaml."""
    try:
        import yaml

        with open(manifest_path) as f:
            data = yaml.safe_load(f)
        if isinstance(data, dict) and "services" in data:
            services = []
            for svc in data["services"]:
                services.append(
                    {
                        "name": svc.get("name", ""),
                        "display_name": svc.get("display_name", ""),
                        "compose_service": svc.get("compose_service", ""),
                        "compose_file": svc.get("compose_file", "docker-compose.yml"),
                        "default_port": svc.get("default_port", 0),
                        "no_browser": svc.get("no_browser", False),
                    }
                )
            return services
    except Exception:
        pass
    return []


def _get_description(repo: Path) -> str:
    """Try to extract a one-line description from README."""
    for name in ("README.md", "README.rst", "README.txt", "README"):
        readme = repo / name
        if readme.is_file():
            try:
                lines = readme.read_text(errors="replace").splitlines()
                for line in lines:
                    stripped = line.strip().lstrip("#").strip()
                    if stripped and not stripped.startswith("!") and len(stripped) > 5:
                        # Skip the title (first heading), get the first paragraph
                        continue
                for line in lines[1:]:
                    stripped = line.strip()
                    if stripped and not stripped.startswith("#") and not stripped.startswith("!"):
                        if len(stripped) > 10:
                            return stripped[:200]
            except Exception:
                pass
    return ""


def scan_project(project_dir: Path) -> ProjectInfo:
    """Scan a single project directory and return its metadata."""
    info = ProjectInfo(name=project_dir.name, path=str(project_dir))

    # Git
    if (project_dir / ".git").exists():
        info.has_git = True
        info.git_branch = _git(project_dir, "rev-parse", "--abbrev-ref", "HEAD")
        status = _git(project_dir, "status", "--porcelain")
        info.git_dirty = bool(status)
        count = _git(project_dir, "rev-list", "--count", "HEAD")
        try:
            info.git_commit_count = int(count)
        except ValueError:
            pass
        info.git_last_commit = _git(project_dir, "log", "-1", "--format=%s (%ar)")
        info.git_remote = _git(project_dir, "remote", "get-url", "origin")

    # Docker
    for df in ("Dockerfile", "Dockerfile.server", "Dockerfile.client"):
        if (project_dir / df).exists():
            info.has_dockerfile = True
            break

    # Compose
    compose = project_dir / "docker-compose.yml"
    if compose.exists():
        info.has_compose = True
        info.compose_services = _parse_compose_services(compose)

    # Dashboard manifest
    manifest = project_dir / ".dashboard.yaml"
    if manifest.exists():
        info.has_dashboard_manifest = True
        info.dashboard_services = _parse_dashboard_manifest(manifest)

    # Languages
    info.languages = _detect_languages(project_dir)

    # Description
    info.description = _get_description(project_dir)

    return info


def scan_projects(projects_root: Path) -> list[ProjectInfo]:
    """Scan all subdirectories for project repos."""
    if not projects_root.is_dir():
        return []

    projects: list[ProjectInfo] = []
    for child in sorted(projects_root.iterdir()):
        if not child.is_dir() or child.name.startswith("."):
            continue
        # Must have at least a .git or Dockerfile to be considered a project
        has_git = (child / ".git").exists()
        has_docker = any(
            (child / f).exists() for f in ("Dockerfile", "docker-compose.yml", ".dashboard.yaml")
        )
        if has_git or has_docker:
            projects.append(scan_project(child))

    return projects
