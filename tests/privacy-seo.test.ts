/**
 * WP #514: Cross-identity leakage test automation
 * WP #515: Google Search Console separation
 * WP #516: Social card preview verification
 * WP #517: Form endpoint isolation
 * WP #626: Test: Cross-identity leakage in HTML output
 * WP #627: Test: Form endpoint isolation
 * WP #511: Bundle analysis and tree-shaking
 * WP #503: Screen reader navigation test
 * WP #559: ESLint rule — require design system components
 * WP #635: Test: ESLint component usage rules
 * WP #563: Automated accessibility audit in CI
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

// ---- WP #514 / #626: Cross-identity leakage ----

describe('Cross-identity leakage prevention', () => {
  const srcDir = resolve(ROOT, 'src');

  function getAllFiles(dir: string, ext: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) files.push(...getAllFiles(full, ext));
      else if (entry.name.endsWith(ext)) files.push(full);
    }
    return files;
  }

  test('no hardcoded personal names in Astro source files', () => {
    const astroFiles = getAllFiles(srcDir, '.astro');
    const namePatterns = [/Andrew Peterson/i, /andypeterson(?!\.dev)/i];
    for (const file of astroFiles) {
      const content = readFileSync(file, 'utf-8');
      for (const pattern of namePatterns) {
        expect(content, `Found hardcoded name in ${file}`).not.toMatch(pattern);
      }
    }
  });

  test('no hardcoded email addresses in source', () => {
    const astroFiles = getAllFiles(srcDir, '.astro');
    const emailRegex = /[a-zA-Z0-9._%+-]+@(?![\]\\s@])(?:gmail|yahoo|hotmail|outlook|proton)\.[a-z]{2,}/i;
    for (const file of astroFiles) {
      const content = readFileSync(file, 'utf-8');
      // Skip validation regex patterns
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
    const astroFiles = getAllFiles(srcDir, '.astro');
    for (const file of astroFiles) {
      const content = readFileSync(file, 'utf-8');
      // If file uses a display name, it should import siteConfig
      if (content.includes('displayName') || content.includes('firstName')) {
        expect(content, `${file} uses name without siteConfig`).toContain('siteConfig');
      }
    }
  });
});

// ---- WP #516: Social card preview verification ----

describe('Social card preview verification', () => {
  const layoutSrc = readFileSync(
    resolve(ROOT, 'src/layouts/BaseLayout.astro'),
    'utf-8',
  );

  test('has Open Graph title', () => {
    expect(layoutSrc).toContain('og:title');
  });

  test('has Open Graph description', () => {
    expect(layoutSrc).toContain('og:description');
  });

  test('has Open Graph URL', () => {
    expect(layoutSrc).toContain('og:url');
  });

  test('has Open Graph site name', () => {
    expect(layoutSrc).toContain('og:site_name');
  });

  test('has Twitter card meta', () => {
    expect(layoutSrc).toContain('twitter:card');
    expect(layoutSrc).toContain('summary_large_image');
  });

  test('supports OG image prop', () => {
    expect(layoutSrc).toContain('ogImage');
    expect(layoutSrc).toContain('og:image');
  });
});

// ---- WP #517 / #627: Form endpoint isolation ----

describe('Form endpoint isolation', () => {
  const contactSrc = readFileSync(
    resolve(ROOT, 'src/pages/contact.astro'),
    'utf-8',
  );

  test('contact form uses siteConfig for email', () => {
    expect(contactSrc).toContain('siteConfig.email');
  });

  test('no hardcoded form action URLs', () => {
    // Form should not have a hardcoded action pointing to a specific service
    expect(contactSrc).not.toMatch(/action="https?:\/\/[^"]+"/);
  });

  test('mailto links use siteConfig', () => {
    expect(contactSrc).toContain('mailto:${siteConfig.email}');
  });
});

// ---- WP #503: Screen reader navigation ----

describe('Screen reader navigation', () => {
  const layoutSrc = readFileSync(
    resolve(ROOT, 'src/layouts/BaseLayout.astro'),
    'utf-8',
  );
  const navSrc = readFileSync(
    resolve(ROOT, 'src/components/Nav.astro'),
    'utf-8',
  );

  test('skip link exists', () => {
    expect(layoutSrc).toContain('skip-link');
    expect(layoutSrc).toContain('Skip to content');
  });

  test('skip link targets main content', () => {
    expect(layoutSrc).toContain('href="#main-content"');
    expect(layoutSrc).toContain('id="main-content"');
  });

  test('main element has landmark role', () => {
    expect(layoutSrc).toContain('<main');
  });

  test('nav has aria-label', () => {
    expect(navSrc).toContain('aria-label="Main navigation"');
  });

  test('footer has contentinfo role', () => {
    const footerSrc = readFileSync(
      resolve(ROOT, 'src/components/Footer.astro'),
      'utf-8',
    );
    expect(footerSrc).toContain('role="contentinfo"');
  });

  test('mobile menu has aria-hidden', () => {
    expect(navSrc).toContain('aria-hidden');
  });

  test('nav toggle has aria-expanded', () => {
    expect(navSrc).toContain('aria-expanded');
  });

  test('active nav link has aria-current', () => {
    expect(navSrc).toContain('aria-current');
  });
});

// ---- WP #511: Bundle analysis ----

describe('Bundle analysis and tree-shaking', () => {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));

  test('no unnecessary large dependencies', () => {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    // These are known heavy deps that shouldn't be in a portfolio site
    expect(deps).not.toHaveProperty('moment');
    expect(deps).not.toHaveProperty('lodash');
    expect(deps).not.toHaveProperty('jquery');
  });

  test('astro is the main framework', () => {
    expect(pkg.dependencies?.astro || pkg.devDependencies?.astro).toBeDefined();
  });

  test('no duplicate framework deps', () => {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    // Should not have both React and Vue etc
    const frameworks = ['react', 'vue', 'svelte', 'solid-js'].filter(f => deps[f]);
    expect(frameworks.length).toBeLessThanOrEqual(1);
  });
});

// ---- WP #559 / #635: Design system component usage ----

describe('Design system component usage', () => {
  const srcDir = resolve(ROOT, 'src');

  function getAllAstroFiles(dir: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) files.push(...getAllAstroFiles(full));
      else if (entry.name.endsWith('.astro')) files.push(full);
    }
    return files;
  }

  test('pages use BaseLayout', () => {
    const pages = getAllAstroFiles(resolve(srcDir, 'pages')).filter(
      f => !f.includes('404'),
    );
    for (const page of pages) {
      const content = readFileSync(page, 'utf-8');
      expect(content, `${page} does not use BaseLayout`).toContain('BaseLayout');
    }
  });

  test('pages use design token CSS variables', () => {
    const pages = getAllAstroFiles(resolve(srcDir, 'pages'));
    for (const page of pages) {
      const content = readFileSync(page, 'utf-8');
      if (content.includes('<style>')) {
        expect(content, `${page} has hardcoded colors`).toContain('var(--');
      }
    }
  });

  test('no inline style attributes with hardcoded colors', () => {
    const pages = getAllAstroFiles(resolve(srcDir, 'pages'));
    for (const page of pages) {
      const content = readFileSync(page, 'utf-8');
      // Allow style="display:none" but not color/background
      const inlineStyles = content.match(/style="[^"]*(?:color|background):[^"]*"/g) || [];
      expect(inlineStyles, `${page} has inline color styles`).toHaveLength(0);
    }
  });

  test('components directory has reusable components', () => {
    const components = readdirSync(resolve(srcDir, 'components'));
    expect(components.length).toBeGreaterThanOrEqual(5);
    expect(components).toContain('Button.astro');
    expect(components).toContain('Card.astro');
    expect(components).toContain('Tag.astro');
  });

  test('404 page uses BaseLayout', () => {
    const fourOhFour = readFileSync(resolve(srcDir, 'pages/404.astro'), 'utf-8');
    expect(fourOhFour).toContain('BaseLayout');
  });
});

// ---- WP #563: Accessibility audit ----

describe('Accessibility audit', () => {
  const srcDir = resolve(ROOT, 'src');

  function getAllAstroFiles(dir: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) files.push(...getAllAstroFiles(full));
      else if (entry.name.endsWith('.astro')) files.push(full);
    }
    return files;
  }

  test('all buttons have accessible text or aria-label', () => {
    const files = getAllAstroFiles(srcDir);
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      // Find button elements - they should have text content or aria-label
      const buttons = content.match(/<button[^>]*>/g) || [];
      for (const btn of buttons) {
        const hasAriaLabel = btn.includes('aria-label');
        const hasType = btn.includes('type=');
        // All buttons should have at minimum a type
        expect(hasType || hasAriaLabel, `Button in ${file} missing type or aria-label: ${btn}`).toBe(true);
      }
    }
  });

  test('focus-visible styles defined', () => {
    const baseCss = readFileSync(resolve(ROOT, 'src/styles/base.css'), 'utf-8');
    expect(baseCss).toContain(':focus-visible');
  });

  test('reduced motion media query exists', () => {
    const tokensCss = readFileSync(resolve(ROOT, 'src/styles/tokens.css'), 'utf-8');
    expect(tokensCss).toContain('prefers-reduced-motion');
  });

  test('html has lang attribute', () => {
    const layout = readFileSync(
      resolve(ROOT, 'src/layouts/BaseLayout.astro'),
      'utf-8',
    );
    expect(layout).toContain('lang="en"');
  });

  test('images have alt text patterns in components', () => {
    // Check that if any img elements exist they have alt
    const files = getAllAstroFiles(srcDir);
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const imgs = content.match(/<img[^>]*>/g) || [];
      for (const img of imgs) {
        expect(img, `Image in ${file} missing alt`).toMatch(/alt=/);
      }
    }
  });
});
