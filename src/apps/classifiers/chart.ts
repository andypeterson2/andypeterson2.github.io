/**
 * Minimal dual-axis line chart for training curves.
 *
 * Renders loss (left Y-axis) and accuracy (right Y-axis) on a single canvas.
 * No external dependencies — uses the Canvas 2D API directly.
 *
 * Drawn in the design system (audit M29): ink on paper from the tokens, Geneva at
 * 12px and up, and series told apart by dash pattern, never by colour (L3: colour
 * is only a status light). It used to read six tokens that don't exist and fall
 * back to a brown ground and Tailwind blues and pinks.
 */

export interface MiniChartOpts {
  title?: string;
  yLabel?: string;
  y2Label?: string;
}

interface Point {
  x: number;
  y: number;
}

interface Series {
  dash: number[];
  yAxis: 'left' | 'right';
  points: Point[];
}

/** A design token's value, read at draw time (dark mode is a page filter, so the
    light values are always right). */
function token(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

interface Frame {
  W: number;
  H: number;
  plotW: number;
  plotH: number;
  ink: string;
  muted: string;
  gridCol: string;
  font: (px: number, bold?: boolean) => string;
  scaleX: (v: number) => number;
  scaleYL: (v: number) => number;
  scaleYR: (v: number) => number;
  leftMin: number;
  leftMax: number;
}

export class MiniChart {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private title: string;
  private yLabel: string;
  private y2Label: string;
  private series: Partial<Record<string, Series>> = {};
  private padding = { top: 30, right: 55, bottom: 30, left: 55 };

  constructor(canvas: HTMLCanvasElement, opts: MiniChartOpts = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d canvas context unavailable');
    this.ctx = ctx;
    this.title = opts.title ?? '';
    this.yLabel = opts.yLabel ?? 'Loss';
    this.y2Label = opts.y2Label ?? 'Accuracy';
  }

  /** Register a named series, drawn with its own dash pattern ([] is solid). */
  addSeries(name: string, dash: number[], yAxis: 'left' | 'right' = 'left'): void {
    this.series[name] = { dash, yAxis, points: [] };
  }

  /** Append a data point to a series. */
  addPoint(seriesName: string, x: number, y: number): void {
    this.series[seriesName]?.points.push({ x, y });
  }

  /** Remove all data points (keeps series definitions). */
  clear(): void {
    for (const s of this.allSeries()) s.points = [];
  }

  private allSeries(): Series[] {
    return Object.values(this.series).filter((s): s is Series => s !== undefined);
  }

  /** Redraw the chart. */
  render(): void {
    const { canvas, ctx, padding: p } = this;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    const ink = token('--ink', 'black');
    const muted = token('--ink-3', 'gray');
    const gridCol = token('--paper-4', 'silver');
    const face = token('--font-sans', 'sans-serif');
    const font = (px: number, bold = false) => `${bold ? 'bold ' : ''}${String(px)}px ${face}`;

    ctx.fillStyle = token('--paper', 'white');
    ctx.fillRect(0, 0, W, H);

    // Compute ranges
    const leftSeries = this.allSeries().filter((s) => s.yAxis === 'left' && s.points.length > 0);
    const allPoints = this.allSeries().flatMap((s) => s.points);

    if (allPoints.length === 0) {
      ctx.fillStyle = muted;
      ctx.font = font(13);
      ctx.textAlign = 'center';
      ctx.fillText('No data yet', W / 2, H / 2);
      return;
    }

    const xMin = Math.min(...allPoints.map((pt) => pt.x));
    const xMax = Math.max(...allPoints.map((pt) => pt.x));
    const leftMin = leftSeries.length
      ? Math.min(...leftSeries.flatMap((s) => s.points.map((pt) => pt.y)))
      : 0;
    const leftMax = leftSeries.length
      ? Math.max(...leftSeries.flatMap((s) => s.points.map((pt) => pt.y)))
      : 1;
    const rightMin = 0;
    const rightMax = 1;

    const plotW = W - p.left - p.right;
    const plotH = H - p.top - p.bottom;

    const frame: Frame = {
      W,
      H,
      plotW,
      plotH,
      ink,
      muted,
      gridCol,
      font,
      leftMin,
      leftMax,
      scaleX: (v) => p.left + (xMax > xMin ? ((v - xMin) / (xMax - xMin)) * plotW : plotW / 2),
      scaleYL: (v) => {
        const range = leftMax - leftMin || 1;
        return p.top + plotH - ((v - leftMin) / range) * plotH;
      },
      scaleYR: (v) => p.top + plotH - ((v - rightMin) / (rightMax - rightMin)) * plotH,
    };

    this.drawGridAndAxes(frame);
    this.drawTitles(frame);
    this.drawSeries(frame);
    this.drawLegend(frame);
  }

  private drawGridAndAxes(f: Frame): void {
    const { ctx, padding: p } = this;
    ctx.strokeStyle = f.gridCol;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = p.top + (f.plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(p.left, y);
      ctx.lineTo(f.W - p.right, y);
      ctx.stroke();
    }

    ctx.fillStyle = f.muted;
    ctx.font = f.font(12);
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = p.top + (f.plotH / 4) * i;
      const range = f.leftMax - f.leftMin || 1;
      const val = f.leftMax - (range / 4) * i;
      ctx.fillText(val.toFixed(3), p.left - 5, y + 3);
    }
    ctx.textAlign = 'left';
    for (let i = 0; i <= 4; i++) {
      const y = p.top + (f.plotH / 4) * i;
      const val = 1 - i / 4;
      ctx.fillText((val * 100).toFixed(0) + '%', f.W - p.right + 5, y + 3);
    }
  }

  private drawTitles(f: Frame): void {
    const { ctx, padding: p } = this;
    if (this.title) {
      ctx.fillStyle = f.ink;
      ctx.font = f.font(13, true);
      ctx.textAlign = 'center';
      ctx.fillText(this.title, f.W / 2, 16);
    }

    ctx.save();
    ctx.font = f.font(12);
    ctx.textAlign = 'center';
    ctx.fillStyle = f.muted;
    ctx.translate(10, p.top + f.plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(this.yLabel, 0, 0);
    ctx.restore();
    ctx.save();
    ctx.translate(f.W - 8, p.top + f.plotH / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillText(this.y2Label, 0, 0);
    ctx.restore();
  }

  private drawSeries(f: Frame): void {
    const { ctx } = this;
    for (const s of this.allSeries()) {
      if (s.points.length === 0) continue;
      const scaleFn = s.yAxis === 'left' ? f.scaleYL : f.scaleYR;
      ctx.strokeStyle = f.ink;
      ctx.lineWidth = 1.5;
      ctx.setLineDash(s.dash);
      ctx.beginPath();
      s.points.forEach((pt, i) => {
        const px = f.scaleX(pt.x);
        const py = scaleFn(pt.y);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      // Points: filled squares on the loss axis, hollow on the accuracy axis.
      for (const pt of s.points) {
        const x = f.scaleX(pt.x) - 2;
        const y = scaleFn(pt.y) - 2;
        if (s.yAxis === 'left') {
          ctx.fillStyle = f.ink;
          ctx.fillRect(x, y, 4, 4);
        } else {
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, 3, 3);
        }
      }
    }
  }

  private drawLegend(f: Frame): void {
    const { ctx, padding: p } = this;
    const legendItems = Object.entries(this.series).filter(
      (entry): entry is [string, Series] => !!entry[1] && entry[1].points.length > 0,
    );
    if (legendItems.length === 0) return;
    ctx.font = f.font(12);
    ctx.textAlign = 'left';
    let lx = p.left + 5;
    const ly = f.H - 6;
    for (const [name, s] of legendItems) {
      // A sample of the series' own dash, not a colour swatch.
      ctx.strokeStyle = f.ink;
      ctx.lineWidth = 1.5;
      ctx.setLineDash(s.dash);
      ctx.beginPath();
      ctx.moveTo(lx, ly - 4);
      ctx.lineTo(lx + 22, ly - 4);
      ctx.stroke();
      ctx.setLineDash([]);
      lx += 26;
      ctx.fillStyle = f.ink;
      ctx.fillText(name, lx, ly);
      lx += ctx.measureText(name).width + 14;
    }
  }
}
