#!/bin/bash
# CI PII/name-leakage lint.
# Scans source AND public assets (including committed PDFs via pdftotext) for
# protected identity strings. Set PROTECTED_NAMES (comma-separated) in CI — include
# names, phone number(s), private email, and home city. The patterns live in CI
# (a secret/env), never committed here, so this file itself carries no PII.
set -e

NAMES=()
if [ -n "$PROTECTED_NAMES" ]; then
  IFS=',' read -ra NAMES <<< "$PROTECTED_NAMES"
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
  name=$(echo "$name" | xargs) # trim
  [ -z "$name" ] && continue

  # Text files across src/ + public/
  MATCHES=$(grep -ri "$name" $SCAN_DIRS "${INCLUDES[@]}" -l 2>/dev/null || true)
  if [ -n "$MATCHES" ]; then
    echo "ERROR: Found '$name' in:"
    echo "$MATCHES" | sed 's/^/  /'
    FOUND=1
  fi

  # Committed PDFs — extract text and search (catches PII baked into rendered résumés)
  if [ $HAVE_PDFTOTEXT -eq 1 ]; then
    while IFS= read -r pdf; do
      if pdftotext "$pdf" - 2>/dev/null | grep -qi "$name"; then
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
