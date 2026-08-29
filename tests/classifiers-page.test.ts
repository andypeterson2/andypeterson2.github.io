/**
 * Classifiers page structure tests.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

describe('Classifiers page', () => {
  // Canonical app page (the /classifiers alias was retired — redirects to this).
  const src = readFileSync(
    resolve(ROOT, 'src/pages/projects/quantum-ml-classifier/app.astro'),
    'utf-8',
  );

  test('mounts through DemoShell', () => {
    expect(src).toContain('DemoShell');
  });

  test('includes ClassifierApp component', () => {
    expect(src).toContain('ClassifierApp');
  });

  test('declares the classifier backend via the DemoShell prop', () => {
    expect(src).toContain("service: 'classifiers'");
    expect(src).toContain('port: 5001');
  });
});
