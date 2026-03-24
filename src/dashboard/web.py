"""Flask web dashboard for managing project repos."""

from __future__ import annotations

import logging
import os
import re
import subprocess
import threading
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS

from dashboard.scanner import scan_projects
from dashboard import openproject

log = logging.getLogger(__name__)

# In-memory store for running services: key = "project/service"
_running: dict[str, dict] = {}
_running_lock = threading.Lock()

# Allowed characters in project/service names to prevent injection
_SAFE_NAME = re.compile(r"^[a-zA-Z0-9._-]+$")


def _validate_name(name: str) -> bool:
    """Return True if name is safe (no path traversal, no injection)."""
    return bool(name and _SAFE_NAME.match(name) and ".." not in name)


def _safe_project_path(projects_root: Path, project_name: str) -> Path | None:
    """Resolve a project path and verify it stays inside projects_root."""
    if not _validate_name(project_name):
        return None
    candidate = (projects_root / project_name).resolve()
    if not str(candidate).startswith(str(projects_root.resolve())):
        return None
    if not candidate.is_dir():
        return None
    return candidate


def _compose_cmd(project_path: str, compose_file: str, *args: str) -> list[str]:
    """Build a docker compose command for a service."""
    return [
        "docker",
        "compose",
        "-f",
        str(Path(project_path) / compose_file),
        *args,
    ]


def create_app(projects_root: str | Path | None = None) -> Flask:
    """Create and configure the Flask application."""
    app = Flask(__name__)
    CORS(app)

    if projects_root is None:
        projects_root = os.environ.get("DASHBOARD_PROJECTS", "/projects")
    app.config["PROJECTS_ROOT"] = Path(projects_root)

    @app.route("/api/health")
    def api_health():
        return jsonify({"status": "ok", "version": "0.1.0"})

    @app.route("/api/projects")
    def api_projects():
        projects = scan_projects(app.config["PROJECTS_ROOT"])
        return jsonify([p.to_dict() for p in projects])

    @app.route("/api/projects/<name>")
    def api_project(name: str):
        projects = scan_projects(app.config["PROJECTS_ROOT"])
        for p in projects:
            if p.name == name:
                return jsonify(p.to_dict())
        return jsonify({"error": "not found"}), 404

    @app.route("/api/services/start", methods=["POST"])
    def api_service_start():
        data = request.get_json(force=True)
        project_name = data.get("project", "")
        service_name = data.get("service", "")
        compose_service = data.get("compose_service", "")
        compose_file = data.get("compose_file", "docker-compose.yml")

        if not project_name or not service_name:
            return jsonify({"error": "project and service required"}), 400

        if not _validate_name(project_name) or not _validate_name(service_name):
            return jsonify({"error": "invalid name"}), 400

        key = f"{project_name}/{service_name}"
        with _running_lock:
            if key in _running:
                return jsonify({"error": "already running", "key": key}), 409

        project_path = _safe_project_path(app.config["PROJECTS_ROOT"], project_name)
        if project_path is None:
            return jsonify({"error": "project not found"}), 404

        try:
            cmd = _compose_cmd(
                str(project_path),
                compose_file,
                "up",
                "-d",
                compose_service or service_name,
            )
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60,
            )
            if result.returncode != 0:
                return jsonify(
                    {
                        "error": "failed to start",
                        "stderr": result.stderr[-500:] if result.stderr else "",
                    }
                ), 500

            with _running_lock:
                _running[key] = {
                    "project": project_name,
                    "service": service_name,
                    "compose_service": compose_service or service_name,
                    "compose_file": compose_file,
                    "project_path": str(project_path),
                }

            return jsonify({"status": "started", "key": key})
        except subprocess.TimeoutExpired:
            return jsonify({"error": "start timed out"}), 504
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route("/api/services/stop", methods=["POST"])
    def api_service_stop():
        data = request.get_json(force=True)
        project_name = data.get("project", "")
        service_name = data.get("service", "")
        compose_service = data.get("compose_service", "")
        compose_file = data.get("compose_file", "docker-compose.yml")

        key = f"{project_name}/{service_name}"

        project_path = _safe_project_path(app.config["PROJECTS_ROOT"], project_name)
        if project_path is None:
            return jsonify({"error": "project not found"}), 404

        try:
            cmd = _compose_cmd(
                str(project_path),
                compose_file,
                "stop",
                compose_service or service_name,
            )
            subprocess.run(cmd, capture_output=True, text=True, timeout=30)

            with _running_lock:
                _running.pop(key, None)

            return jsonify({"status": "stopped", "key": key})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route("/api/services/<project>/<service>/logs")
    def api_service_logs(project: str, service: str):
        if not _validate_name(project) or not _validate_name(service):
            return jsonify({"error": "invalid name"}), 400

        key = f"{project}/{service}"
        with _running_lock:
            info = _running.get(key)

        project_path = _safe_project_path(app.config["PROJECTS_ROOT"], project)
        if project_path is None:
            return jsonify({"error": "project not found"}), 404

        compose_file = "docker-compose.yml"
        compose_service = service
        if info:
            compose_file = info.get("compose_file", compose_file)
            compose_service = info.get("compose_service", compose_service)

        tail = request.args.get("tail", "100")
        try:
            tail_int = int(tail)
            if tail_int < 1 or tail_int > 10000:
                tail = "100"
        except ValueError:
            tail = "100"
        try:
            cmd = _compose_cmd(
                str(project_path),
                compose_file,
                "logs",
                "--no-color",
                f"--tail={tail}",
                compose_service,
            )
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=10,
            )
            return jsonify({"logs": result.stdout, "stderr": result.stderr})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route("/api/services/status")
    def api_services_status():
        """Return status of all known services by checking Docker."""
        projects = scan_projects(app.config["PROJECTS_ROOT"])
        statuses = {}
        for p in projects:
            for svc in p.dashboard_services:
                key = f"{p.name}/{svc['name']}"
                compose_file = svc.get("compose_file", "docker-compose.yml")
                compose_svc = svc.get("compose_service", svc["name"])
                try:
                    cmd = _compose_cmd(
                        p.path,
                        compose_file,
                        "ps",
                        "--format",
                        "{{.State}}",
                        compose_svc,
                    )
                    result = subprocess.run(
                        cmd,
                        capture_output=True,
                        text=True,
                        timeout=5,
                    )
                    state = result.stdout.strip().split("\n")[0] if result.stdout.strip() else ""
                    statuses[key] = state if state else "stopped"
                except Exception:
                    statuses[key] = "unknown"
        return jsonify(statuses)

    # ── OpenProject integration ─────────────────────────────────────────────

    @app.route("/api/openproject/status")
    def api_openproject_status():
        """Return whether OpenProject integration is configured."""
        return jsonify({"configured": openproject.configured()})

    @app.route("/api/openproject/projects")
    def api_openproject_projects():
        """List all projects from OpenProject."""
        projects = openproject.list_projects()
        return jsonify(projects)

    @app.route("/api/openproject/projects/<int:project_id>/versions")
    def api_openproject_versions(project_id: int):
        """List sprints/versions for a project."""
        versions = openproject.list_versions(project_id)
        return jsonify(versions)

    @app.route("/api/openproject/work-packages")
    def api_openproject_work_packages():
        """List work packages, optionally filtered by project_id and version_id."""
        project_id = request.args.get("project_id", type=int)
        version_id = request.args.get("version_id", type=int)
        wps = openproject.list_work_packages(
            project_id=project_id, version_id=version_id
        )
        return jsonify(wps)

    @app.route("/api/openproject/summary")
    def api_openproject_summary():
        """High-level project summary with sprint progress."""
        summaries = openproject.project_summary()
        return jsonify(summaries)

    return app


