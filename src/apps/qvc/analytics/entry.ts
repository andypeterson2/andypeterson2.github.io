/**
 * The analytics screen: a second window reading one live call.
 *
 * It opens no network connection of its own. Everything arrives over a
 * same-origin BroadcastChannel from the call window, so this page works only
 * alongside one and says so when there is nothing to read.
 */
import { renderPanels, type Snapshot } from './panels';

/** Readings kept for the sparklines, newest last. */
const SERIES_CAP = 120;

const series = {
  bandwidth: [] as number[],
  rtt: [] as number[],
  enc: [] as number[],
  dec: [] as number[],
};

let latest: Snapshot = {};

function push(name: keyof typeof series, value: unknown): void {
  if (typeof value !== 'number') return;
  const buf = series[name];
  buf.push(value);
  if (buf.length > SERIES_CAP) buf.shift();
}

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function prep(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const w = canvas.clientWidth || 300;
  const h = canvas.clientHeight || 60;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  return ctx;
}

function drawSeries(canvas: HTMLCanvasElement, points: number[], colour: string): void {
  const ctx = prep(canvas);
  if (!ctx || points.length < 2) return;
  const w = canvas.clientWidth || 300;
  const h = canvas.clientHeight || 60;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  points.forEach((p, i) => {
    const y = h - ((p - min) / span) * h;
    if (i === 0) ctx.moveTo(0, y);
    else ctx.lineTo(i * step, y);
  });
  ctx.stroke();
}

function drawQber(canvas: HTMLCanvasElement, s: Snapshot): void {
  const ctx = prep(canvas);
  if (!ctx) return;
  const w = canvas.clientWidth || 300;
  const h = canvas.clientHeight || 60;
  const ceiling = 0.3;
  const y = (q: number) => h - Math.min(1, q / ceiling) * h;
  for (const [level, name] of [
    [s.qberThreshold, '--color-danger'],
    [s.qberWarning, '--color-warning'],
  ] as const) {
    if (typeof level !== 'number') continue;
    ctx.strokeStyle = token(name);
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(0, y(level));
    ctx.lineTo(w, y(level));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  const points = s.qberHistory ?? [];
  if (points.length < 2) return;
  const step = w / (points.length - 1);
  ctx.strokeStyle = token('--ink-3');
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  points.forEach((q, i) => {
    if (i === 0) ctx.moveTo(0, y(q));
    else ctx.lineTo(i * step, y(q));
  });
  ctx.stroke();
}

function paint(): void {
  const root = document.getElementById('an-root');
  if (!root) return;
  root.innerHTML = renderPanels(latest, Date.now());

  const fill = document.getElementById('an-distill-fill');
  if (fill) {
    const pct = Math.round((latest.distillFraction ?? 0) * 100);
    fill.style.setProperty('--an-fill', `${String(pct)}%`);
  }
  for (const canvas of root.querySelectorAll('canvas')) {
    if (!(canvas instanceof HTMLCanvasElement)) continue;
    const chart = canvas.dataset.chart;
    if (chart === 'qber') drawQber(canvas, latest);
    else if (chart && chart in series) {
      drawSeries(canvas, series[chart as keyof typeof series], token('--accent'));
    }
  }
}

async function start(): Promise<void> {
  if (typeof BroadcastChannel === 'undefined') {
    paint();
    return;
  }
  const { TELEMETRY_CHANNEL } = await import('../engine/analytics/telemetry.js');
  const bus = new BroadcastChannel(TELEMETRY_CHANNEL);
  bus.onmessage = (e: MessageEvent) => {
    latest = e.data as Snapshot;
    const q = latest.quality ?? {};
    const c = latest.crypto ?? {};
    push('bandwidth', q.bandwidthKbps);
    push('rtt', q.rttMs);
    push('enc', c.encryptLatencyUs);
    push('dec', c.decryptLatencyUs);
    paint();
  };
  // A command lane exists in the contract; this screen reads rather than drives.
  paint();
}

void start();
