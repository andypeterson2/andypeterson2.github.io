"""OpenProject API client for the dashboard.

Provides read-only access to projects, sprints (versions), and work
packages from a local OpenProject instance.  All requests use Basic Auth
with an API token.

Configuration is loaded from environment variables:
    OPENPROJECT_URL   — Base URL (default: http://localhost:8088)
    OPENPROJECT_TOKEN — API token (required for data access)
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache
from typing import Any
from urllib.request import Request, urlopen
from urllib.parse import quote, urlencode
import json

log = logging.getLogger(__name__)

_BASE_URL = os.environ.get("OPENPROJECT_URL", "http://localhost:8088")
_TOKEN = os.environ.get("OPENPROJECT_TOKEN", "")


def _api_get(path: str, params: dict[str, str] | None = None) -> dict[str, Any]:
    """Make an authenticated GET request to the OpenProject API v3."""
    url = f"{_BASE_URL}/api/v3{path}"
    if params:
        url += "?" + urlencode(params)

    req = Request(url)
    import base64
    credentials = base64.b64encode(f"apikey:{_TOKEN}".encode()).decode()
    req.add_header("Authorization", f"Basic {credentials}")
    req.add_header("Accept", "application/json")
    # OpenProject validates Host header against its configured host_name.
    # When accessing via Docker networking, we must override Host to match.
    host_name = os.environ.get("OPENPROJECT_HOST_NAME", "")
    if host_name:
        req.add_header("Host", host_name)

    with urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())


def configured() -> bool:
    """Return True if OpenProject credentials are available."""
    return bool(_TOKEN)


def list_projects() -> list[dict[str, Any]]:
    """Fetch all projects from OpenProject."""
    if not configured():
        return []
    try:
        data = _api_get("/projects", {"pageSize": "100"})
        projects = []
        for p in data.get("_embedded", {}).get("elements", []):
            projects.append({
                "id": p["id"],
                "identifier": p["identifier"],
                "name": p["name"],
                "description": (p.get("description", {}) or {}).get("raw", ""),
            })
        return projects
    except Exception as e:
        log.warning("Failed to fetch OpenProject projects: %s", e)
        return []


def list_versions(project_id: int) -> list[dict[str, Any]]:
    """Fetch all versions (sprints) for a project."""
    if not configured():
        return []
    try:
        data = _api_get(f"/projects/{project_id}/versions")
        versions = []
        for v in data.get("_embedded", {}).get("elements", []):
            versions.append({
                "id": v["id"],
                "name": v["name"],
                "status": v.get("status", "open"),
                "startDate": v.get("startDate"),
                "endDate": v.get("endDate"),
            })
        return versions
    except Exception as e:
        log.warning("Failed to fetch versions for project %d: %s", project_id, e)
        return []


def list_work_packages(
    project_id: int | None = None,
    version_id: int | None = None,
) -> list[dict[str, Any]]:
    """Fetch work packages, optionally filtered by project and/or version."""
    if not configured():
        return []
    try:
        filters = []
        if project_id:
            filters.append(json.dumps({"project": {"operator": "=", "values": [str(project_id)]}}))
        if version_id:
            filters.append(json.dumps({"version": {"operator": "=", "values": [str(version_id)]}}))

        params: dict[str, str] = {"pageSize": "200"}
        if filters:
            params["filters"] = "[" + ",".join(filters) + "]"

        data = _api_get("/work_packages", params)
        work_packages = []
        for wp in data.get("_embedded", {}).get("elements", []):
            links = wp.get("_links", {})
            work_packages.append({
                "id": wp["id"],
                "subject": wp["subject"],
                "type": links.get("type", {}).get("title", ""),
                "status": links.get("status", {}).get("title", ""),
                "priority": links.get("priority", {}).get("title", ""),
                "assignee": links.get("assignee", {}).get("title", ""),
                "estimatedTime": wp.get("estimatedTime"),
                "percentageDone": wp.get("percentageDone", 0),
            })
        return work_packages
    except Exception as e:
        log.warning("Failed to fetch work packages: %s", e)
        return []


def project_summary() -> list[dict[str, Any]]:
    """High-level summary of each project: sprint progress, WP counts."""
    projects = list_projects()
    summaries = []
    for proj in projects:
        versions = list_versions(proj["id"])
        wps = list_work_packages(project_id=proj["id"])

        total = len(wps)
        closed = sum(1 for wp in wps if wp["status"] == "Closed")
        in_progress = sum(1 for wp in wps if wp["status"] == "In progress")

        # Find current sprint (latest non-closed version)
        current_sprint = None
        for v in sorted(versions, key=lambda x: x.get("startDate") or ""):
            if v["status"] == "open":
                current_sprint = v
                break

        sprint_wps = []
        if current_sprint:
            sprint_wps = list_work_packages(
                project_id=proj["id"], version_id=current_sprint["id"]
            )

        sprint_total = len(sprint_wps)
        sprint_closed = sum(1 for wp in sprint_wps if wp["status"] == "Closed")

        summaries.append({
            "project": proj,
            "totalWorkPackages": total,
            "closedWorkPackages": closed,
            "inProgressWorkPackages": in_progress,
            "currentSprint": current_sprint,
            "sprintTotal": sprint_total,
            "sprintClosed": sprint_closed,
            "sprintProgress": round(sprint_closed / sprint_total * 100) if sprint_total else 0,
        })

    return summaries
