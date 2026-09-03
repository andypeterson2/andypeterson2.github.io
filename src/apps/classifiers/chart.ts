/**
 * Minimal dual-axis line chart for training curves.
 *
 * Renders loss (left Y-axis) and accuracy (right Y-axis) on a single canvas.
 * No external dependencies — uses the Canvas 2D API directly.
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
  color: string;
  yAxis: 'left' | 'right';
  points: Point[];
}

interface Frame {
  W: number;
  H: number;
  plotW: number;
  plotH: number;
  textCol: string;
  gridCol: string;
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

  /** Register a named series. */
  addSeries(name: string, color: string, yAxis: 'left' | 'right' = 'left'): void {
    this.series[name] = { color, yAxis, points: [] };
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

    // Colours from CSS custom properties
    const style = getComputedStyle(document.documentElement);
    const bg = style.getPropertyValue('--surface').trim() || '#3a3830';
    const textCol = style.getPropertyValue('--text-muted').trim() || '#7c7160';
    const gridCol = style.getPropertyValue('--border').trim() || '#504d40';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Compute ranges
    const leftSeries = this.allSeries().filter((s) => s.yAxis === 'left' && s.points.length > 0);
    const allPoints = this.allSeries().flatMap((s) => s.points);

    if (allPoints.length === 0) {
      ctx.fillStyle = textCol;
      ctx.font = '12px Inter, sans-serif';
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
      textCol,
      gridCol,
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
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = p.top + (f.plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(p.left, y);
      ctx.lineTo(f.W - p.right, y);
      ctx.stroke();
    }

    ctx.fillStyle = f.textCol;
    ctx.font = '10px Inter, sans-serif';
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
      ctx.fillStyle = f.textCol;
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.title, f.W / 2, 14);
    }

    ctx.save();
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = f.textCol;
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
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      s.points.forEach((pt, i) => {
        const px = f.scaleX(pt.x);
        const py = scaleFn(pt.y);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      // Draw dots
      ctx.fillStyle = s.color;
      for (const pt of s.points) {
        ctx.beginPath();
        ctx.arc(f.scaleX(pt.x), scaleFn(pt.y), 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawLegend(f: Frame): void {
    const { ctx, padding: p } = this;
    const legendItems = Object.entries(this.series).filter(
      (entry): entry is [string, Series] => !!entry[1] && entry[1].points.length > 0,
    );
    if (legendItems.length === 0) return;
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'left';
    let lx = p.left + 5;
    const ly = f.H - 6;
    for (const [name, s] of legendItems) {
      ctx.fillStyle = s.color;
      ctx.fillRect(lx, ly - 5, 10, 3);
      lx += 14;
      ctx.fillStyle = f.textCol;
      ctx.fillText(name, lx, ly);
      lx += ctx.measureText(name).width + 12;
    }
  }
}
