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
import {
  drawCircuit,
  drawExpanded,
  expandedColumns,
  MAX_EXPANDED_COLUMNS,
  type Block,
} from './diagram';
import { type Circuit, type Gate } from './circuit';
import {
  COST_OPTIMIZATION,
  COST_SEEDS,
  COST_TARGET,
  DEPTH_BUDGET,
  hardwareCost,
  overBudget,
} from './hardware-cost';
import { exportCircuit, extendsRun, type ExportFormat, type GateRun } from './export';
import { $ } from './state';
import { setStatus } from './ui';

const FORMAT_BUTTONS: Record<ExportFormat, string> = {
  qiskit: 'btn-fmt-qiskit',
  qasm3: 'btn-fmt-qasm',
};

const VIEW_BUTTONS: Record<'folded' | 'full', string> = {
  folded: 'btn-view-folded',
  full: 'btn-view-full',
};

let format: ExportFormat = 'qiskit';
/** The text currently on screen, so Copy never re-derives it. */
let listing = '';
/** Folded boxes, or one iteration written out. */
let view: 'folded' | 'full' = 'folded';
/**
 * The block whose decomposition is open.
 *
 * Kept here rather than read back off the drawing: the SVG is rebuilt from scratch on
 * every grid edit, so anything living in the markup is gone by the next paint.
 */
let pinned: Block | null = null;
/** The circuit on screen, so the pinned panel can describe it without rebuilding. */
let shown: Circuit | null = null;

function pane(): HTMLElement | null {
  return $('code-pane');
}

/** Qubit numbers as a list, collapsing a full run into its ends. */
function qubitList(qubits: number[]): string {
  const sorted = [...qubits].sort((a, b) => a - b);
  const contiguous = sorted.every((q, i) => i === 0 || q === sorted[i - 1] + 1);
  if (contiguous && sorted.length > 2) {
    return `q${String(sorted[0])}-q${String(sorted[sorted.length - 1])}`;
  }
  return sorted.map((q) => `q${String(q)}`).join(' ');
}

/** One line per gate, with runs of the same single-qubit gate on one line. */
function gateLines(gates: Gate[]): string {
  const lines: string[] = [];
  let run: GateRun | null = null;

  const flush = (): void => {
    if (run) lines.push(`${run.name.toUpperCase().padEnd(4)}${qubitList(run.qubits)}`);
    run = null;
  };

  for (const gate of gates) {
    if (gate.controls.length) {
      flush();
      const base = gate.name === 'mcz' ? 'Z' : 'X';
      lines.push(
        `${base.padEnd(4)}controls ${qubitList(gate.controls)}, target q${String(gate.target)}`,
      );
      continue;
    }
    if (extendsRun(run, gate)) {
      run.qubits.push(gate.target);
      continue;
    }
    flush();
    run = { name: gate.name, qubits: [gate.target] };
  }
  flush();
  return lines.join('\n');
}

/** What a folded box is made of, and why it looks the way it does. */
function describe(circuit: Circuit, block: Block): { title: string; body: string } {
  if (block === 'diffuser') {
    return {
      title: 'Diffuser \u2014 reflection about the mean',
      body:
        gateLines(circuit.diffuser) +
        '\n\nThe same for every puzzle. It flips each amplitude about the average, ' +
        "which is what turns the oracle's phase into a difference a measurement can see.",
    };
  }
  const built =
    circuit.oracleKind === 'solutions'
      ? 'The X pattern spells the grid being marked: every cell that should be empty is ' +
        'flipped, so the controlled Z fires on that one state. Which means the oracle was ' +
        'built from the answers the classical pass already found.'
      : 'Each line writes its allowed patterns onto an ancilla, the ancillas are gathered ' +
        'into one phase flip, and the writing is undone. It never sees a solution.';
  return {
    title: `Oracle \u2014 ${oracleSummary(circuit)}`,
    body: `${gateLines(circuit.oracle)}\n\n${built}`,
  };
}

function oracleSummary(circuit: Circuit): string {
  return circuit.oracleKind === 'solutions'
    ? `${String(circuit.solutionCount ?? 0)} marked`
    : `${String(circuit.rows + circuit.cols)} lines`;
}

/** A short description of the circuit for the section rule. */
function summary(qubits: number, depth: number, gates: number): string {
  const plural = qubits === 1 ? 'qubit' : 'qubits';
  return `${String(qubits)} ${plural}, depth ${depth.toLocaleString()}, ${gates.toLocaleString()} gates`;
}

/**
 * What the listing does not say, because the listing carries no prose.
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

/**
 * What a real device would make of this circuit, when it was measured.
 *
 * Every qualifier a transpiled depth needs to mean anything is named: the device, the
 * optimization level, how many seeds were tried, and the iteration count it was
 * measured at.
 */
