/**
 * Client-side classical nonogram solver — the offline demo tier.
 *
 * Depth-first search over line domains: enumerate each line's legal bit patterns, then
 * choose one row pattern per level, filtering every column's surviving patterns by the
 * bit just placed and abandoning the branch when a column has none left. Forward
 * checking on the columns, no propagation between unassigned ones, and none of the
 * overlap and edge deductions a dedicated line solver applies.
 *
 * This is not the backend's search. `classical_solve` there tests all 2^cells grids
 * against the clauses, which is the `Exhaustive` column of the comparison table; this
 * is the `Backtracking` column. Only the pattern generator is shared.
 *
 * Returns each solving grid as a row-major "0"/"1" string ("1" = filled). Exponential,
 * so bounded to LOCAL_MAX_CELLS.
 */

/** Upper bound on cells solved in-browser (5×5). Keeps solves instant. */
export const LOCAL_MAX_CELLS = 25;

/**
 * All valid bit patterns for one line, as integers where bit c (0 = leftmost
 * cell) is set when cell c is filled. Faithful port of the backend's
 * `_generate_patterns`: recursively place each block at every legal start.
 * A clue of [0] or [] (an empty line) yields the single all-empty pattern.
 */
export function linePatterns(len: number, clue: number[] | undefined): number[] {
  const blocks = !clue || clue.length === 0 || (clue.length === 1 && clue[0] === 0) ? [] : clue;
  if (blocks.length === 0) return [0];

  const results: number[] = [];
  (function place(blockIdx: number, start: number, pattern: number): void {
    if (blockIdx === blocks.length) {
      results.push(pattern);
      return;
    }
    const blockLen = blocks[blockIdx];
    const remaining = blocks.slice(blockIdx + 1);
    // Cells the remaining blocks still need: their lengths + one gap each.
    const minRemaining = remaining.reduce((a, b) => a + b, 0) + remaining.length;
    for (let pos = start; pos <= len - blockLen - minRemaining; pos++) {
      let bits = 0;
      for (let b = 0; b < blockLen; b++) bits |= 1 << (pos + b);
      place(blockIdx + 1, pos + blockLen + 1, pattern | bits);
    }
  })(0, 0, 0);
  return results;
}

/** The runs of filled cells along one line, which is what a clue states. */
function runsOf(line: boolean[]): number[] {
  const runs: number[] = [];
  let count = 0;
  for (const filled of line) {
    if (filled) count++;
    else if (count) {
      runs.push(count);
      count = 0;
    }
  }
  if (count) runs.push(count);
  return runs;
}

/** A clue as the check compares it: the runs it states, with the empty line's 0 dropped. */
function statedRuns(clue: number[] | undefined): number[] {
  return (clue ?? []).filter((n) => n > 0);
}

/**
 * Whether a grid satisfies the clues — the oracle's own question, asked classically.
 *
 * This is what makes a measured bitstring a solution or not. It costs one pass over the
 * grid, which is why a candidate is checked rather than inferred from how often it came
 * up: a run concentrates probability so that few shots are needed, and confirming what
 * came back was always cheap.
 */
export function satisfies(bits: string, rowClues: number[][], colClues: number[][]): boolean {
  const rows = rowClues.length;
  const cols = colClues.length;
  if (bits.length !== rows * cols) return false;
  const at = (r: number, c: number): boolean => bits[r * cols + c] === '1';

  const same = (a: number[], b: number[]): boolean =>
    a.length === b.length && a.every((n, i) => n === b[i]);

  for (let r = 0; r < rows; r++) {
    const line = Array.from({ length: cols }, (_, c) => at(r, c));
    if (!same(runsOf(line), statedRuns(rowClues[r]))) return false;
  }
  for (let c = 0; c < cols; c++) {
    const line = Array.from({ length: rows }, (_, r) => at(r, c));
    if (!same(runsOf(line), statedRuns(colClues[c]))) return false;
  }
  return true;
}

/** Render the chosen per-row bitmasks as a row-major "0"/"1" grid string. */
function gridString(chosenRowPats: number[], rows: number, cols: number): string {
  let s = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      s += ((chosenRowPats[r] ?? 0) >> c) & 1 ? '1' : '0';
    }
  }
  return s;
}

export interface LocalSolveResult {
  /** True when the grid exceeds LOCAL_MAX_CELLS (nothing solved). */
  capped: boolean;
  /** Every satisfying grid as a row-major "0"/"1" string. */
  solutions: string[];
  /**
   * Row placements tried — how many times the solver asked the clues a question.
   *
   * The comparable figure for Grover is its oracle call count. One placement is not
   * one full predicate evaluation: it filters the columns still open against a
   * partly filled grid and stops at the first column left with nothing, so it costs
   * at most what checking a whole grid would.
   */
  clueChecks: number;
  /**
   * Grids that satisfy the row clues alone — the space this search walks, against
   * the 2^cells an exhaustive one would.
   */
  candidates: number;
}

/** Solve a nonogram by row-pattern backtracking with column pruning. */
export function solveLocal(rowClues: number[][], colClues: number[][]): LocalSolveResult {
  const rows = rowClues.length;
  const cols = colClues.length;
  if (rows * cols > LOCAL_MAX_CELLS) {
    return { capped: true, solutions: [], clueChecks: 0, candidates: 0 };
  }

  const rowPats = rowClues.map((clue) => linePatterns(cols, clue)); // bit c = column
  const colPats = colClues.map((clue) => linePatterns(rows, clue)); // bit r = row

  const candidates = rowPats.reduce((total, pats) => total * pats.length, 1);

  // A line with no legal pattern makes the whole puzzle unsatisfiable.
  if (rowPats.some((p) => p.length === 0) || colPats.some((p) => p.length === 0)) {
    return { capped: false, solutions: [], clueChecks: 0, candidates };
  }

  const solutions: string[] = [];
  const chosen = new Array<number>(rows);
  let clueChecks = 0;

  (function place(r: number, colCand: number[][]): void {
    if (r === rows) {
      solutions.push(gridString(chosen, rows, cols));
      return;
    }
    for (const pat of rowPats[r] ?? []) {
      clueChecks++;
      // Filter each column's still-feasible patterns by the bit this row places.
      const nextCand = new Array<number[]>(cols);
      let ok = true;
      for (let c = 0; c < cols; c++) {
        const bit = (pat >> c) & 1;
        const filtered = (colCand[c] ?? []).filter((cp) => ((cp >> r) & 1) === bit);
        if (filtered.length === 0) {
          ok = false;
          break;
        }
        nextCand[c] = filtered;
      }
      if (!ok) continue;
      chosen[r] = pat;
      place(r + 1, nextCand);
    }
  })(0, colPats.slice());

  return { capped: false, solutions, clueChecks, candidates };
}
