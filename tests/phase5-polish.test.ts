/**
 * WP #506: Print stylesheet
 * WP #428: Breadcrumbs on nested pages
 * WP #439: Hero micro-status
 * WP #446: Pull quote block
 * WP #553: Error boundary for runtime errors
 * WP #429: Back to top button
 * WP #603: Project category filter logic
 * Updated for system.css monochrome architecture.
 * Removed: IntersectionObserver animations, view transitions,
 * timeline hover transitions, smooth scroll, theme toggle in print.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

// ---- WP #506: Print stylesheet ----

describe('Print stylesheet', () => {
  const baseCss = readFileSync(resolve(ROOT, 'src/styles/base.css'), 'utf-8');

  test('print media query exists', () => {
    expect(baseCss).toContain('@media print');
  });

  test('hides navigation in print', () => {
    const printSection = baseCss.split('@media print')[1] || '';
    expect(printSection).toContain('nav');
    expect(printSection).toContain('display: none');
  });

  test('hides back-to-top in print', () => {
    const printSection = baseCss.split('@media print')[1] || '';
    expect(printSection).toContain('.back-to-top');
  });

  test('makes backgrounds transparent', () => {
    const printSection = baseCss.split('@media print')[1] || '';
    expect(printSection).toContain('background: transparent');
  });

  test('sets text color to black', () => {
    const printSection = baseCss.split('@media print')[1] || '';
    expect(printSection).toContain('color: #000');
  });

  test('shows link URLs after anchor text', () => {
    const printSection = baseCss.split('@media print')[1] || '';
    expect(printSection).toContain("content: ' (' attr(href) ')'");
  });

  test('avoids page breaks after headings', () => {
    const printSection = baseCss.split('@media print')[1] || '';
    expect(printSection).toContain('page-break-after: avoid');
  });

  test('removes main padding-top', () => {
    const printSection = baseCss.split('@media print')[1] || '';
    expect(printSection).toContain('padding-top: 0');
  });
});

// ---- WP #428: Breadcrumbs (inline in BaseLayout) ----

describe('Breadcrumbs (inline in BaseLayout)', () => {
  const layoutSrc = readFileSync(
    resolve(ROOT, 'src/layouts/BaseLayout.astro'),
    'utf-8',
  );

  test('breadcrumbs auto-generated in BaseLayout for non-home pages', () => {
    expect(layoutSrc).toContain('breadcrumbs');
    expect(layoutSrc).toContain('isHome');
  });

  test('includes Home link', () => {
    expect(layoutSrc).toContain('href="/"');
    expect(layoutSrc).toContain('Home');
  });

  test('has details-bar for breadcrumb display', () => {
    expect(layoutSrc).toContain('details-bar');
    expect(layoutSrc).toContain('crumb-link');
  });
});

// ---- WP #439: Hero micro-status (removed — home page now uses Finder icon grid) ----

// ---- WP #446: Pull quote block ----

describe('Pull quote component', () => {
  const pullQuoteSrc = readFileSync(
    resolve(ROOT, 'src/components/PullQuote.astro'),
    'utf-8',
  );

  test('component file exists', () => {
    expect(existsSync(resolve(ROOT, 'src/components/PullQuote.astro'))).toBe(true);
  });

  test('renders blockquote element', () => {
    expect(pullQuoteSrc).toContain('<blockquote');
    expect(pullQuoteSrc).toContain('pull-quote');
  });

  test('has monochrome border-left', () => {
    expect(pullQuoteSrc).toContain('border-left');
    expect(pullQuoteSrc).toContain('#000');
  });

  test('supports optional cite prop', () => {
    expect(pullQuoteSrc).toContain('cite');
  });

  test('uses italic styling', () => {
    expect(pullQuoteSrc).toContain('font-style: italic');
  });

});

// ---- WP #553: Error boundary ----

describe('Error boundary for runtime errors', () => {
  const layoutSrc = readFileSync(
    resolve(ROOT, 'src/layouts/BaseLayout.astro'),
    'utf-8',
  );

  test('error boundary element exists', () => {
    expect(layoutSrc).toContain('error-boundary');
  });

  test('error boundary has role="alert"', () => {
    expect(layoutSrc).toContain('role="alert"');
  });

  test('error boundary hidden by default', () => {
    expect(layoutSrc).toContain('style="display:none"');
  });

  test('listens for window error events', () => {
    expect(layoutSrc).toContain("addEventListener('error'");
  });

  test('error boundary has high z-index', () => {
    expect(layoutSrc).toContain('z-index: 300');
  });
});

// ---- WP #429: Back to top button ----

describe('Back to top button', () => {
  const layoutSrc = readFileSync(
    resolve(ROOT, 'src/layouts/BaseLayout.astro'),
    'utf-8',
  );

  test('back-to-top button exists', () => {
    expect(layoutSrc).toContain('back-to-top');
  });

  test('has aria-label', () => {
    expect(layoutSrc).toContain('aria-label="Back to top"');
  });

  test('uses system.css btn class', () => {
    expect(layoutSrc).toContain('class="btn back-to-top"');
  });

  test('scroll listener toggles visible class', () => {
    expect(layoutSrc).toContain("classList.toggle('visible'");
  });

  test('click scrolls to top smoothly', () => {
    expect(layoutSrc).toContain("scrollTo({ top: 0, behavior: 'smooth' })");
  });

  test('hidden by default (opacity 0)', () => {
    expect(layoutSrc).toContain('opacity: 0');
    expect(layoutSrc).toContain('pointer-events: none');
  });

  test('visible class enables interaction', () => {
    expect(layoutSrc).toContain('.back-to-top.visible');
    expect(layoutSrc).toContain('pointer-events: auto');
  });
});
