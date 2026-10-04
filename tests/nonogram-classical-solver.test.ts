/**
 * The browser's own classical solver, and the check that says whether a grid answers
 * the clues — the question the oracle asks, asked in TypeScript.
 */
import { describe, test, expect } from 'vitest';
import { satisfies, solveLocal } from '../src/apps/nonogram/classical-solver';

describe('Checking a measured grid against the clues', () => {
  // The plus: the board the page opens on.
  const rows = [[1], [3], [1]];
  const cols = [[1], [3], [1]];

  test('accepts the grid the clues describe', () => {
    expect(satisfies('010111010', rows, cols)).toBe(true);
  });

  test('rejects a grid that only looks close', () => {
    // One cell short of the plus: the middle row reads 1, 1 rather than 3.
    expect(satisfies('010101010', rows, cols)).toBe(false);
    expect(satisfies('111111111', rows, cols)).toBe(false);
    expect(satisfies('000000000', rows, cols)).toBe(false);
  });

  test('rejects a grid of the wrong size rather than reading past it', () => {
    expect(satisfies('0101', rows, cols)).toBe(false);
    expect(satisfies('', rows, cols)).toBe(false);
  });

  test('an empty line is stated as a 0 or as nothing at all', () => {
    // One row of two cells, the second empty: both spellings of its clue agree.
    expect(satisfies('10', [[1]], [[1], [0]])).toBe(true);
    expect(satisfies('10', [[1]], [[1], []])).toBe(true);
    expect(satisfies('11', [[1]], [[1], [0]])).toBe(false);
  });

  test('agrees with the solver on every grid it finds', () => {
    const found = solveLocal(rows, cols);
    expect(found.solutions.length).toBeGreaterThan(0);
    for (const grid of found.solutions) expect(satisfies(grid, rows, cols)).toBe(true);
  });

  test('turns down every other grid of that size', () => {
    // 2^9 grids, one of which is the plus: the check is what tells them apart.
    let accepted = 0;
    for (let i = 0; i < 512; i++) {
      const grid = i.toString(2).padStart(9, '0');
      if (satisfies(grid, rows, cols)) accepted++;
    }
    expect(accepted).toBe(1);
  });
});

describe('The search finds every solution, not just one', () => {
  /** Every grid of this size, checked one at a time — the search this page never runs. */
  function bruteForce(rows: number[][], cols: number[][]): string[] {
    const cells = rows.length * cols.length;
    const found: string[] = [];
    for (let i = 0; i < 2 ** cells; i++) {
      const grid = i.toString(2).padStart(cells, '0');
      if (satisfies(grid, rows, cols)) found.push(grid);
    }
    return found;
  }

  /** The clues a grid states, so a board can be built from a picture. */
  function cluesOf(grid: string, rowCount: number, colCount: number) {
    const runs = (line: string) =>
      line
        .split('0')
        .filter(Boolean)
        .map((r) => r.length);
    const rows = Array.from({ length: rowCount }, (_, r) =>
      runs(grid.slice(r * colCount, (r + 1) * colCount)),
    );
    const cols = Array.from({ length: colCount }, (_, c) =>
      runs(Array.from({ length: rowCount }, (_, r) => grid[r * colCount + c]).join('')),
    );
    return { rows, cols };
  }

  test('agrees with brute force on every 3x3 board', () => {
    // 512 boards, each compared against all 512 grids: the pruning is sound only if it
    // never drops a solution, and this is what says so rather than an argument that it
    // cannot. Backtracking explores the same space; it just refuses branches where a
    // column has no pattern left, which can hold no solution.
    for (let i = 0; i < 512; i++) {
      const picture = i.toString(2).padStart(9, '0');
      const { rows, cols } = cluesOf(picture, 3, 3);
      const searched = [...solveLocal(rows, cols).solutions].sort();
      const every = bruteForce(rows, cols).sort();
      expect(searched).toEqual(every);
    }
  });

  test('agrees with brute force on rectangular boards too', () => {
    for (let i = 0; i < 64; i++) {
      const picture = i.toString(2).padStart(6, '0');
      const { rows, cols } = cluesOf(picture, 2, 3);
      expect([...solveLocal(rows, cols).solutions].sort()).toEqual(bruteForce(rows, cols).sort());
    }
  });

  test('reports every solution when a board has more than one', () => {
    // Clues that pin nothing: each row holds one cell, each column one cell.
    const rows = [[1], [1]];
    const cols = [[1], [1]];
    const found = solveLocal(rows, cols).solutions.sort();
    expect(found).toEqual(bruteForce(rows, cols).sort());
    expect(found.length).toBeGreaterThan(1);
  });
});
