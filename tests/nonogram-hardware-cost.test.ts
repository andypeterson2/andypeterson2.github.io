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

  test('every figure is one run, and the range it came from is recorded', () => {
    // A figure is the shallowest run of its arm, so it has to sit inside the range the
    // arm covered; a range that did not contain its own headline would mean the two
    // were computed from different sweeps.
    for (const [rows, cols, solutions] of [
      [3, 3, 1],
      [3, 3, 2],
      [2, 3, 1],
    ] as const) {
      const cost = hardwareCost(rows, cols, solutions)!;
      expect(cost.depth).toBe(cost.depth_range[0]);
      expect(cost.two_qubit).toBeGreaterThanOrEqual(cost.two_qubit_range[0]);
      expect(cost.two_qubit).toBeLessThanOrEqual(cost.two_qubit_range[1]);
      expect(cost.boards).toBeGreaterThan(1);
    }
  });

  test('borrowing a qubit costs the seed its reliability', () => {
    // The ancilla-free decomposition dominates everything around it, so the layout the
    // seed picks barely shows; the borrowed-qubit arm is a draw from a far wider spread.
    const cost = hardwareCost(3, 3, 1)!;
    const span = (range: number[]) => ((range[1] ?? 0) - (range[0] ?? 0)) / (range[0] ?? 1);
    expect(span(cost.two_qubit_range)).toBeGreaterThan(span(cost.two_qubit_noaux_range));
  });

  test('every board is far past what a device of that generation holds', () => {
    // Even compiled with spare qubits to borrow, and with an oracle that already holds
    // the answers, the circuit asks for tens of times the depth a device runs.
    const cost = hardwareCost(3, 3, 1)!;
    expect(overBudget(cost)).toBeGreaterThan(10);
    expect(DEPTH_BUDGET).toBe(200);
  });

  test('names the device it was measured against', () => {
    expect(COST_TARGET).toContain('torino');
    expect(COST_SEEDS).toBeGreaterThan(1);
  });
});
