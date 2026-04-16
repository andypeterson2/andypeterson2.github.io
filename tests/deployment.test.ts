/**
 * Deploy configuration, preview deploy safety, and migration redirect tests.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

// ---- Preview deploy safety ----

describe('Preview deploy safety', () => {
  test('layout supports noindex for preview deploys', () => {
    const layout = readFileSync(resolve(ROOT, 'src/layouts/BaseLayout.astro'), 'utf-8');
    expect(layout).toContain('PREVIEW_DEPLOY');
    expect(layout).toContain('noindex');
    expect(layout).toContain('nofollow');
  });

  test('robots.txt exists', () => {
    expect(existsSync(resolve(ROOT, 'public/robots.txt'))).toBe(true);
  });

  test('robots.txt allows crawling', () => {
    const robots = readFileSync(resolve(ROOT, 'public/robots.txt'), 'utf-8');
    expect(robots).toContain('Allow: /');
  });
});

// ---- CI security audit ----

describe('CI security audit', () => {
  const ciYml = readFileSync(resolve(ROOT, '.github/workflows/ci.yml'), 'utf-8');

  test('npm audit does not silently swallow failures', () => {
    const auditLine = ciYml.split('\n').find((l) => l.includes('npm audit'));
    expect(auditLine).toBeDefined();
    expect(auditLine).not.toContain('|| true');
  });
});

// ---- Docker configuration ----

describe('Docker configuration', () => {
  test('Dockerfile uses multi-stage build', () => {
    const dockerfile = readFileSync(resolve(ROOT, 'Dockerfile'), 'utf-8');
    const fromLines = dockerfile.match(/^FROM /gm) || [];
    expect(fromLines.length).toBeGreaterThanOrEqual(2);
    expect(dockerfile).toContain(' AS ');
  });
});

// ---- Migration redirects ----

describe('Migration redirects', () => {
  const astroConfig = readFileSync(resolve(ROOT, 'astro.config.mjs'), 'utf-8');

  test('redirects old under-construction page', () => {
    expect(astroConfig).toContain('/underconstruction');
  });

  test('redirects /resume', () => {
    expect(astroConfig).toContain("'/resume'");
  });
});
