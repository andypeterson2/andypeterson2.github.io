/**
 * Draw the nonogram findings as standalone figures.
 *
 * The page's own charts are drawn at runtime against the box they land in; these are
 * fixed-size files that carry a caption, so the same drawing serves the page and a
 * report. They are build artifacts: run `npm run figures` after the measurements change.
 *
 * 1-bit throughout, as the rest of the site is: ink on paper, a stipple where a second
 * fill is needed, no colour and no hue to rank by.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(root, 'public/figures/nonogram');

const read = async (name) =>
  (await import(join(root, 'src/data', name), { with: { type: 'json' } })).default;

const costs = await read('nonogram-hardware-cost.json');
const split = await read('nonogram-compile-split.json');
const spread = await read('nonogram-query-spread.json');
const perRound = await read('nonogram-per-round.json');

const W = 640;
/** What every figure has to say about itself, wherever it ends up. */
const PROVENANCE = (env) =>
  `${env.target}, optimization level ${env.optimization_level}, qiskit ${env.qiskit}. A fit to a device model, not a run on hardware.\n` +
  `The oracle is written from the clues and compiled into one marked grid per solution, so every quantum figure is a lower bound.`;
const INK = '#000';
const PAPER = '#fff';

/** The 4px stipple the site fills a second surface with. */
const DEFS =
  `<defs><pattern id="stipple" width="4" height="4" patternUnits="userSpaceOnUse">` +
  `<rect width="4" height="4" fill="${PAPER}"/>` +
  `<rect width="1" height="1" fill="${INK}"/><rect x="2" y="2" width="1" height="1" fill="${INK}"/>` +
  `</pattern></defs>`;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n = (v) => v.toLocaleString('en-US');

function text(x, y, s, { size = 11, anchor = 'start', weight = 400, rotate } = {}) {
  const t = rotate ? ` transform="rotate(${rotate},${x},${y})"` : '';
  return (
    `<text x="${x}" y="${y}" font-family="Geneva, Verdana, sans-serif" font-size="${size}" ` +
    `font-weight="${weight}" fill="${INK}" text-anchor="${anchor}"${t}>${esc(s)}</text>`
  );
}

function bar(x, y, w, h, fill) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${INK}" stroke-width="1"/>`;
}

/**
 * Wrap the marks in a figure: a frame, a title above, and the settings underneath.
 *
 * Every figure states what produced it. A depth fitted to a device model is not a run on
 * one, and a caption is the only place that distinction survives being pasted into a
 * report.
 */
/** Fold a caption to the figure's width: about 120 characters at 10px in 640. */
function wrap(line, max = 118) {
  const out = [];
  let row = '';
  for (const word of line.split(' ')) {
    if (row && `${row} ${word}`.length > max) {
      out.push(row);
      row = word;
    } else row = row ? `${row} ${word}` : word;
  }
  if (row) out.push(row);
  return out;
}

/** A block of small text inside a figure, folded to the width. */
function note(x, y, line, max = 118) {
  return wrap(line, max)
    .map((l, i) => text(x, y + i * 13, l, { size: 10 }))
    .join('');
}

function figure(name, title, height, body, caption) {
  const lines = caption.split('\n').flatMap((l) => wrap(l));
  const h = height + 16 + lines.length * 13;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${h}" width="${W}" height="${h}" ` +
    `role="img" aria-label="${esc(title)}. ${esc(lines.join(' '))}">` +
    `<title>${esc(title)}</title><desc>${esc(lines.join(' '))}</desc>` +
    DEFS +
    `<rect width="${W}" height="${h}" fill="${PAPER}"/>` +
    text(0, 12, title, { size: 12, weight: 700 }) +
    `<g transform="translate(0,26)">${body}</g>` +
    lines.map((l, i) => text(0, height + 28 + i * 13, l, { size: 10 })).join('') +
    `</svg>\n`;
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, name), svg);
  return `${name} (${svg.length} bytes)`;
}

/** A log scale, since every quantity here spans decades. */
function logScale(min, max, px) {
  const lo = Math.log10(min),
    hi = Math.log10(max);
  return (v) => (px * (Math.log10(v) - lo)) / (hi - lo);
}

