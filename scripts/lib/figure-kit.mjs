/**
 * The pieces every figure on this site is drawn from.
 *
 * 1-bit throughout: ink on paper, a stipple where a second fill is needed, no colour and
 * no hue to rank by. A figure carries its own title and caption so it still says what it
 * is after being pasted somewhere else.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const W = 640;
export const INK = '#000';
export const PAPER = '#fff';

/** The 4px stipple the site fills a second surface with. */
export const DEFS =
  `<defs><pattern id="stipple" width="4" height="4" patternUnits="userSpaceOnUse">` +
  `<rect width="4" height="4" fill="${PAPER}"/>` +
  `<rect width="1" height="1" fill="${INK}"/><rect x="2" y="2" width="1" height="1" fill="${INK}"/>` +
  `</pattern></defs>`;

// Quotes included: `esc` feeds double-quoted attributes as well as text nodes.
export const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
export const n = (v) => v.toLocaleString('en-US');

export function text(x, y, s, { size = 11, anchor = 'start', weight = 400, rotate } = {}) {
  const t = rotate ? ` transform="rotate(${rotate},${x},${y})"` : '';
  return (
    `<text x="${x}" y="${y}" font-family="Geneva, Verdana, sans-serif" font-size="${size}" ` +
    `font-weight="${weight}" fill="${INK}" text-anchor="${anchor}"${t}>${esc(s)}</text>`
  );
}

export function bar(x, y, w, h, fill) {
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
export function wrap(line, max = 118) {
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
export function note(x, y, line, max = 118) {
  return wrap(line, max)
    .map((l, i) => text(x, y + i * 13, l, { size: 10 }))
    .join('');
}

/** Bind the primitives to one output directory. */
export function figureWriter(out) {
  return function figure(name, title, height, body, caption) {
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
  };
}
