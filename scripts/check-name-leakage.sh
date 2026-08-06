#!/bin/bash
# CI PII/name-leakage lint.
# Scans source AND public assets (including committed PDFs via pdftotext) for
# protected identity strings. Set PROTECTED_NAMES in CI as ONE ERE PATTERN PER LINE
# (newline-delimited) — names, phone number(s), private email, home city. Patterns are
# matched with `grep -E` (extended regex), case-insensitive; backslashes/metacharacters
# are preserved (no comma-split, no xargs). The patterns live only in CI (a secret/env),
# never committed here, so this file itself carries no PII.
set -e

NAMES=()
if [ -n "$PROTECTED_NAMES" ]; then
  # One ERE pattern per LINE (newline-delimited, NOT comma-split): patterns may then
  # contain commas, and `read -r` preserves the backslashes/metacharacters that the old
  # `xargs` trim silently stripped (turning e.g. \bJohn\b into a no-op that passes).
  while IFS= read -r _line; do NAMES+=("$_line"); done <<< "$PROTECTED_NAMES"
fi

if [ ${#NAMES[@]} -eq 0 ]; then
  # Fail closed in CI: a green PII gate that scans for nothing is worse than none.
  if [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ]; then
    echo "ERROR: PROTECTED_NAMES is unset in CI — refusing to pass a PII gate that checks nothing."
    exit 1
  fi
  echo "No PROTECTED_NAMES configured — skipping leakage check (local run)."
  exit 0
fi

# ── Self-test: prove the scan mechanism still matches a known pattern. A silently
#    mangled pattern or the wrong grep flavor is worse than no gate — turn that
#    failure mode into a hard error instead of a green pass.
_ST_PAT='t[e]?st[0-9]{2}'  # ERE metacharacters; would NOT match under basic regex
if ! printf 'test42' | grep -Eqi "$_ST_PAT"; then
  echo "ERROR: name-leakage self-test failed — ERE grep did not match a known pattern. Refusing to run a possibly-broken gate."
  exit 1
fi
if printf 'harmless' | grep -Eqi "$_ST_PAT"; then
  echo "ERROR: name-leakage self-test failed — pattern matched a negative control. Refusing to run."
  exit 1
fi

SCAN_DIRS="src public"
INCLUDES=(--include='*.ts' --include='*.tsx' --include='*.astro' --include='*.mdx'
  --include='*.css' --include='*.js' --include='*.json' --include='*.html' --include='*.svg' --include='*.md')

HAVE_PDFTOTEXT=0
command -v pdftotext >/dev/null 2>&1 && HAVE_PDFTOTEXT=1
if [ $HAVE_PDFTOTEXT -eq 0 ]; then
  # Fail closed in CI if there are committed PDFs we'd otherwise silently skip.
  if { [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ]; } && [ -n "$(find $SCAN_DIRS -name '*.pdf' 2>/dev/null | head -n1)" ]; then
    echo "ERROR: pdftotext missing in CI but committed PDFs exist — cannot scan them for PII. Install poppler-utils."
    exit 1
  fi
  echo "WARN: pdftotext not found — committed PDFs will NOT be scanned (install poppler-utils in CI)."
fi

FOUND=0
for name in "${NAMES[@]}"; do
  # Trim only outer whitespace/CR — via parameter expansion, NEVER echo|xargs (which
  # word-splits and strips backslashes, silently defanging the pattern).
  name="${name#"${name%%[![:space:]]*}"}"
  name="${name%"${name##*[![:space:]]}"}"
  [ -z "$name" ] && continue

  # Migration guard: newline-delimited patterns are one per line, so a comma inside a
  # single entry almost certainly means the secret is still the old comma-joined format.
  # Fail loud rather than grep a never-matching joined string (which would pass silently).
  case "$name" in
    *,*) echo "ERROR: PROTECTED_NAMES entry '$name' contains a comma — it looks comma-joined. Reformat the secret as one pattern per line."; exit 1;;
  esac

  # Text files across src/ + public/ (extended regex, case-insensitive)
  MATCHES=$(grep -Eri "$name" $SCAN_DIRS "${INCLUDES[@]}" -l 2>/dev/null || true)
  if [ -n "$MATCHES" ]; then
    echo "ERROR: Found '$name' in:"
    echo "$MATCHES" | sed 's/^/  /'
    FOUND=1
  fi

  # Committed PDFs — extract text and search (catches PII baked into rendered résumés)
  if [ $HAVE_PDFTOTEXT -eq 1 ]; then
    while IFS= read -r pdf; do
      if pdftotext "$pdf" - 2>/dev/null | grep -Eqi "$name"; then
        echo "ERROR: Found '$name' in PDF: $pdf"
        FOUND=1
      fi
    done < <(find $SCAN_DIRS -name '*.pdf' 2>/dev/null)
  fi
done

if [ $FOUND -eq 1 ]; then
  echo ""
  echo "Leakage detected! Use site.config.ts variables for names, and keep phone/email/city"
  echo "out of committed source and rendered PDFs."
  exit 1
fi

echo "No name/PII leakage found (scanned: $SCAN_DIRS$([ $HAVE_PDFTOTEXT -eq 1 ] && echo ' + PDFs'))."
