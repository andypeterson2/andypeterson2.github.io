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
} from '../src/apps/classifiers/infer';

const load = <T>(name: string): T =>
  JSON.parse(
    readFileSync(resolve(__dirname, `../public/classifiers/models/${name}.json`), 'utf-8'),
  ) as T;

const iris = load<LinearModel>('iris');
const mnist = load<LinearModel>('mnist');
const bb84 = load<LinearModel>('bb84');
const qsvmIris = load<QsvmModel>('qsvm-iris');
const qsvmBb84 = load<QsvmModel>('qsvm-bb84');
const qsvmMnist = load<QsvmModel>('qsvm-mnist');

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

  test('BB84: a low QBER is clean and a high one eavesdropped', () => {
    expect(bb84.features).toEqual(['qber', 'sifted_key_rate']);
    expect(ClassifierInfer.predict(bb84, [0.02, 0.5]).prediction).toBe('clean');
    expect(ClassifierInfer.predict(bb84, [0.25, 0.5]).prediction).toBe('eavesdropped');
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
    ['setosa', 3.5, 1.4, 1.79],
    ['versicolor', 2.8, 4.3, -0.87],
  ])('Iris %s: sepal width %s, petal length %s gives s ≈ %s', (label, f1, f2, s) => {
    const p = ClassifierInfer.predict(qsvmIris, [f1, f2]);
    expect(p.prediction).toBe(label);
    expect(p.qsvm?.s).toBeCloseTo(margin(qsvmIris, f1, f2), 12);
    expect(p.qsvm?.s).toBeCloseTo(s, 2);
    expect(p.qsvm).toMatchObject({ f1, f2 });
  });

  test('a sign classifier reports no probability', () => {
    const p = ClassifierInfer.predict(qsvmBb84, [0.02, 0.5]);
    expect(p.confidence).toBeNull();
    expect(p.probs).toBeNull();
  });

  test('the sign of s picks the class', () => {
    for (const [f1, f2] of [
      [0.02, 0.5],
      [0.25, 0.5],
    ] as const) {
      const p = ClassifierInfer.predict(qsvmBb84, [f1, f2]);
      expect(p.prediction).toBe(
        margin(qsvmBb84, f1, f2) > 0 ? qsvmBb84.classes[0] : qsvmBb84.classes[1],
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
