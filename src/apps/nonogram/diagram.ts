/**
 * The circuit drawn as wires and boxes.
 *
 * Composite steps stay folded into named boxes spanning the wires they act on, the way
 * every circuit drawer does it. Expanding them is what makes a Grover circuit
 * unreadable: one 3x3 iteration is already 40 gates, and the board runs to 17
 * iterations. The code pane beside this one carries what is inside each box.
 *
 * The iteration count is drawn as a repeat bracket rather than repeated boxes. A large
 * board asks for hundreds of thousands of iterations, so the bracket is the only form
 * that fits, and it says the count exactly.
 *
 * Built as a string and assigned once, matching the histogram, and styled only through
 * classes so the 1-bit palette stays in the stylesheet.
 */
import { gateQubits, type Circuit, type Gate } from './circuit';

/** The two folded steps a reader can open. */
export type Block = 'oracle' | 'diffuser';

const PITCH = 32;
const BOX = 24;
const TOP = 18;
const GUTTER = 54;
const COL = 46;
const GAP = 14;
/** Wires drawn before the rest collapse into a count. */
const MAX_WIRES = 11;

interface Wire {
  /** Qubit index, or null for the row standing in for the hidden ones. */
  qubit: number | null;
  y: number;
}

/**
 * Which wires to draw.
 *
 * A board may ask for more than a hundred qubits. Showing the first few cells, the
 * last cell and the ancillas keeps both ends of the register legible, and the gap
 * says how many it stands for.
 */
