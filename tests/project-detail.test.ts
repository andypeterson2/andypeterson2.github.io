/**
 * The one showcase surface: the legacy project-detail pages are retired in
 * favor of the home timeline (anchored per slug), with the demo pages mounted
 * through DemoShell. These tests pin the retirement (redirects in both the
 * astro config and the Cloudflare _redirects) and the shell contract.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

import { projects } from '../src/data/projects';

const ROOT = resolve(import.meta.dirname!, '..');

// ---- The retired detail surface redirects to the timeline ----

describe('Legacy detail-page redirects', () => {
  const astroConfig = readFileSync(resolve(ROOT, 'astro.config.mjs'), 'utf-8');
  const cfRedirects = readFileSync(resolve(ROOT, 'public/_redirects'), 'utf-8');

  test('the detail pages are gone', () => {
    expect(existsSync(resolve(ROOT, 'src/pages/projects/[slug].astro'))).toBe(false);
    expect(existsSync(resolve(ROOT, 'src/pages/projects/index.astro'))).toBe(false);
  });

  test.each(projects.map((p) => p.slug))('%s redirects to its timeline anchor', (slug) => {
    expect(astroConfig).toContain(`'/projects/${slug}': '/#${slug}'`);
    expect(cfRedirects).toContain(`/projects/${slug} `);
    expect(cfRedirects).toContain(`/#${slug}  301`);
  });

  test('/projects redirects to the timeline section', () => {
    expect(astroConfig).toContain(`'/projects': '/#projects'`);
    expect(cfRedirects).toMatch(/^\/projects\s+\/#projects\s+301$/m);
  });

  test('no /projects/* splat that would clobber the /app/ demo pages', () => {
    expect(cfRedirects).not.toMatch(/^\/projects\/\*/m);
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

  test('the menubar points at the timeline section', () => {
    const layoutSrc = readFileSync(resolve(ROOT, 'src/layouts/BaseLayout.astro'), 'utf-8');
    expect(layoutSrc).toContain('href="/#projects"');
    expect(layoutSrc).not.toContain('href="/projects/"');
  });
});

// ---- DemoShell: the one way a demo page mounts ----

describe('DemoShell', () => {
  const shellSrc = readFileSync(resolve(ROOT, 'src/layouts/DemoShell.astro'), 'utf-8');

  test('wraps BaseLayout and emits the site-backend meta from the backend prop', () => {
    expect(shellSrc).toContain('BaseLayout');
    expect(shellSrc).toContain('name="site-backend"');
    expect(shellSrc).toContain('content={backend.service}');
  });

  test('loads the declared classic scripts in order', () => {
    expect(shellSrc).toContain('scripts.map((src) => <script is:inline src={src} />)');
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

// ---- Page scaffolding script ----

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
