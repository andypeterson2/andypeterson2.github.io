/* =============================================================
   Client-side classical nonogram solver — the offline demo tier.

   A dependency-free port of the Python backend's brute-force classical
   solver (nonogram/classical.py + the pattern generator in nonogram/data.py).
   Rather than enumerate all 2^(n·d) grids like the backend, it enumerates the
   valid bit patterns of each line and backtracks row-by-row, pruning column
   candidates by the bits placed so far — the same solution SET, far less work.

   Returns every grid that satisfies all row + column clues as a row-major
   "0"/"1" string ("1" = filled), which is exactly the shape renderClassical
   consumes. This lets the puzzle you draw be solved in your browser with no
   backend — the confident, zero-cost default (cf. the CV editor's demo tier).

   Brute force is exponential, so it is bounded to small grids (LOCAL_MAX_CELLS)
   — the same reason the backend caps grid size. Larger puzzles fall through to
   the live solver.
   ============================================================= */

/** Upper bound on cells solved in-browser (5×5). Keeps solves instant. */
export const LOCAL_MAX_CELLS = 25;

/**
 * All valid bit patterns for one line, as integers where bit c (0 = leftmost
 * cell) is set when cell c is filled. Faithful port of data.py
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
}

/** Solve a nonogram by row-pattern backtracking with column pruning. */
export function solveLocal(rowClues: number[][], colClues: number[][]): LocalSolveResult {
  const rows = rowClues.length;
  const cols = colClues.length;
  if (rows * cols > LOCAL_MAX_CELLS) return { capped: true, solutions: [] };

  const rowPats = rowClues.map((clue) => linePatterns(cols, clue)); // bit c = column
  const colPats = colClues.map((clue) => linePatterns(rows, clue)); // bit r = row

  // A line with no legal pattern makes the whole puzzle unsatisfiable.
  if (rowPats.some((p) => p.length === 0) || colPats.some((p) => p.length === 0)) {
    return { capped: false, solutions: [] };
  }

  const solutions: string[] = [];
  const chosen = new Array<number>(rows);

  (function place(r: number, colCand: number[][]): void {
    if (r === rows) {
      solutions.push(gridString(chosen, rows, cols));
      return;
    }
    for (const pat of rowPats[r] ?? []) {
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

  return { capped: false, solutions };
}
