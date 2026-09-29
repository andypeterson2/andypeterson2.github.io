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
