/**
 * MNIST-style preprocessing for the drawn digit: crop to the ink, fit the longer side
 * into 20px, centre by mass in 28×28. Without it a plainly drawn 7 reads as a 2 or 3,
 * because the model was trained on centred digits.
 */
import { describe, test, expect } from 'vitest';
import { preprocessDigit, isBlank } from '../src/apps/classifiers/infer';

const N = 28;
const blank = () => new Array<number>(N * N).fill(0);
function box(g: number[]) {
  let x0 = N,
    y0 = N,
    x1 = -1,
    y1 = -1;
  g.forEach((v, i) => {
    if (!v) return;
    const x = i % N,
      y = Math.floor(i / N);
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  });
  return { w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
function centre(g: number[]) {
  let m = 0,
    mx = 0,
    my = 0;
  g.forEach((v, i) => {
    m += v;
    mx += v * (i % N);
    my += v * Math.floor(i / N);
  });
  return [mx / m, my / m];
}

describe('preprocessDigit', () => {
  test('a blank grid is left alone, and isBlank says so', () => {
    const g = blank();
    expect(isBlank(g)).toBe(true);
    expect(preprocessDigit(g)).toEqual(g);
  });

  test('a small digit drawn in a corner is scaled up and centred by mass', () => {
    const g = blank();
    // a 5×8 block in the top-left corner
    for (let y = 1; y < 9; y++) for (let x = 1; x < 6; x++) g[y * N + x] = 255;
    const out = preprocessDigit(g);
    const { w, h } = box(out);
    expect(h).toBe(20); // the longer side fits the 20px box
    expect(w).toBeGreaterThanOrEqual(12);
    expect(w).toBeLessThanOrEqual(13); // aspect ratio kept (5/8 of 20)
    const [cx, cy] = centre(out);
    expect(Math.abs(cx - 13.5)).toBeLessThanOrEqual(1);
    expect(Math.abs(cy - 13.5)).toBeLessThanOrEqual(1);
  });

  test('a thin vertical stroke stays thin (no stretching to square)', () => {
    const g = blank();
    for (let y = 4; y < 24; y++) g[y * N + 20] = 255;
    const { w, h } = box(preprocessDigit(g));
    expect(h).toBe(20);
    expect(w).toBe(1);
  });

  test('output stays within 0–255 and keeps the grid size', () => {
    const g = blank();
    for (let i = 0; i < 40; i++) g[(i % 20) * N + (i % 13) + 3] = 255;
    const out = preprocessDigit(g);
    expect(out).toHaveLength(N * N);
    expect(Math.max(...out)).toBeLessThanOrEqual(255);
    expect(Math.min(...out)).toBeGreaterThanOrEqual(0);
  });
});