def _find_free_port(preferred: int = 5050) -> int:
    """Return *preferred* if available, otherwise ask the OS for a free port."""
    import socket

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", preferred))
            return preferred
        except OSError:
            s.bind(("127.0.0.1", 0))
            return s.getsockname()[1]


def _get_ssl_context() -> tuple[str, str] | None:
    """Return (cert, key) paths if dev certs exist, else None."""
    for d in [
        Path(os.environ.get("DEV_CERT_DIR", "")),
        Path(__file__).resolve().parents[3] / ".certs",
    ]:
        cert, key = d / "cert.pem", d / "key.pem"
        if cert.is_file() and key.is_file():
            return (str(cert), str(key))
    return None


def main() -> None:
    """Entry point for running the web dashboard."""
    projects_root = os.environ.get("DASHBOARD_PROJECTS", str(Path.cwd() / "projects"))
    app = create_app(projects_root)
    preferred = int(os.environ.get("PORT", "5050"))
    port = _find_free_port(preferred)
    if port != preferred:
        print(f"Port {preferred} in use, using port {port} instead")
    ssl_ctx = _get_ssl_context()
    scheme = "https" if ssl_ctx else "http"
    print(f"Dashboard running at {scheme}://localhost:{port}")
    app.run(
        host="0.0.0.0",
        port=port,
        debug=os.environ.get("DEBUG", "0") == "1",
        ssl_context=ssl_ctx,
    )


if __name__ == "__main__":
    main()
