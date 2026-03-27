#!/usr/bin/env python3
"""Scan for sub-apps and generate site-manifest.json."""
import json
import re
import subprocess
import sys
from pathlib import Path

EXCLUDED = {
    "dockerfiles", "images", "lib", "nginx", "shared",
    "tests", "documents", "node_modules", "dist", "templates",
}

EXCLUDED_PATTERNS = {
    "backup", "submodule-backup",
}


def get_submodule_dirs(root: Path) -> set[str]:
    """Auto-detect submodule paths from .gitmodules."""
    gitmodules = root / ".gitmodules"
    if not gitmodules.is_file():
        return set()
    content = gitmodules.read_text()
    return set(re.findall(r'path\s*=\s*(.+)', content))


# Explicit website entry-points inside submodules
SUBMODULE_WEBSITE_PATHS = {
    "packages/nonogram/website",
    "packages/cv/website",
    "packages/qvc/website/client",
}

EXCLUDED_PATHS = {
    "packages/qvc/server",
    "packages/qvc/website/server",
}


def main():
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
    submodule_dirs = get_submodule_dirs(root)
    apps = []

    for index_html in sorted(root.rglob("index.html")):
        rel = index_html.parent.relative_to(root)
        rel_str = str(rel)

        # Skip hidden directories
        if any(p.startswith(".") for p in rel.parts):
            continue

        # Skip excluded top-level directories
        if rel.parts and rel.parts[0] in EXCLUDED:
            continue

        # Skip paths containing excluded patterns (e.g. backup dirs)
        if any(pattern in p for p in rel.parts for pattern in EXCLUDED_PATTERNS):
            continue

        # Skip excluded directory names at any depth
        if any(p in EXCLUDED for p in rel.parts):
            continue

        # Skip submodule dirs unless path is an explicit website entry-point
        if rel_str in submodule_dirs or any(
            rel_str.startswith(sd + "/") for sd in submodule_dirs
        ):
            if rel_str not in SUBMODULE_WEBSITE_PATHS:
                continue

        # Skip excluded path prefixes
        if any(rel_str == ex or rel_str.startswith(ex + "/") for ex in EXCLUDED_PATHS):
            continue

        # Extract metadata from HTML
        html = index_html.read_text(encoding="utf-8", errors="ignore")

        # Skip Jinja/template files (contain {{ }})
        if "{{" in html and "}}" in html:
            continue

        # <meta name="site-nav-label" content="...">  (display name override)
        m_label = re.search(
            r'<meta\s+name="site-nav-label"\s+content="([^"]*)"', html, re.IGNORECASE
        )
        # <meta name="site-nav-icon" content="...">  (Font Awesome class)
        m_icon = re.search(
            r'<meta\s+name="site-nav-icon"\s+content="([^"]*)"', html, re.IGNORECASE
        )
        # <meta name="site-nav-pin" content="left">  (pin position in navbar)
        m_pin = re.search(
            r'<meta\s+name="site-nav-pin"\s+content="([^"]*)"', html, re.IGNORECASE
        )
        # New format: <meta name="site-backend" content="svc" data-port="8080" data-label="...">
        m_backend_new = re.search(
            r'<meta\s+name="site-backend"\s+content="([^"]*)"(?:\s+data-port="(\d+)")?', html, re.IGNORECASE
        )
        # Legacy: <meta name="site-backend-service" content="...">
        m_backend_svc = m_backend_new or re.search(
            r'<meta\s+name="site-backend-service"\s+content="([^"]*)"', html, re.IGNORECASE
        )
        # Legacy: <meta name="site-backend-port" content="...">
        m_backend_port = re.search(
            r'<meta\s+name="site-backend-port"\s+content="([^"]*)"', html, re.IGNORECASE
        )
        # Fallback to <title> for the label
        m_title = re.search(r"<title>(.*?)</title>", html, re.IGNORECASE)

        label = m_label.group(1).strip() if m_label else (
            m_title.group(1).strip() if m_title else (rel_str if rel_str != "." else "Home")
        )
        icon = m_icon.group(1).strip() if m_icon else None

        pin = m_pin.group(1).strip() if m_pin else None

        path = "/" if rel_str == "." else "/" + rel_str + "/"
        entry = {"path": path, "title": label}
        if icon:
            entry["icon"] = icon
        if pin:
            entry["pin"] = pin
        if m_backend_svc:
            svc_name = m_backend_svc.group(1).strip()
            # New format has data-port in group(2); legacy uses separate meta tag
            if m_backend_new and m_backend_new.group(2):
                port = int(m_backend_new.group(2))
            elif m_backend_port:
                port = int(m_backend_port.group(1).strip())
            else:
                port = 8080
            entry["backend"] = {
                "service": svc_name,
                "defaultPort": port,
            }
        apps.append(entry)

    # Root first, then alphabetical
    apps.sort(key=lambda a: (a["path"] != "/", a["path"]))

    manifest = {
        "apps": apps,
    }

    out = root / "site-manifest.json"
    out.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"site-manifest.json: {len(apps)} apps")
    for a in apps:
        print(f"  {a['path']:25s} {a['title']}")


if __name__ == "__main__":
    main()
