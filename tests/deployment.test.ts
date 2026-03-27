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

// ---- Migration redirects ----

describe('Migration redirects', () => {
  const astroConfig = readFileSync(resolve(ROOT, 'astro.config.mjs'), 'utf-8');

  test('redirects old nonograms page', () => {
    expect(astroConfig).toContain('/nonograms');
  });

  test('redirects old quantum video page', () => {
    expect(astroConfig).toContain('/quantumvideo');
  });

  test('redirects old under-construction page', () => {
    expect(astroConfig).toContain('/underconstruction');
  });

  test('redirects /me to /', () => {
    expect(astroConfig).toContain("'/me'");
    expect(astroConfig).toContain("'/me': '/'");
  });

  test('redirects old resume PDF', () => {
    expect(astroConfig).toContain('Current-Resume.pdf');
  });
});
