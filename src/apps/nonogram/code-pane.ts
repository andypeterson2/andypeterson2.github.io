/**
 * The circuit pane: the puzzle on screen as source a visitor can take away.
 *
 * Built from the clues alone, so it answers for every board the editor allows rather
 * than only the ones the page can solve or send to hardware. That is the point of it:
 * past a few cells nothing here will run anywhere we can offer, and someone with a
 * real simulator should still be able to pick the circuit up.
 */
import { buildCircuit, circuitDepth, entanglingCount, totalGates } from './circuit';
import { groverOutcome } from './grover-sim';
import { BLOCKS, drawCircuit, ghostBlock, type Block, type Rect } from './diagram';
import { type Circuit } from './circuit';
import { exportCircuit, type ExportFormat } from './export';
import { $ } from './state';
import { setStatus } from './ui';

const FORMAT_BUTTONS: Record<ExportFormat, string> = {
  qiskit: 'btn-fmt-qiskit',
  qasm3: 'btn-fmt-qasm',
};

const BLOCK_BUTTONS: Record<Block, string> = {
  oracle: 'btn-block-oracle',
  diffuser: 'btn-block-diffuser',
};

/**
 * How long the opening runs, matching the chain of transitions in the stylesheet.
 * The overlay it needs is cleared when the last of them has finished.
 */
const MORPH_MS = 460;

let format: ExportFormat = 'qiskit';
/** The text currently on screen, so Copy never re-derives it. */
let listing = '';
/**
 * The blocks written out in place.
 *
 * Kept here rather than read back off the drawing: the SVG is rebuilt from scratch on
 * every grid edit, so anything living in the markup is gone by the next paint.
 */
const expanded = new Set<Block>();
/** Where each block sat at the last paint, so the next one can grow out of it. */
let placed: Record<Block, Rect> | null = null;
/** The running overlay's timer, so a grid edit mid-animation cannot outlive its SVG. */
let morphTimer: ReturnType<typeof setTimeout> | null = null;
/** The circuit on screen, so a press can redraw it without rebuilding. */
let shown: Circuit | null = null;

function pane(): HTMLElement | null {
  return $('code-pane');
}

/** A short description of the circuit for the section rule. */
function summary(qubits: number, depth: number, gates: number): string {
  const plural = qubits === 1 ? 'qubit' : 'qubits';
  return `${String(qubits)} ${plural}, depth ${depth.toLocaleString()}, ${gates.toLocaleString()} gates`;
}

/**
 * What the listing does not say, because the listing carries no prose. It is the
 * listing's own hover text.
 *
 * Qubit order and endianness are the two things that make a correct circuit look
 * broken to someone reading its output for the first time, so they lead.
 */
function explain(circuit: ReturnType<typeof buildCircuit>): string {
  const { problemQubits: cells, iterations, solutionCount, oracleKind } = circuit;
  const ideal = groverOutcome(solutionCount ?? 1, cells, iterations).markedProbability;

  const counted =
    solutionCount === null
      ? 'This board is past what the page solves classically, so the iteration count assumes a single solution.'
      : `${String(solutionCount)} solution${solutionCount === 1 ? '' : 's'}, so ${String(iterations)} iterations reach an ideal ${(ideal * 100).toFixed(1)}%.`;

  const built =
    oracleKind === 'solutions'
      ? 'The oracle marks the grids the classical pass found, so it shows amplitude amplification rather than a quantum solve.'
      : 'The oracle checks each row and column against its allowed patterns, so it never sees a solution.';

  return (
    `Qubit i is cell i, read left to right and top to bottom. Measurements come back ` +
    `little-endian, so reverse a bitstring to read it as a grid. ${counted} ${built} ` +
    `Equivalent to what this page runs; a hardware run is transpiled to a device besides.`
  );
}

function paint(): void {
  const listingEl = $('code-listing');
  if (listingEl) listingEl.textContent = listing;
  for (const [name, id] of Object.entries(FORMAT_BUTTONS)) {
    $(id)?.setAttribute('aria-pressed', String(name === format));
  }
}

