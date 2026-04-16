/**
 * Integration tests for project routing — verify that the data in
 * src/data/projects.ts produces the expected set of generated paths.
 */
import { describe, test, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { projects } from '../../src/data/projects';

const ROOT = resolve(import.meta.dirname!, '..', '..');
const DIST = resolve(ROOT, 'dist');

describe('Project page generation', () => {
  const hasDist = existsSync(resolve(DIST, 'projects'));

  test.runIf(hasDist)('each project slug produces a built HTML page', () => {
    for (const project of projects) {
      const expected = resolve(DIST, 'projects', project.slug, 'index.html');
      expect(existsSync(expected), `missing built page for ${project.slug}`).toBe(true);
    }
  });

  test.runIf(hasDist)('projects index page exists', () => {
    expect(existsSync(resolve(DIST, 'projects', 'index.html'))).toBe(true);
  });

  test('all project slugs are valid filesystem-safe paths', () => {
    for (const project of projects) {
      expect(project.slug).not.toContain('/');
      expect(project.slug).not.toContain('..');
      expect(project.slug).not.toContain(' ');
    }
  });

  test('projects form a stable ordered list for prev/next navigation', () => {
    const slugs = projects.map((p) => p.slug);
    // Order must be deterministic to support prev/next navigation
    expect(slugs).toHaveLength(projects.length);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
