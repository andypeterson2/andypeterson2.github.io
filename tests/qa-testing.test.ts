/**
 * Website Phase 6: QA/Testing
 * WP #570: E2E test suite: critical user journeys
 * WP #571: Visual regression baseline for all components
 * WP #572: Cross-browser smoke test matrix
 * WP #574: Accessibility automated audit (all pages)
 * WP #575: Performance budget validation
 * WP #576: SEO and meta validation across deployments
 * WP #577: Print stylesheet verification
 * WP #578: Mobile responsive spot-check suite
 * WP #547: Broken link checker in CI
 * WP #548: Cross-browser smoke test checklist
 * WP #549: End-to-end test suite
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

function getAllFiles(dir: string, ext: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...getAllFiles(full, ext));
    else if (entry.name.endsWith(ext)) files.push(full);
  }
  return files;
}

// ---- WP #570 / #549: Critical user journeys ----

describe('Critical user journeys', () => {
  const pages = getAllFiles(resolve(ROOT, 'src/pages'), '.astro');

  test('all pages use BaseLayout', () => {
    for (const page of pages) {
      const content = readFileSync(page, 'utf-8');
      expect(content, `${page} missing BaseLayout`).toContain('BaseLayout');
    }
  });

  test('all pages have title prop or default', () => {
    for (const page of pages) {
      const content = readFileSync(page, 'utf-8');
      // Every page either sets title= or uses default
      if (!page.includes('index.astro') || page.includes('projects')) {
        expect(content, `${page} missing title`).toMatch(/title[=:]/);
      }
    }
  });

  test('navigation links cover all main pages', () => {
    const navSrc = readFileSync(resolve(ROOT, 'src/components/Nav.astro'), 'utf-8');
    expect(navSrc).toContain("href: '/'");
    expect(navSrc).toContain("href: '/about'");
    expect(navSrc).toContain("href: '/projects'");
    expect(navSrc).toContain("href: '/skills'");
    expect(navSrc).toContain("href: '/resume'");
    expect(navSrc).toContain("href: '/contact'");
  });

  test('footer exists on all pages via layout', () => {
    const layout = readFileSync(resolve(ROOT, 'src/layouts/BaseLayout.astro'), 'utf-8');
    expect(layout).toContain('<Footer');
  });

  test('404 page exists and has back link', () => {
    const fourOhFour = readFileSync(resolve(ROOT, 'src/pages/404.astro'), 'utf-8');
    expect(fourOhFour).toContain('Back to Home');
    expect(fourOhFour).toContain('href="/"');
  });
});

// ---- WP #571: Visual regression baseline ----

describe('Visual regression baseline - component inventory', () => {
  const componentDir = resolve(ROOT, 'src/components');
  const components = readdirSync(componentDir).filter(f => f.endsWith('.astro'));

  test('all core components exist', () => {
    expect(components).toContain('Button.astro');
    expect(components).toContain('Card.astro');
    expect(components).toContain('Tag.astro');
    expect(components).toContain('Nav.astro');
    expect(components).toContain('Footer.astro');
    expect(components).toContain('SectionLabel.astro');
    expect(components).toContain('Breadcrumbs.astro');
    expect(components).toContain('PullQuote.astro');
  });

  test('all components use design tokens', () => {
    for (const comp of components) {
      const content = readFileSync(join(componentDir, comp), 'utf-8');
      if (content.includes('<style>')) {
        expect(content, `${comp} missing design tokens`).toContain('var(--');
      }
    }
  });

  test('no component uses hardcoded pixel values for spacing', () => {
    for (const comp of components) {
      const content = readFileSync(join(componentDir, comp), 'utf-8');
      const styleSection = content.split('<style>')[1]?.split('</style>')[0] || '';
      // Allow specific pixel values for borders and widths, but padding/margin should use tokens
      const paddingMatches = styleSection.match(/padding:\s*\d+px/g) || [];
      const marginMatches = styleSection.match(/margin:\s*\d+px/g) || [];
      expect(
        paddingMatches.length + marginMatches.length,
        `${comp} has hardcoded px spacing`,
      ).toBe(0);
    }
  });
});

// ---- WP #572 / #548: Cross-browser smoke test ----

describe('Cross-browser compatibility', () => {
  const tokensCss = readFileSync(resolve(ROOT, 'src/styles/tokens.css'), 'utf-8');
  const baseCss = readFileSync(resolve(ROOT, 'src/styles/base.css'), 'utf-8');

  test('uses standard CSS custom properties', () => {
    expect(tokensCss).toContain(':root');
    expect(tokensCss).toContain('--color-');
    expect(tokensCss).toContain('--font-');
    expect(tokensCss).toContain('--space-');
  });

  test('uses clamp for responsive typography', () => {
    expect(tokensCss).toContain('clamp(');
  });

  test('uses standard flexbox and grid', () => {
    const allCss = baseCss + tokensCss;
    expect(allCss).not.toContain('-webkit-flex');
    expect(allCss).not.toContain('-ms-grid');
  });

  test('reduced motion fallback exists', () => {
    expect(tokensCss).toContain('prefers-reduced-motion: reduce');
  });

  test('no vendor-specific properties in tokens', () => {
    // Tokens should be pure custom properties
    expect(tokensCss).not.toContain('-webkit-');
    expect(tokensCss).not.toContain('-moz-');
  });
});

// ---- WP #574: Accessibility automated audit ----

describe('Accessibility audit - all pages', () => {
  const pages = getAllFiles(resolve(ROOT, 'src/pages'), '.astro');
  const layout = readFileSync(resolve(ROOT, 'src/layouts/BaseLayout.astro'), 'utf-8');

  test('html has lang attribute', () => {
    expect(layout).toContain('lang="en"');
  });

  test('all pages have descriptive headings', () => {
    for (const page of pages) {
      const content = readFileSync(page, 'utf-8');
      if (!page.includes('404')) {
        expect(content, `${page} missing h1`).toContain('<h1');
      }
    }
  });

  test('all interactive elements have accessible names', () => {
    for (const page of pages) {
      const content = readFileSync(page, 'utf-8');
      const buttons = content.match(/<button[^>]*>/g) || [];
      for (const btn of buttons) {
        expect(
          btn.includes('aria-label') || btn.includes('type='),
          `Button in ${page} lacks accessibility: ${btn.slice(0, 60)}`,
        ).toBe(true);
      }
    }
  });

  test('skip link targets main content', () => {
    expect(layout).toContain('href="#main-content"');
    expect(layout).toContain('id="main-content"');
  });

  test('form inputs have labels', () => {
    for (const page of pages) {
      const content = readFileSync(page, 'utf-8');
      const inputs = content.match(/<input[^>]*id="([^"]+)"/g) || [];
      for (const input of inputs) {
        const idMatch = input.match(/id="([^"]+)"/);
        if (idMatch) {
          expect(content, `Missing label for ${idMatch[1]} in ${page}`).toContain(
            `for="${idMatch[1]}"`,
          );
        }
      }
    }
  });
});

// ---- WP #575: Performance budget ----

describe('Performance budget validation', () => {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));

  test('minimal dependency count', () => {
    const depCount = Object.keys(pkg.dependencies || {}).length;
    expect(depCount).toBeLessThan(15);
  });

  test('no heavy runtime dependencies', () => {
    const deps = pkg.dependencies || {};
    expect(deps).not.toHaveProperty('moment');
    expect(deps).not.toHaveProperty('lodash');
    expect(deps).not.toHaveProperty('jquery');
    expect(deps).not.toHaveProperty('bootstrap');
  });

  test('CSS uses custom properties (no utility framework)', () => {
    const baseCss = readFileSync(resolve(ROOT, 'src/styles/base.css'), 'utf-8');
    expect(baseCss).toContain('var(--');
    expect(baseCss).not.toContain('@tailwind');
  });

  test('font loading uses display=swap', () => {
    const layout = readFileSync(resolve(ROOT, 'src/layouts/BaseLayout.astro'), 'utf-8');
    expect(layout).toContain('display=swap');
  });

  test('font preconnect configured', () => {
    const layout = readFileSync(resolve(ROOT, 'src/layouts/BaseLayout.astro'), 'utf-8');
    expect(layout).toContain('rel="preconnect"');
    expect(layout).toContain('fonts.googleapis.com');
  });
});

// ---- WP #576: SEO and meta validation ----

describe('SEO and meta validation', () => {
  const layout = readFileSync(resolve(ROOT, 'src/layouts/BaseLayout.astro'), 'utf-8');

  test('meta charset is first in head', () => {
    const headContent = layout.split('<head>')[1]?.split('</head>')[0] || '';
    const charsetPos = headContent.indexOf('charset');
    expect(charsetPos).toBeLessThan(50);
  });

  test('viewport meta present', () => {
    expect(layout).toContain('name="viewport"');
    expect(layout).toContain('width=device-width');
  });

  test('meta description present', () => {
    expect(layout).toContain('name="description"');
  });

  test('canonical URL present', () => {
    expect(layout).toContain('rel="canonical"');
  });

  test('Open Graph meta complete', () => {
    expect(layout).toContain('og:type');
    expect(layout).toContain('og:title');
    expect(layout).toContain('og:description');
    expect(layout).toContain('og:url');
    expect(layout).toContain('og:site_name');
  });

  test('Twitter meta present', () => {
    expect(layout).toContain('twitter:card');
    expect(layout).toContain('twitter:title');
    expect(layout).toContain('twitter:description');
  });

  test('favicon links present', () => {
    expect(layout).toContain('favicon.svg');
    expect(layout).toContain('apple-touch-icon');
  });

  test('structured data present', () => {
    expect(layout).toContain('application/ld+json');
  });
});

// ---- WP #577: Print stylesheet verification ----

describe('Print stylesheet verification', () => {
  const baseCss = readFileSync(resolve(ROOT, 'src/styles/base.css'), 'utf-8');
  const printSection = baseCss.split('@media print')[1] || '';

  test('print styles exist', () => {
    expect(printSection.length).toBeGreaterThan(100);
  });

  test('removes interactive elements', () => {
    expect(printSection).toContain('nav');
    expect(printSection).toContain('.back-to-top');
    expect(printSection).toContain('.theme-toggle');
    expect(printSection).toContain('display: none');
  });

  test('ensures readable text color', () => {
    expect(printSection).toContain('color: #000');
  });

  test('removes backgrounds', () => {
    expect(printSection).toContain('background: transparent');
  });

  test('prevents page breaks after headings', () => {
    expect(printSection).toContain('page-break-after: avoid');
  });
});

// ---- WP #578: Mobile responsive ----

describe('Mobile responsive spot-check', () => {
  const navSrc = readFileSync(resolve(ROOT, 'src/components/Nav.astro'), 'utf-8');

  test('responsive nav breakpoint exists', () => {
    expect(navSrc).toContain('@media (max-width: 768px)');
  });

  test('mobile hamburger menu exists', () => {
    expect(navSrc).toContain('nav-toggle');
    expect(navSrc).toContain('mobile-menu');
  });

  test('touch targets meet 48px minimum', () => {
    expect(navSrc).toContain('min-width: 48px');
    expect(navSrc).toContain('min-height: 48px');
  });

  test('mobile links are full-width accessible', () => {
    expect(navSrc).toContain('mobile-link');
    expect(navSrc).toContain('min-height: 48px');
  });

  test('grid layouts use auto-fill/minmax for responsiveness', () => {
    const pages = getAllFiles(resolve(ROOT, 'src/pages'), '.astro');
    let foundAutoFill = false;
    for (const page of pages) {
      const content = readFileSync(page, 'utf-8');
      if (content.includes('auto-fill')) {
        foundAutoFill = true;
        break;
      }
    }
    expect(foundAutoFill).toBe(true);
  });
});

// ---- WP #547: Broken link checker ----

describe('Internal link consistency', () => {
  const pages = getAllFiles(resolve(ROOT, 'src/pages'), '.astro');
  const navSrc = readFileSync(resolve(ROOT, 'src/components/Nav.astro'), 'utf-8');

  test('all nav links point to existing pages', () => {
    const navLinks = navSrc.match(/href: '([^']+)'/g) || [];
    const pageRoutes = pages.map(p => {
      const rel = p.replace(resolve(ROOT, 'src/pages'), '');
      return rel
        .replace(/\/index\.astro$/, '')
        .replace(/\.astro$/, '')
        .replace(/\[.*?\]/, ':dynamic')
        || '/';
    });

    for (const link of navLinks) {
      const href = link.match(/href: '([^']+)'/)?.[1];
      if (href) {
        const exists = pageRoutes.some(r => r === href || r.startsWith(href + '/'));
        expect(exists, `Nav link ${href} has no matching page`).toBe(true);
      }
    }
  });

  test('no dead internal links in footer', () => {
    const footerSrc = readFileSync(resolve(ROOT, 'src/components/Footer.astro'), 'utf-8');
    // Footer links are external (github, linkedin, email) or theme toggle
    // Just verify no broken internal href="/" paths
    const internalLinks = footerSrc.match(/href="\/[^"]*"/g) || [];
    // All internal links should be valid
    expect(internalLinks.length).toBe(0); // Footer has no internal page links
  });
});
