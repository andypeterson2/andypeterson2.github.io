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

// ---- WP #428: Breadcrumbs ----

describe('Breadcrumbs component', () => {
  const breadcrumbsSrc = readFileSync(
    resolve(ROOT, 'src/components/Breadcrumbs.astro'),
    'utf-8',
  );

  test('component file exists', () => {
    expect(existsSync(resolve(ROOT, 'src/components/Breadcrumbs.astro'))).toBe(true);
  });

  test('has breadcrumb nav with aria-label', () => {
    expect(breadcrumbsSrc).toContain('aria-label="Breadcrumb"');
  });

  test('includes Home link', () => {
    expect(breadcrumbsSrc).toContain('href="/"');
    expect(breadcrumbsSrc).toContain('Home');
  });

  test('uses aria-current for current page', () => {
    expect(breadcrumbsSrc).toContain('aria-current="page"');
  });

  test('has separator with aria-hidden', () => {
    expect(breadcrumbsSrc).toContain('aria-hidden="true"');
  });

  test('breadcrumbs used on about page', () => {
    const aboutSrc = readFileSync(resolve(ROOT, 'src/pages/about.astro'), 'utf-8');
    expect(aboutSrc).toContain('Breadcrumbs');
  });

  test('breadcrumbs used on projects page', () => {
    const projectsSrc = readFileSync(resolve(ROOT, 'src/pages/projects/index.astro'), 'utf-8');
    expect(projectsSrc).toContain('Breadcrumbs');
  });

  test('breadcrumbs used on skills page', () => {
    const skillsSrc = readFileSync(resolve(ROOT, 'src/pages/skills.astro'), 'utf-8');
    expect(skillsSrc).toContain('Breadcrumbs');
  });

  test('breadcrumbs used on resume page', () => {
    const resumeSrc = readFileSync(resolve(ROOT, 'src/pages/resume.astro'), 'utf-8');
    expect(resumeSrc).toContain('Breadcrumbs');
  });

  test('breadcrumbs used on contact page', () => {
    const contactSrc = readFileSync(resolve(ROOT, 'src/pages/contact.astro'), 'utf-8');
    expect(contactSrc).toContain('Breadcrumbs');
  });
});

// ---- WP #439: Hero micro-status ----

describe('Hero micro-status', () => {
  const indexSrc = readFileSync(resolve(ROOT, 'src/pages/index.astro'), 'utf-8');

  test('has status element', () => {
    expect(indexSrc).toContain('hero-status');
  });

  test('has status dot', () => {
    expect(indexSrc).toContain('status-dot');
  });

  test('has status text about current work', () => {
    expect(indexSrc).toContain('Currently working on');
  });

  test('hero-status uses standard-dialog', () => {
    expect(indexSrc).toContain('standard-dialog hero-status');
  });
});

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

  test('pull quote used on about page', () => {
    const aboutSrc = readFileSync(resolve(ROOT, 'src/pages/about.astro'), 'utf-8');
    expect(aboutSrc).toContain('PullQuote');
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
