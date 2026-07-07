/**
 * Navigation, footer, page structure, accessibility, SEO, and security header tests.
 * Updated for system.css monochrome architecture.
 * Removed tests for non-existent pages: about, skills, resume.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

// ---- Navigation (inline in BaseLayout) ----

describe('Nav (inline in BaseLayout)', () => {
  const layoutSrc = readFileSync(resolve(ROOT, 'src/layouts/BaseLayout.astro'), 'utf-8');

  test('has aria-label for main navigation', () => {
    expect(layoutSrc).toContain('aria-label="Main navigation"');
  });

  test('renders nav links for existing pages', () => {
    expect(layoutSrc).toContain('href="/"');
    expect(layoutSrc).toContain('href="/projects/"');
  });

  test('uses valid ARIA menubar pattern', () => {
    expect(layoutSrc).toContain('role="menubar"');
    expect(layoutSrc).toContain('role="menuitem"');
    // Make sure the old invalid values are gone
    expect(layoutSrc).not.toContain('role="menu-bar"');
    expect(layoutSrc).not.toContain('role="menu-item"');
  });

  test('nav has border bottom', () => {
    expect(layoutSrc).toContain('border-bottom');
  });
});

// ---- URL Routing ----

describe('URL Routing', () => {
  const pages = [
    'src/pages/index.astro',
    'src/pages/projects/index.astro',
    'src/pages/404.astro',
  ];

  test.each(pages)('%s exists', (page) => {
    expect(existsSync(resolve(ROOT, page))).toBe(true);
  });

  test('404 page has back-to-home link', () => {
    const notFound = readFileSync(resolve(ROOT, 'src/pages/404.astro'), 'utf-8');
    expect(notFound).toContain('Home');
    expect(notFound).toContain('href="/"');
  });
});

// ---- Skip-to-Content ----

describe('Skip-to-Content Link', () => {
  const layoutSrc = readFileSync(resolve(ROOT, 'src/layouts/BaseLayout.astro'), 'utf-8');

  test('skip link exists in layout', () => {
    expect(layoutSrc).toContain('skip-link');
    expect(layoutSrc).toContain('Skip to content');
  });

  test('skip link targets main content', () => {
    expect(layoutSrc).toContain('href="#main-content"');
    expect(layoutSrc).toContain('id="main-content"');
  });
});

// ---- Layout Structure ----

describe('Layout Structure', () => {
  const layoutSrc = readFileSync(resolve(ROOT, 'src/layouts/BaseLayout.astro'), 'utf-8');

  test('uses system.css window structure', () => {
    expect(layoutSrc).toContain('class="window');
    expect(layoutSrc).toContain('title-bar');
    expect(layoutSrc).toContain('window-pane');
  });

  test('window-pane has main-content id', () => {
    expect(layoutSrc).toContain('id="main-content"');
  });

  test('includes navigation', () => {
    expect(layoutSrc).toContain('aria-label="Main navigation"');
  });

  test('has inline footer-like content or slot for footer', () => {
    expect(layoutSrc).toContain('<slot');
  });
});

// ---- Home Page ----

describe('Home Page', () => {
  const indexSrc = readFileSync(resolve(ROOT, 'src/pages/index.astro'), 'utf-8');

  test('uses BaseLayout', () => {
    expect(indexSrc).toContain('BaseLayout');
  });

  test('has finder icon grid', () => {
    expect(indexSrc).toContain('icon-grid');
    expect(indexSrc).toContain('finder-icon');
  });

  test('links to projects', () => {
    expect(indexSrc).toContain('/projects/');
  });
});

// ---- Projects Page ----

describe('Projects Page', () => {
  const projectsSrc = readFileSync(resolve(ROOT, 'src/pages/projects/index.astro'), 'utf-8');

  test('lists multiple projects', () => {
    const projectsData = readFileSync(resolve(ROOT, 'src/data/projects.ts'), 'utf-8');
    expect(projectsData).toContain('Quantum Video Chat');
    expect(projectsData).toContain('Quantum Nonogram Solver');
    expect(projectsData).toContain('Quantum ML Classifier Platform');
  });

  test('uses finder-icon grid layout', () => {
    expect(projectsSrc).toContain('finder-icon');
    expect(projectsSrc).toContain('icon-grid');
  });

  test('uses responsive grid (via base.css)', () => {
    const baseCss = readFileSync(resolve(ROOT, 'src/styles/base.css'), 'utf-8');
    expect(baseCss).toContain('grid-template-columns');
    expect(baseCss).toContain('auto-fill');
  });

  test('projects link to detail pages', () => {
    expect(projectsSrc).toContain('/projects/');
    expect(projectsSrc).toContain('project.slug');
  });
});

// ---- Accessibility ----

describe('Accessibility Features', () => {
  test('reduced-motion in tokens CSS', () => {
    const tokensCss = readFileSync(resolve(ROOT, 'src/styles/tokens.css'), 'utf-8');
    expect(tokensCss).toContain('prefers-reduced-motion');
  });

  test('nav has ARIA attributes', () => {
    const layoutSrc = readFileSync(resolve(ROOT, 'src/layouts/BaseLayout.astro'), 'utf-8');
    expect(layoutSrc).toContain('aria-label');
  });
});

// ---- SEO ----

describe('SEO and Meta Tags', () => {
  const layoutSrc = readFileSync(resolve(ROOT, 'src/layouts/BaseLayout.astro'), 'utf-8');

  test('has meta description', () => {
    expect(layoutSrc).toContain('name="description"');
  });

  test('has viewport meta', () => {
    expect(layoutSrc).toContain('name="viewport"');
  });

  test('has dynamic page title', () => {
    expect(layoutSrc).toContain('pageTitle');
  });

  test('has lang attribute on html', () => {
    expect(layoutSrc).toContain('lang="en"');
  });

  test('has Open Graph meta tags', () => {
    expect(layoutSrc).toContain('og:type');
    expect(layoutSrc).toContain('og:title');
    expect(layoutSrc).toContain('og:description');
    expect(layoutSrc).toContain('og:url');
    expect(layoutSrc).toContain('og:site_name');
  });

  test('has Twitter card meta tags', () => {
    expect(layoutSrc).toContain('twitter:card');
    expect(layoutSrc).toContain('twitter:title');
  });

  test('has canonical URL', () => {
    expect(layoutSrc).toContain('rel="canonical"');
    expect(layoutSrc).toContain('canonicalUrl');
  });

  test('has favicon links', () => {
    expect(layoutSrc).toContain('favicon.svg');
  });

  test('favicon.svg exists in public/', () => {
    expect(existsSync(resolve(ROOT, 'public/favicon.svg'))).toBe(true);
  });

  test('fonts are vendored via system.css (no external CDN)', () => {
    expect(layoutSrc).toContain('system.css');
    expect(layoutSrc).not.toContain('fonts.googleapis.com');
  });
});

// ---- Security header policy ----
//
// This is a static GitHub Pages origin (behind Cloudflare). GH Pages ignores
// public/_headers, so those headers are a SPEC mirrored by hand into Cloudflare
// edge rules — see docs/security-headers.md. What the repo enforces on its own
// is the in-page CSP + referrer <meta>; those are the controls worth asserting
// here. (That the CSP actually ships in the built HTML is gated separately by
// scripts/check-security-headers.sh, which runs after `npm run build`.)

describe('Security header policy', () => {
  const headersSpec = readFileSync(resolve(ROOT, 'public/_headers'), 'utf-8');
  const configSrc = readFileSync(resolve(ROOT, 'astro.config.mjs'), 'utf-8');
  const layoutSrc = readFileSync(resolve(ROOT, 'src/layouts/BaseLayout.astro'), 'utf-8');

  // Enforced in-repo — these ship inside the HTML and hold with or without edge rules.
  test('CSP is configured with the load-bearing directives', () => {
    expect(configSrc).toContain('csp:');
    expect(configSrc).toContain("default-src 'self'");
    expect(configSrc).toContain("object-src 'none'");
    expect(configSrc).toContain("frame-ancestors 'none'");
    // the CV editor's gateway must stay allow-listed or the app's fetches break
    expect(configSrc).toContain('https://api.andypeterson.dev');
  });

  test('referrer policy ships as a meta tag', () => {
    expect(layoutSrc).toContain('name="referrer"');
    expect(layoutSrc).toContain('strict-origin-when-cross-origin');
  });

  // Spec-only — public/_headers is inert on GH Pages and mirrored to Cloudflare.
  // Assert it still lists the edge-only headers it's the contract for, and that
  // it's clearly labelled as a spec so no one mistakes it for a live source.
  test('_headers spec lists the edge-only headers (mirrored to Cloudflare)', () => {
    expect(headersSpec).toContain('X-Content-Type-Options: nosniff');
    expect(headersSpec).toContain('X-Frame-Options: DENY');
    expect(headersSpec).toContain('Permissions-Policy');
    expect(headersSpec).toContain('Strict-Transport-Security');
  });

  test('_headers is labelled spec-only, not a live GH Pages header source', () => {
    expect(headersSpec).toMatch(/SPEC|inert|Cloudflare/i);
  });
});
