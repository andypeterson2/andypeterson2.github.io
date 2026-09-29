import { describe, test, expect } from 'vitest';
import { classicalCost, formatCount } from '../src/apps/nonogram/classical-cost';
import { hardwareCost } from '../src/apps/nonogram/hardware-cost';
import { solveLocal } from '../src/apps/nonogram/classical-solver';
import { optimalIterations } from '../src/apps/nonogram/grover-sim';

/** The board the hardware table was measured on: alternating cells. */
function alternating(rows: number, cols: number): [number[][], number[][]] {
  const grid: number[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ((r * cols + c) % 2 === 0 ? 1 : 0)),
  );
  const clue = (cells: number[]): number[] => {
    const out: number[] = [];
    let run = 0;
    for (const cell of cells) {
      if (cell) run++;
      else if (run) {
        out.push(run);
        run = 0;
      }
    }
    if (run) out.push(run);
    return out.length ? out : [0];
  };
  return [grid.map(clue), Array.from({ length: cols }, (_, c) => clue(grid.map((row) => row[c]!)))];
}

describe('Classical cost in circuit terms', () => {
  test('reproduces the figures measured against the backend encoder', () => {
    // Computed independently in Python over the backend's own clue encoder.
    const cases: [number, number, number, number, number][] = [
      // rows, cols, predicate gates, predicate depth, span
      [2, 2, 11, 4, 8],
      [2, 3, 23, 7, 13],
      [3, 3, 29, 7, 16],
    ];
    for (const [rows, cols, gates, depth, span] of cases) {
      const [rc, cc] = alternating(rows, cols);
      const cost = classicalCost(rc, cc);
      expect(cost.predicateGates, `${String(rows)}x${String(cols)} gates`).toBe(gates);
      expect(cost.predicateDepth, `${String(rows)}x${String(cols)} depth`).toBe(depth);
      expect(cost.span, `${String(rows)}x${String(cols)} span`).toBe(span);
    }
  });

  test('work is one predicate per candidate', () => {
    const [rc, cc] = alternating(3, 3);
    const cost = classicalCost(rc, cc);
    expect(cost.work).toBe(2 ** 9 * cost.predicateGates);
    expect(cost.work).toBe(14848);
  });

  test('span stays shallow where work explodes', () => {
    // The point of the comparison: brute force spends its cost on width.
    const [rc, cc] = alternating(6, 6);
    const cost = classicalCost(rc, cc);
    expect(cost.span).toBeLessThan(60);
    expect(cost.workLog2).toBeGreaterThan(36);
  });

  test('a count past exact integers is given as a power of two', () => {
    const [rc, cc] = alternating(8, 8);
    const cost = classicalCost(rc, cc);
    // The body face has no approximation sign, so a rounded exponent says so in words.
    expect(formatCount(cost.work, cost.workLog2)).toMatch(/^(about )?2\^\d+$/);
    expect(formatCount(2 ** 64, 64)).toBe('2^64');
    expect(formatCount(2 ** 64, 63.4)).toBe('about 2^63');
    expect(formatCount(1234, 10)).toBe('1,234');
  });

  test('Grover is deeper than the whole classical search is wide', () => {
    // The headline the two rows exist to show.
    const [rc, cc] = alternating(3, 3);
    const cost = classicalCost(rc, cc);
    const quantum = hardwareCost(3, 3, 1)!;
    expect(quantum.depth).toBeGreaterThan(cost.work);
    expect(quantum.depth / cost.span).toBeGreaterThan(1000);
  });
});

describe('What the backtracker actually does', () => {
  test('counts the placements it tried, not the grids it could have', () => {
    // The plus sign: three row placements at r=0, one at r=1, three at r=2. Column
    // pruning is why it is seven and not the nine the row clues alone allow.
    const rows = [[1], [1, 1], [1]];
    const cols = [[1], [1, 1], [1]];
    const result = solveLocal(rows, cols);
    expect(result.clueChecks).toBe(7);
    expect(result.candidates).toBe(9);
    expect(result.solutions).toHaveLength(1);
  });

  test('asks the clues fewer questions than Grover asks its oracle', () => {
    // The headline of the Clue checks row: a nonogram is not unstructured search.
    const rows = [[1], [1, 1], [1]];
    const cols = [[1], [1, 1], [1]];
    const local = solveLocal(rows, cols);
    const grover = optimalIterations(local.solutions.length, 9);
    expect(local.clueChecks).toBeLessThan(grover);
  });

  test('a board past the local limit reports no counts rather than wrong ones', () => {
    const clues = Array.from({ length: 6 }, () => [1]);
    const capped = solveLocal(clues, clues);
    expect(capped.capped).toBe(true);
    expect(capped.clueChecks).toBe(0);
    expect(capped.candidates).toBe(0);
  });
});