function decades(min, max) {
  const out = [];
  for (let d = Math.floor(Math.log10(min)); d <= Math.ceil(Math.log10(max)); d++) {
    const v = 10 ** d;
    if (v >= min && v <= max) out.push(v);
  }
  return out;
}

const row = (r, c, m) => costs.rows.find((x) => x.rows === r && x.cols === c && x.solutions === m);
const shapeOf = (s) => spread.shapes.find((x) => x.shape === s);

// 1. What the measured cost is made of
function figureSplit() {
  const s = split.split;
  const bars = [
    {
      label: 'no spare qubits',
      parts: [
        ['synthesis', s.synthesis_no_ancilla_all_to_all],
        ['routing', s.routing_net],
      ],
    },
    {
      label: '2 spare qubits lent',
      parts: [
        ['synthesis', s.synthesis_anc2_all_to_all],
        ['routing', s.shipped_routing_net],
      ],
    },
  ];
  const H = 170;
  const left = 110;
  const max = s.reference_two_qubit;
  const px = (v) => ((W - left - 120) * v) / max;
  let body = '';
  bars.forEach((b, i) => {
    const y = 26 + i * 64;
    let x = left;
    b.parts.forEach(([part, v], j) => {
      body += bar(x, y, px(v), 30, j === 0 ? INK : 'url(#stipple)');
      if (px(v) > 58) body += text(x + px(v) / 2, y + 19, n(v), { anchor: 'middle', size: 10 });
      x += px(v);
    });
    body += text(left - 8, y + 19, b.label, { anchor: 'end' });
    const total = b.parts.reduce((a, [, v]) => a + v, 0);
    body += text(x + 8, y + 19, `${n(total)} gates`, { size: 10 });
  });
  body +=
    text(left, 8, 'solid: many-controlled synthesis', { size: 10 }) +
    text(left + 190, 8, 'stipple: SWAP routing onto the lattice', { size: 10 });
  body += note(
    left,
    136,
    `The same circuit, one compiler decision apart: ${s.shipped_vs_reference_two_qubit_factor}x the gates, ` +
      `${s.shipped_vs_reference_depth_factor}x the depth, at nine qubits. The gap widens with the ` +
      `gate: one of c controls costs 6(c-1) with a qubit to borrow and about c^2.4 with none.`,
    92,
  );
  return figure(
    'compile-split.svg',
    'A 3x3 Grover circuit: what its cost is made of',
    H,
    body,
    `Routing is not a constant: it costs ${n(s.routing_net)} on top of the dearer synthesis and ${n(s.shipped_routing_net)} on top of the cheaper one.\n` +
      PROVENANCE(split.environment),
  );
}

