#!/bin/bash
# Post-build security gate: the content security policy is the one security
# header this static site enforces for itself (Astro `security.csp` injects a
# hashed per-page <meta http-equiv> at build time). GitHub Pages can't set HTTP
# security headers, so if the meta ever stops emitting — an Astro upgrade, a
# config edit — the site silently loses its injection defense. This asserts the
# built output actually carries it, with the directives that matter.
#
# Run AFTER `npm run build`. Reads dist/; fails the build if the CSP is missing.
set -euo pipefail

DIST="${1:-dist}"

if [ ! -f "$DIST/index.html" ]; then
  echo "✗ $DIST/index.html not found — run 'npm run build' first." >&2
  exit 1
fi

# Every built content page must carry the CSP meta (Astro emits one per page).
# Redirect stubs are exempt: they're meta-refresh pages with no scripts/content
# that bounce instantly, so a policy would protect nothing.
pages_total=0
pages_missing=0
skipped=0
while IFS= read -r -d '' page; do
  if grep -qi 'http-equiv="refresh"' "$page"; then
    skipped=$((skipped + 1))
    continue
  fi
  pages_total=$((pages_total + 1))
  if ! grep -qi 'http-equiv="content-security-policy"' "$page"; then
    echo "✗ no CSP meta in $page" >&2
    pages_missing=$((pages_missing + 1))
  fi
done < <(find "$DIST" -type f -name '*.html' -print0)

if [ "$pages_total" -eq 0 ]; then
  echo "✗ no HTML in $DIST — nothing was built." >&2
  exit 1
fi
if [ "$pages_missing" -gt 0 ]; then
  echo "✗ $pages_missing/$pages_total built pages are missing the CSP meta." >&2
  exit 1
fi

# The home page's policy must carry the load-bearing directives. A regression
# that widened these (e.g. dropped object-src, or lost the gateway from
# connect-src so the CV editor breaks) should fail loudly, not ship.
CSP=$(grep -io '<meta http-equiv="content-security-policy"[^>]*>' "$DIST/index.html" | head -1)
require() {
  if ! printf '%s' "$CSP" | grep -qi -- "$1"; then
    echo "✗ CSP is missing required directive: $1" >&2
    exit 1
  fi
}
require "default-src 'self'"
require "object-src 'none'"
require "base-uri 'self'"
require "frame-ancestors 'none'"
require "connect-src"
require "api.andypeterson.dev"   # the CV editor's gateway — dropping it breaks the app

echo "✓ CSP present in all $pages_total content pages ($skipped redirect stubs exempt), with required directives."