function hardwareLine(circuit: ReturnType<typeof buildCircuit>): string {
  const cost = hardwareCost(circuit.rows, circuit.cols, circuit.solutionCount);
  if (!cost) {
    return (
      `No measurement for a board this size: transpiling one costs more than it says. ` +
      `The figures above are the circuit as written, before any device sees it.`
    );
  }
  const over = Math.round(overBudget(cost));
  return (
    `Transpiled for ibm_torino (Qiskit's ${COST_TARGET} snapshot) at optimization ` +
    `level ${String(COST_OPTIMIZATION)}, ` +
    `best of ${String(COST_SEEDS)} seeds: ${cost.depth.toLocaleString()} layers and ` +
    `${cost.two_qubit.toLocaleString()} two-qubit gates at ${String(cost.iterations)} iterations. ` +
    `A device of that generation holds about ${String(DEPTH_BUDGET)} layers before noise takes over, ` +
    `so this asks for roughly ${over.toLocaleString()} times what it has.`
  );
}

function paint(): void {
  const listingEl = $('code-listing');
  if (listingEl) listingEl.textContent = listing;
  for (const [name, id] of Object.entries(FORMAT_BUTTONS)) {
    $(id)?.setAttribute('aria-pressed', String(name === format));
  }
}

/**
 * Draw the circuit and whatever is open beside it.
 *
 * `role="img"` would make every mark inside presentational, and with it the two boxes
 * a reader can press, so the drawing is a group that names itself instead.
 */
function paintCircuit(): void {
  const svg = $('circuit-svg');
  const circuit = shown;
  if (!svg || !circuit) return;

  const wide = expandedColumns(circuit) <= MAX_EXPANDED_COLUMNS;
  const full = view === 'full' && wide;
  const { body, width, height } = full ? drawExpanded(circuit) : drawCircuit(circuit, pinned);

  svg.setAttribute('viewBox', `0 0 ${String(width)} ${String(height)}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('role', 'group');
  svg.removeAttribute('aria-hidden');
  svg.setAttribute(
    'aria-label',
    full
      ? `One Grover iteration of ${String(circuit.iterations)}, written out gate by gate.`
      : `Grover circuit: ${String(circuit.qubits)} qubits, an oracle and a diffuser repeated ${String(circuit.iterations)} times.`,
  );
  svg.innerHTML = body;

  const toggle = $('circuit-view');
  if (toggle) {
    toggle.hidden = !wide;
    for (const [name, id] of Object.entries(VIEW_BUTTONS)) {
      $(id)?.setAttribute('aria-pressed', String(full ? name === 'full' : name === 'folded'));
    }
  }

  const caption = $('circuit-caption');
  if (caption) {
    caption.textContent = full
      ? `One iteration of ${circuit.iterations.toLocaleString()}. The dashed guard marks where the oracle ends.`
      : 'Press a box to see what it is made of.';
  }

  const panel = $('circuit-decomp');
  if (!panel) return;
  if (full || !pinned) {
    panel.hidden = true;
    panel.innerHTML = '';
    return;
  }
  const { title, body: text } = describe(circuit, pinned);
  panel.hidden = false;
  panel.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'decomp-head';
  const name = document.createElement('span');
  name.textContent = title;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 's6-btn s6-btn--sm';
  close.textContent = '\u00d7';
  close.setAttribute('aria-label', 'Close');
  close.addEventListener('click', () => {
    pinned = null;
    paintCircuit();
  });
  head.append(name, close);
  const pre = document.createElement('pre');
  pre.textContent = text;
  panel.append(head, pre);
}

/** Build the circuit for these clues and show its code. */
export function renderCodePane(rowClues: number[][], colClues: number[][]): void {
  const host = pane();
  if (!host) return;

  const circuit = buildCircuit(rowClues, colClues);
  listing = exportCircuit(circuit, format);
  paint();

  shown = circuit;
  paintCircuit();

  const hw = $('hardware-note');
  if (hw) hw.textContent = hardwareLine(circuit);

  const note = $('code-note');
  if (note) note.textContent = explain(circuit);

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
    setStatus('Circuit code copied.', 'ok');
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
  for (const [name, id] of Object.entries(VIEW_BUTTONS)) {
    $(id)?.addEventListener('click', () => {
      view = name as 'folded' | 'full';
      pinned = null;
      paintCircuit();
    });
  }

  // Delegated: the drawing is replaced wholesale on every edit, so a listener bound to
  // a box would be thrown away with it.
  const svg = $('circuit-svg');
  const press = (target: EventTarget | null): void => {
    const hit = (target as Element | null)?.closest('[data-block]');
    const block = hit?.getAttribute('data-block');
    if (block !== 'oracle' && block !== 'diffuser') return;
    pinned = pinned === block ? null : block;
    paintCircuit();
    // Repainting replaces the box that was just pressed, and with it the focus, so a
    // second key press would land on nothing.
    const again = svg?.querySelector<SVGElement>(`[data-block="${block}"]`);
    again?.focus();
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
