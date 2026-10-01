/**
 * What this circuit would cost on a real device.
 *
 * Measured offline against a snapshot of an IBM Heron and committed as data, so the
 * figure needs no backend and no account. The table is short because the cost turns
 * out to depend on the grid and the solution count and not on which puzzle it is:
 * the oracle carries one multi-controlled term per solution, so two boards in the
 * same class differ only by a few single-qubit gates.
 *
 * `tools/build_depth_table.py` in the nonogram repository regenerates it.
 */
import table from '../../data/nonogram-hardware-cost.json';

export interface HardwareCost {
  rows: number;
  cols: number;
  solutions: number;
  iterations: number;
  /** How many boards of this shape share this solution count. */
  boards: number;
  /** Spare qubits the synthesis pass was given, which it borrows for the big gates. */
  ancillas: number;
  depth: number;
  depth_max: number;
  gates: number;
  two_qubit: number;
  /** The same circuit compiled with nothing to borrow, six times dearer at nine cells. */
  depth_noaux: number;
  gates_noaux: number;
  two_qubit_noaux: number;
  /**
   * The same board through an oracle that tests the clues rather than holding the
   * answers: one flag qubit per line, one gate per pattern the clue allows.
   */
  depth_clue: number;
  depth_clue_max: number;
  gates_clue: number;
  two_qubit_clue: number;
  qubits_clue: number;
}

interface CostTable {
  target: string;
  qiskit: string;
  optimization_level: number;
  seeds: number;
  ancillas: number;
  worst_spread: number;
  rows: HardwareCost[];
}

const COSTS = table as CostTable;

/**
 * Layers a current Eagle or Heron device holds before decoherence dominates.
 * Matches the backend's own HW_DEPTH_BUDGET.
 */
export const DEPTH_BUDGET = 200;

export const COST_TARGET = COSTS.target;
export const COST_SEEDS = COSTS.seeds;
export const COST_OPTIMIZATION = COSTS.optimization_level;
/** How far the seeds spread, as a percentage, for the rows deep enough to mean anything. */
export const COST_SPREAD = COSTS.worst_spread;

/** The measured cost for this board, or null when it was never measured. */
export function hardwareCost(
  rows: number,
  cols: number,
  solutions: number | null,
): HardwareCost | null {
  if (solutions === null) return null;
  return (
    COSTS.rows.find((r) => r.rows === rows && r.cols === cols && r.solutions === solutions) ?? null
  );
}

/**
 * How the built circuit grows per extra cell, measured rather than derived.
 *
 * Compares this board against the next size down in the table with the same solution
 * count, so it answers the same question the `Per extra cell` row asks of the algorithm.
 * Null when there is nothing to compare against.
 */
export function measuredGrowth(rows: number, cols: number, solutions: number): string | null {
  const here = hardwareCost(rows, cols, solutions);
  if (!here) return null;
  const cells = rows * cols;
  const smaller = COSTS.rows
    .filter((r) => r.solutions === solutions && r.rows * r.cols < cells && r.two_qubit > 0)
    .sort((a, b) => b.rows * b.cols - a.rows * a.cols)
    .at(0);
  if (!smaller) return null;
  const step = cells - smaller.rows * smaller.cols;
  const perCell = (here.two_qubit / smaller.two_qubit) ** (1 / step);
  return `${perCell.toFixed(2)}x`;
}

/**
 * How the cost of one round grows per extra cell, measured against the next size down.
 *
 * The round count is fixed by the solution count and the register, so growth in the total
 * carries it along; dividing it out leaves what a single oracle-and-diffuser pass costs,
 * which is the part the compilation decides.
 */
export function measuredRoundGrowth(rows: number, cols: number, solutions: number): number | null {
  const here = hardwareCost(rows, cols, solutions);
  if (!here || here.iterations <= 0) return null;
  const cells = rows * cols;
  const smaller = COSTS.rows
    .filter(
      (r) =>
        r.solutions === solutions && r.rows * r.cols < cells && r.two_qubit > 0 && r.iterations > 0,
    )
    .sort((a, b) => b.rows * b.cols - a.rows * a.cols)
    .at(0);
  if (!smaller) return null;
  const step = cells - smaller.rows * smaller.cols;
  const perRound = here.two_qubit / here.iterations;
  const was = smaller.two_qubit / smaller.iterations;
  return (perRound / was) ** (1 / step);
}

/** How far past a device's reach this circuit is. */
export function overBudget(cost: HardwareCost): number {
  return cost.depth / DEPTH_BUDGET;
}
