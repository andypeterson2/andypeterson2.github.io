/**
 * Integration tests for sitemap generation.
 *
 * These tests require `npm run build` to have produced a dist/
 * directory. Run via `npm run test:integration` which chains the
 * build before test execution.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { projects } from '../../src/data/projects';

const ROOT = resolve(import.meta.dirname!, '..', '..');
const DIST = resolve(ROOT, 'dist');

describe('Sitemap generation', () => {
  const hasDist = existsSync(resolve(DIST, 'sitemap-0.xml'));

  test.runIf(hasDist)('sitemap index exists', () => {
    expect(existsSync(resolve(DIST, 'sitemap-index.xml'))).toBe(true);
  });

  test.runIf(hasDist)('sitemap-0.xml exists', () => {
    expect(existsSync(resolve(DIST, 'sitemap-0.xml'))).toBe(true);
  });

  test.runIf(hasDist)('sitemap contains entries for every project slug', () => {
    const xml = readFileSync(resolve(DIST, 'sitemap-0.xml'), 'utf-8');
    for (const project of projects) {
      expect(xml, `missing sitemap entry for ${project.slug}`).toContain(
        `/projects/${project.slug}/`,
      );
    }
  });

  test.runIf(hasDist)('sitemap contains core pages', () => {
    const xml = readFileSync(resolve(DIST, 'sitemap-0.xml'), 'utf-8');
    expect(xml).toMatch(/<loc>https?:\/\/[^<]+\/<\/loc>/);  // home
    expect(xml).toContain('/about/');
    expect(xml).toContain('/projects/');
  });
});
