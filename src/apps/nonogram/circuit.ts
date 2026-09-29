/**
 * The Grover circuit for a puzzle, built as a gate list in the browser.
 *
 * The measurement probabilities come from a closed form, which is what keeps them
 * instant at any size. This builds the circuit itself: the thing a visitor copies,
 * and the only source of a gate count or a depth offline.
 *
 * Two oracles, because the cheap one needs the answers:
 *
 *   solutions   — one phase flip per satisfying grid. Needs the solution set, so it
 *                 stops where `solveLocal` does. No ancillas, and it is the shape
 *                 Qiskit's own synthesis arrives at.
 *   constraints — each line checks itself onto an ancilla, and a phase flip fires when
 *                 every line agrees. Polynomial in the grid, so it covers boards far
 *                 past anything solvable, and it never sees a solution.
 *
 * Qubit i is cell i in row-major order, matching the backend's v0..vn. Ancillas follow
 * the cells.
 */
import { linePatterns, solveLocal } from './classical-solver';
import { optimalIterations } from './grover-sim';

/** A gate in the abstract basis the exporters and the diagram share. */
export interface Gate {
  /** `mcz` and `mcx` carry controls; `h`, `x` and `z` do not. */
  name: 'h' | 'x' | 'z' | 'mcz' | 'mcx';
  controls: number[];
  target: number;
  /** Which part of the algorithm emitted this, for the diagram's grouping. */
  stage: 'prepare' | 'oracle' | 'diffuser';
}

export interface Circuit {
  /** The opening Hadamards. */
  prepare: Gate[];
  /** Marks the states the clues allow. */
  oracle: Gate[];
  /** Reflects about the uniform superposition. */
  diffuser: Gate[];
  /** One Grover iteration: oracle then diffuser. Repeated `iterations` times. */
  round: Gate[];
  /** Cells plus ancillas. */
  qubits: number;
  /** Cells alone — the space being searched. */
  problemQubits: number;
  ancillas: number;
  iterations: number;
  rows: number;
  cols: number;
  /** How the oracle was built, which decides what the gate counts mean. */
  oracleKind: 'solutions' | 'constraints';
  /** Satisfying grids, when they were counted; null when the board was too big. */
  solutionCount: number | null;
}

/** Every qubit a gate touches. */
export function gateQubits(gate: Gate): number[] {
  return [...gate.controls, gate.target];
}

/**
 * Layers in one run of `gates`, scheduling each as early as its qubits allow.
 *
 * Abstract layers: a multi-controlled gate counts as one, where hardware would spend
 * many. It describes the circuit as written, so it is comparable across boards but not
 * against a transpiled figure.
 */
export function layerCount(gates: Gate[]): number {
  const freeAt = new Map<number, number>();
  let depth = 0;
  for (const gate of gates) {
    const touched = gateQubits(gate);
    let layer = 0;
    for (const q of touched) layer = Math.max(layer, freeAt.get(q) ?? 0);
    for (const q of touched) freeAt.set(q, layer + 1);
    depth = Math.max(depth, layer + 1);
  }
  return depth;
}

/**
 * Depth of the whole circuit.
 *
 * Counted rather than laid out: at the sizes the editor allows the iteration count
 * reaches the hundreds of thousands, and a gate list that long cannot be held. Rounds
 * cannot overlap — the diffuser closes on a Hadamard across every cell and the next
 * oracle opens on the cells again — so multiplying is exact.
 */
export function circuitDepth(circuit: Circuit): number {
  return layerCount(circuit.prepare) + circuit.iterations * layerCount(circuit.round);
}

/** Gates by name, for the metrics table. */
export function gateCounts(circuit: Circuit): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const gate of circuit.prepare) counts[gate.name] = (counts[gate.name] ?? 0) + 1;
  for (const gate of circuit.round) {
    counts[gate.name] = (counts[gate.name] ?? 0) + circuit.iterations;
  }
  return counts;
}

/** Total gates, which past a few cells is far more than can be listed. */
export function totalGates(circuit: Circuit): number {
  return circuit.prepare.length + circuit.iterations * circuit.round.length;
}

/** Gates acting on more than one qubit — the ones hardware pays for. */
export function entanglingCount(circuit: Circuit): number {
  const perRound = circuit.round.filter((g) => g.controls.length > 0).length;
  return (
    circuit.prepare.filter((g) => g.controls.length > 0).length + circuit.iterations * perRound
  );
}

/** How many gates `expandGates` will build before it refuses. */
const MAX_EXPANDED_GATES = 200_000;

/**
 * The circuit written out gate by gate, for simulating or drawing it.
 *
 * Returns null when the run would be too long to hold, which is the normal answer for
 * any board past a few cells.
 */
export function expandGates(circuit: Circuit, limit = MAX_EXPANDED_GATES): Gate[] | null {
  if (totalGates(circuit) > limit) return null;
  const gates = [...circuit.prepare];
  for (let i = 0; i < circuit.iterations; i++) gates.push(...circuit.round);
  return gates;
}

