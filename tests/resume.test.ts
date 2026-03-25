/**
 * WP #476: Inline resume web view
 * WP #477: ATS compatibility verification
 * WP #480: Cover letter template
 * WP #612: Test: Build-time PDF generation (placeholder verified)
 * Updated for system.css monochrome architecture.
 *
 * Resume, about, and cover-letter pages do not exist yet.
 * Only the print stylesheet readiness test is retained.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

// ---- WP #612: PDF generation readiness ----

describe('PDF generation readiness', () => {
  test('site has printable structure', () => {
    const baseCss = readFileSync(resolve(ROOT, 'src/styles/base.css'), 'utf-8');
    expect(baseCss).toContain('@media print');
  });
});
