/**
 * What a visitor, a crawler or a screen reader would see: no real name or personal
 * address in the source, a social card that previews, and every control named.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { ROOT, astroFiles } from './source-files';

// Cross-identity leakage

describe('Cross-identity leakage prevention', () => {
  test('no hardcoded personal names in Astro source files', () => {
    const files = astroFiles('src');
    const namePatterns = [/Andrew Peterson/i, /andypeterson(?!\.dev)/i];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      // CDN / GitHub hosting URLs embed the GitHub handle by necessity (jsDelivr asset
      // URLs, GitHub Pages hosts, repo links) — strip them so only real name leaks in
      // user-facing copy are caught, leaving required infrastructure references alone.
      const stripped = content
        .replace(/https?:\/\/cdn\.jsdelivr\.net\/[^\s"')]+/gi, '')
        .replace(/https?:\/\/github\.com\/[^\s"')]+/gi, '')
        .replace(/[a-z0-9-]+\.github\.io/gi, '');
      for (const pattern of namePatterns) {
        expect(stripped, `Found hardcoded name in ${file}`).not.toMatch(pattern);
      }
    }
  });

  test('no hardcoded email addresses in source', () => {
    const files = astroFiles('src');
    const emailRegex =
      /[a-zA-Z0-9._%+-]+@(?![\]\\s@])(?:gmail|yahoo|hotmail|outlook|proton)\.[a-z]{2,}/i;
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const stripped = content.replace(/@\[.*?\]/g, '');
      expect(stripped, `Found hardcoded email in ${file}`).not.toMatch(emailRegex);
    }
  });

  test('site config uses environment variables', () => {
    const configSrc = readFileSync(resolve(ROOT, 'src/config/site.ts'), 'utf-8');
    expect(configSrc).toContain('import.meta.env');
    expect(configSrc).toContain('SITE_DISPLAY_NAME');
    expect(configSrc).toContain('SITE_EMAIL');
  });

  test('all display names flow through siteConfig', () => {
    const files = astroFiles('src');
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      if (content.includes('displayName') || content.includes('firstName')) {
        expect(content, `${file} uses name without siteConfig`).toContain('siteConfig');
      }
    }
  });
});

// Social card preview verification

describe('Social card preview verification', () => {
  const layoutSrc = readFileSync(resolve(ROOT, 'src/layouts/BaseLayout.astro'), 'utf-8');

  test('has Twitter card with large image', () => {
    expect(layoutSrc).toContain('twitter:card');
    expect(layoutSrc).toContain('summary_large_image');
  });

  test('supports OG image prop', () => {
    expect(layoutSrc).toContain('ogImage');
    expect(layoutSrc).toContain('og:image');
  });

  // A large-image card with no image previews as a blank box.
  test('every page gets a default preview image that exists', () => {
    expect(layoutSrc).toContain("ogImage = '/og-card.png'");
    expect(layoutSrc).toContain('twitter:image');
    expect(existsSync(resolve(ROOT, 'public/og-card.png'))).toBe(true);
  });

  test('JSON-LD sameAs holds profile URLs, not bare handles', () => {
    expect(layoutSrc).toContain('`https://github.com/${siteConfig.github}`');
    expect(layoutSrc).toContain('`https://linkedin.com/in/${siteConfig.linkedin}`');
  });

  test('titles name the person, and the 404 is noindex without a canonical', () => {
    expect(layoutSrc).toContain('siteConfig.displayName');
    expect(layoutSrc).toContain('{!noindex && <link rel="canonical"');
    const notFound = readFileSync(resolve(ROOT, 'src/pages/404.astro'), 'utf-8');
    expect(notFound).toMatch(/<BaseLayout[^>]*\bnoindex\b/);
  });

  test('robots.txt points crawlers at the sitemap', () => {
    const robots = readFileSync(resolve(ROOT, 'public/robots.txt'), 'utf-8');
    expect(robots).toMatch(/^Sitemap: https:\/\/.+\/sitemap-index\.xml$/m);
  });
});

// Screen reader navigation

describe('Screen reader navigation', () => {
  const layoutSrc = readFileSync(resolve(ROOT, 'src/layouts/BaseLayout.astro'), 'utf-8');

  test('nav has aria-label', () => {
    expect(layoutSrc).toContain('aria-label="Main navigation"');
  });
});

// Design system component usage

describe('Design system component usage', () => {
  test('pages mount through BaseLayout or DemoShell (which wraps it)', () => {
    const pages = astroFiles('src/pages').filter((f) => !f.includes('404'));
    for (const page of pages) {
      const content = readFileSync(page, 'utf-8');
      expect(content, `${page} does not use a site shell`).toMatch(/BaseLayout|DemoShell/);
    }
  });
});

// Accessibility audit

/**
 * Remove every tag, repeating until the string settles. One pass is not enough:
 * stripping the inner tag of `<<div>>` leaves `<>` behind, which is still markup.
 */
function stripTags(html: string): string {
  let out = html;
  for (let prev = ''; prev !== out;) {
    prev = out;
    out = out.replace(/<[^<>]*>/g, '');
  }
  return out;
}

describe('Accessibility audit', () => {
  // A screen reader announces a button by its label or its content, so one of the
  // two has to be there. `type=` says nothing about that, and accepting it passed
  // an empty <button type="button"></button>. Closing tags may wrap a line, and
  // decorative children are stripped before the content counts.
  test('every button carries an accessible name', () => {
    const BUTTON = /<button\b[^>]*>([\s\S]*?)<\/button\s*>/gi;
    const DECORATIVE = /<([a-z][\w-]*)\b[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/\1\s*>/gi;
    const nameless: string[] = [];
    for (const file of astroFiles('src')) {
      const content = readFileSync(file, 'utf-8');
      for (const match of content.matchAll(BUTTON)) {
        const open = match[0].slice(0, match[0].indexOf('>') + 1);
        if (open.includes('aria-hidden="true"')) continue;
        const text = stripTags(match[1].replace(DECORATIVE, '')).trim();
        if (!open.includes('aria-label') && !text) nameless.push(`${file}: ${open}`);
      }
    }
    expect(nameless).toEqual([]);
  });

  test('images have alt text patterns in components', () => {
    const files = astroFiles('src');
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const imgs = content.match(/<img[^>]*>/g) || [];
      for (const img of imgs) {
        expect(img, `Image in ${file} missing alt`).toMatch(/alt=/);
      }
    }
  });
});