/** Whether the reader asked for no animation. */
function stillness(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Grow one block into its replacement, over the drawing that already holds the result.
 *
 * The copy left behind carries the shape being replaced — the folded box on the way
 * open, the gates on the way back — so both halves of the change are on screen at once.
 * A dashed frame runs between the two widths while they cross over. The stylesheet owns
 * the order and the timing; this owns the two widths it cannot know.
 */
function morph(svg: Element, circuit: Circuit, block: Block, from: Rect, to: Rect): void {
  const open = expanded.has(block);
  const live = svg.querySelector(`[data-block="${block}"]`);
  if (!live) return;

  svg.insertAdjacentHTML(
    'beforeend',
    `<g class="circ-morph" data-dir="${open ? 'open' : 'close'}">` +
      ghostBlock(circuit, block, from.x, !open) +
      `<rect class="circ-morph-frame" y="${String(to.y)}" height="${String(to.height)}"/>` +
      '</g>',
  );
  const layer = svg.lastElementChild;
  const frame = layer?.querySelector('.circ-morph-frame');
  if (!(layer instanceof SVGElement) || !(frame instanceof SVGElement)) return;

  // Geometry the stylesheet cannot hold: it differs with every board.
  frame.style.setProperty('--morph-x', `${String(to.x)}px`);
  frame.style.setProperty('--morph-w', `${String(from.width)}px`);
  live.classList.add('circ-arriving');

  // What this block displaces, and the name it keeps, both start where they stood and
  // travel with the frame.
  const slide = `${String(from.width - to.width)}px`;
  const travelling: SVGElement[] = [];
  for (const sel of [`[data-after="${block}"]`, '.circ-name']) {
    const found = sel.startsWith('.') ? live.querySelector(sel) : svg.querySelector(sel);
    if (!(found instanceof SVGElement)) continue;
    found.style.setProperty('--slide', slide);
    found.classList.add('circ-slide');
    travelling.push(found);
  }

  requestAnimationFrame(() => {
    layer.classList.add('circ-morph--run');
    frame.style.setProperty('--morph-w', `${String(to.width)}px`);
    for (const el of travelling) el.style.setProperty('--slide', '0px');
    live.classList.add('circ-arrived');
  });

  if (morphTimer) clearTimeout(morphTimer);
  morphTimer = setTimeout(() => {
    layer.remove();
    live.classList.remove('circ-arriving', 'circ-arrived');
    for (const el of travelling) el.classList.remove('circ-slide');
    morphTimer = null;
  }, MORPH_MS);
}

/**
 * Draw the circuit, with whichever blocks are open written out in place.
 *
 * `role="img"` would make every mark inside presentational, and with it the two boxes
 * a reader can press, so the drawing is a group that names itself instead.
 */
function paintCircuit(opening?: Block): void {
  const svg = $('circuit-svg');
  const circuit = shown;
  if (!svg || !circuit) return;

  const before = placed;
  const { body, width, height, blocks } = drawCircuit(circuit, expanded);

  svg.setAttribute('viewBox', `0 0 ${String(width)} ${String(height)}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('role', 'group');
  svg.removeAttribute('aria-hidden');
  const opened = BLOCKS.filter((b) => expanded.has(b));
  svg.setAttribute(
    'aria-label',
    `Grover circuit: ${String(circuit.qubits)} qubits, an oracle and a diffuser repeated ` +
      `${String(circuit.iterations)} times` +
      (opened.length ? `, with the ${opened.join(' and the ')} written out.` : '.'),
  );
  if (morphTimer) {
    clearTimeout(morphTimer);
    morphTimer = null;
  }
  svg.innerHTML = body;
  placed = blocks;

  if (opening && before && !stillness()) {
    morph(svg, circuit, opening, before[opening], blocks[opening]);
  }

  for (const block of BLOCKS) {
    $(BLOCK_BUTTONS[block])?.setAttribute('aria-pressed', String(expanded.has(block)));
  }
}

/** Build the circuit for these clues and show its code. */
export function renderCodePane(rowClues: number[][], colClues: number[][]): void {
  const host = pane();
  if (!host) return;

  const circuit = buildCircuit(rowClues, colClues);
  listing = exportCircuit(circuit, format);
  paint();

  // What the listing does not say, on the listing rather than under it: the copied text
  // stays circuit and nothing else.
  const listingEl = $('code-listing');
  if (listingEl) listingEl.title = explain(circuit);

  shown = circuit;
  paintCircuit();

  const meta = $('code-meta');
  if (meta) {
    meta.textContent = summary(circuit.qubits, circuitDepth(circuit), totalGates(circuit));
    const entangling = `${entanglingCount(circuit).toLocaleString()} entangling gates. `;
    meta.title =
      entangling +
      (circuit.oracleKind === 'solutions'
        ? 'The oracle marks the solutions the classical pass found.'
        : 'The oracle checks each row and column, so it never sees a solution.');
  }
  host.classList.add('visible');
}

async function copy(): Promise<void> {
  if (!listing) return;
  try {
    await navigator.clipboard.writeText(listing);
  } catch {
    // Denied permission, an insecure origin, or no clipboard at all. The text is on
    // screen and selectable, so say that rather than failing silently.
    setStatus('Copying was blocked — select the code and copy it instead.', 'err');
  }
}

/**
 * The circuit band follows the width until the reader has an opinion.
 *
 * It is the tallest thing on the page and the least likely to be read first, so a
 * narrow screen gets it folded. Once someone opens or closes it themselves that choice
 * stands: otherwise rotating a tablet would reopen what they had just put away.
 */
function followWidth(band: HTMLDetailsElement): void {
  const wide = window.matchMedia('(min-width: 769px)');
  let userDecided = false;

  band.open = wide.matches;
  band.addEventListener('toggle', () => {
    userDecided = true;
  });
  wide.addEventListener('change', (e) => {
    if (!userDecided) band.open = e.matches;
  });
}

/** Wire the format buttons and Copy. Call once. */
export function initCodePane(onFormatChange: () => void): void {
  for (const [name, id] of Object.entries(FORMAT_BUTTONS)) {
    $(id)?.addEventListener('click', () => {
      format = name as ExportFormat;
      onFormatChange();
    });
  }
  const toggle = (block: Block): void => {
    if (expanded.has(block)) expanded.delete(block);
    else expanded.add(block);
    paintCircuit(block);
  };

  for (const block of BLOCKS) {
    $(BLOCK_BUTTONS[block])?.addEventListener('click', () => {
      toggle(block);
    });
  }

  // Delegated: the drawing is replaced wholesale on every edit, so a listener bound to
  // a box would be thrown away with it.
  const svg = $('circuit-svg');
  const press = (target: EventTarget | null): void => {
    const hit = (target as Element | null)?.closest('[data-block]');
    const block = hit?.getAttribute('data-block');
    if (block !== 'oracle' && block !== 'diffuser') return;
    toggle(block);
    // Repainting replaces the shape that was just pressed, and with it the focus, so a
    // second key press would land on nothing.
    svg?.querySelector<SVGElement>(`[data-block="${block}"]`)?.focus();
  };
  svg?.addEventListener('click', (e) => {
    press(e.target);
  });
  svg?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    press(e.target);
  });

  $('btn-copy-code')?.addEventListener('click', () => void copy());
  const band = $('circuit-band');
  if (band instanceof HTMLDetailsElement) followWidth(band);
  paint();
}
