/**
 * The circuit drawn as wires and boxes.
 *
 * Composite steps start folded into named boxes spanning the wires they act on, the way
 * every circuit drawer does it, and a reader opens one at a time in place. Opening both
 * at once is a whole iteration written out: 40 gates on a 3x3, and the board runs to 17
 * iterations, so the count stays a repeat bracket rather than repeated boxes. A large
 * board asks for hundreds of thousands of iterations, and the bracket says the count
 * exactly where drawing them could not.
 *
 * Built as a string and assigned once, matching the histogram, and styled only through
 * classes so the 1-bit palette stays in the stylesheet.
 */
import { circuitDepth, gateQubits, totalGates, type Circuit, type Gate } from './circuit';

/** The two folded steps a reader can open. */
export type Block = 'oracle' | 'diffuser';

/** In the order they run. */
export const BLOCKS: readonly Block[] = ['oracle', 'diffuser'];

const PITCH = 32;
const BOX = 24;
/** The first wire's y, leaving the depth bracket and its label room above it. */
const TOP = 52;
const GUTTER = 54;
const COL = 46;
const GAP = 14;
const EXP_BOX = 22;
const EXP_COL = 32;
/** Room inside an opened frame: the left edge, and the right edge that holds its name. */
const FRAME_PAD = 10;
const FRAME_NAME = 20;
/** Wires drawn before the rest collapse into a count. */
const MAX_WIRES = 11;

interface Wire {
  /** Qubit index, or null for the row standing in for the hidden ones. */
  qubit: number | null;
  y: number;
}

