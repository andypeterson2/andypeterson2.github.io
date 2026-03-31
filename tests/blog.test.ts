/**
 * Custom 404 page tests.
 * Blog feature is not yet implemented. Blog-specific tests removed.
 * Updated for system.css monochrome architecture.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

// ---- Custom 404 with personality ----

describe('Custom 404 with personality', () => {
  const fourOhFour = readFileSync(resolve(ROOT, 'src/pages/404.astro'), 'utf-8');

  test('has quantum-themed messaging', () => {
    expect(fourOhFour).toContain('superposition');
  });

  test('suggests multiple navigation options', () => {
    expect(fourOhFour).toContain('error-actions');
    expect(fourOhFour).toContain('/projects');
    expect(fourOhFour).toContain('/projects');
  });

  test('404 uses system.css window with Error title', () => {
    expect(fourOhFour).toContain('window error-window');
    expect(fourOhFour).toContain('>Error<');
  });
});
