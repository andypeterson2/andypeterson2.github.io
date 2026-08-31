/**
 * Classifiers page structure tests.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

describe('Classifiers page', () => {
  // Canonical app page (the /classifiers alias was retired — redirects to this).
  const src = readFileSync(resolve(ROOT, 'src/pages/projects/ai-ml/app.astro'), 'utf-8');

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

describe('Browser model weights', () => {
  // The in-browser demo's weights must come from the classifier repo's own
  // exporter (make export-web + sync-web) — never hand-rolled. The provenance
  // block is the exporter's signature; its absence means someone regenerated
  // the files outside the drift-checked pipeline.
  for (const dataset of ['iris', 'mnist']) {
    const model = JSON.parse(
      readFileSync(resolve(ROOT, `public/classifiers/models/${dataset}.json`), 'utf-8'),
    ) as Record<string, unknown>;

    test(`${dataset}.json carries exporter provenance`, () => {
      const prov = model.provenance as Record<string, unknown>;
      expect(prov).toBeDefined();
      expect(prov.source_repo).toBe('quantum-machine-learning');
      expect(prov.source_sha).toMatch(/^[0-9a-f]{40}$/);
      expect(prov.source_dirty).toBe(false);
      expect(prov.exported_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test(`${dataset}.json matches the infer.js contract`, () => {
      expect(model.kind).toBe('linear');
      expect(model.dataset).toBe(dataset);
      expect(Array.isArray(model.weight)).toBe(true);
      expect(Array.isArray(model.bias)).toBe(true);
      const normalize = model.normalize as Record<string, unknown>;
      expect(normalize.scale).toBe(dataset === 'mnist' ? 255 : 1);
      expect(typeof model.test_accuracy).toBe('number');
    });
  }
});
