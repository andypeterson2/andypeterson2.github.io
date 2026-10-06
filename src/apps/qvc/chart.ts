/**
 * The QBER strip chart.
 *
 * Colours are read from the design tokens at paint time, so the chart follows
 * the theme the portal picked. A token that stops resolving leaves the stroke
 * empty, which shows up immediately; a hex fallback would hide it.
 */
import { state } from './state';
import { QBER_THRESHOLD, QBER_WARNING } from './render';

/** The y-axis top, so the threshold and a typical spike both have room. */
const CHART_CEILING = 0.3;

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function drawQberChart(): void {
  const canvas = document.getElementById('qvc-chart');
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const w = canvas.clientWidth || 300;
  const h = canvas.clientHeight || 60;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const ink = token('--ink');
  const faint = token('--ink-4');

  const y = (q: number) => h - Math.min(1, q / CHART_CEILING) * h;

  // The two thresholds, so a reading is placed against them rather than guessed.
  // The page is 1-bit, so the two are told apart by dash length and weight: the
  // abort threshold is the heavier, longer-dashed line of the pair.
  for (const [level, colour, dash, width] of [
    [QBER_THRESHOLD, ink, [6, 3], 1.5],
    [QBER_WARNING, faint, [2, 3], 1],
  ] as const) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.setLineDash([...dash]);
    ctx.beginPath();
    ctx.moveTo(0, y(level));
    ctx.lineTo(w, y(level));
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const points = state.qberHistory;
  if (points.length < 2) return;
  const step = w / (points.length - 1);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  points.forEach((q, i) => {
    const px = i * step;
    const py = y(q);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
}