function wires(circuit: Circuit): Wire[] {
  const { qubits, problemQubits } = circuit;
  if (qubits <= MAX_WIRES) {
    return Array.from({ length: qubits }, (_, i) => ({ qubit: i, y: TOP + i * PITCH }));
  }
  const head = MAX_WIRES - 4;
  const shown: (number | null)[] = [
    ...Array.from({ length: head }, (_, i) => i),
    null,
    problemQubits - 1,
  ];
  // Keep two ancillas visible when there are any: they are the part of the register a
  // reader will not expect.
  if (circuit.ancillas > 0) shown.push(problemQubits, qubits - 1);
  else shown.push(qubits - 2, qubits - 1);
  return shown.map((qubit, i) => ({ qubit, y: TOP + i * PITCH }));
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** A box spanning every wire between `from` and `to`, named down its right edge. */
function span(box: {
  x: number;
  from: number;
  to: number;
  label: string;
  sub: string;
  block?: 'oracle' | 'diffuser';
  pinned?: boolean;
}): string {
  const { x, from, to, label, sub, block, pinned } = box;
  const top = from - BOX / 2;
  const height = to - from + BOX;
  const cx = x + COL / 2;
  // Rotated rather than set in a vertical writing mode: a transform needs no layout
  // and renders the same everywhere.
  const nameX = x + COL - 7;
  const mid = top + height / 2;
  const state = pinned ? ' circ-pinned' : '';
  const shell = block
    ? `<g class="circ-hit${state}" role="button" tabindex="0" data-block="${block}" ` +
      `aria-pressed="${String(Boolean(pinned))}" ` +
      `aria-label="${esc(label)}, open what it is made of">`
    : '<g>';
  return (
    shell +
    `<rect class="circ-box" x="${String(x)}" y="${String(top)}" width="${String(COL)}" height="${String(height)}"/>` +
    `<text class="circ-box-name" x="${String(nameX)}" y="${String(mid)}" ` +
    `transform="rotate(90 ${String(nameX)} ${String(mid)})">${esc(label)}</text>` +
    (sub
      ? `<text class="circ-box-sub" x="${String(cx - 5)}" y="${String(mid)}" ` +
        `transform="rotate(90 ${String(cx - 5)} ${String(mid)})">${esc(sub)}</text>`
      : '') +
    '</g>'
  );
}

/** What the oracle box says about itself, so two puzzles do not draw the same. */
function oracleSub(circuit: Circuit): string {
  if (circuit.oracleKind === 'solutions') {
    const n = circuit.solutionCount ?? 0;
    return `${String(n)} marked`;
  }
  return `${String(circuit.rows + circuit.cols)} lines`;
}

/** The whole circuit as an SVG body, plus the size it needs. */
export interface Drawing {
  body: string;
  width: number;
  height: number;
}

export function drawCircuit(circuit: Circuit, pinned: Block | null = null): Drawing {
  const rows = wires(circuit);
  const cellRows = rows.filter((w) => w.qubit !== null && w.qubit < circuit.problemQubits);
  const firstCell = cellRows[0].y;
  const lastCell = cellRows[cellRows.length - 1].y;
  const lastRow = rows[rows.length - 1].y;
  const height = lastRow + TOP + 22;

  let x = GUTTER;
  const parts: string[] = [];

  // Preparation: one H per cell, in a single column.
  const hx = x;
  for (const w of cellRows) {
    parts.push(
      `<rect class="circ-box" x="${String(hx)}" y="${String(w.y - BOX / 2)}" width="${String(BOX)}" height="${String(BOX)}"/>`,
      `<text class="circ-gate" x="${String(hx + BOX / 2)}" y="${String(w.y)}">H</text>`,
    );
  }
  x += BOX + GAP;

  const repeatStart = x;
  parts.push(
    span({
      x,
      from: firstCell,
      to: circuit.ancillas ? lastRow : lastCell,
      label: 'Oracle',
      sub: oracleSub(circuit),
      block: 'oracle',
      pinned: pinned === 'oracle',
    }),
  );
  x += COL + GAP;
  parts.push(
    span({
      x,
      from: firstCell,
      to: lastCell,
      label: 'Diffuser',
      sub: '',
      block: 'diffuser',
      pinned: pinned === 'diffuser',
    }),
  );
  x += COL;
  const repeatEnd = x;
  x += GAP * 2;

  // Measurement, on the cells only: the ancillas end where they started.
  const mx = x;
  for (const w of cellRows) {
    parts.push(
      `<rect class="circ-box" x="${String(mx)}" y="${String(w.y - BOX / 2)}" width="${String(BOX)}" height="${String(BOX)}"/>`,
      `<path class="circ-meter" d="M${String(mx + 4)} ${String(w.y + 5)} a ${String(BOX / 2 - 4)} ${String(BOX / 2 - 4)} 0 0 1 ${String(BOX - 8)} 0"/>`,
      `<line class="circ-meter" x1="${String(mx + BOX / 2)}" y1="${String(w.y + 5)}" x2="${String(mx + BOX - 5)}" y2="${String(w.y - 4)}"/>`,
    );
  }
  const width = mx + BOX + 12;

  // Wires first, so every box sits on top of its line.
  const lines = rows
    .map((w) =>
      w.qubit === null
        ? `<text class="circ-more" x="${String(GUTTER - 8)}" y="${String(w.y)}">⋮</text>`
        : `<line class="circ-wire" x1="${String(GUTTER)}" y1="${String(w.y)}" x2="${String(width - 12)}" y2="${String(w.y)}"/>` +
          `<text class="circ-label" x="${String(GUTTER - 8)}" y="${String(w.y)}">q[${String(w.qubit)}]</text>`,
    )
    .join('');

  // The repeat bracket, under the two boxes it encloses.
  const by = lastRow + 14;
  const bracket =
    `<path class="circ-bracket" d="M${String(repeatStart)} ${String(by)} v5 H${String(repeatEnd)} v-5"/>` +
    `<text class="circ-repeat" x="${String((repeatStart + repeatEnd) / 2)}" y="${String(by + 17)}">` +
    `× ${circuit.iterations.toLocaleString()}</text>`;

  return { body: lines + parts.join('') + bracket, width, height };
}

/* ── One iteration, written out ── */

const EXP_BOX = 22;
const EXP_COL = 32;
/** Past this the drawing stops being readable and the listing serves better. */
export const MAX_EXPANDED_COLUMNS = 26;

/**
 * Pack gates into columns, each as early as the qubits it touches allow.
 *
 * A column holds one stage only. Packed by qubit alone, the oracle's closing flips
 * share a column with the diffuser's first gates, and the guard drawn at that column
 * puts part of the oracle on the diffuser's side of it.
 */
function columns(gates: Gate[]): Gate[][] {
  const packed: Gate[][] = [];
  const freeAt = new Map<number, number>();
  let stage: Gate['stage'] | null = null;
  let floor = 0;
  for (const gate of gates) {
    if (stage !== null && gate.stage !== stage) floor = packed.length;
    stage = gate.stage;
    const col = place(gate, freeAt, floor);
    (packed[col] ??= []).push(gate);
  }
  return packed;
}

/** Every wire a gate occupies. A multi-qubit gate blocks the ones it spans too. */
function occupied(gate: Gate): number[] {
  const touched = gateQubits(gate);
  if (touched.length === 1) return touched;
  const lo = Math.min(...touched);
  const hi = Math.max(...touched);
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

/** The earliest column at or after `floor` where a gate fits, reserving its wires. */
function place(gate: Gate, freeAt: Map<number, number>, floor: number): number {
  const wires = occupied(gate);
  let col = floor;
  for (const q of wires) col = Math.max(col, freeAt.get(q) ?? 0);
  for (const q of wires) freeAt.set(q, col + 1);
  return col;
}

/** How wide the written-out circuit would be, so a caller can decline to draw it. */
export function expandedColumns(circuit: Circuit): number {
  return columns(circuit.round).length;
}

function gateMarks(gate: Gate, x: number, y: (q: number) => number): string {
  const cx = x + EXP_BOX / 2;
  if (gate.controls.length === 0) {
    const top = y(gate.target) - EXP_BOX / 2;
    return (
      `<rect class="circ-box" x="${String(x)}" y="${String(top)}" width="${String(EXP_BOX)}" height="${String(EXP_BOX)}"/>` +
      `<text class="circ-gate" x="${String(cx)}" y="${String(y(gate.target))}">${gate.name.toUpperCase()}</text>`
    );
  }
  const all = gateQubits(gate);
  const lo = Math.min(...all.map(y));
  const hi = Math.max(...all.map(y));
  const dots = gate.controls
    .map((q) => `<circle class="circ-ctrl" cx="${String(cx)}" cy="${String(y(q))}" r="3.5"/>`)
    .join('');
  const target =
    gate.name === 'mcz'
      ? `<rect class="circ-box" x="${String(x)}" y="${String(y(gate.target) - EXP_BOX / 2)}" width="${String(EXP_BOX)}" height="${String(EXP_BOX)}"/>` +
        `<text class="circ-gate" x="${String(cx)}" y="${String(y(gate.target))}">Z</text>`
      : `<circle class="circ-open" cx="${String(cx)}" cy="${String(y(gate.target))}" r="7"/>` +
        `<line class="circ-wire" x1="${String(cx - 7)}" y1="${String(y(gate.target))}" x2="${String(cx + 7)}" y2="${String(y(gate.target))}"/>` +
        `<line class="circ-wire" x1="${String(cx)}" y1="${String(y(gate.target) - 7)}" x2="${String(cx)}" y2="${String(y(gate.target) + 7)}"/>`;
  return (
    `<line class="circ-wire" x1="${String(cx)}" y1="${String(lo)}" x2="${String(cx)}" y2="${String(hi)}"/>` +
    dots +
    target
  );
}

/**
 * One Grover iteration drawn gate by gate, with a dashed guard between the oracle and
 * the diffuser — the mark a barrier makes in every other drawer.
 *
 * One iteration, never all of them: the count runs to seventeen on a 3x3 and past two
 * hundred thousand on a large board.
 */
export function drawExpanded(circuit: Circuit): Drawing {
  const rows = wires(circuit);
  const y = (q: number): number => {
    const found = rows.find((w) => w.qubit === q);
    return found ? found.y : rows[rows.length - 1].y;
  };
  const drawn = new Set(rows.map((w) => w.qubit));
  const packed = columns(circuit.round.filter((g) => gateQubits(g).every((q) => drawn.has(q))));

  const lastRow = rows[rows.length - 1].y;
  const height = lastRow + TOP + 30;
  const left = GUTTER - 8;

  const marks: string[] = [];
  const guards: string[] = [];
  let x = GUTTER;
  let guardX = 0;

  for (const col of packed) {
    if (!guardX && col.some((g) => g.stage === 'diffuser')) {
      guardX = x - 6;
      guards.push(
        `<line class="circ-guard" x1="${String(guardX)}" y1="${String(TOP - 16)}" x2="${String(guardX)}" y2="${String(lastRow + 16)}"/>`,
      );
    }
    for (const gate of col) marks.push(gateMarks(gate, x, y));
    x += EXP_COL;
  }

  const width = x + 12;
  const lines = rows
    .map((w) =>
      w.qubit === null
        ? `<text class="circ-more" x="${String(left)}" y="${String(w.y)}">⋮</text>`
        : `<line class="circ-wire" x1="${String(GUTTER)}" y1="${String(w.y)}" x2="${String(width - 12)}" y2="${String(w.y)}"/>` +
          `<text class="circ-label" x="${String(left)}" y="${String(w.y)}">q[${String(w.qubit)}]</text>`,
    )
    .join('');

  // Each stage names itself under the columns it owns.
  const end = guardX || x;
  const labels =
    `<text class="circ-stage" x="${String((GUTTER + end) / 2)}" y="${String(lastRow + 30)}">oracle</text>` +
    (guardX
      ? `<text class="circ-stage" x="${String((guardX + x) / 2)}" y="${String(lastRow + 30)}">diffuser</text>`
      : '');

  return { body: lines + guards.join('') + marks.join('') + labels, width, height };
}
