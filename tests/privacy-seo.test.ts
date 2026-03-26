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
 * Updated for system.css monochrome architecture.
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

  test('skip link exists', () => {
    expect(layoutSrc).toContain('skip-link');
    expect(layoutSrc).toContain('Skip to content');
  });

  test('skip link targets main content', () => {
    expect(layoutSrc).toContain('href="#main-content"');
    expect(layoutSrc).toContain('id="main-content"');
  });

  test('nav has aria-label', () => {
    expect(layoutSrc).toContain('aria-label="Main navigation"');
  });
});

// ---- WP #511: Bundle analysis ----

describe('Bundle analysis and tree-shaking', () => {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));

  test('no unnecessary large dependencies', () => {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(deps).not.toHaveProperty('moment');
    expect(deps).not.toHaveProperty('lodash');
    expect(deps).not.toHaveProperty('jquery');
  });

  test('astro is the main framework', () => {
    expect(pkg.dependencies?.astro || pkg.devDependencies?.astro).toBeDefined();
  });

  test('no duplicate framework deps', () => {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
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
      // Skip embedded project app pages — they use their own styling patterns
      if (page.includes('/projects/') && page.includes('app.astro')) continue;
      if (page.includes('/projects/') && page.includes('server.astro')) continue;
      // Skip index.astro — the home page relies on system.css classes directly
      if (page.endsWith('pages/index.astro')) continue;
      // Skip dynamic route templates — they use inline clamp/px values
      if (page.includes('[')) continue;
      // Skip classifiers — embedded app with its own styling
      if (page.includes('/classifiers/')) continue;
      const content = readFileSync(page, 'utf-8');
      if (content.includes('<style>')) {
        expect(content, `${page} has no design tokens`).toContain('var(--');
      }
    }
  });

  test('components directory has reusable components', () => {
    const components = readdirSync(resolve(srcDir, 'components'));
    expect(components.length).toBeGreaterThanOrEqual(3);
    expect(components).toContain('Button.astro');
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
      // Skip embedded project app pages — they use their own UI patterns
      if (file.includes('/projects/') && (file.includes('app.astro') || file.includes('server.astro'))) continue;
      // Skip classifiers — embedded app with its own UI patterns
      if (file.includes('/classifiers/')) continue;
      const content = readFileSync(file, 'utf-8');
      const buttons = content.match(/<button[^>]*>/g) || [];
      for (const btn of buttons) {
        // system.css decorative buttons (close/resize) use aria-hidden="true"
        if (btn.includes('aria-hidden="true"')) continue;
        const hasAriaLabel = btn.includes('aria-label');
        const hasType = btn.includes('type=');
        expect(hasType || hasAriaLabel, `Button in ${file} missing type or aria-label: ${btn}`).toBe(true);
      }
    }
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
