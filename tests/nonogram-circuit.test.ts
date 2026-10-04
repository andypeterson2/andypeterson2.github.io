import { describe, test, expect } from 'vitest';
import {
  buildCircuit,
  circuitDepth,
  entanglingCount,
  expandGates,
  gateCounts,
  layerCount,
  totalGates,
  type Circuit,
  type Gate,
} from '../src/apps/nonogram/circuit';
import { solveLocal } from '../src/apps/nonogram/classical-solver';
import { groverOutcome } from '../src/apps/nonogram/grover-sim';

/**
 * A statevector simulator for the gate set the builder emits.
 *
 * H, X, Z, MCZ and MCX all have real matrices, so one array of real amplitudes is the
 * whole state. Written against the gate list rather than any export, so it tests the
 * circuit itself.
 */
function simulate(circuit: Circuit): Float64Array {
  const gates = expandGates(circuit);
  if (!gates) throw new Error('circuit too long to simulate');
  const size = 2 ** circuit.qubits;
  const amps = new Float64Array(size);
  amps[0] = 1;
  const invSqrt2 = Math.SQRT1_2;

  for (const gate of gates) {
    const bit = 1 << gate.target;
    const mask = gate.controls.reduce((m, c) => m | (1 << c), 0);
    switch (gate.name) {
      case 'x':
        for (let i = 0; i < size; i++) {
          if (i & bit) continue;
          const j = i | bit;
          const t = amps[i]!;
          amps[i] = amps[j]!;
          amps[j] = t;
        }
        break;
      case 'h':
        for (let i = 0; i < size; i++) {
          if (i & bit) continue;
          const j = i | bit;
          const a = amps[i]!;
          const b = amps[j]!;
          amps[i] = (a + b) * invSqrt2;
          amps[j] = (a - b) * invSqrt2;
        }
        break;
      case 'z':
        for (let i = 0; i < size; i++) if (i & bit) amps[i] = -amps[i]!;
        break;
      case 'mcz':
        for (let i = 0; i < size; i++) {
          if ((i & mask) === mask && i & bit) amps[i] = -amps[i]!;
        }
        break;
      case 'mcx':
        for (let i = 0; i < size; i++) {
          if ((i & mask) !== mask || i & bit) continue;
          const j = i | bit;
          const t = amps[i]!;
          amps[i] = amps[j]!;
          amps[j] = t;
        }
        break;
    }
  }
  return amps;
}

/** Total probability on the states whose cell bits spell a solution. */
function solutionProbability(
  amps: Float64Array,
  solutions: string[],
  qubits: number,
  problemQubits: number,
): number {
  const wanted = new Set(
    // Qubit i is cell i, so the index is the grid read as a little-endian integer.
    solutions.map((bits) => {
      let index = 0;
      for (let q = 0; q < problemQubits; q++) if (bits[q] === '1') index |= 1 << q;
      return index;
    }),
  );
  const cellMask = (1 << problemQubits) - 1;
  let total = 0;
  for (let i = 0; i < 2 ** qubits; i++) {
    if (wanted.has(i & cellMask)) total += amps[i]! ** 2;
  }
  return total;
}

/** [rowClues, colClues] for puzzles small enough to simulate with ancillas. */
const PUZZLES: [string, number[][], number[][]][] = [
  ['2x2 diagonals', [[1], [1]], [[1], [1]]],
  ['2x2 single solution', [[2], [0]], [[1], [1]]],
  ['2x3 bar', [[3], [0]], [[1], [1], [1]]],
  ['3x2 column', [[1], [1], [1]], [[3], [0]]],
];

