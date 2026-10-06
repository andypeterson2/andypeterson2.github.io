/**
 * The test card that stands behind a video with nothing in it.
 *
 * A broadcast alignment card, drawn in the page's own 1-bit vocabulary: every
 * tone is a stipple of black on white rather than a grey, so the card holds up
 * at any size and matches the rest of the site. The step wedge along the
 * bottom is the honest version of a greyscale bar — six ordered patterns from
 * paper to ink.
 *
 * It sits *behind* the `<video>`, so a stream that arrives simply covers it.
 */

/** Local: importing the shared one would make the two modules import each other. */
function escapeText(text: string): string {
  return text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
}

/** Crosshair-in-brackets, the alignment mark at each corner. */
function cornerMark(x: number, y: number, flipX: boolean, flipY: boolean): string {
  const sx = flipX ? -1 : 1;
  const sy = flipY ? -1 : 1;
  return `<g transform="translate(${String(x)} ${String(y)}) scale(${String(sx)} ${String(sy)})">
      <path d="M-34-34h22M-34-34v22" />
      <circle cx="0" cy="0" r="16" fill="none" />
      <path d="M-22 0h44M0-22v44" />
    </g>`;
}

const SPOKES = [0, 45, 90, 135, 180, 225, 270, 315];

/**
 * `caption` is the one line the card carries; keep it short and true, because
 * it is the only thing on screen saying why there is no picture.
 */
export function testCard(caption: string): string {
  const grid = Array.from({ length: 15 }, (_, i) => `M${String((i + 1) * 40)} 0v360`)
    .concat(Array.from({ length: 8 }, (_, i) => `M0 ${String((i + 1) * 40)}h640`))
    .join('');
  const spokes = SPOKES.map(
    (deg) =>
      `<path d="M320 180L${String(320 + 118 * Math.cos((deg * Math.PI) / 180))} ${String(
        180 + 118 * Math.sin((deg * Math.PI) / 180),
      )}" stroke="url(#qvc-tc-50)" stroke-width="14" />`,
  ).join('');
  // The step wedge, where a broadcast card puts its greyscale bar. Six ordered
  // patterns, so the ramp is real at any size instead of six flat greys.
  const wedge = ['none', 'qvc-tc-12', 'qvc-tc-25', 'qvc-tc-50', 'qvc-tc-75', 'ink']
    .map((tone, i) => {
      const fill =
        tone === 'none' ? 'var(--paper)' : tone === 'ink' ? 'var(--ink)' : `url(#${tone})`;
      return `<rect x="${String(160 + i * 60)}" y="222" width="60" height="34" fill="${fill}" />`;
    })
    .join('');
  return `<svg
      class="qvc-testcard"
      viewBox="0 0 640 360"
      preserveAspectRatio="xMidYMid slice"
      shape-rendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern id="qvc-tc-12" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="var(--paper)" />
          <path d="M0 0h2v2H0zM4 4h2v2H4z" fill="var(--ink)" />
        </pattern>
        <pattern id="qvc-tc-25" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="var(--paper)" />
          <path d="M0 0h2v2H0z" fill="var(--ink)" />
        </pattern>
        <pattern id="qvc-tc-50" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="var(--paper)" />
          <path d="M0 0h2v2H0zM2 2h2v2H2z" fill="var(--ink)" />
        </pattern>
        <pattern id="qvc-tc-75" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="var(--ink)" />
          <path d="M0 0h2v2H0z" fill="var(--paper)" />
        </pattern>
      </defs>
      <rect width="640" height="360" fill="var(--paper)" />
      <g stroke="var(--ink-4)" stroke-width="1" fill="none"><path d="${grid}" /></g>
      <circle cx="320" cy="180" r="120" fill="none" stroke="var(--ink)" stroke-width="3" />
      ${spokes}
      <g stroke="var(--ink)" stroke-width="3" fill="none">
        ${cornerMark(70, 70, false, false)}
        ${cornerMark(570, 70, true, false)}
        ${cornerMark(70, 290, false, true)}
        ${cornerMark(570, 290, true, true)}
      </g>
      ${wedge}
      <rect x="160" y="222" width="360" height="34" fill="none" stroke="var(--ink)"
        stroke-width="3" />
      <rect x="70" y="134" width="500" height="68" fill="var(--paper)" stroke="var(--ink)"
        stroke-width="3" />
      <text x="320" y="178" class="qvc-testcard-text" font-size="34" text-anchor="middle">${escapeText(caption)}</text>
    </svg>`;
}
