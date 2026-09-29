import { describe, test, expect } from 'vitest';
import {
  COST_SEEDS,
  COST_TARGET,
  DEPTH_BUDGET,
  hardwareCost,
  overBudget,
} from '../src/apps/nonogram/hardware-cost';
import { buildCircuit } from '../src/apps/nonogram/circuit';

describe('Measured hardware cost', () => {
  test('answers for every board it was measured on', () => {
    for (const [rows, cols, solutions] of [
      [2, 2, 1],
      [2, 2, 2],
      [3, 3, 1],
      [3, 3, 2],
      [2, 3, 1],
    ] as const) {
      const cost = hardwareCost(rows, cols, solutions);
      expect(cost, `${String(rows)}x${String(cols)} M=${String(solutions)}`).not.toBeNull();
      expect(cost!.depth).toBeGreaterThan(0);
      expect(cost!.two_qubit).toBeGreaterThan(0);
    }
  });

  test('declines a board it never measured', () => {
    expect(hardwareCost(6, 6, 1)).toBeNull();
    // A board too big to solve has no count to look up either.
    expect(hardwareCost(3, 3, null)).toBeNull();
  });

  test('the iteration count matches the one the browser picks', () => {
    // The measurement is only meaningful at the k the page actually reports.
    for (const [rows, cols] of [
      [2, 2],
      [3, 3],
    ] as const) {
      const clues = { rows: Array.from({ length: rows }, () => [1]) };
      const circuit = buildCircuit(
        clues.rows,
        Array.from({ length: cols }, () => [1]),
      );
      const cost = hardwareCost(rows, cols, circuit.solutionCount);
      if (cost) expect(cost.iterations).toBe(circuit.iterations);
    }
  });

  test('a bigger grid costs more than a smaller one', () => {
    expect(hardwareCost(3, 3, 1)!.depth).toBeGreaterThan(hardwareCost(2, 2, 1)!.depth);
    expect(hardwareCost(2, 3, 1)!.depth).toBeGreaterThan(hardwareCost(2, 2, 1)!.depth);
  });

  test('the measured spread stays small enough for one row to stand for its class', () => {
    // The table keeps one row per grid and solution count rather than per board.
    // That only holds while boards in a class cost the same.
    for (const [rows, cols, solutions] of [
      [3, 3, 1],
      [3, 3, 2],
      [2, 3, 1],
    ] as const) {
      const cost = hardwareCost(rows, cols, solutions)!;
      expect((cost.depth_max - cost.depth) / cost.depth).toBeLessThan(0.02);
      expect(cost.boards).toBeGreaterThan(1);
    }
  });

  test('every board is far past what a device of that generation holds', () => {
    const cost = hardwareCost(3, 3, 1)!;
    expect(overBudget(cost)).toBeGreaterThan(100);
    expect(DEPTH_BUDGET).toBe(200);
  });

  test('names the device it was measured against', () => {
    expect(COST_TARGET).toContain('torino');
    expect(COST_SEEDS).toBeGreaterThan(1);
  });
});
