#!/usr/bin/env bash
# New page scaffolding script
# Usage: ./scripts/new-page.sh <page-name>
# Creates a new Astro page with BaseLayout and standard structure.

set -euo pipefail

PAGE_NAME="${1:-}"

if [ -z "$PAGE_NAME" ]; then
  echo "Usage: $0 <page-name>"
  echo "Example: $0 blog"
  exit 1
fi

SLUG=$(echo "$PAGE_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
TITLE=$(echo "$PAGE_NAME" | sed 's/\b\(.\)/\u\1/g')
FILE="src/pages/${SLUG}.astro"

if [ -f "$FILE" ]; then
  echo "Error: $FILE already exists"
  exit 1
fi

cat > "$FILE" << TEMPLATE
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { siteConfig } from '../config/site';
---

<BaseLayout title="${TITLE}" description="${TITLE} page">
  <div class="page-intro">
    <p class="page-subtitle">Description for ${TITLE}.</p>
  </div>

  <div class="page-section">
    <div class="section-rule"><span>${TITLE}</span></div>
    <p>Page content goes here.</p>
  </div>
</BaseLayout>

<style>
  .page-intro {
    padding: clamp(16px, 3vw, 40px) 0 clamp(8px, 1.5vw, 20px);
  }
  .page-subtitle {
    font-size: clamp(12px, 1.78vw, 24px);
    max-width: 55ch;
    line-height: 1.5;
  }
  .page-section {
    padding: clamp(12px, 2vw, 28px) 0;
  }
</style>
TEMPLATE

echo "Created $FILE"
