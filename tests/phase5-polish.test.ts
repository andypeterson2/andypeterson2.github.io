/**
 * Print stylesheet, breadcrumbs, pull quote, error boundary,
 * and back-to-top button tests.
 * Updated for system.css monochrome architecture.
 * Removed: IntersectionObserver animations, view transitions,
 * timeline hover transitions, smooth scroll, theme toggle in print.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

// ---- Print stylesheet ----

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
    expect(printSection).toMatch(/(?:page-)?break-after: avoid/);
  });

  test('removes main padding-top', () => {
    const printSection = baseCss.split('@media print')[1] || '';
    expect(printSection).toContain('padding-top: 0');
  });
});

// ---- Flat layout (breadcrumb details-bar removed) ----

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

// ---- Pull quote block ----

describe('Pull quote component', () => {
  const pullQuoteSrc = readFileSync(resolve(ROOT, 'src/components/PullQuote.astro'), 'utf-8');

  test('component file exists', () => {
    expect(existsSync(resolve(ROOT, 'src/components/PullQuote.astro'))).toBe(true);
  });

  test('renders blockquote element', () => {
    expect(pullQuoteSrc).toContain('<blockquote');
    expect(pullQuoteSrc).toContain('pull-quote');
  });

  test('has border-left styling', () => {
    expect(pullQuoteSrc).toContain('border-left');
  });

  test('supports optional cite prop', () => {
    expect(pullQuoteSrc).toContain('cite');
  });

  test('uses italic styling', () => {
    expect(pullQuoteSrc).toContain('font-style: italic');
  });
});

// ---- Error boundary (intentionally removed — app pages handle errors via their own UI) ----

describe('Error boundary for runtime errors', () => {
  const layoutSrc = readFileSync(resolve(ROOT, 'src/layouts/BaseLayout.astro'), 'utf-8');

  test('error boundary deliberately removed with comment', () => {
    expect(layoutSrc).toContain('Error boundary removed');
  });
});

// ---- Back to top button ----

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
