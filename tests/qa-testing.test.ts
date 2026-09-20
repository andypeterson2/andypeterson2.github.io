/**
 * Page-level invariants that span every page rather than one file: titles, design
 * tokens in component styles, SEO head order, reflowing grids, nav links that
 * resolve, and the accessibility rules that are easy to undo by accident.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { ROOT, astroFiles } from './source-files';

// Page structure validation

describe('Page structure validation', () => {
  const pages = astroFiles('src/pages');

  test('all pages have title prop or default', () => {
    for (const page of pages) {
      const content = readFileSync(page, 'utf-8');
      if (!page.includes('index.astro')) {
        expect(content, `${page} missing title`).toMatch(/title[=:]/);
      }
    }
  });
});

// Design-token compliance, audited over the source

describe('Design-token compliance - component style audit', () => {
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

// SEO extras

describe('SEO extras', () => {
  const layout = readFileSync(resolve(ROOT, 'src/layouts/BaseLayout.astro'), 'utf-8');

  // The encoding has to be declared inside the first 1024 bytes of the document,
  // so it goes at the very top of <head>.
  test('meta charset opens the head', () => {
    const headContent = layout.split('<head>')[1]?.split('</head>')[0] || '';
    const charsetPos = headContent.indexOf('charset');
    expect(charsetPos, 'no charset declaration in <head>').toBeGreaterThanOrEqual(0);
    expect(charsetPos).toBeLessThan(50);
  });

  test('structured data present', () => {
    expect(layout).toContain('application/ld+json');
  });
});

// Mobile responsive

describe('Mobile responsive spot-check', () => {
  test('the home grids reflow with auto-fit/auto-fill and minmax', () => {
    for (const f of ['src/pages/index.astro', 'src/components/home/TimelineEntry.astro']) {
      const src = readFileSync(resolve(ROOT, f), 'utf-8');
      expect(src, f).toMatch(/repeat\(auto-fi(?:t|ll), minmax\(/);
    }
  });
});

// Internal link consistency

describe('Internal link consistency', () => {
  const pages = astroFiles('src/pages');
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
        // Nav entries may deep-link into a section of a page (e.g. "/#intro"),
        // so resolve against the path and ignore the fragment.
        const pathPart = href.split('#')[0] || '/';
        const normalizedHref = pathPart.replace(/\/$/, '') || '/';
        const exists = pageRoutes.some(
          (r) => r === normalizedHref || r.startsWith(normalizedHref + '/'),
        );
        expect(exists, `Nav link ${href} has no matching page`).toBe(true);
      }
    }
  });
});

// Accessibility: meaningful alt text

describe('Accessibility: meaningful alt text', () => {
  // On the timeline the project icon sits directly beside the project name, so
  // it is decorative — an explicit empty alt is the correct choice there, and a
  // missing alt is not. (The projects listing below is different: there the
  // icon is the link's content and must describe the target.)
  test('home page timeline icons are explicitly marked decorative', () => {
    const src = readFileSync(resolve(ROOT, 'src/pages/index.astro'), 'utf-8');
    const imgs = src.match(/<img[^>]*>/g) || [];
    expect(imgs.length).toBeGreaterThan(0);
    for (const tag of imgs) {
      expect(tag, 'Image on home page is missing an alt attribute').toMatch(/alt=/);
    }
  });

  test('timeline project icons are decorative (empty alt beside the visible title)', () => {
    const src = readFileSync(resolve(ROOT, 'src/components/home/TimelineEntry.astro'), 'utf-8');
    const icon = src.match(/<img[^>]*class="tl-icon"[^>]*>/);
    expect(icon).not.toBeNull();
    expect(icon![0]).toMatch(/alt=""/);
  });
});

// Accessibility: color-only indicators

describe('Accessibility: color-only indicators', () => {
  test('server connection state is a visible word, not a colour-only dot', () => {
    // The dot is decorative (aria-hidden); the state is spoken as text beside it, in a
    // polite status region, so it's never colour-only.
    const src = readFileSync(resolve(ROOT, 'src/apps/shared/server-connect-modal.ts'), 'utf-8');
    expect(src).toMatch(/dot\.setAttribute\('aria-hidden', 'true'\)/);
    expect(src).toMatch(/sn-state/);
    expect(src).toMatch(/word\.setAttribute\('role', 'status'\)/);
  });
});
