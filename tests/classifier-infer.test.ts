/**
 * The in-browser forward passes against the shipped weight files: each answer is the one
 * the exported model gives, and the QSVM's margin is the paper's rule computed by hand.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ClassifierInfer,
  preprocessDigit,
  type LinearModel,
  type QsvmModel,
  type QsvmOvoModel,
} from '../src/apps/classifiers/infer';

const load = <T>(name: string): T =>
  JSON.parse(
    readFileSync(resolve(__dirname, `../public/classifiers/models/${name}.json`), 'utf-8'),
  ) as T;

const iris = load<LinearModel>('iris');
const mnist = load<LinearModel>('mnist');
const qsvmIris = load<QsvmModel>('qsvm-iris');
const qsvmMnist = load<QsvmModel>('qsvm-mnist');
const qsvmOvo = load<QsvmOvoModel>('qsvm-iris-ovo');

/** s = w1·(a·f1 + b) + w2·(c·f2 + d), straight from the model file. */
const margin = (m: QsvmModel, f1: number, f2: number) =>
  m.w[0] * (m.map.a * f1 + m.map.b) + m.w[1] * (m.map.c * f2 + m.map.d);

describe('linear models', () => {
  test.each([
    ['setosa', [5.1, 3.5, 1.4, 0.2]],
    ['versicolor', [5.9, 2.8, 4.3, 1.3]],
    ['virginica', [6.7, 3.0, 5.6, 2.2]],
  ])('Iris: a typical %s reads as %s', (label, x) => {
    expect(ClassifierInfer.predict(iris, x).prediction).toBe(label);
  });

  test('softmax is a distribution and confidence is its top value', () => {
    const p = ClassifierInfer.predict(iris, [5.9, 2.8, 4.3, 1.3]);
    const probs = p.probs ?? [];
    expect(probs).toHaveLength(iris.classes.length);
    expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(p.confidence).toBe(Math.max(...probs));
  });

  test('MNIST: a centred vertical bar reads as a 1', () => {
    const g = new Array<number>(784).fill(0);
    for (let y = 4; y < 24; y++) g[y * 28 + 13] = g[y * 28 + 14] = 255;
    expect(ClassifierInfer.predict(mnist, preprocessDigit(g)).prediction).toBe('1');
  });
});

describe('QSVM paper recreation', () => {
  test('Iris reads its two features in the order the model file names them', () => {
    expect(qsvmIris.features).toEqual(['sepal_width', 'petal_length']);
  });

  test.each([
    ['setosa', 3.5, 1.4, 1.89],
    ['versicolor', 2.8, 4.3, -0.9],
  ])('Iris %s: sepal width %s, petal length %s gives s ≈ %s', (label, f1, f2, s) => {
    const p = ClassifierInfer.predict(qsvmIris, [f1, f2]);
    expect(p.prediction).toBe(label);
    expect(p.qsvm?.s).toBeCloseTo(margin(qsvmIris, f1, f2), 12);
    expect(p.qsvm?.s).toBeCloseTo(s, 2);
    expect(p.qsvm).toMatchObject({ f1, f2 });
  });

  test('a sign classifier reports no probability', () => {
    const p = ClassifierInfer.predict(qsvmIris, [3.5, 1.4]);
    expect(p.confidence).toBeNull();
    expect(p.probs).toBeNull();
  });

  test('the sign of s picks the class', () => {
    for (const [f1, f2] of [
      [3.5, 1.4],
      [2.8, 4.3],
    ] as const) {
      const p = ClassifierInfer.predict(qsvmIris, [f1, f2]);
      expect(p.prediction).toBe(
        margin(qsvmIris, f1, f2) > 0 ? qsvmIris.classes[0] : qsvmIris.classes[1],
      );
    }
  });

  test('MNIST features are the ink ratios of the 28×28 grid', () => {
    const g = new Array<number>(784).fill(0);
    // 60 inked cells top-left and 8 bottom-right, so both ratios are 60 / 8.
    for (let y = 2; y < 12; y++) for (let x = 3; x < 9; x++) g[y * 28 + x] = 255;
    for (let y = 16; y < 20; y++) for (let x = 18; x < 20; x++) g[y * 28 + x] = 255;
    const p = ClassifierInfer.predict(qsvmMnist, g);
    expect(p.qsvm?.f1).toBeCloseTo(60 / 8, 12);
    expect(p.qsvm?.f2).toBeCloseTo(60 / 8, 12);
    expect(p.qsvm?.s).toBeCloseTo(margin(qsvmMnist, 60 / 8, 60 / 8), 12);
  });
});

