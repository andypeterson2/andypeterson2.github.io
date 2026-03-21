#!/usr/bin/env bash
# WP #568: New page scaffolding script
# Usage: ./scripts/new-page.sh <page-name>
# Creates a new Astro page with BaseLayout, breadcrumbs, and standard structure.

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
import SectionLabel from '../components/SectionLabel.astro';
import Breadcrumbs from '../components/Breadcrumbs.astro';
import { siteConfig } from '../config/site';
---

<BaseLayout title="${TITLE}" description="${TITLE} page">
  <div class="container">
    <Breadcrumbs crumbs={[{ label: '${TITLE}' }]} />
    <section class="page-header">
      <h1>${TITLE}</h1>
      <p class="page-subtitle">Description for ${TITLE}.</p>
    </section>

    <section class="content">
      <SectionLabel label="Content" />
      <p>Page content goes here.</p>
    </section>
  </div>
</BaseLayout>

<style>
  .page-header {
    padding: var(--space-16) 0 var(--space-8);
    max-width: var(--content-width);
  }
  .page-header h1 {
    margin-bottom: var(--space-4);
  }
  .page-subtitle {
    font-size: var(--text-xl);
    color: var(--color-text-secondary);
  }
  .content {
    padding: var(--space-12) 0;
  }
</style>
TEMPLATE

echo "Created $FILE"
