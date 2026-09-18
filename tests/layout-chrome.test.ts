/**
 * Print stylesheet, error boundary, and back-to-top button tests.
 * Updated for system.css monochrome architecture.
 * Removed: IntersectionObserver animations, view transitions,
 * timeline hover transitions, smooth scroll, theme toggle in print,
 * breadcrumbs, and the pull-quote component (deleted as unused).
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

// Print stylesheet

describe('Print stylesheet', () => {
  const baseCss = readFileSync(resolve(ROOT, 'packages/system-six/styles/base.css'), 'utf-8');

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

  test('sets text color to ink', () => {
    const printSection = baseCss.split('@media print')[1] || '';
    expect(printSection).toContain('color: var(--ink)');
  });

  test('shows link URLs after anchor text', () => {
    const printSection = baseCss.split('@media print')[1] || '';
    expect(printSection).toContain("content: ' (' attr(href) ')'");
  });

  test('avoids page breaks after headings', () => {
    const printSection = baseCss.split('@media print')[1] || '';
    expect(printSection).toMatch(/(?:page-)?break-after: avoid/);
  });

  // The page scrolls inside .site-pane under a clipped 100vh body; print must unclip
  // the chain or the paper gets one screen of a seven-screen page.
  test('unclips the scrolling pane so the whole page prints', () => {
    const printSection = baseCss.split('@media print')[1] || '';
    expect(printSection).toContain('.site-pane');
    expect(printSection).toContain('overflow: visible !important');
    expect(printSection).toContain('height: auto !important');
  });

  test('removes main padding-top', () => {
    const printSection = baseCss.split('@media print')[1] || '';
    expect(printSection).toContain('padding-top: 0');
  });
});

// Flat layout (breadcrumb details-bar removed)

describe('Flat layout — no breadcrumb details-bar', () => {
  const layoutSrc = readFileSync(resolve(ROOT, 'src/layouts/BaseLayout.astro'), 'utf-8');

  test('no breadcrumb details-bar is rendered', () => {
    expect(layoutSrc).not.toContain('class="details-bar"');
    expect(layoutSrc).not.toContain('crumb-link');
  });

  test('menubar includes a Home link to root', () => {
    expect(layoutSrc).toContain('href="/"');
    expect(layoutSrc).toContain('Home');
  });

  test('the heart is the theme toggle', () => {
    expect(layoutSrc).toContain('heart-toggle');
    expect(layoutSrc).toContain('theme-toggle');
  });
});

// No global error boundary: each app page handles its own errors in its UI

describe('Error boundary for runtime errors', () => {
  const layoutSrc = readFileSync(resolve(ROOT, 'src/layouts/BaseLayout.astro'), 'utf-8');

  test('the layout installs no global error handler', () => {
    expect(layoutSrc).not.toMatch(
      /window\.onerror|unhandledrejection|addEventListener\(\s*['"]error['"]/,
    );
  });
});

// Back to top button

describe('Back to top button', () => {
  const layoutSrc = readFileSync(resolve(ROOT, 'src/layouts/BaseLayout.astro'), 'utf-8');

  test('back-to-top button exists', () => {
    expect(layoutSrc).toContain('back-to-top');
  });

  test('has aria-label', () => {
    expect(layoutSrc).toContain('aria-label="Back to top"');
  });

  test('uses the design-system <Button> (renders system.css .btn) for back-to-top', () => {
    // Was a raw <button class="btn back-to-top">; now the design-system Button
    // component (variant secondary → system.css .btn) carrying the back-to-top class.
    expect(layoutSrc).toContain('<Button');
    expect(layoutSrc).toContain('class="back-to-top"');
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