// 2. How a round grows with the register
function figureGrowth() {
  const pts = perRound.perRound;
  const series = [
    { label: 'nothing to borrow', get: (p) => p.deviceNoSpare, dash: true, fill: PAPER },
    { label: '2 spare qubits', get: (p) => p.device, dash: false, fill: INK },
    { label: 'no routing (12n - 25)', get: (p) => p.allToAll, dash: true, fill: PAPER },
  ];
  const H = 280;
  const left = 56,
    top = 14,
    plotH = 180,
    plotW = W - left - 160;
  const lo = 10,
    hi = 10000;
  const y = logScale(lo, hi, plotH);
  const first = pts[0].qubits,
    span = pts[pts.length - 1].qubits - first;
  const xOf = (q) => left + (plotW * (q - first)) / span;
  let body = '';
  for (const d of decades(lo, hi)) {
    const yy = top + plotH - y(d);
    body +=
      `<line x1="${left}" y1="${yy}" x2="${left + plotW}" y2="${yy}" stroke="${INK}" stroke-width="1" stroke-dasharray="1 3"/>` +
      text(left - 6, yy + 4, n(d), { anchor: 'end', size: 10 });
  }
  body += `<line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotH}" stroke="${INK}"/>`;
  body += `<line x1="${left}" y1="${top + plotH}" x2="${left + plotW}" y2="${top + plotH}" stroke="${INK}"/>`;
  for (const p of pts) {
    if (p.qubits % 2) continue;
    body += text(xOf(p.qubits), top + plotH + 14, String(p.qubits), {
      anchor: 'middle',
      size: 10,
    });
  }
  body += text(left + plotW / 2, top + plotH + 28, 'qubits', { anchor: 'middle', size: 10 });
  for (const s of series) {
    const path = pts
      .map((p, j) => `${j ? 'L' : 'M'}${xOf(p.qubits)},${top + plotH - y(s.get(p))}`)
      .join(' ');
    body += `<path d="${path}" fill="none" stroke="${INK}" stroke-width="${s.dash ? 1 : 2}" ${s.dash ? 'stroke-dasharray="5 3"' : ''}/>`;
    for (const p of pts) {
      if (p.qubits % 3 && p.qubits !== pts[pts.length - 1].qubits) continue;
      body += `<circle cx="${xOf(p.qubits)}" cy="${top + plotH - y(s.get(p))}" r="3" fill="${s.fill}" stroke="${INK}"/>`;
    }
    const last = pts[pts.length - 1];
    body += text(xOf(last.qubits) + 8, top + plotH - y(s.get(last)) + 4, s.label, { size: 10 });
  }
  const last = pts[pts.length - 1];
  body += note(
    left,
    top + plotH + 46,
    `Without routing the cost of a round is exactly 12n - 25 at every size measured. Routing onto ` +
      `the lattice multiplies that by ${pts[2].routingFactor} at six qubits and ${last.routingFactor} ` +
      `at ${last.qubits}; refusing the spare qubits multiplies it by ` +
      `${(pts[2].deviceNoSpare / pts[2].device).toFixed(1)} and ` +
      `${(last.deviceNoSpare / last.device).toFixed(1)}.`,
    102,
  );
  return figure(
    'round-growth.svg',
    'Two-qubit gates per Grover round, against register size',
    H,
    body,
    `The penalty for compiling without a spare qubit is not a constant: it widens from ${(pts[0].deviceNoSpare / pts[0].device).toFixed(1)}x at four qubits to ${(last.deviceNoSpare / last.device).toFixed(1)}x at ${last.qubits}.\n` +
      `A single round over a one-solution oracle, seed 0, so these are structural counts rather than the best-of-seeds figures the cost table carries.\n` +
      PROVENANCE(split.environment),
  );
}

// 3. What one many-controlled gate costs, with and without a qubit to borrow
function figureMcx() {
  const pts = perRound.mcx;
  const H = 250;
  const left = 56,
    top = 14,
    plotH = 160,
    plotW = W - left - 150;
  const lo = 10,
    hi = 10000;
  const y = logScale(lo, hi, plotH);
  const first = pts[0].controls,
    span = pts[pts.length - 1].controls - first;
  const xOf = (c) => left + (plotW * (c - first)) / span;
  let body = '';
  for (const d of decades(lo, hi)) {
    const yy = top + plotH - y(d);
    body +=
      `<line x1="${left}" y1="${yy}" x2="${left + plotW}" y2="${yy}" stroke="${INK}" stroke-width="1" stroke-dasharray="1 3"/>` +
      text(left - 6, yy + 4, n(d), { anchor: 'end', size: 10 });
  }
  body += `<line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotH}" stroke="${INK}"/>`;
  body += `<line x1="${left}" y1="${top + plotH}" x2="${left + plotW}" y2="${top + plotH}" stroke="${INK}"/>`;
  for (const p of pts) {
    body += text(xOf(p.controls), top + plotH + 14, String(p.controls), {
      anchor: 'middle',
      size: 10,
    });
  }
  body += text(left + plotW / 2, top + plotH + 28, 'controls', { anchor: 'middle', size: 10 });
  for (const [key, label, dash] of [
    ['noSpare', 'no spare qubit', true],
    ['twoSpare', '2 spare, exactly 6(c - 1)', false],
  ]) {
    const path = pts
      .map((p, j) => `${j ? 'L' : 'M'}${xOf(p.controls)},${top + plotH - y(p[key])}`)
      .join(' ');
    body += `<path d="${path}" fill="none" stroke="${INK}" stroke-width="${dash ? 1 : 2}" ${dash ? 'stroke-dasharray="5 3"' : ''}/>`;
    for (const p of pts) {
      body += `<circle cx="${xOf(p.controls)}" cy="${top + plotH - y(p[key])}" r="3" fill="${dash ? PAPER : INK}" stroke="${INK}"/>`;
    }
    const end = pts[pts.length - 1];
    body += text(xOf(end.controls) + 8, top + plotH - y(end[key]) + 4, label, { size: 10 });
  }
  const ratios = pts.map((p) => `${String(p.controls)}: ${p.ratio.toFixed(1)}x`).join(', ');
  body += note(left, top + plotH + 46, `Ratio by control count — ${ratios}.`, 102);
  return figure(
    'mcx-cost.svg',
    'One many-controlled X, with and without a qubit to borrow',
    H,
    body,
    `The borrowed-qubit cost is exactly 6(c - 1) at every size; the ancilla-free path grows about c^2.4 to twenty controls, so the gap widens rather than holding at one factor.\n` +
      `Transpiled to the device's basis with no coupling map, so this is synthesis alone, before any routing.\n` +
      `The cost gap itself is long established — Barenco et al. 1995 give linear with borrowed work qubits against quadratic with none.`,
  );
}