/** Flip the phase of the one basis state written in `bits` (row-major, '0'/'1'). */
function markState(bits: string, cells: number[], stage: Gate['stage']): Gate[] {
  const zeros = cells.filter((q) => bits[q] === '0');
  const flips: Gate[] = zeros.map((q) => ({ name: 'x', controls: [], target: q, stage }));
  const last = cells[cells.length - 1];
  return [...flips, { name: 'mcz', controls: cells.slice(0, -1), target: last, stage }, ...flips];
}

/** One phase flip per satisfying grid. */
function solutionOracle(solutions: string[], cells: number[]): Gate[] {
  return solutions.flatMap((bits) => markState(bits, cells, 'oracle'));
}

/**
 * Each line checks itself onto an ancilla; a phase flip fires when all of them hold.
 *
 * A line's allowed patterns are mutually exclusive, so writing each one onto the
 * ancilla with an MCX adds up to "this line is valid" without any OR machinery. The
 * same gates run again afterwards to leave the ancillas clean, which they must be:
 * an ancilla still entangled with the cells would spoil the interference the next
 * iteration depends on.
 */
function constraintOracle(
  rowClues: number[][],
  colClues: number[][],
  rows: number,
  cols: number,
  cells: number[],
): Gate[] {
  const lines: { qubits: number[]; patterns: number[] }[] = [];
  for (let r = 0; r < rows; r++) {
    const qubits = Array.from({ length: cols }, (_, c) => r * cols + c);
    lines.push({ qubits, patterns: linePatterns(cols, rowClues[r]) });
  }
  for (let c = 0; c < cols; c++) {
    const qubits = Array.from({ length: rows }, (_, r) => r * cols + c);
    lines.push({ qubits, patterns: linePatterns(rows, colClues[c]) });
  }

  const compute: Gate[] = [];
  const ancillas: number[] = [];
  lines.forEach((line, i) => {
    const ancilla = cells.length + i;
    ancillas.push(ancilla);
    for (const pattern of line.patterns) {
      // X-conjugate the cells this pattern leaves empty, so the MCX fires on it alone.
      const zeros = line.qubits.filter((_, bit) => !((pattern >> bit) & 1));
      const flips: Gate[] = zeros.map((q) => ({
        name: 'x',
        controls: [],
        target: q,
        stage: 'oracle',
      }));
      compute.push(...flips, {
        name: 'mcx',
        controls: line.qubits,
        target: ancilla,
        stage: 'oracle',
      });
      compute.push(...flips);
    }
  });

  const last = ancillas[ancillas.length - 1];
  const flip: Gate = {
    name: 'mcz',
    controls: ancillas.slice(0, -1),
    target: last,
    stage: 'oracle',
  };
  // Uncompute in reverse so every ancilla returns to |0>.
  const uncompute = [...compute].reverse();
  return [...compute, flip, ...uncompute];
}

/** Reflect about the uniform superposition. */
function diffuser(cells: number[]): Gate[] {
  const h: Gate[] = cells.map((q) => ({ name: 'h', controls: [], target: q, stage: 'diffuser' }));
  const x: Gate[] = cells.map((q) => ({ name: 'x', controls: [], target: q, stage: 'diffuser' }));
  const last = cells[cells.length - 1];
  return [
    ...h,
    ...x,
    { name: 'mcz', controls: cells.slice(0, -1), target: last, stage: 'diffuser' },
    ...x,
    ...h,
  ];
}

export interface BuildOptions {
  /** Override the iteration count; omitted means the count that peaks. */
  iterations?: number;
  /** Force an oracle instead of letting the board's size choose. */
  oracle?: 'solutions' | 'constraints';
}

/**
 * The Grover circuit for these clues.
 *
 * The oracle is chosen by what is knowable: with the solutions in hand the direct
 * phase flip is smaller and matches the backend, and without them the constraint
 * build still works. A board with no solutions has nothing to amplify, so the
 * solution oracle would be empty, so the constraint oracle stands in.
 */
export function buildCircuit(
  rowClues: number[][],
  colClues: number[][],
  options: BuildOptions = {},
): Circuit {
  const rows = rowClues.length;
  const cols = colClues.length;
  const problemQubits = rows * cols;
  const cells = Array.from({ length: problemQubits }, (_, i) => i);

  const local = solveLocal(rowClues, colClues);
  const solutionCount = local.capped ? null : local.solutions.length;

  const usable = !local.capped && local.solutions.length > 0;
  const oracleKind = options.oracle ?? (usable ? 'solutions' : 'constraints');

  const oracleGates =
    oracleKind === 'solutions'
      ? solutionOracle(local.solutions, cells)
      : constraintOracle(rowClues, colClues, rows, cols, cells);
  const diffuserGates = diffuser(cells);

  const ancillas = oracleKind === 'constraints' ? rows + cols : 0;
  const iterations =
    options.iterations ?? optimalIterations(Math.max(1, solutionCount ?? 1), problemQubits);

  const prepare: Gate[] = cells.map((q) => ({
    name: 'h',
    controls: [],
    target: q,
    stage: 'prepare',
  }));

  return {
    prepare,
    oracle: oracleGates,
    diffuser: diffuserGates,
    round: [...oracleGates, ...diffuserGates],
    qubits: problemQubits + ancillas,
    problemQubits,
    ancillas,
    iterations,
    rows,
    cols,
    oracleKind,
    solutionCount,
  };
}