describe('Circuit construction', () => {
  test('the solution oracle amplifies exactly the puzzle solutions', () => {
    for (const [name, rowClues, colClues] of PUZZLES) {
      const circuit = buildCircuit(rowClues, colClues, { oracle: 'solutions' });
      const solutions = solveLocal(rowClues, colClues).solutions;
      const amps = simulate(circuit);
      const got = solutionProbability(amps, solutions, circuit.qubits, circuit.problemQubits);
      const want = groverOutcome(
        solutions.length,
        circuit.problemQubits,
        circuit.iterations,
      ).markedProbability;
      expect(got, name).toBeCloseTo(want, 9);
    }
  });

  test('the constraint oracle amplifies the same states without being told them', () => {
    for (const [name, rowClues, colClues] of PUZZLES) {
      const circuit = buildCircuit(rowClues, colClues, { oracle: 'constraints' });
      const solutions = solveLocal(rowClues, colClues).solutions;
      const amps = simulate(circuit);
      const got = solutionProbability(amps, solutions, circuit.qubits, circuit.problemQubits);
      const want = groverOutcome(
        solutions.length,
        circuit.problemQubits,
        circuit.iterations,
      ).markedProbability;
      expect(got, name).toBeCloseTo(want, 9);
    }
  });

  test('the constraint oracle leaves every ancilla clean', () => {
    // A dirty ancilla stays entangled with the cells and kills the next iteration's
    // interference, which a single-iteration probability check would not notice.
    const circuit = buildCircuit([[1], [1]], [[1], [1]], { oracle: 'constraints' });
    expect(circuit.ancillas).toBeGreaterThan(0);
    const amps = simulate(circuit);
    const cellMask = (1 << circuit.problemQubits) - 1;
    for (let i = 0; i < 2 ** circuit.qubits; i++) {
      if (i & ~cellMask) expect(amps[i]).toBeCloseTo(0, 12);
    }
  });

  test('both oracles agree on a board with no solution', () => {
    // Clues that cannot be satisfied: nothing to amplify, so the state stays uniform.
    const rowClues = [[2], [2]];
    const colClues = [[1], [1]];
    expect(solveLocal(rowClues, colClues).solutions).toHaveLength(0);
    const circuit = buildCircuit(rowClues, colClues, { oracle: 'constraints' });
    const amps = simulate(circuit);
    const cellMask = (1 << circuit.problemQubits) - 1;
    const uniform = 1 / 2 ** circuit.problemQubits;
    for (let i = 0; i < 2 ** circuit.qubits; i++) {
      if (!(i & ~cellMask)) expect(amps[i]! ** 2).toBeCloseTo(uniform, 9);
    }
  });
});

describe('Circuit shape', () => {
  test('a board past the local solve limit still builds, from the constraints', () => {
    // 6x6 = 36 cells, far past LOCAL_MAX_CELLS, so the solutions are unknown.
    const clues = Array.from({ length: 6 }, () => [1]);
    const circuit = buildCircuit(clues, clues);
    expect(circuit.oracleKind).toBe('constraints');
    expect(circuit.solutionCount).toBeNull();
    expect(circuit.ancillas).toBe(12);
    expect(circuit.round.length).toBeGreaterThan(0);
  });

  test('a board needing more iterations than fit in memory still reports its size', () => {
    // 6x6 with one assumed solution needs ~205,000 iterations. The circuit is a
    // description, so the counts answer while the gate list cannot be built.
    const clues = Array.from({ length: 6 }, () => [1]);
    const circuit = buildCircuit(clues, clues);
    expect(circuit.iterations).toBeGreaterThan(200_000);
    expect(totalGates(circuit)).toBeGreaterThan(1e6);
    expect(circuitDepth(circuit)).toBeGreaterThan(1e6);
    expect(expandGates(circuit)).toBeNull();
  });

  test('depth counts layers, not gates', () => {
    // The opening Hadamards act on different qubits, so they share one layer.
    const circuit = buildCircuit([[1], [1]], [[1], [1]], { iterations: 0 });
    expect(circuit.prepare).toHaveLength(4);
    expect(circuitDepth(circuit)).toBe(1);
  });

  test('the multiplied depth equals the depth of the written-out circuit', () => {
    // Rounds cannot overlap, which is what lets the count stand in for a layout.
    for (const k of [1, 2, 3, 5]) {
      const circuit = buildCircuit([[1], [1]], [[1], [1]], { iterations: k });
      const gates = expandGates(circuit);
      expect(gates).not.toBeNull();
      expect(circuitDepth(circuit)).toBe(layerCount(gates!));
    }
  });

  test('depth and entangling counts grow with the iteration count', () => {
    const one = buildCircuit([[1], [1]], [[1], [1]], { iterations: 1 });
    const three = buildCircuit([[1], [1]], [[1], [1]], { iterations: 3 });
    expect(circuitDepth(three)).toBeGreaterThan(circuitDepth(one));
    expect(entanglingCount(three)).toBe(3 * entanglingCount(one));
  });

  test('gate counts add up to the gate total', () => {
    const circuit = buildCircuit([[1], [1]], [[1], [1]]);
    const counts = gateCounts(circuit);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(totalGates(circuit));
  });
});