// 4. What the oracle's honesty costs
function figureOracles() {
  const pts = [
    [2, 2],
    [2, 3],
    [3, 3],
  ].map(([r, c]) => row(r, c, 1));
  const series = [
    { label: 'tests the clues', get: (x) => x.two_qubit_clue / x.iterations, fill: INK, dy: 4 },
    { label: 'marks the answers', get: (x) => x.two_qubit / x.iterations, fill: PAPER, dy: 4 },
    {
      label: 'marks them, nothing to borrow',
      get: (x) => x.two_qubit_noaux / x.iterations,
      fill: PAPER,
      // Its line ends close to the clue oracle's, so the two names are parted by hand.
      dy: -9,
    },
  ];
  const H = 250;
  const left = 56,
    top = 14,
    plotH = 150,
    plotW = W - left - 190;
  const lo = 10,
    hi = 10000;
  const y = logScale(lo, hi, plotH);
  const xOf = (cells) => left + (plotW * (cells - 4)) / 5;
  let body = '';
  for (const d of decades(lo, hi)) {
    const yy = top + plotH - y(d);
    body +=
      `<line x1="${left}" y1="${yy}" x2="${left + plotW}" y2="${yy}" stroke="${INK}" stroke-width="1" stroke-dasharray="1 3"/>` +
      text(left - 6, yy + 4, n(d), { anchor: 'end', size: 10 });
  }
  body += `<line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotH}" stroke="${INK}"/>`;
  body += `<line x1="${left}" y1="${top + plotH}" x2="${left + plotW}" y2="${top + plotH}" stroke="${INK}"/>`;
  for (const p of pts) {
    body += text(xOf(p.rows * p.cols), top + plotH + 14, `${p.rows}x${p.cols}`, {
      anchor: 'middle',
      size: 10,
    });
  }
  series.forEach((s, i) => {
    const path = pts
      .map((p, j) => `${j ? 'L' : 'M'}${xOf(p.rows * p.cols)},${top + plotH - y(s.get(p))}`)
      .join(' ');
    body += `<path d="${path}" fill="none" stroke="${INK}" stroke-width="${i ? 1 : 2}" ${i ? 'stroke-dasharray="5 3"' : ''}/>`;
    for (const p of pts)
      body += `<circle cx="${xOf(p.rows * p.cols)}" cy="${top + plotH - y(s.get(p))}" r="4" fill="${s.fill}" stroke="${INK}"/>`;
    const last = pts[pts.length - 1];
    body += text(xOf(last.rows * last.cols) + 10, top + plotH - y(s.get(last)) + s.dy, s.label, {
      size: 10,
    });
  });
  const big = pts[pts.length - 1];
  body += note(
    left,
    top + plotH + 36,
    `At ${String(big.rows * big.cols)} cells an oracle that reads the clues costs ` +
      `${(big.two_qubit_clue / big.two_qubit).toFixed(1)}x one that already holds the answers, ` +
      `and holds ${String(big.qubits_clue)} qubits against ${String(big.rows * big.cols + big.ancillas)}.`,
    100,
  );
  return figure(
    'oracle-cost.svg',
    'Two-qubit gates per round, by what the oracle knows',
    H,
    body,
    `Qiskit reduces the clue formula over its whole truth table into one marked grid per solution, so the usual figures price an oracle nobody could build without solving the puzzle first.\n` +
      `The clue oracle carries one flag qubit per line and one gate per pattern that line allows. Boards with one solution, best of ${String(perRound.environment.seeds + 7)} seeds.\n` +
      `${split.environment.target}, optimization level ${split.environment.optimization_level}, qiskit ${split.environment.qiskit}. A fit to a device model, not a run on hardware.`,
  );
}

