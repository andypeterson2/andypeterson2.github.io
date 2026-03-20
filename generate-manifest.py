#!/usr/bin/env python3
"""Scan for sub-apps and generate site-manifest.json."""
import json, re, sys
from datetime import datetime, timezone
from pathlib import Path

EXCLUDED = {
    "dockerfiles", "images", "lib", "nginx", "shared",
    "tests", ".claude", "documents",
}

EXCLUDED_PATHS = {
    "qvc/server",
}


def main():
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent
    apps = []

    for index_html in sorted(root.rglob("index.html")):
        rel = index_html.parent.relative_to(root)
        rel_str = str(rel)

        # Skip excluded top-level directories
        if rel.parts and rel.parts[0] in EXCLUDED:
            continue

        # Skip excluded path prefixes
        if any(rel_str == ex or rel_str.startswith(ex + "/") for ex in EXCLUDED_PATHS):
            continue

        # Extract metadata from HTML
        html = index_html.read_text(encoding="utf-8", errors="ignore")

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
        # <meta name="site-backend-service" content="...">  (backend service name)
        m_backend_svc = re.search(
            r'<meta\s+name="site-backend-service"\s+content="([^"]*)"', html, re.IGNORECASE
        )
        # <meta name="site-backend-port" content="...">  (backend default port)
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
            entry["backend"] = {
                "service": m_backend_svc.group(1).strip(),
                "defaultPort": int(m_backend_port.group(1).strip()) if m_backend_port else 8080,
            }
        apps.append(entry)

    # Root first, then alphabetical
    apps.sort(key=lambda a: (a["path"] != "/", a["path"]))

    manifest = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "apps": apps,
    }

    out = root / "site-manifest.json"
    out.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"site-manifest.json: {len(apps)} apps")
    for a in apps:
        print(f"  {a['path']:25s} {a['title']}")


if __name__ == "__main__":
    main()