/** Where a block sits in the drawing, so a caller can animate between two of them. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The whole circuit as an SVG body, plus the size it needs. */
export interface Drawing {
  body: string;
  width: number;
  height: number;
  blocks: Record<Block, Rect>;
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

/** A curly brace down the right of the wires, gathering them into one count. */
function brace(x: number, top: number, bottom: number): string {
  const mid = (top + bottom) / 2;
  const r = 6;
  return (
    `<path class="circ-brace" d="M${String(x)} ${String(top)} ` +
    `q${String(r)} 0 ${String(r)} ${String(r)} ` +
    `V${String(mid - r)} q0 ${String(r)} ${String(r)} ${String(r)} ` +
    `q${String(-r)} 0 ${String(-r)} ${String(r)} ` +
    `V${String(bottom - r)} q0 ${String(r)} ${String(-r)} ${String(r)}"/>`
  );
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** What the oracle box says about itself, so two puzzles do not draw the same. */
function oracleSub(circuit: Circuit): string {
  if (circuit.oracleKind === 'solutions') {
    const n = circuit.solutionCount ?? 0;
    return `${String(n)} marked`;
  }
  return `${String(circuit.rows + circuit.cols)} lines`;
}

/** Why an opened block looks the way it does, shown where the gates are. */
function blockTitle(circuit: Circuit, block: Block): string {
  if (block === 'diffuser') {
    return (
      'Diffuser — the same for every puzzle. It flips each amplitude about the average, ' +
      "which is what turns the oracle's phase into a difference a measurement can see."
    );
  }
  return circuit.oracleKind === 'solutions'
    ? 'Oracle — the X pattern spells the grid being marked: every cell that should be ' +
        'empty is flipped, so the controlled Z fires on that one state. Which means the ' +
        'oracle was built from the answers the classical pass already found.'
    : 'Oracle — each line writes its allowed patterns onto an ancilla, the ancillas are ' +
        'gathered into one phase flip, and the writing is undone. It never sees a solution.';
}

/**
 * The name down a block's right edge, rotated: a transform needs no layout.
 *
 * Wrapped, because it is the one mark a block keeps when it opens: the group is what
 * travels to the new edge, leaving the rotation on the text where it belongs.
 */
function edgeName(right: number, mid: number, label: string): string {
  const nameX = right - 7;
  return (
    `<g class="circ-name"><text class="circ-box-name" x="${String(nameX)}" y="${String(mid)}" ` +
    `transform="rotate(90 ${String(nameX)} ${String(mid)})">${esc(label)}</text></g>`
  );
}

/** What a folded box says about itself, beside its name. It has no open form. */
function edgeSub(right: number, mid: number, sub: string): string {
  if (!sub) return '';
  const subX = right - COL / 2 - 5;
  return (
    `<text class="circ-box-sub" x="${String(subX)}" y="${String(mid)}" ` +
    `transform="rotate(90 ${String(subX)} ${String(mid)})">${esc(sub)}</text>`
  );
}

/** The pressable shell every block wears, folded or open. */
function shell(block: Block, open: boolean, label: string, sub: string, title: string): string {
  const said = open ? `${label}, open. Press to fold it back.` : `${label}, ${sub}. Press to open it.`;
  return (
    `<g class="circ-hit${open ? ' circ-open-block' : ''}" role="button" tabindex="0" ` +
    `data-block="${block}" aria-pressed="${String(open)}" aria-label="${esc(said)}">` +
    `<title>${esc(title)}</title>`
  );
}

/** Pack gates into columns, each as early as the qubits it touches allow. */
function columns(gates: Gate[]): Gate[][] {
  const packed: Gate[][] = [];
  const freeAt = new Map<number, number>();
  for (const gate of gates) {
    const col = place(gate, freeAt);
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

/** The earliest column where a gate fits, reserving its wires. */
function place(gate: Gate, freeAt: Map<number, number>): number {
  const wires = occupied(gate);
  let col = 0;
  for (const q of wires) col = Math.max(col, freeAt.get(q) ?? 0);
  for (const q of wires) freeAt.set(q, col + 1);
  return col;
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

/** How wide an opened block is: its gates, plus the frame around them. */
function openWidth(gates: Gate[]): number {
  return columns(gates).length * EXP_COL + FRAME_PAD + FRAME_NAME;
}

interface Placement {
  x: number;
  top: number;
  height: number;
  label: string;
  sub: string;
  gates: Gate[];
  y: (q: number) => number;
}

/**
 * Where a block sits and what it holds, for one circuit.
 *
 * The animation redraws a single block on its own, so this has to answer the same way
 * for a whole drawing and for one piece of it.
 */
function placement(circuit: Circuit, block: Block, x: number): Placement {
  const rows = wires(circuit);
  const cellRows = rows.filter((w) => w.qubit !== null && w.qubit < circuit.problemQubits);
  const firstCell = cellRows[0].y;
  const lastCell = cellRows[cellRows.length - 1].y;
  const lastRow = rows[rows.length - 1].y;
  const drawn = new Set(rows.map((w) => w.qubit));
  const to = block === 'oracle' && circuit.ancillas ? lastRow : lastCell;
  const gates = (block === 'oracle' ? circuit.oracle : circuit.diffuser).filter((g) =>
    gateQubits(g).every((q) => drawn.has(q)),
  );
  return {
    x,
    top: firstCell - BOX / 2,
    height: to - firstCell + BOX,
    label: block === 'oracle' ? 'Oracle' : 'Diffuser',
    sub: block === 'oracle' ? oracleSub(circuit) : '',
    gates,
    y: (q) => rows.find((w) => w.qubit === q)?.y ?? lastRow,
  };
}

/**
 * What a block draws at `x`: the part that swaps when it opens, and the name that does
 * not, kept apart so an animation can fade one and carry the other across.
 */
function blockMarks(
  circuit: Circuit,
  block: Block,
  x: number,
  open: boolean,
): [body: string, name: string, rect: Rect] {
  const at = placement(circuit, block, x);
  const width = open ? openWidth(at.gates) : COL;
  const [body, name] = open ? opened(at) : folded(at);
  return [body, name, { x, y: at.top, width, height: at.height }];
}

/** A block as a control: the same marks, wrapped in what a reader can press. */
function blockAt(circuit: Circuit, block: Block, x: number, open: boolean): [string, Rect] {
  const [body, name, rect] = blockMarks(circuit, block, x, open);
  const at = placement(circuit, block, x);
  return [
    shell(block, open, at.label, at.sub, blockTitle(circuit, block)) +
      `<g class="circ-body">${body}</g>` +
      name +
      '</g>',
    rect,
  ];
}

/** A folded block: one named box spanning the wires it acts on. */
function folded(at: Placement): [body: string, name: string] {
  const mid = at.top + at.height / 2;
  return [
    `<rect class="circ-box" x="${String(at.x)}" y="${String(at.top)}" ` +
      `width="${String(COL)}" height="${String(at.height)}"/>` +
      edgeSub(at.x + COL, mid, at.sub),
    edgeName(at.x + COL, mid, at.label),
  ];
}

/** An opened block: a dashed frame with the gates it stands for inside it. */
function opened(at: Placement): [body: string, name: string] {
  const width = openWidth(at.gates);
  let x = at.x + FRAME_PAD;
  const marks: string[] = [];
  for (const col of columns(at.gates)) {
    for (const gate of col) marks.push(gateMarks(gate, x, at.y));
    x += EXP_COL;
  }
  return [
    // An opened block is a frame and some gates, so most of it is paper a press would
    // fall straight through, onto the wire underneath.
    `<rect class="circ-hit-area" x="${String(at.x)}" y="${String(at.top)}" ` +
      `width="${String(width)}" height="${String(at.height)}"/>` +
      `<rect class="circ-frame" x="${String(at.x)}" y="${String(at.top)}" ` +
      `width="${String(width)}" height="${String(at.height)}"/>` +
      `<g class="circ-inner">${marks.join('')}</g>`,
    edgeName(at.x + width, at.top + at.height / 2, at.label),
  ];
}

/**
 * The circuit, with whichever blocks the reader has opened written out in place.
 *
 * Gates on wires the drawing collapsed are left out: their qubits have no row to sit on.
 */
export function drawCircuit(circuit: Circuit, expanded: ReadonlySet<Block> = new Set()): Drawing {
  const rows = wires(circuit);
  const cellRows = rows.filter((w) => w.qubit !== null && w.qubit < circuit.problemQubits);
  const lastRow = rows[rows.length - 1].y;
  // Room under the last wire for the repeat bracket and what it says.
  const height = lastRow + 46;

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
  const blocks = {} as Record<Block, Rect>;
  // Everything downstream of a block is nested in a group named for it, so opening that
  // block can slide what it displaces instead of teleporting it.
  for (const block of BLOCKS) {
    const [body, rect] = blockAt(circuit, block, x, expanded.has(block));
    parts.push(body, `<g data-after="${block}">`);
    blocks[block] = rect;
    x += rect.width + GAP;
  }
  const repeatEnd = x - GAP;
  x += GAP;

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
        ? `<text class="circ-more" x="${String(GUTTER - 8)}" y="${String(w.y)}">\u22ee</text>`
        : `<line class="circ-wire" x1="${String(GUTTER)}" y1="${String(w.y)}" x2="${String(width - 12)}" y2="${String(w.y)}"/>` +
          `<text class="circ-label" x="${String(GUTTER - 8)}" y="${String(w.y)}">q[${String(w.qubit)}]</text>`,
    )
    .join('');

  // The repeat bracket, under the two blocks it encloses.
  const by = lastRow + 14;
  const bracket =
    `<path class="circ-bracket" d="M${String(repeatStart)} ${String(by)} v5 H${String(repeatEnd)} v-5"/>` +
    `<text class="circ-repeat" x="${String((repeatStart + repeatEnd) / 2)}" y="${String(by + 17)}">` +
    `\u00d7 ${circuit.iterations.toLocaleString()}</text>`;

  // Depth is a span along the circuit, so it is bracketed like one, over the wires it
  // runs the length of.
  const dy = TOP - 22;
  const depth =
    `<path class="circ-bracket" d="M${String(GUTTER)} ${String(dy + 5)} v-5 H${String(width - 12)} v5"/>` +
    `<text class="circ-span" x="${String((GUTTER + width - 12) / 2)}" y="${String(dy - 8)}">` +
    `depth ${circuitDepth(circuit).toLocaleString()}</text>`;

  // The gate count is of the whole register, so its brace takes in every wire.
  const gx = width - 4;
  const gates =
    brace(gx, TOP - BOX / 2, lastRow + BOX / 2) +
    `<text class="circ-span circ-gates" x="${String(gx + 9)}" y="${String((TOP + lastRow) / 2)}" ` +
    `transform="rotate(90 ${String(gx + 9)} ${String((TOP + lastRow) / 2)})">` +
    `${totalGates(circuit).toLocaleString()} gates</text>`;

  const close = BLOCKS.map(() => '</g>').join('');
  return {
    body: lines + parts.join('') + close + bracket + depth + gates,
    width: width + 26,
    height,
    blocks,
  };
}

/**
 * One block drawn on its own, for the copy an animation leaves behind.
 *
 * The frame grows out of the box it replaces, so the box has to outlive the repaint
 * that dropped it — and closing needs the same of the gates.
 */
export function ghostBlock(circuit: Circuit, block: Block, x: number, open: boolean): string {
  const [body] = blockMarks(circuit, block, x, open);
  // The body alone. A second thing answering to this block's name would take the next
  // press and the next tab stop, and the name itself stays with the block that keeps it.
  return `<g class="circ-ghost-block" aria-hidden="true">${body}</g>`;
}
