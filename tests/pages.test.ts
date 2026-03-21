/**
 * WP #589-#592, #595: Navigation and footer tests
 * WP #597-#600, #602, #604, #608, #610-#611, #613, #615: Page tests
 * WP #618-#623: Accessibility tests
 * WP #498-#505: Accessibility implementation verification
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

// ---- Navigation ----

describe('Nav Component', () => {
  const navSrc = readFileSync(
    resolve(ROOT, 'src/components/Nav.astro'),
    'utf-8',
  );

  test('has aria-label for main navigation', () => {
    expect(navSrc).toContain('aria-label="Main navigation"');
  });

  test('renders nav links for all pages', () => {
    expect(navSrc).toContain("'/'");
    expect(navSrc).toContain("'/about'");
    expect(navSrc).toContain("'/projects'");
    expect(navSrc).toContain("'/skills'");
    expect(navSrc).toContain("'/resume'");
    expect(navSrc).toContain("'/contact'");
  });

  test('supports active state via currentPath', () => {
    expect(navSrc).toContain('active');
    expect(navSrc).toContain('aria-current');
  });

  test('has mobile hamburger toggle', () => {
    expect(navSrc).toContain('nav-toggle');
    expect(navSrc).toContain('aria-expanded');
    expect(navSrc).toContain('aria-controls="mobile-menu"');
  });

  test('has mobile menu', () => {
    expect(navSrc).toContain('mobile-menu');
    expect(navSrc).toContain('aria-hidden');
  });

  test('toggle script manages expanded state', () => {
    expect(navSrc).toContain("setAttribute('aria-expanded'");
  });

  test('uses token variables', () => {
    expect(navSrc).toContain('var(--color-');
    expect(navSrc).toContain('var(--font-mono)');
  });

  test('nav is fixed position', () => {
    expect(navSrc).toContain('position: fixed');
  });

  test('hamburger hidden on desktop, visible on mobile', () => {
    expect(navSrc).toContain('@media (max-width: 768px)');
    expect(navSrc).toContain('.nav-links');
    expect(navSrc).toContain('display: none');
  });

  test('touch targets meet 48px minimum', () => {
    expect(navSrc).toContain('min-width: 48px');
    expect(navSrc).toContain('min-height: 48px');
  });
});

// ---- Footer ----

describe('Footer Component', () => {
  const footerSrc = readFileSync(
    resolve(ROOT, 'src/components/Footer.astro'),
    'utf-8',
  );

  test('has contentinfo role', () => {
    expect(footerSrc).toContain('role="contentinfo"');
  });

  test('displays copyright with year', () => {
    expect(footerSrc).toContain('footer-copyright');
    expect(footerSrc).toContain('getFullYear()');
  });

  test('uses siteConfig for display name', () => {
    expect(footerSrc).toContain('siteConfig.displayName');
  });

  test('has footer navigation with aria-label', () => {
    expect(footerSrc).toContain('aria-label="Footer navigation"');
  });

  test('external links have security attributes', () => {
    expect(footerSrc).toContain('rel="noopener noreferrer"');
    expect(footerSrc).toContain('target="_blank"');
  });

  test('renders GitHub, LinkedIn, and Email links from config', () => {
    expect(footerSrc).toContain('siteConfig.github');
    expect(footerSrc).toContain('siteConfig.linkedin');
    expect(footerSrc).toContain('siteConfig.email');
  });

  test('uses token variables', () => {
    expect(footerSrc).toContain('var(--color-');
    expect(footerSrc).toContain('var(--font-mono)');
  });
});

// ---- URL Routing ----

describe('URL Routing', () => {
  const pages = [
    'src/pages/index.astro',
    'src/pages/about.astro',
    'src/pages/projects/index.astro',
    'src/pages/skills.astro',
    'src/pages/resume.astro',
    'src/pages/contact.astro',
    'src/pages/404.astro',
  ];

  test.each(pages)('%s exists', (page) => {
    expect(existsSync(resolve(ROOT, page))).toBe(true);
  });

  test('404 page has back-to-home link', () => {
    const notFound = readFileSync(resolve(ROOT, 'src/pages/404.astro'), 'utf-8');
    expect(notFound).toContain('Back to Home');
    expect(notFound).toContain('href="/"');
  });
});

// ---- Skip-to-content ----

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

// ---- Layout Structure (Semantic Landmarks) ----

describe('Semantic HTML Landmarks', () => {
  const layoutSrc = readFileSync(
    resolve(ROOT, 'src/layouts/BaseLayout.astro'),
    'utf-8',
  );

  test('has header element', () => {
    expect(layoutSrc).toContain('<header>');
  });

  test('has main element with id', () => {
    expect(layoutSrc).toContain('<main id="main-content">');
  });

  test('includes Nav component in header', () => {
    expect(layoutSrc).toContain('Nav');
  });

  test('includes Footer component', () => {
    expect(layoutSrc).toContain('Footer');
  });
});

// ---- Hero Page ----

describe('Hero Section', () => {
  const heroSrc = readFileSync(
    resolve(ROOT, 'src/pages/index.astro'),
    'utf-8',
  );

  test('uses siteConfig for display name', () => {
    expect(heroSrc).toContain('siteConfig.displayName');
  });

  test('uses siteConfig for description', () => {
    expect(heroSrc).toContain('siteConfig.description');
  });

  test('has action buttons', () => {
    expect(heroSrc).toContain('View Projects');
    expect(heroSrc).toContain('Get in Touch');
  });

  test('action buttons link to pages', () => {
    expect(heroSrc).toContain('href="/projects"');
    expect(heroSrc).toContain('href="/contact"');
  });
});

// ---- About Page ----

describe('About Page', () => {
  const aboutSrc = readFileSync(
    resolve(ROOT, 'src/pages/about.astro'),
    'utf-8',
  );

  test('has page title', () => {
    expect(aboutSrc).toContain("title=\"About\"");
  });

  test('has bio section', () => {
    expect(aboutSrc).toContain('about-bio');
    expect(aboutSrc).toContain('siteConfig.displayName');
  });

  test('has timeline section', () => {
    expect(aboutSrc).toContain('timeline');
    expect(aboutSrc).toContain('timeline-item');
    expect(aboutSrc).toContain('timeline-date');
  });

  test('has research interests section', () => {
    expect(aboutSrc).toContain('Research Interests');
    expect(aboutSrc).toContain('interest-list');
  });

  test('uses token variables', () => {
    expect(aboutSrc).toContain('var(--color-');
    expect(aboutSrc).toContain('var(--font-mono)');
  });
});

// ---- Projects Page ----

describe('Projects Page', () => {
  const projectsSrc = readFileSync(
    resolve(ROOT, 'src/pages/projects/index.astro'),
    'utf-8',
  );

  test('lists multiple projects', () => {
    expect(projectsSrc).toContain('Quantum Video Chat');
    expect(projectsSrc).toContain('Quantum Nonogram Solver');
    expect(projectsSrc).toContain('Quantum Protein Kernel');
  });

  test('uses Card components', () => {
    expect(projectsSrc).toContain('Card');
  });

  test('uses responsive grid', () => {
    expect(projectsSrc).toContain('grid-template-columns');
    expect(projectsSrc).toContain('auto-fill');
  });

  test('projects have tags', () => {
    expect(projectsSrc).toContain('Tag');
    expect(projectsSrc).toContain('tags');
  });
});

// ---- Skills Page ----

describe('Skills Page', () => {
  const skillsSrc = readFileSync(
    resolve(ROOT, 'src/pages/skills.astro'),
    'utf-8',
  );

  test('has tabbed navigation', () => {
    expect(skillsSrc).toContain('role="tablist"');
    expect(skillsSrc).toContain('role="tab"');
    expect(skillsSrc).toContain('role="tabpanel"');
  });

  test('has skill categories', () => {
    expect(skillsSrc).toContain('Quantum Computing');
    expect(skillsSrc).toContain('Languages');
    expect(skillsSrc).toContain('Frameworks');
  });

  test('tab switching script exists', () => {
    expect(skillsSrc).toContain("setAttribute('aria-selected'");
  });

  test('tabs meet touch target minimum', () => {
    expect(skillsSrc).toContain('min-height: 48px');
  });
});

// ---- Resume Page ----

describe('Resume Page', () => {
  const resumeSrc = readFileSync(
    resolve(ROOT, 'src/pages/resume.astro'),
    'utf-8',
  );

  test('has download link', () => {
    expect(resumeSrc).toContain('Download PDF');
    expect(resumeSrc).toContain('resume.pdf');
  });

  test('has last-updated date', () => {
    expect(resumeSrc).toContain('last-updated');
    expect(resumeSrc).toContain('Last updated');
  });

  test('has experience section', () => {
    expect(resumeSrc).toContain('Experience');
    expect(resumeSrc).toContain('experience-item');
  });

  test('has education section', () => {
    expect(resumeSrc).toContain('Education');
  });
});

// ---- Contact Page ----

describe('Contact Page', () => {
  const contactSrc = readFileSync(
    resolve(ROOT, 'src/pages/contact.astro'),
    'utf-8',
  );

  test('has availability badge', () => {
    expect(contactSrc).toContain('availability-badge');
    expect(contactSrc).toContain('availability-dot');
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

  test('focus-visible in base CSS', () => {
    const baseCss = readFileSync(resolve(ROOT, 'src/styles/base.css'), 'utf-8');
    expect(baseCss).toContain(':focus-visible');
  });

  test('nav has ARIA labels', () => {
    const navSrc = readFileSync(resolve(ROOT, 'src/components/Nav.astro'), 'utf-8');
    expect(navSrc).toContain('aria-label');
    expect(navSrc).toContain('aria-expanded');
    expect(navSrc).toContain('aria-controls');
    expect(navSrc).toContain('aria-current');
  });

  test('footer external links have noopener', () => {
    const footerSrc = readFileSync(resolve(ROOT, 'src/components/Footer.astro'), 'utf-8');
    expect(footerSrc).toContain('rel="noopener noreferrer"');
  });

  test('skills tabs have proper ARIA roles', () => {
    const skillsSrc = readFileSync(resolve(ROOT, 'src/pages/skills.astro'), 'utf-8');
    expect(skillsSrc).toContain('aria-selected');
    expect(skillsSrc).toContain('aria-controls');
    expect(skillsSrc).toContain('aria-labelledby');
  });

  test('mobile nav links meet 48px touch target', () => {
    const navSrc = readFileSync(resolve(ROOT, 'src/components/Nav.astro'), 'utf-8');
    expect(navSrc).toContain('min-height: 48px');
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
});

// ---- External Link Security ----

describe('External Link Security', () => {
  const footerSrc = readFileSync(
    resolve(ROOT, 'src/components/Footer.astro'),
    'utf-8',
  );

  test('external links use target="_blank"', () => {
    expect(footerSrc).toContain('target="_blank"');
  });

  test('external links have rel="noopener noreferrer"', () => {
    expect(footerSrc).toContain('rel="noopener noreferrer"');
  });
});
