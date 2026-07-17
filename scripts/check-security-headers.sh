#!/bin/bash
# Post-build security gate: the content security policy is the one security
# header this static site enforces for itself (Astro `security.csp` injects a
# hashed per-page <meta http-equiv> at build time). GitHub Pages can't set HTTP
# security headers, so if the meta ever stops emitting — an Astro upgrade, a
# config edit — the site silently loses its injection defense. This asserts the
# built output actually carries it, with the directives that matter.
#
# ─────────────────────────────────────────────────────────────────────────────
# WHAT A <meta> CSP CANNOT DO — read before adding a `require` below.
#
# Per the CSP spec, three directives are IGNORED when delivered via <meta>:
#   frame-ancestors, report-uri, sandbox
# They only take effect as a real HTTP response header. Our policy still *names*
# frame-ancestors (harmless, and correct if the policy is ever header-delivered),
# but a browser does nothing with it here — so this script must NOT assert it and
# call the site protected. It used to, which is worse than not checking: the gate
# went green and everyone believed clickjacking was handled while the site was
# framable. Anti-framing must come from the EDGE (Cloudflare fronts this site and
# can add response headers; GitHub Pages cannot).
#
# Build-time can't see edge headers, so `--live` below checks the deployed site.
# ─────────────────────────────────────────────────────────────────────────────
#
# Usage:
#   check-security-headers.sh [dist]              # build gate (reads dist/)
#   check-security-headers.sh --live <origin>     # verify the EDGE headers
#
# Run the default AFTER `npm run build`. Fails the build if the CSP is missing.
set -euo pipefail

# ---- --live: assert the deployed origin sends what a <meta> CSP can't ----
if [ "${1:-}" = "--live" ]; then
  ORIGIN="${2:?usage: check-security-headers.sh --live https://example.com}"
  hdrs=$(curl -fsSL -m 15 -D - -o /dev/null "$ORIGIN") || { echo "✗ could not reach $ORIGIN" >&2; exit 1; }
  live_fail=0
  # Anti-framing: either X-Frame-Options, or a real CSP *header* with frame-ancestors.
  if printf '%s' "$hdrs" | grep -qiE '^x-frame-options:' \
    || printf '%s' "$hdrs" | grep -qiE '^content-security-policy:.*frame-ancestors'; then
    echo "✓ anti-framing header present"
  else
    echo "✗ no anti-framing header (X-Frame-Options / CSP frame-ancestors). The <meta> CSP's" >&2
    echo "  frame-ancestors is INERT — add a Cloudflare response-header rule." >&2
    live_fail=1
  fi
  if printf '%s' "$hdrs" | grep -qiE '^strict-transport-security:'; then
    echo "✓ HSTS present"
  else
    echo "✗ no Strict-Transport-Security (enable HSTS at the Cloudflare edge)." >&2
    live_fail=1
  fi
  printf '%s' "$hdrs" | grep -qiE '^x-content-type-options:\s*nosniff' \
    && echo "✓ nosniff present" || echo "! no X-Content-Type-Options: nosniff (minor)" >&2
  exit "$live_fail"
fi

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
# Only directives a <meta> CSP actually enforces belong here. NOT frame-ancestors:
# it's ignored in meta (see the header comment), so asserting it would certify a
# protection that doesn't exist. Anti-framing is verified by `--live` instead.
require "default-src 'self'"
require "object-src 'none'"
require "base-uri 'self'"
require "form-action"
require "connect-src"
require "api.andypeterson.dev"   # the CV editor's gateway — dropping it breaks the app

echo "✓ CSP present in all $pages_total content pages ($skipped redirect stubs exempt), with required directives."
echo "  note: frame-ancestors is inert in <meta> — anti-framing + HSTS come from the edge."
echo "        verify the deployed site with: $0 --live https://andypeterson.dev"
