/**
 * QA tests: cross-browser compatibility, page structure validation,
 * performance budgets, SEO checks, mobile responsiveness, and link consistency.
 * Updated for system.css monochrome architecture.
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

// ---- Page structure validation ----

describe('Page structure validation', () => {
  const pages = getAllFiles(resolve(ROOT, 'src/pages'), '.astro');

  test('all pages have title prop or default', () => {
    for (const page of pages) {
      const content = readFileSync(page, 'utf-8');
      if (!page.includes('index.astro') || page.includes('projects')) {
        expect(content, `${page} missing title`).toMatch(/title[=:]/);
      }
    }
  });

  test('all pages have descriptive headings', () => {
    for (const page of pages) {
      const content = readFileSync(page, 'utf-8');
      if (page.includes('404') || page.endsWith('pages/index.astro')) continue;
      if (page.includes('resume.astro') || page.includes('cover-letter.astro')) continue;
      if (
        page.includes('/projects/') &&
        (page.includes('app.astro') ||
          page.includes('server.astro') ||
          page.includes('client.astro'))
      )
        continue;
      if (page.includes('[')) continue;
      if (page.endsWith('projects/index.astro')) continue;
      if (page.includes('/classifiers/')) continue;
      expect(content, `${page} missing h1`).toContain('<h1');
    }
  });

  test('form inputs have labels', () => {
    for (const page of pages) {
      if (
        page.includes('/projects/') &&
        (page.includes('app.astro') ||
          page.includes('server.astro') ||
          page.includes('client.astro'))
      )
        continue;
      if (page.includes('/classifiers/')) continue;
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

// ---- Visual regression baseline ----

describe('Visual regression baseline - component inventory', () => {
  const componentDir = resolve(ROOT, 'src/components');
  const components = readdirSync(componentDir).filter((f) => f.endsWith('.astro'));

  test('all components use design tokens or System 6 patterns', () => {
    const systemCssComponents = ['Button.astro'];
    for (const comp of components) {
      if (systemCssComponents.includes(comp)) continue;
      const content = readFileSync(join(componentDir, comp), 'utf-8');
      if (content.includes('<style>')) {
        const usesTokens = content.includes('var(--');
        const usesSystem6 = content.includes('Chicago') || content.includes('#000');
        expect(
          usesTokens || usesSystem6,
          `${comp} missing design tokens or System 6 patterns`,
        ).toBe(true);
      }
    }
  });
});

// ---- Cross-browser compatibility ----

describe('Cross-browser compatibility', () => {
  const tokensCss = readFileSync(resolve(ROOT, 'src/styles/tokens.css'), 'utf-8');
  const baseCss = readFileSync(resolve(ROOT, 'src/styles/base.css'), 'utf-8');

  test('uses standard CSS custom properties', () => {
    expect(tokensCss).toContain(':root');
    expect(tokensCss).toContain('--color-');
    expect(tokensCss).toContain('--font-');
    expect(tokensCss).toContain('--space-');
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
    expect(tokensCss).not.toContain('-webkit-');
    expect(tokensCss).not.toContain('-moz-');
  });
});

// ---- Performance budget ----

describe('Performance budget validation', () => {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));

  test('minimal dependency count', () => {
    const depCount = Object.keys(pkg.dependencies || {}).length;
    expect(depCount).toBeLessThan(15);
  });

  test('CSS uses custom properties (no utility framework)', () => {
    const baseCss = readFileSync(resolve(ROOT, 'src/styles/base.css'), 'utf-8');
    expect(baseCss).toContain('var(--');
    expect(baseCss).not.toContain('@tailwind');
  });
});

// ---- SEO extras ----

describe('SEO extras', () => {
  const layout = readFileSync(resolve(ROOT, 'src/layouts/BaseLayout.astro'), 'utf-8');

  test('meta charset is first in head', () => {
    const headContent = layout.split('<head>')[1]?.split('</head>')[0] || '';
    const charsetPos = headContent.indexOf('charset');
    expect(charsetPos).toBeLessThan(50);
  });

  test('structured data present', () => {
    expect(layout).toContain('application/ld+json');
  });
});

// ---- Mobile responsive ----

describe('Mobile responsive spot-check', () => {
  test('grid layouts use auto-fill/minmax for responsiveness', () => {
    const baseCss = readFileSync(resolve(ROOT, 'src/styles/base.css'), 'utf-8');
    expect(baseCss).toContain('auto-fill');
    expect(baseCss).toContain('minmax');
  });
});

// ---- Internal link consistency ----

describe('Internal link consistency', () => {
  const pages = getAllFiles(resolve(ROOT, 'src/pages'), '.astro');
  const layoutSrc = readFileSync(resolve(ROOT, 'src/layouts/BaseLayout.astro'), 'utf-8');

  test('all nav links point to existing pages', () => {
    const navSection = layoutSrc.split('aria-label="Main navigation"')[1]?.split('</nav>')[0] || '';
    const navLinks = navSection.match(/href="([^"{}]+)"/g) || [];
    const pageRoutes = pages.map((p) => {
      const rel = p.replace(resolve(ROOT, 'src/pages'), '');
      return (
        rel
          .replace(/\/index\.astro$/, '')
          .replace(/\.astro$/, '')
          .replace(/\[.*?\]/, ':dynamic') || '/'
      );
    });

    for (const link of navLinks) {
      const href = link.match(/href="([^"]+)"/)?.[1];
      if (href) {
        if (href.includes('.')) continue;
        const normalizedHref = href.replace(/\/$/, '') || '/';
        const exists = pageRoutes.some(
          (r) => r === normalizedHref || r.startsWith(normalizedHref + '/'),
        );
        expect(exists, `Nav link ${href} has no matching page`).toBe(true);
      }
    }
  });
});

// ---- Accessibility: meaningful alt text ----

describe('Accessibility: meaningful alt text', () => {
  test('home page project icons have descriptive alt text', () => {
    const src = readFileSync(resolve(ROOT, 'src/pages/index.astro'), 'utf-8');
    const iconImgs = src.match(/<img[^>]*class="icon-glyph"[^>]*>/g) || [];
    expect(iconImgs.length).toBeGreaterThan(0);
    for (const tag of iconImgs) {
      expect(tag, 'Icon image on home page has empty alt text').not.toMatch(/alt=""/);
    }
  });

  test('projects listing icons have descriptive alt text', () => {
    const src = readFileSync(resolve(ROOT, 'src/pages/projects/index.astro'), 'utf-8');
    const iconImgs = src.match(/<img[^>]*class="icon-glyph"[^>]*>/g) || [];
    expect(iconImgs.length).toBeGreaterThan(0);
    for (const tag of iconImgs) {
      expect(tag, 'Icon image on projects page has empty alt text').not.toMatch(/alt=""/);
    }
  });

  test('related project icons have descriptive alt text', () => {
    const src = readFileSync(resolve(ROOT, 'src/pages/projects/[slug].astro'), 'utf-8');
    const relatedIcons = src.match(/<img[^>]*class="related-icon"[^>]*>/g) || [];
    expect(relatedIcons.length).toBeGreaterThan(0);
    for (const tag of relatedIcons) {
      expect(tag, 'Related project icon has empty alt text').not.toMatch(/alt=""/);
    }
  });
});

// ---- Accessibility: color-only indicators ----

describe('Accessibility: color-only indicators', () => {
  test('server connection status dots have accessible labels', () => {
    const src = readFileSync(resolve(ROOT, 'src/components/ServerConnectModal.astro'), 'utf-8');
    // Status dots must update aria-label when connection state changes
    expect(src).toMatch(/aria-label/);
    expect(src).toMatch(/dot.*aria-label|aria-label.*dot/s);
  });
});
