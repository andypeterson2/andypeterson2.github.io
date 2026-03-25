/**
 * Website Phase 7: Blog & Tier 3
 * Blog feature is not yet implemented. Blog-specific tests removed.
 * Retained: Custom 404, Footer credit line tests.
 * Updated for system.css monochrome architecture.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

// ---- WP #535: Custom 404 with personality ----

describe('Custom 404 with personality', () => {
  const fourOhFour = readFileSync(resolve(ROOT, 'src/pages/404.astro'), 'utf-8');

  test('has quantum-themed messaging', () => {
    expect(fourOhFour).toContain('superposition');
  });

  test('suggests multiple navigation options', () => {
    expect(fourOhFour).toContain('error-actions');
    expect(fourOhFour).toContain('/projects');
    expect(fourOhFour).toContain('/contact');
  });

  test('404 uses system.css window with Error title', () => {
    expect(fourOhFour).toContain('window error-window');
    expect(fourOhFour).toContain('>Error<');
  });
});

// ---- WP #434: Built with credit line ----

describe('Built with credit line', () => {
  const footer = readFileSync(resolve(ROOT, 'src/components/Footer.astro'), 'utf-8');

  test('footer has details-bar with copyright', () => {
    expect(footer).toContain('details-bar footer-bar');
    expect(footer).toContain('year');
  });

  test('footer has social links', () => {
    expect(footer).toContain('siteConfig.github');
    expect(footer).toContain('siteConfig.linkedin');
  });
});
