/**
 * The classical search measured in the same units as the quantum circuit.
 *
 * Circuit depth has a classical twin: the critical path through a Boolean circuit
 * computing the same predicate. Work and span is the pair parallel computing uses,
 * and it maps one to one — gate count against gate count, depth against depth — so
 * the two columns of the metrics table can be read against each other.
 *
 * The predicate is the one the quantum oracle implements: every line is valid when
 * the cells match one of the patterns its clue allows. Written with fan-in-2 gates a
 * pattern is an AND over the line's cells, a line is an OR over its patterns, and the
 * board is an AND over its lines. Negations cost nothing here, as usual for this
 * model, and the same convention applies to both columns.
 *
 * This measures the flat predicate. The solver the page ships prunes, so it does far
 * less work than this; its own counters are reported as themselves rather than
 * dressed up as a circuit.
 */
import { linePatterns } from './classical-solver';

export interface ClassicalCost {
  /** Fan-in-2 gates to decide one candidate grid. */
  predicateGates: number;
  /** Layers on the critical path of that decision. */
  predicateDepth: number;
  /** Gates to decide every candidate: the whole search as one circuit. */
  work: number;
  /**
   * Layers of that circuit, every candidate decided at once and the answers
   * combined. The exhaustive search has no sequential step, which is exactly what
   * makes it shallow and Grover deep.
   */
  span: number;
  /** log2 of the work, which stays finite where the work itself does not. */
  workLog2: number;
}

/** Gates and depth to combine `n` inputs with one fan-in-2 gate per join. */
function combine(n: number): { gates: number; depth: number } {
  if (n <= 1) return { gates: 0, depth: 0 };
  return { gates: n - 1, depth: Math.ceil(Math.log2(n)) };
}

/** The cost of deciding this board classically, as a Boolean circuit. */
export function classicalCost(rowClues: number[][], colClues: number[][]): ClassicalCost {
  const rows = rowClues.length;
  const cols = colClues.length;
  const cells = rows * cols;

  const lines: { length: number; clue: number[] | undefined }[] = [
    ...rowClues.map((clue) => ({ length: cols, clue })),
    ...colClues.map((clue) => ({ length: rows, clue })),
  ];

  let predicateGates = 0;
  let deepestLine = 0;
  for (const line of lines) {
    const patterns = linePatterns(line.length, line.clue);
    const and = combine(line.length);
    const or = combine(patterns.length);
    predicateGates += patterns.length * and.gates + or.gates;
    deepestLine = Math.max(deepestLine, and.depth + or.depth);
  }

  const all = combine(lines.length);
  predicateGates += all.gates;
  const predicateDepth = deepestLine + all.depth;

  // One copy of the predicate per candidate, then an OR tree over the answers. The
  // tree is `cells` deep because there are 2^cells of them.
  return {
    predicateGates,
    predicateDepth,
    work: 2 ** cells * predicateGates,
    workLog2: cells + (predicateGates > 0 ? Math.log2(predicateGates) : 0),
    span: predicateDepth + cells,
  };
}

/** A count too large to write out, given as the power of two it is closest to. */
function approxPowerOfTwo(log2: number): string {
  return `~2^${String(Math.round(log2))}`;
}

/** A gate or layer count, falling back to a power of two once it stops fitting. */
export function formatCount(value: number, log2: number): string {
  return Number.isSafeInteger(value) ? value.toLocaleString() : approxPowerOfTwo(log2);
}
