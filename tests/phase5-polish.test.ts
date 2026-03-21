/**
 * WP #506: Print stylesheet
 * WP #428: Breadcrumbs on nested pages
 * WP #444: Timeline hover states
 * WP #439: Hero micro-status
 * WP #451: Project card scroll entrance animation
 * WP #468: Skill item entrance animation
 * WP #446: Pull quote block
 * WP #553: Error boundary for runtime errors
 * WP #429: Back to top button
 * WP #430: Smooth scroll
 * WP #593: Page transition animations (scroll entrance)
 * WP #594: Smooth scroll and nav offset
 * WP #601: Timeline hover interactions
 * WP #603: Project category filter logic
 * WP #605: Project card scroll entrance animation
 * WP #609: Skill item entrance animation
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

  test('hides theme toggle in print', () => {
    const printSection = baseCss.split('@media print')[1] || '';
    expect(printSection).toContain('.theme-toggle');
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

// ---- WP #444 / #601: Timeline hover states ----

describe('Timeline hover interactions', () => {
  const aboutSrc = readFileSync(resolve(ROOT, 'src/pages/about.astro'), 'utf-8');

  test('timeline items have hover transition', () => {
    expect(aboutSrc).toContain('.timeline-item');
    expect(aboutSrc).toContain('transition:');
  });

  test('timeline items translate on hover', () => {
    expect(aboutSrc).toContain('.timeline-item:hover');
    expect(aboutSrc).toContain('transform: translateX');
  });

  test('timeline date changes color on hover', () => {
    expect(aboutSrc).toContain('.timeline-item:hover .timeline-date');
  });
});

// ---- WP #439: Hero micro-status ----

describe('Hero micro-status', () => {
  const indexSrc = readFileSync(resolve(ROOT, 'src/pages/index.astro'), 'utf-8');

  test('has status element', () => {
    expect(indexSrc).toContain('hero-status');
  });

  test('has pulsing status dot', () => {
    expect(indexSrc).toContain('status-dot');
    expect(indexSrc).toContain('animation: pulse');
  });

  test('has status text about current work', () => {
    expect(indexSrc).toContain('status-text');
    expect(indexSrc).toContain('Currently working on');
  });
});

// ---- WP #451 / #605: Project card scroll entrance ----

describe('Project card scroll entrance animation', () => {
  const projectsSrc = readFileSync(
    resolve(ROOT, 'src/pages/projects/index.astro'),
    'utf-8',
  );

  test('uses IntersectionObserver for scroll animation', () => {
    expect(projectsSrc).toContain('IntersectionObserver');
  });

  test('cards start with opacity 0', () => {
    expect(projectsSrc).toContain('opacity: 0');
  });

  test('cards start translated down', () => {
    expect(projectsSrc).toContain('transform: translateY');
  });

  test('visible class sets opacity 1', () => {
    expect(projectsSrc).toContain('.project-card-wrap.visible');
    expect(projectsSrc).toContain('opacity: 1');
  });

  test('observer unobserves after intersection', () => {
    expect(projectsSrc).toContain('observer.unobserve');
  });
});

// ---- WP #468 / #609: Skill item entrance animation ----

describe('Skill item entrance animation', () => {
  const skillsSrc = readFileSync(resolve(ROOT, 'src/pages/skills.astro'), 'utf-8');

  test('uses IntersectionObserver for skills', () => {
    expect(skillsSrc).toContain('IntersectionObserver');
  });

  test('skill items start invisible', () => {
    expect(skillsSrc).toContain('.skill-item');
    expect(skillsSrc).toContain('opacity: 0');
  });

  test('visible class reveals skill items', () => {
    expect(skillsSrc).toContain('.skill-item.visible');
  });

  test('has staggered delay per item', () => {
    expect(skillsSrc).toContain('transitionDelay');
  });

  test('skill items have hover state', () => {
    expect(skillsSrc).toContain('.skill-item:hover');
    expect(skillsSrc).toContain('border-color: var(--color-accent)');
  });

  test('re-observes on tab switch', () => {
    expect(skillsSrc).toContain('observeSkills()');
    // Called in the tab click handler
    const tabHandler = skillsSrc.split("tab.addEventListener('click'")[1] || '';
    expect(tabHandler).toContain('observeSkills');
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

  test('has accent border-left', () => {
    expect(pullQuoteSrc).toContain('border-left');
    expect(pullQuoteSrc).toContain('--color-accent');
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

// ---- WP #430 / #594: Smooth scroll ----

describe('Smooth scroll and nav offset', () => {
  const baseCss = readFileSync(resolve(ROOT, 'src/styles/base.css'), 'utf-8');

  test('smooth scroll behavior set on html', () => {
    expect(baseCss).toContain('scroll-behavior: smooth');
  });

  test('main has padding-top for fixed nav', () => {
    const layoutSrc = readFileSync(
      resolve(ROOT, 'src/layouts/BaseLayout.astro'),
      'utf-8',
    );
    expect(layoutSrc).toContain('padding-top: 48px');
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