// 5. What each method asks the clues
function figureQueries() {
  const shapes = spread.shapes.filter((s) => s.groverRoundsM1);
  const H = 290;
  const left = 56,
    top = 14,
    plotH = 190,
    plotW = W - left - 30;
  const lo = 1,
    hi = 40000;
  const y = logScale(lo, hi, plotH);
  const slot = plotW / shapes.length;
  let body = '';
  for (const d of decades(lo, hi)) {
    const yy = top + plotH - y(d);
    body +=
      `<line x1="${left}" y1="${yy}" x2="${left + plotW}" y2="${yy}" stroke="${INK}" stroke-width="1" stroke-dasharray="1 3"/>` +
      text(left - 6, yy + 4, n(d), { anchor: 'end', size: 10 });
  }
  body += `<line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotH}" stroke="${INK}"/>`;
  body += `<line x1="${left}" y1="${top + plotH}" x2="${left + plotW}" y2="${top + plotH}" stroke="${INK}"/>`;
  shapes.forEach((s, i) => {
    const cx = left + slot * (i + 0.5);
    const p = s.placementsM1 ?? s.placements;
    const yy = (v) => top + plotH - y(Math.max(v, lo));
    // The spread of what the backtracker asked, over every board of this shape.
    body += `<line x1="${cx}" y1="${yy(p.min)}" x2="${cx}" y2="${yy(p.max)}" stroke="${INK}"/>`;
    body += bar(cx - 11, yy(p.p90), 22, Math.max(2, yy(p.median) - yy(p.p90)), 'url(#stipple)');
    body += `<line x1="${cx - 13}" y1="${yy(p.median)}" x2="${cx + 13}" y2="${yy(p.median)}" stroke="${INK}" stroke-width="2"/>`;
    // What Grover needs on the same board, which is one number and not a spread.
    body += `<path d="M${cx - 6},${yy(s.groverRoundsM1)} L${cx},${yy(s.groverRoundsM1) - 7} L${cx + 6},${yy(s.groverRoundsM1)} L${cx},${yy(s.groverRoundsM1) + 7} Z" fill="${INK}"/>`;
    body += text(cx, top + plotH + 14, s.shape, { anchor: 'middle', size: 10 });
    body += text(cx, top + plotH + 26, s.sampled ? '(sampled)' : `${n(s.puzzlesM1)}`, {
      anchor: 'middle',
      size: 9,
    });
  });
  body +=
    text(left, top + plotH + 46, 'bar: median to p90 of the backtracker, line: its full range', {
      size: 10,
    }) +
    text(left, top + plotH + 59, 'diamond: rounds Grover needs on the same board', { size: 10 });
  return figure(
    'queries.svg',
    'Questions put to the clues, over every solvable board',
    H,
    body,
    `Boards with one solution; the count under each label is how many there are. 5x5 is a 400,000-grid sample, one grid per puzzle, so it is unbiased at one solution.\n` +
      `Exhaustive search is off the top of this axis: 512 checks at 3x3, 33.5 million at 5x5.\n` +
      `A backtracking placement is at most one whole-grid check, so its count is an upper bound on its queries; Grover's round count is exact.\n` +
      `Rounds come from the noiseless formula. Nothing here ran on a quantum device.`,
  );
}

