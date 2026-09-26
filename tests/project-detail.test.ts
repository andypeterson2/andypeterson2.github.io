/**
 * The project pages: a Finder-style icon grid at /projects and a page per slug
 * under it, with the demo pages mounted through DemoShell beneath those.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

import { projects } from '../src/data/projects';

const ROOT = resolve(import.meta.dirname!, '..');

// The project pages

describe('Project pages', () => {
  const cfRedirects = readFileSync(resolve(ROOT, 'public/_redirects'), 'utf-8');

  test('the grid and the per-slug page both exist', () => {
    expect(existsSync(resolve(ROOT, 'src/pages/projects/index.astro'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'src/pages/projects/[slug].astro'))).toBe(true);
  });

  test('the grid links each project to its own page', () => {
    const grid = readFileSync(resolve(ROOT, 'src/pages/projects/index.astro'), 'utf-8');
    expect(grid).toContain('icon-grid');
    expect(grid).toContain('/projects/${project.slug}/');
  });

  test('no /projects/* splat that would clobber the pages below it', () => {
    expect(cfRedirects).not.toMatch(/^\/projects\/\*/m);
  });

  test.each(projects.map((p) => p.slug))('%s keeps its /app/ redirect untouched', (slug) => {
    // The per-slug page is real now, so only the demo deep links still redirect.
    expect(cfRedirects).not.toMatch(new RegExp(`^/projects/${slug}\\s+/#`, 'm'));
  });
});

describe('Timeline anchors', () => {
  const indexSrc = readFileSync(resolve(ROOT, 'src/pages/index.astro'), 'utf-8');
  const entrySrc = readFileSync(resolve(ROOT, 'src/components/home/TimelineEntry.astro'), 'utf-8');

  test('the timeline window carries the #projects anchor', () => {
    expect(indexSrc).toContain('id="projects"');
  });

  test('each project entry is anchored by its slug', () => {
    expect(entrySrc).toContain('id={entry.project.slug}');
  });

  test('the menubar points at the projects page', () => {
    const layoutSrc = readFileSync(resolve(ROOT, 'src/layouts/BaseLayout.astro'), 'utf-8');
    expect(layoutSrc).toContain('href="/projects/"');
  });
});

// DemoShell: the one way a demo page mounts

describe('DemoShell', () => {
  const shellSrc = readFileSync(resolve(ROOT, 'src/layouts/DemoShell.astro'), 'utf-8');

  test('wraps BaseLayout and emits the site-backend meta from the backend prop', () => {
    expect(shellSrc).toContain('BaseLayout');
    expect(shellSrc).toContain('name="site-backend"');
    expect(shellSrc).toContain('content={backend.service}');
  });

  test('carries no classic-script manifest (app code is bundled module entries)', () => {
    expect(shellSrc).not.toContain('scripts.map');
    expect(shellSrc).not.toContain('is:inline src=');
  });

  test.each([
    'src/pages/projects/ai-ml/app.astro',
    'src/pages/projects/quantum-nonogram-solver/app.astro',
    'src/pages/projects/latex-resume-editor/app.astro',
  ])('%s mounts through DemoShell', (page) => {
    const src = readFileSync(resolve(ROOT, page), 'utf-8');
    expect(src).toContain('DemoShell');
    expect(src).not.toContain('BaseLayout');
  });
});
