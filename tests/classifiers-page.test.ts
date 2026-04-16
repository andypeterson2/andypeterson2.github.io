/**
 * Classifiers page structure tests.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

describe('Classifiers page', () => {
  const src = readFileSync(resolve(ROOT, 'src/pages/classifiers/index.astro'), 'utf-8');

  test('uses BaseLayout', () => {
    expect(src).toContain('BaseLayout');
  });

  test('includes ClassifierApp component', () => {
    expect(src).toContain('ClassifierApp');
  });

  test('declares site-backend meta for classifier service', () => {
    expect(src).toContain('name="site-backend"');
    expect(src).toContain('content="classifiers"');
  });

  test('specifies backend port', () => {
    expect(src).toContain('data-port="5001"');
  });

  test('has breadcrumbs linking to quantum protein kernel project', () => {
    expect(src).toContain('quantum protein kernel');
    expect(src).toContain('/projects/quantum-protein-kernel/');
  });
});
