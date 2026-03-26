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
  const layoutSrc = readFileSync(
    resolve(ROOT, 'src/layouts/BaseLayout.astro'),
    'utf-8',
  );

  test('has aria-label for main navigation', () => {
    expect(layoutSrc).toContain('aria-label="Main navigation"');
  });

  test('renders nav links for existing pages', () => {
    expect(layoutSrc).toContain('href="/"');
    expect(layoutSrc).toContain('href="/contact"');
  });

  test('uses system.css menu-bar pattern', () => {
    expect(layoutSrc).toContain('role="menu-bar"');
    expect(layoutSrc).toContain('role="menu-item"');
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
    'src/pages/contact.astro',
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
  const layoutSrc = readFileSync(
    resolve(ROOT, 'src/layouts/BaseLayout.astro'),
    'utf-8',
  );

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
  const layoutSrc = readFileSync(
    resolve(ROOT, 'src/layouts/BaseLayout.astro'),
    'utf-8',
  );

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
  const indexSrc = readFileSync(
    resolve(ROOT, 'src/pages/index.astro'),
    'utf-8',
  );

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
  const projectsSrc = readFileSync(
    resolve(ROOT, 'src/pages/projects/index.astro'),
    'utf-8',
  );

  test('lists multiple projects', () => {
    const projectsData = readFileSync(resolve(ROOT, 'src/data/projects.ts'), 'utf-8');
    expect(projectsData).toContain('Quantum Video Chat');
    expect(projectsData).toContain('Quantum Nonogram Solver');
    expect(projectsData).toContain('Quantum Protein Kernel');
  });

  test('uses finder-icon grid layout', () => {
    expect(projectsSrc).toContain('finder-icon');
    expect(projectsSrc).toContain('icon-grid');
  });

  test('uses responsive grid', () => {
    expect(projectsSrc).toContain('grid-template-columns');
    expect(projectsSrc).toContain('auto-fill');
  });

  test('projects link to detail pages', () => {
    expect(projectsSrc).toContain('/projects/');
    expect(projectsSrc).toContain('project.slug');
  });
});

// ---- Contact Page ----

describe('Contact Page', () => {
  const contactSrc = readFileSync(
    resolve(ROOT, 'src/pages/contact.astro'),
    'utf-8',
  );

  test('has contact intro with subtitle', () => {
    expect(contactSrc).toContain('contact-intro');
    expect(contactSrc).toContain('subtitle');
  });

  test('has mailto link with pre-filled subject', () => {
    expect(contactSrc).toContain('mailto:');
    expect(contactSrc).toContain('subject=');
  });

  test('uses siteConfig for email and social links', () => {
    expect(contactSrc).toContain('siteConfig.email');
    expect(contactSrc).toContain('siteConfig.github');
    expect(contactSrc).toContain('siteConfig.linkedin');
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
  const layoutSrc = readFileSync(
    resolve(ROOT, 'src/layouts/BaseLayout.astro'),
    'utf-8',
  );

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

// ---- HTTP Security Headers ----

describe('HTTP Security Headers', () => {
  const headers = readFileSync(resolve(ROOT, 'public/_headers'), 'utf-8');

  test('sets X-Content-Type-Options', () => {
    expect(headers).toContain('X-Content-Type-Options: nosniff');
  });

  test('sets X-Frame-Options', () => {
    expect(headers).toContain('X-Frame-Options: DENY');
  });

  test('sets Referrer-Policy', () => {
    expect(headers).toContain('Referrer-Policy');
  });

  test('sets Permissions-Policy', () => {
    expect(headers).toContain('Permissions-Policy');
  });

  test('sets Content-Security-Policy', () => {
    expect(headers).toContain('Content-Security-Policy');
  });
});
