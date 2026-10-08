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

  test('declares the classifier backend via the DemoShell prop (deploy-based — no port)', () => {
    const src = readFileSync(resolve(ROOT, 'src/pages/projects/ai-ml/app.astro'), 'utf-8');
    expect(src).toContain("service: 'classifiers'");
    expect(src).not.toContain('port:'); // the manual host/port connect era is over
  });
});

describe('Browser model weights', () => {
  // The in-browser demo's weights must come from the classifier repo's own
  // exporters (make export-web / export-qsvm + sync-web) — never hand-rolled.
  // The provenance block is the exporter's signature; its absence means someone
  // regenerated the files outside the drift-checked pipeline.
  const load = (name: string) =>
    JSON.parse(
      readFileSync(resolve(ROOT, `public/classifiers/models/${name}.json`), 'utf-8'),
    ) as Record<string, unknown>;

  for (const name of [
    'iris',
    'mnist',
    'qsvm-iris',
    'qsvm-mnist',
    'qsvm-iris-ovo',
  ]) {
    test(`${name}.json carries exporter provenance`, () => {
      const prov = load(name).provenance as Record<string, unknown>;
      expect(prov).toBeDefined();
      expect(prov.source_repo).toBe('quantum-machine-learning');
      expect(prov.source_sha).toMatch(/^[0-9a-f]{40}$/);
      expect(prov.source_dirty).toBe(false);
      expect(prov.exported_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  }

  for (const dataset of ['iris', 'mnist']) {
    test(`${dataset}.json matches the linear infer.js contract`, () => {
      const model = load(dataset);
      expect(model.kind).toBe('linear');
      expect(model.dataset).toBe(dataset);
      expect(Array.isArray(model.weight)).toBe(true);
      expect(Array.isArray(model.bias)).toBe(true);
      const normalize = model.normalize as Record<string, unknown>;
      expect(normalize.scale).toBe(dataset === 'mnist' ? 255 : 1);
      expect(typeof model.test_accuracy).toBe('number');
    });
  }

  for (const dataset of ['iris', 'mnist']) {
    test(`qsvm-${dataset}.json matches the qsvm infer.js contract`, () => {
      const model = load(`qsvm-${dataset}`);
      expect(model.kind).toBe('qsvm');
      expect(model.dataset).toBe(dataset);
      expect(model.classes).toHaveLength(2);
      expect(model.w).toHaveLength(2);
      const map = model.map as Record<string, unknown>;
      for (const k of ['a', 'b', 'c', 'd']) expect(typeof map[k]).toBe('number');
      expect(model.features).toHaveLength(2);
      expect(['features', 'pixels']).toContain(model.raw_input);
      if (model.raw_input === 'pixels') expect(typeof model.ink_threshold).toBe('number');
      expect(typeof model.test_accuracy).toBe('number');
      const display = model.display as Record<string, unknown>;
      expect(display.label).toContain('QSVM');
      expect(typeof display.subset).toBe('string');
    });
  }

  // The three-class Iris rule is a separate kind, so none of the assertions
  // above have to be loosened to admit it.
  test('qsvm-iris-ovo.json matches the one-vs-one contract', () => {
    const model = load('qsvm-iris-ovo');
    expect(model.kind).toBe('qsvm-ovo');
    expect(model.dataset).toBe('iris');
    expect(model.classes).toEqual(['setosa', 'versicolor', 'virginica']);
    expect(model.features).toHaveLength(4);
    expect(model.raw_input).toBe('features');
    expect(model.w).toHaveLength(4);
    expect(model.targets).toHaveLength(2);
    const rules = model.rules as { pair: string[]; a: number[]; b: number[] }[];
    expect(rules).toHaveLength(3);
    for (const rule of rules) {
      expect(rule.pair).toHaveLength(2);
      expect(rule.a).toHaveLength(4);
      expect(rule.b).toHaveLength(4);
    }
    expect(typeof model.test_accuracy).toBe('number');
    expect(typeof model.cv_accuracy).toBe('number');
    const display = model.display as Record<string, unknown>;
    expect(display.label).toContain('QSVM');
  });

  // The paper's own Iris experiment keeps its slot beside the widened rule.
  test('the binary Iris rule is still the paper\u2019s two features', () => {
    const binary = load('qsvm-iris');
    expect(binary.classes).toEqual(['setosa', 'versicolor']);
    expect(binary.features).toEqual(['sepal_width', 'petal_length']);
  });
});
