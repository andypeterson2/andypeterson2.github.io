#!/usr/bin/env python3
"""Scan the built site (dist/) and generate site-manifest.json.

The portal navbar is driven by site-manifest.json. Each built page's index.html
may carry <meta> tags that describe how it appears in the nav:

  <meta name="site-nav-label" content="...">              display-name override
  <meta name="site-nav-icon"  content="fa-solid fa-...">  navbar icon
  <meta name="site-nav-pin"   content="left">             pin position
  <meta name="site-backend"   content="svc" data-port="8080">  backend hint

Run AFTER `astro build` (it reads the built routes, not source):

    npm run build && python3 scripts/generate-manifest.py [dist_dir]

Writes site-manifest.json at the repo root. (Before the submodule refactor this
scanned the repo tree and special-cased submodule directories; the portal is now
a single Astro app, so deriving the manifest from dist/ yields the real routes.)
"""
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# Path segments that never represent a navigable page.
EXCLUDED_PARTS = {"_astro", "_image", "_server-islands"}


def main():
    scan_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO_ROOT / "dist"
    if not scan_dir.is_dir():
        print(
            f"::error::scan dir not found: {scan_dir} — run `npm run build` first",
            file=sys.stderr,
        )
        sys.exit(1)

    apps = []
    for index_html in sorted(scan_dir.rglob("index.html")):
        rel = index_html.parent.relative_to(scan_dir)
        if any(
            p.startswith(".") or p.startswith("_") or p in EXCLUDED_PARTS
            for p in rel.parts
        ):
            continue

        html = index_html.read_text(encoding="utf-8", errors="ignore")

        # Skip redirect stubs (astro `redirects`, e.g. /resume, /underconstruction).
        if re.search(r'http-equiv=["\']refresh["\']', html, re.IGNORECASE):
            continue

        m_label = re.search(
            r'<meta\s+name="site-nav-label"\s+content="([^"]*)"', html, re.IGNORECASE
        )
        m_icon = re.search(
            r'<meta\s+name="site-nav-icon"\s+content="([^"]*)"', html, re.IGNORECASE
        )
        m_pin = re.search(
            r'<meta\s+name="site-nav-pin"\s+content="([^"]*)"', html, re.IGNORECASE
        )
        m_backend = re.search(
            r'<meta\s+name="site-backend"\s+content="([^"]*)"(?:\s+data-port="(\d+)")?',
            html,
            re.IGNORECASE,
        )
        m_title = re.search(r"<title>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)

        rel_str = str(rel)
        # Prefer an explicit nav label; else the first segment of the <title>
        # (strips the " | Projects" site-name suffix the layout appends).
        label = (
            m_label.group(1).strip()
            if m_label
            else (
                m_title.group(1).split("|")[0].strip()
                if m_title
                else (rel_str if rel_str != "." else "Home")
            )
        )

        path = "/" if rel_str == "." else "/" + rel_str + "/"
        entry = {"path": path, "title": label}
        if m_icon:
            entry["icon"] = m_icon.group(1).strip()
        if m_pin:
            entry["pin"] = m_pin.group(1).strip()
        if m_backend:
            backend = {"service": m_backend.group(1).strip()}
            # data-port is optional; clients fall back to ServiceConfig defaults.
            if m_backend.group(2):
                backend["defaultPort"] = int(m_backend.group(2))
            entry["backend"] = backend
        apps.append(entry)

    # Root first, then alphabetical by path.
    apps.sort(key=lambda a: (a["path"] != "/", a["path"]))

    out = REPO_ROOT / "site-manifest.json"
    out.write_text(json.dumps({"apps": apps}, indent=2) + "\n")
    print(f"Wrote {out.name} with {len(apps)} app(s).")


if __name__ == "__main__":
    main()
