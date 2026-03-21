#!/bin/bash
# WP #400: CI name-leakage lint check
# Scans source files for hardcoded identity strings.
# Add protected names to the NAMES array below.
set -e

NAMES=()

# Read names from PROTECTED_NAMES env var (comma-separated)
if [ -n "$PROTECTED_NAMES" ]; then
  IFS=',' read -ra NAMES <<< "$PROTECTED_NAMES"
fi

if [ ${#NAMES[@]} -eq 0 ]; then
  echo "No PROTECTED_NAMES configured — skipping name-leakage check."
  exit 0
fi

FOUND=0
for name in "${NAMES[@]}"; do
  name=$(echo "$name" | xargs) # trim whitespace
  if [ -z "$name" ]; then continue; fi
  MATCHES=$(grep -ri "$name" src/ --include='*.ts' --include='*.tsx' --include='*.astro' --include='*.mdx' --include='*.css' -l 2>/dev/null || true)
  if [ -n "$MATCHES" ]; then
    echo "ERROR: Found '$name' in:"
    echo "$MATCHES" | sed 's/^/  /'
    FOUND=1
  fi
done

if [ $FOUND -eq 1 ]; then
  echo ""
  echo "Name leakage detected! Use site.config.ts variables instead of hardcoded names."
  exit 1
fi

echo "No name leakage found."
