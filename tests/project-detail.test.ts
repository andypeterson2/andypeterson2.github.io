/**
 * WP #455: Related projects section
 * WP #456: Next/previous project navigation
 * WP #453: Architecture diagram support
 * WP #462: Technology/tag filter
 * WP #426: Page transition animations
 * WP #568: New page scaffolding script
 * WP #606: Test: Related projects and prev/next navigation
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

// ---- WP #455 / #456 / #606: Project detail pages ----

describe('Project detail page', () => {
  const detailSrc = readFileSync(
    resolve(ROOT, 'src/pages/projects/[slug].astro'),
    'utf-8',
  );

  test('detail page template exists', () => {
    expect(existsSync(resolve(ROOT, 'src/pages/projects/[slug].astro'))).toBe(true);
  });

  test('has getStaticPaths for SSG', () => {
    expect(detailSrc).toContain('getStaticPaths');
  });

  test('uses BaseLayout', () => {
    expect(detailSrc).toContain('BaseLayout');
  });

  test('has breadcrumbs with Projects parent', () => {
    expect(detailSrc).toContain('Breadcrumbs');
    expect(detailSrc).toContain("label: 'Projects'");
    expect(detailSrc).toContain("href: '/projects'");
  });

  test('shows project title as h1', () => {
    expect(detailSrc).toContain('<h1>{project.title}</h1>');
  });

  test('shows project tags', () => {
    expect(detailSrc).toContain('project.tags');
    expect(detailSrc).toContain('<Tag');
  });

  test('shows project status', () => {
    expect(detailSrc).toContain('status-indicator');
    expect(detailSrc).toContain('project.status');
  });
});

describe('Related projects section', () => {
  const detailSrc = readFileSync(
    resolve(ROOT, 'src/pages/projects/[slug].astro'),
    'utf-8',
  );

  test('related projects section exists', () => {
    expect(detailSrc).toContain('related-projects');
    expect(detailSrc).toContain('Related Projects');
  });

  test('filters related by same category', () => {
    expect(detailSrc).toContain('p.category === project.category');
  });

  test('excludes current project from related', () => {
    expect(detailSrc).toContain("p.slug !== slug");
  });

  test('limits related projects', () => {
    expect(detailSrc).toContain('.slice(0, 2)');
  });

  test('related projects are Card components', () => {
    expect(detailSrc).toContain('<Card');
  });
});

describe('Previous/Next project navigation', () => {
  const detailSrc = readFileSync(
    resolve(ROOT, 'src/pages/projects/[slug].astro'),
    'utf-8',
  );

  test('nav element with aria-label exists', () => {
    expect(detailSrc).toContain('project-nav');
    expect(detailSrc).toContain('aria-label="Project navigation"');
  });

  test('has previous link', () => {
    expect(detailSrc).toContain('prevProject');
    expect(detailSrc).toContain('Previous');
  });

  test('has next link', () => {
    expect(detailSrc).toContain('nextProject');
    expect(detailSrc).toContain('Next');
  });

  test('computes prev/next from project index', () => {
    expect(detailSrc).toContain('projectIndex > 0');
    expect(detailSrc).toContain('projectIndex < projects.length - 1');
  });
});

// ---- WP #453: Architecture diagram support ----

describe('Architecture diagram support', () => {
  const detailSrc = readFileSync(
    resolve(ROOT, 'src/pages/projects/[slug].astro'),
    'utf-8',
  );

  test('architecture section exists', () => {
    expect(detailSrc).toContain('Architecture');
  });

  test('has placeholder for diagram content', () => {
    expect(detailSrc).toContain('architecture-placeholder');
  });
});

// ---- WP #462: Technology/tag filter ----

describe('Technology tag filter', () => {
  const projectsSrc = readFileSync(
    resolve(ROOT, 'src/pages/projects/index.astro'),
    'utf-8',
  );

  test('tag filter buttons exist', () => {
    expect(projectsSrc).toContain('tag-filter-btn');
    expect(projectsSrc).toContain('data-tag');
  });

  test('project cards have data-tags attribute', () => {
    expect(projectsSrc).toContain('data-tags');
  });

  test('tag filter script handles click', () => {
    expect(projectsSrc).toContain("querySelectorAll('.tag-filter-btn')");
    expect(projectsSrc).toContain('activeTag');
  });

  test('filters combine category and tag', () => {
    expect(projectsSrc).toContain('matchesCat && matchesTag');
  });

  test('has All Tags button', () => {
    expect(projectsSrc).toContain('All Tags');
  });
});

// ---- WP #426: Page transitions ----

describe('Page transition animations', () => {
  const layoutSrc = readFileSync(
    resolve(ROOT, 'src/layouts/BaseLayout.astro'),
    'utf-8',
  );
  const baseCss = readFileSync(resolve(ROOT, 'src/styles/base.css'), 'utf-8');

  test('view-transition meta tag exists', () => {
    expect(layoutSrc).toContain('view-transition');
  });

  test('view transition animations defined', () => {
    expect(baseCss).toContain('::view-transition-old');
    expect(baseCss).toContain('::view-transition-new');
  });

  test('fade-in animation defined', () => {
    expect(baseCss).toContain('@keyframes fade-in');
  });

  test('fade-out animation defined', () => {
    expect(baseCss).toContain('@keyframes fade-out');
  });
});

// ---- WP #568: Page scaffolding script ----

describe('Page scaffolding script', () => {
  test('script exists', () => {
    expect(existsSync(resolve(ROOT, 'scripts/new-page.sh'))).toBe(true);
  });

  test('script is executable', () => {
    const scriptSrc = readFileSync(resolve(ROOT, 'scripts/new-page.sh'), 'utf-8');
    expect(scriptSrc).toContain('#!/usr/bin/env bash');
  });

  test('script generates Astro page', () => {
    const scriptSrc = readFileSync(resolve(ROOT, 'scripts/new-page.sh'), 'utf-8');
    expect(scriptSrc).toContain('BaseLayout');
    expect(scriptSrc).toContain('Breadcrumbs');
    expect(scriptSrc).toContain('.astro');
  });

  test('script validates input', () => {
    const scriptSrc = readFileSync(resolve(ROOT, 'scripts/new-page.sh'), 'utf-8');
    expect(scriptSrc).toContain('Usage:');
    expect(scriptSrc).toContain('exit 1');
  });

  test('script checks for existing file', () => {
    const scriptSrc = readFileSync(resolve(ROOT, 'scripts/new-page.sh'), 'utf-8');
    expect(scriptSrc).toContain('already exists');
  });
});
