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

  test.runIf(hasDist)('sitemap contains every local demo page (detail surface retired)', () => {
    const xml = readFileSync(resolve(DIST, 'sitemap-0.xml'), 'utf-8');
    for (const project of projects.filter((p) => p.appUrl?.startsWith('/'))) {
      // The demo URL is the card's appUrl (not slug-derived — the classifier
      // demo lives on the /projects/ai-ml/app/ umbrella).
      expect(xml, `missing sitemap entry for ${project.slug}`).toContain(project.appUrl!);
    }
    // The retired detail pages must NOT resurface.
    expect(xml).not.toMatch(/\/projects\/[\w-]+\/<\/loc>/);
  });

  test.runIf(hasDist)('sitemap contains core pages', () => {
    const xml = readFileSync(resolve(DIST, 'sitemap-0.xml'), 'utf-8');
    expect(xml).toMatch(/<loc>https?:\/\/[^<]+\/<\/loc>/); // home
    expect(xml).toContain('/projects/');
  });
});