describe('QSVM one-vs-one, three species', () => {
  /** One pairwise rule's score on the unit circle, straight from the model file. */
  const pairScore = (m: QsvmOvoModel, i: number, f: number[]) => {
    const rule = m.rules[i]!;
    const v = m.w.map((_, k) => (rule.a[k] ?? 0) * (f[k] ?? 0) + (rule.b[k] ?? 0));
    const norm = Math.hypot(...v);
    return v.reduce((acc, vk, k) => acc + (m.w[k] ?? 0) * (vk / norm), 0);
  };

  test('it reads every measurement the form offers', () => {
    expect(qsvmOvo.features).toEqual([
      'sepal_length',
      'sepal_width',
      'petal_length',
      'petal_width',
    ]);
  });

  // One textbook sample per species, the third of which no binary rule in this
  // file can answer at all.
  test.each([
    ['setosa', [5.1, 3.5, 1.4, 0.2]],
    ['versicolor', [5.7, 2.8, 4.1, 1.3]],
    ['virginica', [6.5, 3.0, 5.5, 2.0]],
  ] as const)('%s is picked by the vote', (label, f) => {
    const p = ClassifierInfer.predict(qsvmOvo, [...f]);
    expect(p.prediction).toBe(label);
    expect(p.confidence).toBeNull();
    expect(p.probs).toBeNull();
    expect(p.ovo?.contests).toHaveLength(3);
    expect(p.ovo?.votes[label]).toBeGreaterThanOrEqual(2);
  });

  test('each contest is the pairwise rule computed by hand', () => {
    const f = [5.7, 2.8, 4.1, 1.3];
    const p = ClassifierInfer.predict(qsvmOvo, f);
    qsvmOvo.rules.forEach((rule, i) => {
      const contest = p.ovo?.contests[i];
      expect(contest?.pair).toEqual(rule.pair);
      expect(contest?.s).toBeCloseTo(pairScore(qsvmOvo, i, f), 12);
    });
  });

  test('the tightest contest is the narrowest one the winner won', () => {
    const p = ClassifierInfer.predict(qsvmOvo, [5.7, 2.8, 4.1, 1.3]);
    const won = p.ovo!.contests.filter((c) => c.winner === p.prediction);
    const narrowest = Math.min(...won.map((c) => Math.abs(c.lean)));
    expect(Math.abs(p.ovo!.tightest.lean)).toBeCloseTo(narrowest, 12);
  });

  test('every feature moves the answer, unlike the two-feature rule beside it', () => {
    const base = [5.8, 3.0, 4.2, 1.3];
    for (let k = 0; k < 4; k++) {
      const moved = [...base];
      moved[k] = (moved[k] ?? 0) + 1.5;
      const before = ClassifierInfer.predict(qsvmOvo, base).ovo!.contests.map((c) => c.s);
      const after = ClassifierInfer.predict(qsvmOvo, moved).ovo!.contests.map((c) => c.s);
      expect(after, `feature ${String(k)} moved nothing`).not.toEqual(before);
    }
  });

  test('one weight vector serves all three rules', () => {
    expect(qsvmOvo.w).toHaveLength(4);
    expect(qsvmOvo.rules).toHaveLength(3);
    // The widened targets keep the kernel matrix, so the alpha behind w is the
    // one the binary exports already shipped.
    const dot = (u: number[], v: number[]) => u.reduce((a, x, i) => a + x * (v[i] ?? 0), 0);
    const [t0, t1] = qsvmOvo.targets as [number[], number[]];
    expect(dot(t0, t0)).toBeCloseTo(1, 12);
    expect(dot(t1, t1)).toBeCloseTo(1, 12);
    expect(dot(t0, t1)).toBeCloseTo(0.490974, 6);
  });
});