// 6. Against the depth a device holds
function figureBudget() {
  const budget = 200;
  const shapes = [
    [2, 2],
    [2, 3],
    [3, 3],
  ].map(([r, c]) => row(r, c, 1));
  const H = 200;
  const left = 56,
    top = 10;
  const lo = 100,
    hi = 100000;
  const plotW = W - left - 120;
  const x = logScale(lo, hi, plotW);
  let body = '';
  for (const d of decades(lo, hi)) {
    body +=
      `<line x1="${left + x(d)}" y1="${top}" x2="${left + x(d)}" y2="${top + 120}" stroke="${INK}" stroke-width="1" stroke-dasharray="1 3"/>` +
      text(left + x(d), top + 134, n(d), { anchor: 'middle', size: 10 });
  }
  shapes.forEach((s, i) => {
    const y = top + 8 + i * 38;
    body += bar(left, y, x(s.depth), 12, INK);
    body += bar(left, y + 13, x(s.depth_noaux), 12, 'url(#stipple)');
    body += text(left - 6, y + 16, `${s.rows}x${s.cols}`, { anchor: 'end' });
    body += text(
      left + x(s.depth_noaux) + 8,
      y + 16,
      `${n(s.depth)} / ${n(s.depth_noaux)} layers`,
      {
        size: 10,
      },
    );
  });
  body +=
    `<line x1="${left + x(budget)}" y1="${top}" x2="${left + x(budget)}" y2="${top + 120}" stroke="${INK}" stroke-width="2"/>` +
    text(left + x(budget), top + 148, `${budget} layers a device holds`, {
      anchor: 'middle',
      size: 10,
    });
  body += text(left, top + 166, 'solid: spare qubits lent, stipple: nothing to borrow', {
    size: 10,
  });
  return figure(
    'depth-budget.svg',
    'Circuit depth against the depth a device runs before noise takes over',
    H,
    body,
    `From 2x3 up a single round is deeper than the budget either way, so no whole round completes. At 2x2 one round of three fits.\n` +
      `The 200-layer figure is a working assumption, not a number read off a device.\n` +
      PROVENANCE(split.environment),
  );
}

// 7. The unit decides the verdict
function figureUnits() {
  const hw = row(3, 3, 1);
  const shape = shapeOf('3x3');
  const work = 2 ** 9 * shape.predicateGatesMedianM1;
  // What the page's own solver would spend on the same board, as an upper bound: one
  // whole-grid check per placement, though a placement stops at the first blocked column.
  const backtracking = shape.placementsM1.median * shape.predicateGatesMedianM1;
  const held = 9 + hw.ancillas;
  const bars = [
    ['two-qubit gates', hw.two_qubit / work],
    ['all gates', hw.gates / work],
    ['qubit-layers', (held * hw.depth) / work],
  ];
  const H = 170;
  const left = 110,
    top = 10;
  const lo = 0.05,
    hi = 20;
  const plotW = W - left - 110;
  const x = logScale(lo, hi, plotW);
  let body = '';
  for (const d of [0.1, 1, 10]) {
    body +=
      `<line x1="${left + x(d)}" y1="${top}" x2="${left + x(d)}" y2="${top + 116}" stroke="${INK}" stroke-width="${d === 1 ? 2 : 1}" ${d === 1 ? '' : 'stroke-dasharray="1 3"'}/>` +
      text(left + x(d), top + 130, `${d}x`, { anchor: 'middle', size: 10 });
  }
  bars.forEach(([label, ratio], i) => {
    const y = top + 8 + i * 34;
    const from = Math.min(ratio, 1),
      to = Math.max(ratio, 1);
    body += bar(left + x(from), y, x(to) - x(from), 20, ratio > 1 ? 'url(#stipple)' : INK);
    body += text(left - 8, y + 14, label, { anchor: 'end' });
    body += text(left + x(to) + 8, y + 14, `${ratio.toFixed(2)}x`, { size: 10 });
  });
  body += text(left, top + 150, 'left of the rule: cheaper than the exhaustive search', {
    size: 10,
  });
  return figure(
    'unit-choice.svg',
    'One circuit against exhaustive search, in three units',
    H,
    body,
    `A 3x3 board with one solution, against ${n(work)} gate-steps for exhaustive search on one processor: 2^9 grids at the median cost of a whole-grid check over one-solution boards.\n` +
      `Against the page's own backtracker the circuit loses in every unit: about ${n(backtracking)} gate-steps at the median board, which its two-qubit count alone is ${(hw.two_qubit / backtracking).toFixed(0)}x past.\n` +
      `Width times depth charges the circuit for qubits it holds idle, and the classical side for no width at all, which is most of the spread here.\n` +
      PROVENANCE(split.environment),
  );
}

const written = [
  figureSplit(),
  figureGrowth(),
  figureMcx(),
  figureOracles(),
  figureQueries(),
  figureBudget(),
  figureUnits(),
];
console.log(`figures: ${written.join(', ')}`);
