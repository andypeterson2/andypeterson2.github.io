import { describe, test, expect } from 'vitest';
import { groverOutcome, optimalIterations, sampleCounts } from '../src/apps/nonogram/grover-sim';
import { solveLocal } from '../src/apps/nonogram/classical-solver';

/** The published closed form, written out independently of the implementation. */
function textbookP(k: number, solutions: number, searchSpace: number): number {
  return Math.sin((2 * k + 1) * Math.asin(Math.sqrt(solutions / searchSpace))) ** 2;
}

describe('Grover amplitudes', () => {
  // Pins the arithmetic. The simulation reduces to this identity, so agreement here
  // is a regression check on the implementation rather than evidence about physics.
  test('matches the closed form across iteration counts', () => {
    for (const [m, n] of [
      [1, 16],
      [2, 16],
      [1, 512],
      [3, 512],
    ]) {
      for (let k = 0; k <= 6; k++) {
        const got = groverOutcome(m!, Math.log2(n!), k).markedProbability;
        expect(got).toBeCloseTo(textbookP(k, m!, n!), 12);
      }
    }
  });

  test('the 2x2 all-filled puzzle reproduces the figures in the backend README', () => {
    // 4 qubits, one satisfying grid: 47.3% at k=1, 96.1% at k=3, 12.5% at k=5.
    expect(groverOutcome(1, 4, 1).markedProbability).toBeCloseTo(0.4728, 3);
    expect(groverOutcome(1, 4, 3).markedProbability).toBeCloseTo(0.9613, 3);
    expect(groverOutcome(1, 4, 5).markedProbability).toBeCloseTo(0.1254, 3);
  });

  test('more iterations are not better — P(k) turns back past its peak', () => {
    const peak = optimalIterations(1, 4);
    expect(groverOutcome(1, 4, peak).markedProbability).toBeGreaterThan(
      groverOutcome(1, 4, peak + 2).markedProbability,
    );
  });

  test('unsatisfiable clues leave the register uniform, however long it is turned', () => {
    const out = groverOutcome(0, 4);
    expect(out.markedProbability).toBe(0);
    expect(out.perMarked).toBe(0);
    expect(out.perUnmarked).toBeCloseTo(1 / 16, 12);
    expect(out.iterations).toBe(0);
  });

  test('a fully satisfied space cannot be missed', () => {
    const out = groverOutcome(16, 4);
    expect(out.markedProbability).toBe(1);
    expect(out.perMarked).toBeCloseTo(1 / 16, 12);
    expect(out.perUnmarked).toBe(0);
  });

  test('the probabilities account for every basis state', () => {
    const out = groverOutcome(3, 9);
    const total =
      out.perMarked * out.solutionCount + out.perUnmarked * (out.searchSpace - out.solutionCount);
    expect(total).toBeCloseTo(1, 12);
  });
});

describe('Sampled measurements', () => {
  /** A fixed cycle: the draws stay the same run to run, so the test is not flaky. */
  function cycle(values: number[]): () => number {
    let i = 0;
    return () => values[i++ % values.length]!;
  }

  const PUZZLE = { rowClues: [[2], [2]], colClues: [[2], [2]] };
  const solutions = solveLocal(PUZZLE.rowClues, PUZZLE.colClues).solutions;

  test('the puzzle this uses has exactly one solution', () => {
    expect(solutions).toEqual(['1111']);
  });

  test('every shot is accounted for', () => {
    const out = groverOutcome(solutions.length, 4);
    const counts = sampleCounts(solutions, 4, 200, out, cycle([0.1, 0.5, 0.9, 0.3]));
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(200);
  });

  test('keys are little-endian, so the renderer can reverse them into a grid', () => {
    const out = groverOutcome(solutions.length, 4);
    // rng below markedProbability every time ⇒ every shot lands on the solution.
    const counts = sampleCounts(solutions, 4, 10, out, () => 0);
    expect(Object.keys(counts)).toEqual(['1111']);

    // An asymmetric solution shows the reversal that '1111' cannot.
    const asym = sampleCounts(['1000'], 4, 10, groverOutcome(1, 4), () => 0);
    expect(Object.keys(asym)).toEqual(['0001']);
  });

  test('a miss lands on a state that is not a solution', () => {
    // rng above markedProbability ⇒ every shot misses.
    const counts = sampleCounts(solutions, 4, 25, groverOutcome(1, 4), () => 0.999);
    expect(Object.keys(counts)).not.toContain('1111');
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(25);
  });

  // With nothing marked there is no peak, and a draw would let a handful of states
  // clear the threshold by luck — a list of answers to a puzzle that has none.
  test('unsatisfiable clues report the flat distribution, not a draw of it', () => {
    const none = solveLocal([[2], [2]], [[1], [1]]).solutions;
    expect(none).toEqual([]);
    const counts = sampleCounts(none, 4, 50, groverOutcome(0, 4), cycle([0.2, 0.7]));
    // Every basis state, all equal: nothing stands out because nothing should.
    expect(Object.keys(counts)).toHaveLength(16);
    expect(new Set(Object.values(counts)).size).toBe(1);
  });

  test('a space too large to list falls back to sampling, and stays flat anyway', () => {
    const counts = sampleCounts([], 16, 500, groverOutcome(0, 16), cycle([0.2, 0.7, 0.4]));
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(500);
    expect(Object.keys(counts).length).toBeLessThan(2 ** 16);
  });

  test('the sampled top state is the solution over many shots', () => {
    const out = groverOutcome(1, 4);
    let seed = 1;
    const lcg = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const counts = sampleCounts(solutions, 4, 4000, out, lcg);
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]!;
    expect(top[0]).toBe('1111');
    expect(top[1] / 4000).toBeGreaterThan(0.5);
  });
});
