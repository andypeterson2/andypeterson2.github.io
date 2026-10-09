/**
 * Multi-Dataset Classifier App — client-side SPA logic.
 *
 * Reusable UI behaviours (theme toggle, drawer, dropdown, resize, log
 * terminal) come from the ui-kit module; this one handles application logic:
 * state management, SSE streaming, training, evaluation, prediction, model
 * persistence, and canvas drawing.
 *
 * Server responses are typed at the boundary with the Raw* interfaces below,
 * hand-derived from the classifier backend's route handlers.
 */

import { initDropdown, onEscape } from '../ui-kit/ui-kit';
import { connectionManager } from './connection';
import { consumeSSE, type SseStructuredEvent } from './sse';
import { MiniChart } from './chart';
import {
  ClassifierInfer,
  isBlank,
  preprocessDigit,
  type ClassifierModel,
  type Prediction,
} from './infer';

import { ServiceConfig } from '../shared/service-config';
import { SitePass } from '../shared/pass';

// Backend config
// window.API_BASE / window.UI_CONFIG are seeded before this module runs. API_BASE
// changes whenever the user connects a backend, so the per-dataset URL prefix is
// computed live via base() rather than frozen at module-load time.
document.addEventListener('navbar:connect', (e) => {
  const detail = (e as CustomEvent<{ service?: string; url?: string }>).detail;
  if (detail.service !== 'classifiers' || !detail.url) return;
  // Allowlist the origin before adopting it: anything on the page can dispatch
  // a CustomEvent, and API_BASE decides where model inputs get POSTed.
  if (!ServiceConfig.isAllowedUrl(detail.url)) {
    console.warn('[classifiers] Ignoring navbar:connect URL outside the allowlist:', detail.url);
    return;
  }
  window.API_BASE = detail.url;
});

/** Live URL prefix for all API calls scoped to the active dataset. */
function base(): string {
  const ds = window.UI_CONFIG?.name ?? 'mnist';
  return (window.API_BASE ?? '') + `/d/${ds}`;
}

// Connection-aware fetch wrapper

/** A live channel is up; 'degraded' is a live channel that missed one ping. */
function isLive(): boolean {
  const s = connectionManager.state;
  return s === 'connected' || s === 'degraded';
}

/** True when no live backend is connected — the demo tier runs inference in-browser. */
function isOffline(): boolean {
  return !isLive();
}

/**
 * Thin wrapper around fetch that checks the connection manager state before
 * issuing a request. Throws immediately when offline so callers can
 * surface a user-visible error instead of hanging silently.
 */
async function apiFetch(url: string | URL | Request, opts?: RequestInit): Promise<Response> {
  if (isOffline()) {
    throw new Error('Not connected to server');
  }
  return fetch(url, opts);
}

// Wire shapes (hand-derived from the classifier backend routes)

interface RawEnvelope {
  error?: { code?: string; message?: string } | string;
}

interface RawEvalResult {
  accuracy: number;
  avg_loss: number | null;
  per_class_accuracy: Record<string, number | undefined>;
  num_params: number | null;
}

interface RawModelInfo {
  model_type: string;
  epochs: number;
  batch_size: number;
  lr: number;
  num_params?: number | null;
  training_history?: unknown[];
  stopped_early?: boolean;
  eval_result?: RawEvalResult | null;
}

interface RawTrainDone {
  name: string;
  model_type: string;
  epochs: number;
  batch_size: number;
  lr: number;
  num_params?: number | null;
  history?: unknown[];
  stopped_early?: boolean;
  epochs_completed?: number;
  best_val_accuracy?: number | null;
}

interface RawEvaluateDone {
  results: Record<string, RawEvalResult | undefined>;
}

interface RawSavedModel {
  filename: string;
  name: string;
  model_type: string;
  epochs: number;
}

interface RawLoadedModel extends RawEnvelope {
  name: string;
  model_type: string;
  epochs: number;
  batch_size: number;
  lr: number;
}

interface RawPredictResponse extends RawEnvelope {
  results?: Record<string, Prediction | undefined>;
}

interface RawEnsembleResponse extends RawEnvelope {
  accuracy: number;
  avg_loss: number | null;
  per_class_accuracy: Record<string, number | undefined>;
}

/**
 * Extract a "code: message" string from a parsed contract error envelope
 * ({ error: { code, message } }), or null when the body carries no error.
 */
function envelopeError(data: RawEnvelope | null | undefined): string | null {
  if (!data?.error) return null;
  if (typeof data.error === 'object') {
    return (
      (data.error.code ? data.error.code + ': ' : '') + (data.error.message ?? 'request failed')
    );
  }
  return data.error;
}

/** A failed live call, carrying the HTTP status. */
class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** The page is back on its in-browser models: the gateway refused the pass. */
function dropToBrowserTier(): void {
  SitePass.clear();
  connectionManager.disconnect();
  document.dispatchEvent(
    new CustomEvent('navbar:connect-failed', {
      detail: { service: 'classifiers', reason: 'unauthorized' },
    }),
  );
}

/**
 * Fetch and parse a live route. A non-2xx status or an error envelope throws an
 * ApiError; a refused pass (401/402) also drops the page to the browser tier.
 */
async function apiJson<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await apiFetch(url, opts);
  const data = (await res.json().catch(() => null)) as (T & RawEnvelope) | null;
  const err = envelopeError(data);
  if (!res.ok || err || data === null) {
    if (res.status === 401 || res.status === 402) dropToBrowserTier();
    throw new ApiError(res.status, err ?? `HTTP ${String(res.status)}`);
  }
  return data;
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// State

/** A session model as the UI tracks it (server-trained, ensemble, or in-browser). */
interface ModelInfo {
  model_type: string;
  epochs: number | string;
  batch_size: number | string;
  lr: number | null;
  num_params?: number | null;
  training_history?: unknown[];
  stopped_early?: boolean;
  eval_result: RawEvalResult | null;
  /** Accuracy drop per ablated layer, filled in by an ablation run. */
  ablation?: Record<string, number>;
  /** In-browser demo model — no backend to ablate/export/remove against. */
  _local?: boolean;
  /** Model asset name for the in-browser tier. */
  _file?: string;
  /** The classes a shipped model knows, which can be fewer than the dataset's. */
  _classes?: string[] | undefined;
  /** The inputs a shipped model reads, which can be a subset of the form's. */
  _features?: string[] | undefined;
  /** Wilson interval on the test accuracy, with the sample it came from. */
  _accCi?: [number, number] | undefined;
  _testN?: number | undefined;
  _testProtocol?: string | undefined;
  /** Mean accuracy over several splits, where one held-out split is too small. */
  _cvAccuracy?: number | undefined;
  _cvSplits?: number | undefined;
  /** Computed in this page (the ensemble result); the backend has no model by this name. */
  _virtual?: boolean;
  /** The paper a model recreates, e.g. "Yang et al. 2019". */
  _cite?: string | undefined;
}

/** Application state — single source of truth for loaded models and predictions. */
const state: {
  models: Partial<Record<string, ModelInfo>>;
  predictions: Partial<Record<string, Prediction & { outOfScope?: boolean }>>;
} = {
  models: {},
  predictions: {},
};

function modelEntries(): [string, ModelInfo][] {
  return Object.entries(state.models).filter(
    (entry): entry is [string, ModelInfo] => entry[1] !== undefined,
  );
}

/** Models the live backend holds, excluding the in-browser ones and the page's ensemble. */
function serverNames(): string[] {
  return modelEntries()
    .filter(([, m]) => !m._local && !m._virtual)
    .map(([name]) => name);
}

// Smart naming

/** Generate the next available default name for a model type. */
function defaultName(modelType: string): string {
  const names = Object.keys(state.models);
  if (!names.includes(modelType)) return modelType;
  let n = 2;
  while (names.includes(`${modelType} ${String(n)}`)) n++;
  return `${modelType} ${String(n)}`;
}

// DOM helpers / refs

function byId<T extends HTMLElement>(id: string, ctor: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof ctor))
    throw new Error(`classifier app: #${id} missing from the page (or wrong element kind)`);
  return el;
}

const dropdown = initDropdown(
  byId('dataset-menu-btn', HTMLElement),
  byId('dataset-menu', HTMLElement),
);

onEscape(() => {
  dropdown.close();
});

const canvasCol = byId('canvas-col', HTMLElement);
const tabularCol = byId('tabular-col', HTMLElement);

const canvas = byId('draw-canvas', HTMLCanvasElement);
const canvasCtx = canvas.getContext('2d');
if (!canvasCtx) throw new Error('classifier app: 2d canvas context unavailable');
const ctx = canvasCtx;
const seenCtx = byId('seen-canvas', HTMLCanvasElement).getContext('2d');
const trainBtn = byId('train-btn', HTMLButtonElement);
const clearBtn = byId('clear-btn', HTMLButtonElement);
const importBtn = byId('import-btn', HTMLButtonElement);
const refreshSavedBtn = byId('refresh-saved-btn', HTMLButtonElement);
const savedSelect = byId('saved-select', HTMLSelectElement);
const datasetList = byId('dataset-list', HTMLElement);
const datasetCurrent = byId('dataset-current', HTMLElement);
const evalProgress = byId('evaluate-progress', HTMLElement);
const evalBar = byId('eval-bar', HTMLElement);
const evalStatus = byId('eval-status', HTMLElement);
// What a failed run says, in the card whose button started it.
const trainStatus = byId('train-status', HTMLElement);
const modelsStatus = byId('models-status', HTMLElement);
const savedStatus = byId('saved-status', HTMLElement);
const ablationStatus = modelsStatus;
const metricsHead = byId('metrics-head', HTMLElement);
const metricsBody = byId('metrics-body', HTMLElement);
const modelNameInput = byId('model-name', HTMLInputElement);
const chartArea = byId('chart-area', HTMLElement);
const trainChartCanvas = byId('train-chart', HTMLCanvasElement);
const ensembleBtn = byId('ensemble-btn', HTMLButtonElement);
const teacherSelect = byId('teacher-select', HTMLSelectElement);
const distillRow = byId('distill-row', HTMLElement);
const modelTypeSelect = byId('model-type', HTMLSelectElement);

let trainChart: MiniChart | null = null;

// Input-type visibility

function applyInputVisibility(): void {
  const image = window.UI_CONFIG?.input_type === 'image';
  canvasCol.classList.toggle('hidden', !image);
  tabularCol.classList.toggle('hidden', image);
}
applyInputVisibility();

// Model info panel

// Element/attribute allowlist for the backend's model-info HTML. Anything not
// listed is unwrapped (text kept) or, for script-bearing containers, removed.
const INFO_DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META']);
const INFO_ALLOWED_TAGS = new Set([
  'H1',
  'H2',
  'H3',
  'H4',
  'P',
  'UL',
  'OL',
  'LI',
  'STRONG',
  'EM',
  'B',
  'I',
  'CODE',
  'PRE',
  'TABLE',
  'THEAD',
  'TBODY',
  'TR',
  'TH',
  'TD',
  'A',
  'BR',
  'HR',
  'BLOCKQUOTE',
  'SPAN',
  'DIV',
  'SUB',
  'SUP',
]);

function sanitizeInfoTree(root: HTMLElement): void {
  for (const el of [...root.querySelectorAll('*')]) {
    if (INFO_DROP_TAGS.has(el.tagName)) {
      el.remove();
      continue;
    }
    if (!INFO_ALLOWED_TAGS.has(el.tagName)) {
      el.replaceWith(...el.childNodes); // unwrap unknown elements, keep text
      continue;
    }
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name === 'href' && /^(https?:|#|\/)/i.test(attr.value.trim())) continue;
      el.removeAttribute(attr.name); // default-deny: no handlers, styles, srcs
    }
  }
}

async function fetchModelInfo(modelType: string): Promise<void> {
  const details = byId('model-info-details', HTMLElement);
  const panel = byId('model-info-panel', HTMLElement);
  if (!modelType || isOffline()) {
    details.classList.add('hidden');
    return;
  }
  try {
    const res = await apiFetch(`${base()}/model-info/${encodeURIComponent(modelType)}`);
    if (!res.ok) {
      details.classList.add('hidden');
      return;
    }
    const data = (await res.json()) as { html?: string };
    const doc = new DOMParser().parseFromString(data.html ?? '', 'text/html');
    sanitizeInfoTree(doc.body);
    // Adopt the sanitized nodes directly: an innerHTML re-parse is the classic mXSS lane
    // (inert markup can mutate into live script). replaceChildren never re-parses.
    panel.replaceChildren(...doc.body.childNodes);
    details.classList.remove('hidden');
  } catch {
    details.classList.add('hidden');
  }
}

// Refresh default name when model type changes

modelTypeSelect.addEventListener('change', () => {
  modelNameInput.value = defaultName(modelTypeSelect.value);
  void fetchModelInfo(modelTypeSelect.value);
});

// Show/hide distillation weight when teacher is selected
teacherSelect.addEventListener('change', () => {
  distillRow.classList.toggle('hidden', !teacherSelect.value);
});

/** Update teacher select dropdown with current session models. */
function updateTeacherSelect(): void {
  const current = teacherSelect.value;
  teacherSelect.innerHTML = '<option value="">— none —</option>';
  for (const name of serverNames()) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    teacherSelect.appendChild(opt);
  }
  teacherSelect.value = current;
  distillRow.classList.toggle('hidden', !teacherSelect.value);
}

/** Update ensemble button visibility (needs 2+ models). */
function updateEnsembleBtn(): void {
  ensembleBtn.classList.toggle('hidden', serverNames().length < 2);
}

// Dataset menu (client-side switching, no navigation)

// Populate the dataset dropdown from the client-side list and switch in place.
// The portal has no per-dataset routes (/d/<name>/ would 404) and the demo runs
// entirely client-side, so switching just reconfigures the UI + reloads weights.
function renderDatasetMenu(): void {
  const datasets = window.CLASSIFIER_DATASETS ?? [];
  const current = window.UI_CONFIG?.name;
  datasetList.innerHTML = '';
  // The trigger says which dataset is loaded ("Dataset: Iris ▾"), and so does the
  // list, to a screen reader as well as by the highlight.
  const loaded = datasets.find((d) => d.name === current);
  if (loaded) datasetCurrent.textContent = loaded.display_name.split(' ')[0] ?? loaded.name;
  for (const ds of datasets) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ui-dropdown-item' + (ds.name === current ? ' active' : '');
    if (ds.name === current) btn.setAttribute('aria-current', 'true');
    btn.textContent = ds.display_name;
    btn.addEventListener('click', () => {
      dropdown.close();
      if (ds.name !== window.UI_CONFIG?.name) void switchDataset(ds.name);
    });
    datasetList.appendChild(btn);
  }
}

// Canvas drawing (28×28 pixel grid for MNIST)

const GRID = 28;
const CELL = canvas.width / GRID; // 280 / 28 = 10px per cell
let drawing = false;

/** 28×28 grid of pixel intensities (0–255). */
const grid = new Uint8Array(GRID * GRID);

/** Render the whole pixel grid onto the canvas; the cell lines are a CSS overlay. */
function renderGrid(): void {
  const img = ctx.createImageData(canvas.width, canvas.height);
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const v = grid[gy * GRID + gx] ?? 0;
      const x0 = Math.round(gx * CELL);
      const y0 = Math.round(gy * CELL);
      const x1 = Math.round((gx + 1) * CELL);
      const y1 = Math.round((gy + 1) * CELL);
      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          const i = (py * canvas.width + px) * 4;
          img.data[i] = v;
          img.data[i + 1] = v;
          img.data[i + 2] = v;
          img.data[i + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Repaint one cell from the grid. */
function paintCell(gx: number, gy: number): void {
  const v = grid[gy * GRID + gx] ?? 0;
  const x0 = Math.round(gx * CELL);
  const y0 = Math.round(gy * CELL);
  ctx.fillStyle = `rgb(${String(v)} ${String(v)} ${String(v)})`;
  ctx.fillRect(x0, y0, Math.round((gx + 1) * CELL) - x0, Math.round((gy + 1) * CELL) - y0);
}

/** Paint 784 grayscale values (light ink on black) into a 28×28 context. */
function putDigit(target: CanvasRenderingContext2D, digit: ArrayLike<number>): void {
  const img = target.createImageData(GRID, GRID);
  for (let i = 0; i < digit.length; i++) {
    const v = digit[i] ?? 0;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  target.putImageData(img, 0, 0);
}

/** The digit as a 28×28 PNG, base64 without the data: prefix (what /predict takes). */
function digitPng(digit: ArrayLike<number>): string {
  const c = document.createElement('canvas');
  c.width = c.height = GRID;
  const g = c.getContext('2d');
  if (!g) return '';
  putDigit(g, digit);
  return c.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
}

/** The last digit drawn in the "as the model sees it" thumbnail. */
let seenDigit: ArrayLike<number> = grid;

function showSeen(digit: ArrayLike<number>): void {
  seenDigit = digit;
  if (seenCtx) putDigit(seenCtx, digit);
}

function clearCanvas(): void {
  grid.fill(0);
  renderGrid();
  showSeen(grid);
}
clearCanvas();

// The browser can drop a canvas's bitmap (GPU reset, memory pressure) and hand it back
// blank; strokes only repaint the cells they touch, so repaint everything from the grid.
canvas.addEventListener('contextrestored', renderGrid);
byId('seen-canvas', HTMLCanvasElement).addEventListener('contextrestored', () => {
  showSeen(seenDigit);
});

function getGridPos(e: MouseEvent | TouchEvent): { gx: number; gy: number } {
  const rect = canvas.getBoundingClientRect();
  // .item(0) is honestly nullable (touchend delivers an empty TouchList).
  const src = 'touches' in e ? e.touches.item(0) : e;
  const clientX = src?.clientX ?? 0;
  const clientY = src?.clientY ?? 0;
  const gx = Math.floor(((clientX - rect.left) / rect.width) * GRID);
  const gy = Math.floor(((clientY - rect.top) / rect.height) * GRID);
  return { gx: Math.max(0, Math.min(GRID - 1, gx)), gy: Math.max(0, Math.min(GRID - 1, gy)) };
}

function paintPixel(e: MouseEvent | TouchEvent): void {
  if (!drawing) return;
  e.preventDefault();
  const { gx, gy } = getGridPos(e);
  // Paint a soft 3×3 brush: centre=255, neighbours=128
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = gx + dx,
        ny = gy + dy;
      if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) continue;
      const idx = ny * GRID + nx;
      const add = dx === 0 && dy === 0 ? 255 : 128;
      grid[idx] = Math.min(255, (grid[idx] ?? 0) + add);
      paintCell(nx, ny);
    }
  }
}

function strokeEnd(): void {
  drawing = false;
  if (window.UI_CONFIG?.input_type === 'image') scheduleAutoPredict();
}

canvas.addEventListener('mousedown', (e) => {
  drawing = true;
  paintPixel(e);
});
canvas.addEventListener('mousemove', paintPixel);
canvas.addEventListener('mouseup', strokeEnd);
// A stroke that runs off the pad ends there, and still gets scored.
canvas.addEventListener('mouseleave', () => {
  if (drawing) strokeEnd();
});
canvas.addEventListener(
  'touchstart',
  (e) => {
    drawing = true;
    paintPixel(e);
  },
  { passive: false },
);
canvas.addEventListener('touchmove', paintPixel, { passive: false });
canvas.addEventListener('touchend', strokeEnd);

// Utilities

function pct(v: number): string {
  return (v * 100).toFixed(1) + '%';
}
function accClass(v: number): string {
  return v >= 0.95 ? 'acc-high' : v >= 0.8 ? 'acc-med' : 'acc-low';
}
function confClass(v: number): string {
  return v >= 0.8 ? 'conf-high' : 'conf-low';
}

// Session models list (MODELS card)

/** Ablation and save-to-disk, for a model the backend holds. */
function serverModelActions(name: string): HTMLButtonElement[] {
  const ablationBtn = document.createElement('button');
  ablationBtn.className = 's6-btn s6-btn--icon s6-btn--sm';
  ablationBtn.dataset.ablation = name;
  ablationBtn.title = 'Ablation study';
  ablationBtn.textContent = '⊘';
  const exportBtn = document.createElement('button');
  exportBtn.className = 's6-btn s6-btn--icon';
  exportBtn.dataset.export = name;
  exportBtn.title = 'Save to disk';
  exportBtn.setAttribute('aria-label', 'Save ' + name + ' to disk');
  exportBtn.textContent = '⤓';
  return [ablationBtn, exportBtn];
}

function buildSessionModelsList(): void {
  updateTeacherSelect();
  updateEnsembleBtn();
}

// Prediction table (TRY card)

function predictionAnswerCell(
  p: (Prediction & { outOfScope?: boolean }) | undefined,
): HTMLTableCellElement {
  const td = document.createElement('td');
  if (!p) {
    td.textContent = '—';
    return td;
  }
  // Server-supplied strings go through textContent, never innerHTML.
  const span = document.createElement('span');
  span.className = p.outOfScope ? 'pred-label pred-out' : 'pred-label';
  span.textContent = p.prediction;
  td.appendChild(span);
  return td;
}

/**
 * A figure and the bar that gives it a size, so a reader sees how strong a
 * score is without knowing what scale it is on. `lean` runs -1 to 1 and fills
 * out from the middle; otherwise the bar fills from the left.
 */
function scoreBar(fraction: number, opts: { lean?: boolean } = {}): HTMLElement {
  const bar = document.createElement('span');
  bar.className = opts.lean ? 'score-bar score-bar--lean' : 'score-bar';
  const fill = document.createElement('span');
  fill.className = 'score-fill';
  const size = Math.min(Math.abs(fraction), 1);
  if (opts.lean) {
    fill.style.width = `${String(50 * size)}%`;
    fill.style.left = fraction >= 0 ? '50%' : `${String(50 - 50 * size)}%`;
  } else {
    fill.style.width = `${String(100 * size)}%`;
    fill.style.left = '0';
  }
  bar.appendChild(fill);
  return bar;
}

/**
 * How decisive the QSVM was, as a share of the evidence it had: its two feature
 * terms argue for opposite classes, and the margin is what one wins by. At 0%
 * they cancel and the answer sits on the boundary; at 100% one term decided it
 * alone. A ratio rather than the raw margin, which is on no scale a reader knows.
 */
function qsvmLean(q: NonNullable<Prediction['qsvm']>): number {
  const total = Math.abs(q.t1) + Math.abs(q.t2);
  return total === 0 ? 0 : q.s / total;
}

function predictionScoreCell(
  p: Prediction | undefined,
  m: ModelInfo | undefined,
): HTMLTableCellElement {
  const td = document.createElement('td');
  td.className = 'num score-cell';
  if (p?.ovo) {
    // Three pairwise rules decide this one. The figure is the narrowest contest
    // the winner was in: how close the answer came to going the other way.
    const { votes, contests, tightest } = p.ovo;
    const lean = tightest.winner === p.prediction ? tightest.lean : -Math.abs(tightest.lean);
    const num = document.createElement('span');
    num.className = confClass(Math.abs(lean));
    num.textContent = pct(Math.abs(lean));
    td.appendChild(num);
    td.appendChild(scoreBar(lean, { lean: true }));
    const others = contests
      .map((k) => `${k.pair[0]} vs ${k.pair[1]} ${k.s >= 0 ? '+' : ''}${k.s.toFixed(3)}`)
      .join(', ');
    td.title =
      `Vote ${String(votes[p.prediction] ?? 0)} of ${String(contests.length)} for ${p.prediction}. ` +
      `Tightest contest ${tightest.pair[0]} vs ${tightest.pair[1]}, ` +
      `${pct(Math.abs(tightest.lean))} of the evidence. All three: ${others}.`;
  } else if (p?.qsvm) {
    // A sign classifier has no probability; how far it leans is its strength.
    const { f1, f2, s, t1, t2 } = p.qsvm;
    const lean = qsvmLean(p.qsvm);
    const num = document.createElement('span');
    num.className = confClass(Math.abs(lean));
    num.textContent = pct(Math.abs(lean));
    td.appendChild(num);
    td.appendChild(scoreBar(lean, { lean: true }));
    const sides = m?._classes ?? [];
    const toward = lean >= 0 ? sides[0] : sides[1];
    td.title =
      `Margin ${s.toFixed(3)}, ${pct(Math.abs(lean))} of the evidence` +
      (toward ? ` toward ${toward}` : '') +
      `. Feature terms ${t1.toFixed(3)} and ${t2.toFixed(3)}, from f1 ${f1.toFixed(2)} and f2 ${f2.toFixed(2)}.`;
  } else if (p?.confidence != null) {
    const num = document.createElement('span');
    num.className = confClass(p.confidence);
    num.textContent = pct(p.confidence);
    td.appendChild(num);
    td.appendChild(scoreBar(p.confidence));
    td.title = 'Softmax of the top class: uncalibrated, so high on a scribble too';
  } else {
    td.textContent = '—';
  }
  return td;
}

/**
 * Refill the two cells that move under the pen, leaving the rest of the table
 * alone. A stroke lands several times a second, and rebuilding eighteen columns
 * at that rate would throw away scroll position and every open tooltip.
 */
function buildPredictionTable(): void {
  const now = metricSections(window.UI_CONFIG?.class_labels ?? []).find(
    (sec) => sec.label === 'Now',
  );
  if (!now) return;
  for (const [name, m] of modelEntries()) {
    const tr = metricsBody.querySelector<HTMLTableRowElement>(
      `tr[data-model="${CSS.escape(name)}"]`,
    );
    // No such row yet: the table has not been built, or it has no models.
    if (!tr) continue;
    for (const row of now.rows) {
      const cell = tr.querySelector<HTMLTableCellElement>(
        `td[data-metric="${CSS.escape(row.key)}"]`,
      );
      if (cell) cell.replaceWith(metricCell(row, m, name));
    }
  }
}

// Metrics table: a row per model, a column per metric (TEST card)

interface MetricRow {
  key: string;
  fn: (m: ModelInfo, name: string) => string;
  cls?: string;
  html?: boolean;
  /** An extra class on the cell, e.g. the headline Test Acc column. */
  cellCls?: string;
  /**
   * Builds the cell itself, for a value that is more than text. Preferred over
   * `html`, which would need every server-supplied string escaped by hand.
   */
  node?: (m: ModelInfo, name: string) => HTMLTableCellElement;
  /** Shown on hover against the row's label. */
  note?: string;
}

interface MetricSection {
  label: string;
  rows: MetricRow[];
  /**
   * Drawn even when every cell is empty. The live columns must exist before the
   * first stroke, because the updater refills them rather than creating them.
   */
  always?: boolean;
}

/**
 * What a test accuracy was measured over: the sample, the interval around it,
 * and the protocol. A percentage on 30 samples is worth four points either way.
 */
function accuracyNote(m: ModelInfo): string {
  const acc = m.eval_result?.accuracy ?? 0;
  const parts: string[] = [];
  if (m._testN) parts.push(`${String(Math.round(acc * m._testN))} of ${String(m._testN)}`);
  if (m._accCi) parts.push(`95% CI ${pct(m._accCi[0])}–${pct(m._accCi[1])}`);
  if (m._cvAccuracy != null) {
    parts.push(`${pct(m._cvAccuracy)} over ${String(m._cvSplits ?? 0)} splits`);
  }
  if (m._testProtocol) parts.push(m._testProtocol);
  return parts.length > 0 ? parts.join('; ') : 'Measured on the held-out split';
}

/** Every layer any model has an ablation figure for, in first-seen order. */
function ablatedLayers(): string[] {
  const seen: string[] = [];
  for (const [, m] of modelEntries()) {
    for (const layer of Object.keys(m.ablation ?? {})) {
      if (!seen.includes(layer)) seen.push(layer);
    }
  }
  return seen;
}

function metricSections(labels: string[]): MetricSection[] {
  return [
    // First, because it is what changes under the pen: everything after it
    // holds still while these two columns move.
    {
      label: 'Now',
      always: true,
      rows: [
        {
          key: 'Prediction',
          fn: (_m, name) => (state.predictions[name] ? 'answered' : '—'),
          node: (_m, name) => predictionAnswerCell(state.predictions[name]),
          cellCls: 'metric-headline',
        },
        {
          key: 'Score',
          fn: (_m, name) => (state.predictions[name] ? 'scored' : '—'),
          node: (m, name) => predictionScoreCell(state.predictions[name], m),
          note: 'How sure the model is. Linear models: softmax of the top class, uncalibrated. QSVM: how far its margin leans, as a share of the evidence its features gave it; for the one-vs-one rule, the narrowest contest the winner was in.',
        },
      ],
    },
    {
      label: 'Config',
      rows: [
        { key: 'Type', fn: (m) => m.model_type },
        { key: 'Epochs', fn: (m) => String(m.epochs), cls: 'cfg-cell num' },
        { key: 'Batch', fn: (m) => String(m.batch_size), cls: 'cfg-cell num' },
        {
          key: 'LR',
          fn: (m) => (m.lr != null ? parseFloat(m.lr.toPrecision(4)).toString() : '—'),
          cls: 'cfg-cell num',
        },
        {
          key: 'Params',
          fn: (m) => (m.num_params ? m.num_params.toLocaleString() : '—'),
          cls: 'cfg-cell num',
        },
        { key: 'Early Stop', fn: (m) => (m.stopped_early ? 'Yes' : '—'), cls: 'cfg-cell' },
        {
          key: 'Reads',
          fn: (m) => m._features?.join(', ') ?? '—',
          cls: 'cfg-cell',
          note: 'The inputs this model takes. A form input missing here does not move its answer.',
        },
      ],
    },
    {
      label: 'Evaluation',
      rows: [
        {
          key: 'Test Acc',
          fn: (m) => (m.eval_result ? pct(m.eval_result.accuracy) : '—'),
          cls: 'num',
          cellCls: 'metric-headline',
          // A bare percentage on 30 samples reads as precise. The hover carries
          // the sample it came from and the interval around it.
          node: (m) => {
            const td = document.createElement('td');
            td.className = 'num';
            if (!m.eval_result) {
              td.textContent = '—';
              return td;
            }
            const span = document.createElement('span');
            span.className = accClass(m.eval_result.accuracy);
            span.textContent = pct(m.eval_result.accuracy);
            td.appendChild(span);
            td.title = accuracyNote(m);
            return td;
          },
        },
        {
          key: 'Test Loss',
          fn: (m) => (m.eval_result?.avg_loss != null ? m.eval_result.avg_loss.toFixed(4) : '—'),
          cls: 'num',
        },
      ],
    },
    {
      label: 'Ablation (accuracy drop)',
      rows: ablatedLayers().map((layer) => ({
        key: layer,
        fn: (m: ModelInfo) => {
          const drop = m.ablation?.[layer];
          // A bigger drop means the layer carried more of the answer, so the
          // scale runs the other way from accuracy.
          return drop != null ? `<span class="${accClass(1 - drop)}">${pct(drop)}</span>` : '—';
        },
        html: true,
        cls: 'num',
      })),
    },
    {
      label: 'Per-Class Accuracy',
      rows: labels.map((label) => ({
        key: label,
        fn: (m: ModelInfo) => {
          if (!m.eval_result) return '—';
          const acc = m.eval_result.per_class_accuracy[label];
          return acc != null ? `<span class="${accClass(acc)}">${pct(acc)}</span>` : '—';
        },
        html: true,
        cls: 'num',
      })),
    },
  ];
}

/**
 * The two header rows: the section each metric belongs to, then the metrics
 * themselves. Actions spans both, because it belongs to no section.
 */
function buildMetricsHead(sections: MetricSection[], withActions: boolean): void {
  const groupTr = document.createElement('tr');
  const corner = document.createElement('th');
  corner.className = 'corner-cell';
  corner.scope = 'col';
  corner.rowSpan = 2;
  // An empty header announces nothing: name it for screen readers, visually hidden.
  const cornerLabel = document.createElement('span');
  cornerLabel.className = 'sr-only';
  cornerLabel.textContent = 'Model';
  corner.appendChild(cornerLabel);
  groupTr.appendChild(corner);
  for (const section of sections) {
    const th = document.createElement('th');
    th.scope = 'colgroup';
    th.colSpan = section.rows.length;
    th.className = 'metrics-section-head';
    th.textContent = section.label;
    groupTr.appendChild(th);
  }
  if (withActions) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.rowSpan = 2;
    th.className = 'metric-label';
    th.dataset.metric = 'Actions';
    th.textContent = 'Actions';
    groupTr.appendChild(th);
  }

  const keyTr = document.createElement('tr');
  for (const section of sections) {
    for (const row of section.rows) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.className = 'metric-label';
      // Named, so the column that changes under the pen can be found and
      // refilled without rebuilding the table around it.
      th.dataset.metric = row.key;
      th.textContent = row.key;
      if (row.note) {
        th.classList.add('has-note');
        th.title = row.note;
      }
      keyTr.appendChild(th);
    }
  }
  metricsHead.replaceChildren(groupTr, keyTr);
}

/** The sections, dropping every metric and section no model has a value for. */
function visibleSections(entries: [string, ModelInfo][], labels: string[]): MetricSection[] {
  return metricSections(labels)
    .map((section) => ({
      label: section.label,
      rows: section.always
        ? section.rows
        : section.rows.filter((row) => entries.some(([n, m]) => row.fn(m, n) !== '—')),
    }))
    .filter((section) => section.rows.length > 0);
}

function buildMetricsTable(): void {
  const entries = modelEntries();
  const labels = window.UI_CONFIG?.class_labels ?? [];

  if (entries.length === 0) {
    metricsHead.innerHTML = '';
    metricsBody.innerHTML = `<tr class="empty-row"><td>No models trained yet</td></tr>`;
    return;
  }

  // An in-browser model has no backend to ablate, export or remove against, so
  // the column appears only once one of the models can use it.
  const withActions = entries.some(([, m]) => !m._local);
  const sections = visibleSections(entries, labels);
  buildMetricsHead(sections, withActions);
  metricsBody.replaceChildren(
    ...entries.map(([name, m]) => modelRow(name, m, sections, withActions)),
  );
}

/** One model: its name, then a cell under every column the table drew. */
function modelRow(
  name: string,
  m: ModelInfo,
  sections: MetricSection[],
  withActions: boolean,
): HTMLTableRowElement {
  const tr = document.createElement('tr');
  // Named, so the cells that change under the pen can be found by model.
  tr.dataset.model = name;
  const nameTh = document.createElement('th');
  nameTh.scope = 'row';
  nameTh.className = 'col-model-name';
  nameTh.textContent = name;
  tr.appendChild(nameTh);
  for (const section of sections) {
    for (const row of section.rows) tr.appendChild(metricCell(row, m, name));
  }
  if (withActions) tr.appendChild(actionsCell(name, m));
  return tr;
}

/** Ablate, export and remove, on the row of the model each acts on. */
function actionsCell(name: string, m: ModelInfo): HTMLTableCellElement {
  const td = document.createElement('td');
  td.className = 'model-actions';
  td.dataset.metric = 'Actions';
  if (m._local) return td;
  if (!m._virtual) td.append(...serverModelActions(name));
  const removeBtn = document.createElement('button');
  removeBtn.className = 's6-btn s6-btn--icon s6-btn--danger';
  removeBtn.dataset.remove = name;
  removeBtn.setAttribute('aria-label', 'Remove ' + name);
  removeBtn.textContent = '×';
  td.appendChild(removeBtn);
  return td;
}

/** One cell of a metric column: the metric builds it, or it is text. */
function metricCell(row: MetricRow, m: ModelInfo, name: string): HTMLTableCellElement {
  let td: HTMLTableCellElement;
  if (row.node) {
    td = row.node(m, name);
  } else {
    td = document.createElement('td');
    if (row.cls) td.className = row.cls;
    const val = row.fn(m, name);
    if (row.html) td.innerHTML = val;
    else td.textContent = val;
  }
  if (row.cellCls) td.classList.add(row.cellCls);
  td.dataset.metric = row.key;
  return td;
}

// Load models from server on page load

async function loadModels(): Promise<void> {
  if (isOffline()) return;
  try {
    const data = await apiJson<Record<string, RawModelInfo | undefined>>(`${base()}/models`);
    for (const [name, info] of Object.entries(data)) {
      if (info?.model_type) state.models[name] = { eval_result: null, ...info };
    }
  } catch (err) {
    modelsStatus.textContent = `Couldn't load the live models — ${errText(err)}`;
    return;
  }
  buildMetricsTable();
  buildPredictionTable();
  buildSessionModelsList();
  modelNameInput.value = defaultName(modelTypeSelect.value);
}

/** Fill the Model select with the live backend's model types for this dataset. */
async function loadModelTypes(): Promise<void> {
  if (isOffline()) return;
  const ds = window.UI_CONFIG?.name ?? 'mnist';
  try {
    const data = await apiJson<{ model_types?: unknown }>(
      `${window.API_BASE ?? ''}/api/datasets/${encodeURIComponent(ds)}/config`,
    );
    const types = Array.isArray(data.model_types)
      ? data.model_types.filter((t): t is string => typeof t === 'string')
      : [];
    modelTypeSelect.replaceChildren(...types.map((t) => new Option(t, t)));
  } catch (err) {
    trainStatus.textContent = `Couldn't load the model types — ${errText(err)}`;
  }
  modelNameInput.value = defaultName(modelTypeSelect.value);
  applyTier();
  void fetchModelInfo(modelTypeSelect.value);
}

/** Forget what only the live backend had: its models, their answers, its type list. */
function dropServerModels(): void {
  for (const name of serverNames()) {
    state.models = Object.fromEntries(Object.entries(state.models).filter(([k]) => k !== name));
    state.predictions = Object.fromEntries(
      Object.entries(state.predictions).filter(([k]) => k !== name),
    );
  }
  modelTypeSelect.replaceChildren();
  savedSelect.innerHTML = '<option value="">— needs the live backend —</option>';
  buildMetricsTable();
  buildPredictionTable();
  buildSessionModelsList();
  applyTier();
}

// Evaluate all session models

async function runEvaluate(): Promise<void> {
  if (serverNames().length === 0) return;
  evalProgress.classList.remove('hidden');
  evalBar.style.width = '5%';
  evalBar.setAttribute('aria-valuenow', '5');
  evalStatus.textContent = 'Starting evaluation…';
  let batchesDone = 0;
  const approxBatches = 10 * serverNames().length;
  await consumeSSE(
    `${base()}/evaluate`,
    {},
    {
      fetchImpl: apiFetch,
      syncUrl: `${base()}/evaluate/sync`,
      onStatus(msg) {
        if (typeof msg !== 'string') return;
        evalStatus.textContent = msg;
        batchesDone++;
        const p = Math.min(95, (batchesDone / approxBatches) * 100);
        evalBar.style.width = String(p) + '%';
        evalBar.setAttribute('aria-valuenow', String(Math.round(p)));
      },
      onDone(event) {
        evalBar.style.width = '100%';
        evalBar.setAttribute('aria-valuenow', '100');
        evalStatus.textContent = 'Evaluation complete!';
        const { results } = event as RawEvaluateDone;
        for (const [name, result] of Object.entries(results)) {
          const m = state.models[name];
          if (m && result) m.eval_result = result;
        }
        buildMetricsTable();
        setTimeout(() => {
          evalProgress.classList.add('hidden');
          evalBar.style.width = '0%';
          evalBar.setAttribute('aria-valuenow', '0');
        }, 1500);
      },
      onError(err) {
        evalStatus.textContent = `Error: ${err}`;
        setTimeout(() => evalProgress.classList.add('hidden'), 2000);
      },
    },
  );
}

// Train

/** Dash patterns for the training-curve series, so line style tells them apart. */
const SERIES_DASHES: number[][] = [[], [7, 4], [2, 3], [10, 3, 2, 3], [14, 5], [1, 4]];
let seriesIdx = 0;

interface TrainBody {
  model_type: string;
  epochs: number;
  batch_size: number;
  lr: number;
  name: string;
  patience?: number;
  val_gap?: number;
  teacher?: string;
  distill_weight?: number;
}

/** A history event from the training stream (train_loss present). */
function asHistoryEvent(
  msg: SseStructuredEvent,
): { train_loss: number; val_accuracy?: number | null } | null {
  return typeof msg.train_loss === 'number'
    ? (msg as { train_loss: number; val_accuracy?: number | null })
    : null;
}

trainBtn.addEventListener('click', () => {
  void (async () => {
    const modelType = modelTypeSelect.value;
    if (!modelType) {
      return;
    }
    const epochs = parseInt(byId('epochs', HTMLInputElement).value, 10);
    const batchSize = parseInt(byId('batch-size', HTMLInputElement).value, 10);
    const lr = parseFloat(byId('lr', HTMLInputElement).value);
    const name = modelNameInput.value.trim() || defaultName(modelType);

    // Advanced options
    const patienceEl = byId('patience', HTMLInputElement);
    const valGapEl = byId('val-gap', HTMLInputElement);
    const patience = patienceEl.value ? parseInt(patienceEl.value, 10) : null;
    const valGap = parseInt(valGapEl.value, 10) || 50;
    const teacher = teacherSelect.value || null;
    const distillW = parseFloat(byId('distill-weight', HTMLInputElement).value) || 0.5;

    const body: TrainBody = { model_type: modelType, epochs, batch_size: batchSize, lr, name };
    if (patience != null) body.patience = patience;
    if (patience != null || teacher) body.val_gap = valGap;
    if (teacher) {
      body.teacher = teacher;
      body.distill_weight = distillW;
    }

    trainBtn.disabled = true;
    trainBtn.classList.add('btn-loading');
    trainBtn.textContent = 'Training…';

    // Prepare chart for training curves
    const useChart = patience != null || teacher;
    if (useChart) {
      trainChart ??= new MiniChart(trainChartCanvas, {
        title: 'Training Curves',
        yLabel: 'Loss',
        y2Label: 'Val Accuracy',
      });
      const d = SERIES_DASHES[seriesIdx++ % SERIES_DASHES.length] ?? [];
      const d2 = SERIES_DASHES[seriesIdx++ % SERIES_DASHES.length] ?? [];
      trainChart.addSeries(`${name} loss`, d, 'left');
      trainChart.addSeries(`${name} acc`, d2, 'right');
      chartArea.classList.remove('hidden');
    }

    let historyStep = 0;
    // Boxed so the assignment inside onDone survives TS's control-flow
    // narrowing (a bare let reads as never-assigned at the post-await check).
    const trained: { name: string | null } = { name: null };

    await consumeSSE(`${base()}/train`, body, {
      fetchImpl: apiFetch,
      syncUrl: `${base()}/train/sync`,
      onStatus(msg) {
        if (typeof msg === 'string') {
          return;
        }
        const hist = asHistoryEvent(msg);
        if (!hist) return;
        // History event from training
        historyStep++;
        if (useChart && trainChart) {
          trainChart.addPoint(`${name} loss`, historyStep, hist.train_loss);
          if (hist.val_accuracy != null) {
            trainChart.addPoint(`${name} acc`, historyStep, hist.val_accuracy);
          }
          trainChart.render();
        }
      },
      onDone(rawEvent) {
        const event = rawEvent as RawTrainDone;
        state.models[event.name] = {
          model_type: event.model_type,
          epochs: event.epochs,
          batch_size: event.batch_size,
          lr: event.lr,
          num_params: event.num_params ?? null,
          training_history: event.history ?? [],
          stopped_early: event.stopped_early ?? false,
          eval_result: null,
        };
        trained.name = event.name;
        buildMetricsTable();
        buildPredictionTable();
        buildSessionModelsList();
        modelNameInput.value = defaultName(modelTypeSelect.value);
      },
      onError(err) {
        trainStatus.textContent = `Training failed — ${err}`;
      },
    });

    trainBtn.disabled = false;
    trainBtn.classList.remove('btn-loading');
    trainBtn.textContent = '▶ Train';

    if (trained.name) {
      await runEvaluate();
    }
  })();
});

// Predict

let autoPredictTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleAutoPredict(): void {
  if (Object.keys(state.models).length === 0) return;
  if (autoPredictTimer) clearTimeout(autoPredictTimer);
  autoPredictTimer = setTimeout(() => {
    void runPredict();
  }, 250);
}

/** Every model answers: the in-browser ones here, the live ones through /predict. */
async function runPredict(): Promise<void> {
  await runPredictLocal();
  if (isOffline() || serverNames().length === 0) return;
  let body: { image: string } | { features: Record<string, number> };
  if (window.UI_CONFIG?.input_type === 'image') {
    if (isBlank(Array.from(grid))) return;
    // The same cropped, centred 28×28 digit the in-browser models score.
    body = { image: digitPng(preprocessDigit(Array.from(grid))) };
  } else {
    const features: Record<string, number> = {};
    document.querySelectorAll<HTMLInputElement>('.feature-input').forEach((inp) => {
      features[inp.dataset.feature ?? ''] = parseFloat(inp.value) || 0;
    });
    body = { features };
  }
  try {
    const data = await apiJson<RawPredictResponse>(`${base()}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    Object.assign(state.predictions, data.results);
    buildPredictionTable();
  } catch (err) {
    modelsStatus.textContent = `Live predict failed — ${errText(err)}`;
  }
}

// Demo tier: run every in-browser model over the current canvas / feature
// inputs, producing the same shape the server /predict returns. Each model
// reads the features it names, which can be a subset of the form's.
async function runPredictLocal(): Promise<void> {
  const locals = modelEntries().filter(([, m]) => m._local);
  const image = window.UI_CONFIG?.input_type === 'image';
  // Nothing drawn → nothing to predict. A linear model will happily "answer" an empty
  // grid with a confident digit that has no basis.
  if (image && isBlank(Array.from(grid))) {
    state.predictions = {};
    buildPredictionTable();
    return;
  }
  // The canvas goes through MNIST's own crop-scale-centre step first.
  const digit = image ? preprocessDigit(Array.from(grid)) : null;
  if (digit) showSeen(digit);
  for (const [name, m] of locals) {
    let model: ClassifierModel;
    try {
      model = await ClassifierInfer.loadModel(m._file ?? '');
    } catch {
      continue;
    }
    state.predictions[name] = ClassifierInfer.predict(model, digit ?? featureValues(model));
  }
  markOutOfScope(locals);
  buildPredictionTable();
}

/** The form's values in the order the model names its features. */
function featureValues(model: ClassifierModel): number[] {
  return (model.features ?? []).map((f) => {
    const inp = document.querySelector<HTMLInputElement>(`.feature-input[data-feature="${f}"]`);
    return inp ? parseFloat(inp.value) || 0 : 0;
  });
}

/**
 * A model that knows fewer classes than the dataset answers every input with one
 * of the classes it has; when the full model's answer is not among them, that
 * answer is out of scope. A model covering every class is never marked.
 */
function markOutOfScope(locals: [string, ModelInfo][]): void {
  const reference = locals.find(([, m]) => !m._classes)?.[0];
  const refPred = reference ? state.predictions[reference]?.prediction : undefined;
  for (const [name, m] of locals) {
    const p = state.predictions[name];
    if (p && m._classes && refPred !== undefined) p.outOfScope = !m._classes.includes(refPred);
  }
}

// Client-side dataset switching

// Build the tabular feature form (Iris) from the model's feature list + ranges:
// a slider to explore with and a box for the exact value, kept in step.
function buildFeatureInputs(model: ClassifierModel): void {
  const wrap = document.querySelector('#tabular-col .feature-inputs');
  if (!wrap) return;
  wrap.innerHTML = '';
  const ranges = model.feature_ranges ?? [];
  (model.features ?? []).forEach((f, i) => {
    const [min, max] = ranges[i] ?? [0, 10];
    wrap.appendChild(featureRow(f, min, max));
  });
}

/** Two significant steps across the range: 0.1 for Iris's centimetres, 0.01 for a QBER. */
function featureStep(min: number, max: number): number {
  return 10 ** Math.floor(Math.log10((max - min) / 20));
}

function featureRow(f: string, min: number, max: number): HTMLElement {
  const ds = window.UI_CONFIG;
  const step = featureStep(min, max);
  const digits = Math.max(0, Math.round(-Math.log10(step)));
  const lo = (Math.floor(min / step) * step).toFixed(digits);
  const hi = (Math.ceil(max / step) * step).toFixed(digits);
  const mid = ((min + max) / 2).toFixed(digits);
  const id = `feature-${f}`;

  const row = document.createElement('div');
  row.className = 'feature-row';
  const label = document.createElement('label');
  label.className = 'feature-label';
  label.htmlFor = id;
  label.textContent = ds?.feature_labels?.[f] ?? humanize(f);
  const hint = document.createElement('span');
  hint.className = 'feature-hint num';
  hint.textContent = `${lo} – ${hi}${ds?.unit ? ` ${ds.unit}` : ''}`;
  label.appendChild(hint);

  const range = document.createElement('input');
  range.type = 'range';
  range.className = 'feature-range';
  range.tabIndex = -1;
  range.setAttribute('aria-hidden', 'true');
  const input = document.createElement('input');
  input.type = 'number';
  input.id = id;
  input.className = 'feature-input';
  input.dataset.feature = f;
  input.dataset.default = mid;
  for (const el of [range, input]) {
    el.min = lo;
    el.max = hi;
    el.step = String(step);
    el.value = mid;
  }
  // Moving either re-scores the in-browser models; the live ones answer on Predict.
  range.addEventListener('input', () => {
    input.value = range.value;
    void runPredictLocal();
  });
  input.addEventListener('input', () => {
    range.value = input.value;
    void runPredictLocal();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void runPredict();
  });
  row.append(label, range, input);
  return row;
}

function humanize(f: string): string {
  const words = f.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Switch the active dataset entirely in the browser: swap UI_CONFIG, flip the
// input UI (canvas ↔ tabular), reload that dataset's weights, and re-predict.
async function switchDataset(name: string): Promise<void> {
  const ds = (window.CLASSIFIER_DATASETS ?? []).find((d) => d.name === name);
  if (!ds) return;
  window.UI_CONFIG = ds;
  const image = ds.input_type === 'image';
  applyInputVisibility();
  state.models = {};
  state.predictions = {};
  modelTypeSelect.replaceChildren();
  await initLocalModels(); // demo models for this dataset (rebuilds the tables)
  void loadModels(); // backend models too, when connected (no-op offline)
  void loadModelTypes();
  if (image) {
    clearCanvas();
  } else {
    try {
      buildFeatureInputs(await ClassifierInfer.loadModel(ds.name));
    } catch {
      /* asset missing */
    }
  }
  renderDatasetMenu();
  if (!image) void runPredictLocal();
}

const predictBtnTab = document.getElementById('predict-btn-tab');
if (predictBtnTab)
  predictBtnTab.addEventListener('click', () => {
    void runPredict();
  });
byId('reset-features-btn', HTMLButtonElement).addEventListener('click', () => {
  document.querySelectorAll<HTMLInputElement>('#tabular-col .feature-row').forEach((row) => {
    const input = row.querySelector<HTMLInputElement>('.feature-input');
    const range = row.querySelector<HTMLInputElement>('.feature-range');
    if (!input || !range) return;
    input.value = range.value = input.dataset.default ?? input.value;
  });
  void runPredictLocal();
});

clearBtn.addEventListener('click', () => {
  clearCanvas();
  state.predictions = {};
  buildPredictionTable();
});

// Saved models on disk

async function loadSavedModels(): Promise<void> {
  if (isOffline()) return;
  try {
    const files = await apiJson<RawSavedModel[]>(`${base()}/models/disk`);
    if (!Array.isArray(files)) throw new Error('unexpected response');
    savedSelect.innerHTML = '';
    if (files.length === 0) {
      savedSelect.innerHTML = '<option value="">— no saved models —</option>';
      importBtn.disabled = true;
    } else {
      savedSelect.innerHTML = '<option value="">— select a saved model —</option>';
      for (const f of files) {
        const opt = document.createElement('option');
        opt.value = f.filename;
        opt.textContent = `${f.name}  (${f.model_type}, ${String(f.epochs)} ep)`;
        savedSelect.appendChild(opt);
      }
      importBtn.disabled = false;
    }
  } catch (err) {
    savedStatus.textContent = `Couldn't list the saved models — ${errText(err)}`;
  }
}
savedSelect.addEventListener('change', () => {
  importBtn.disabled = !savedSelect.value;
});
refreshSavedBtn.addEventListener('click', () => {
  void loadSavedModels();
});

// Import from disk

importBtn.addEventListener('click', () => {
  void (async () => {
    const filename = savedSelect.value;
    if (!filename) return;
    importBtn.disabled = true;
    try {
      const data = await apiJson<RawLoadedModel>(
        `${base()}/models/disk/${encodeURIComponent(filename)}/load`,
        { method: 'POST' },
      );
      state.models[data.name] = {
        model_type: data.model_type,
        epochs: data.epochs,
        batch_size: data.batch_size,
        lr: data.lr,
        eval_result: null,
      };
      buildMetricsTable();
      buildPredictionTable();
      buildSessionModelsList();
      modelNameInput.value = defaultName(modelTypeSelect.value);
      await runEvaluate();
    } catch (err) {
      savedStatus.textContent = `Import failed — ${errText(err)}`;
    } finally {
      importBtn.disabled = !savedSelect.value;
    }
  })();
});

// Export (delegated save buttons in session rows)

document.addEventListener('click', (e) => {
  const btn =
    e.target instanceof Element ? e.target.closest<HTMLButtonElement>('[data-export]') : null;
  const exportName = btn?.dataset.export;
  if (!btn || !exportName) return;
  void (async () => {
    btn.disabled = true;
    try {
      await apiJson<RawEnvelope>(`${base()}/models/${encodeURIComponent(exportName)}/export`, {
        method: 'POST',
      });
      await loadSavedModels();
    } catch (err) {
      savedStatus.textContent = `Export failed — ${errText(err)}`;
    } finally {
      btn.disabled = false;
    }
  })();
});

// Remove model from session (delegated close buttons)

document.addEventListener('click', (e) => {
  const btn =
    e.target instanceof Element ? e.target.closest<HTMLButtonElement>('[data-remove]') : null;
  const name = btn?.dataset.remove;
  if (!name) return;
  void (async () => {
    try {
      await apiFetch(`${base()}/models/${encodeURIComponent(name)}`, { method: 'DELETE' });
    } catch {
      /* best effort — server may be unavailable */
    }
    state.models = Object.fromEntries(Object.entries(state.models).filter(([key]) => key !== name));
    state.predictions = Object.fromEntries(
      Object.entries(state.predictions).filter(([key]) => key !== name),
    );
    buildMetricsTable();
    buildPredictionTable();
    buildSessionModelsList();
    modelNameInput.value = defaultName(modelTypeSelect.value);
  })();
});

// Ensemble

ensembleBtn.addEventListener('click', () => {
  void (async () => {
    const names = serverNames();
    if (names.length < 2) return;
    ensembleBtn.disabled = true;
    ensembleBtn.textContent = 'Running…';
    try {
      const data = await apiJson<RawEnsembleResponse>(`${base()}/ensemble`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_names: names }),
      });
      // Store as a virtual model for display
      state.models.Ensemble = {
        model_type: 'Ensemble',
        epochs: '—',
        batch_size: '—',
        lr: null,
        num_params: null,
        training_history: [],
        _virtual: true,
        eval_result: {
          accuracy: data.accuracy,
          avg_loss: data.avg_loss,
          per_class_accuracy: data.per_class_accuracy,
          num_params: null,
        },
      };
      buildMetricsTable();
    } catch (err) {
      modelsStatus.textContent = `Ensemble failed — ${errText(err)}`;
    } finally {
      ensembleBtn.disabled = false;
      ensembleBtn.textContent = 'Ensemble';
    }
  })();
});

// Ablation (delegated from session model rows)

document.addEventListener('click', (e) => {
  const btn =
    e.target instanceof Element ? e.target.closest<HTMLButtonElement>('[data-ablation]') : null;
  const modelName = btn?.dataset.ablation;
  if (!btn || !modelName) return;
  void (async () => {
    btn.disabled = true;
    ablationStatus.textContent = `Ablating ${modelName}…`;

    await consumeSSE(
      `${base()}/ablation`,
      { model_name: modelName },
      {
        fetchImpl: apiFetch,
        onStatus(msg) {
          if (typeof msg === 'string') return;
          // One event per ablated layer, so the layer name is what tells them
          // apart; without it a four-layer model reports four identical rows.
          if (
            msg.type === 'ablation_result' &&
            typeof msg.layer === 'string' &&
            typeof msg.drop === 'number'
          ) {
            const model = state.models[modelName];
            if (model) model.ablation = { ...model.ablation, [msg.layer]: msg.drop };
          }
        },
        onDone() {
          buildMetricsTable();
          ablationStatus.textContent = '';
        },
        onError(err) {
          ablationStatus.textContent = `Ablation failed — ${err}`;
        },
      },
    );
    btn.disabled = false;
  })();
});

// Tier-aware controls
// Offline these say "Needs the live backend"; the Train form folds and Saved hides.
const BACKEND_CONTROLS = ['ensemble-btn', 'refresh-saved-btn', 'import-btn', 'saved-select'];
const trainForm = byId('train-form', HTMLDetailsElement);
const trainFields = byId('train-fields', HTMLFieldSetElement);
let shownTier: 'offline' | 'live' | null = null;

function applyTier(): void {
  const off = isOffline();
  for (const id of BACKEND_CONTROLS) {
    const el = document.getElementById(id);
    if (el instanceof HTMLButtonElement || el instanceof HTMLSelectElement) {
      el.disabled = off;
      el.title = off ? 'Needs the live backend' : '';
    }
  }
  trainFields.disabled = off;
  byId('backend-note', HTMLElement).hidden = !off;
  byId('saved-card', HTMLElement).hidden = off;
  // Fold or unfold only when the tier changes, so a visitor's own toggle stands.
  const tier = off ? 'offline' : 'live';
  if (tier !== shownTier) trainForm.open = !off;
  shownTier = tier;
  // The Model list comes from the live backend; until it arrives the field can't be filled.
  byId('model-type-row', HTMLElement).hidden = modelTypeSelect.options.length === 0;
}

// Connection state observer

document.addEventListener('connection:statechange', (e) => {
  const { state: s, previous } = (e as CustomEvent<{ state: string; previous: string }>).detail;
  applyTier();
  if (s === 'connected' && previous !== 'degraded') {
    void loadModels();
    void loadSavedModels();
    void loadModelTypes();
  }
  if (s === 'disconnected' && (previous === 'connected' || previous === 'degraded')) {
    dropServerModels();
  }
});

// Init

/** A shipped weight file as a session model, with its real test accuracy. */
function localModelInfo(model: ClassifierModel, file: string): ModelInfo {
  const quantum = model.kind === 'qsvm' || model.kind === 'qsvm-ovo';
  const numParams =
    model.kind === 'qsvm' || model.kind === 'qsvm-ovo'
      ? (model.num_params ?? null)
      : model.weight.length * (model.weight[0]?.length ?? 0) + model.bias.length;
  return {
    model_type: quantum ? 'QSVM' : 'Linear',
    epochs: '—',
    batch_size: '—',
    lr: null,
    num_params: numParams,
    training_history: [],
    eval_result: {
      accuracy: model.test_accuracy ?? 0,
      avg_loss: null,
      per_class_accuracy: {},
      num_params: numParams,
    },
    _local: true,
    _file: file,
    _classes: quantum ? [...model.classes] : undefined,
    _features: model.features ? [...model.features] : undefined,
    _accCi: model.test_accuracy_ci,
    _testN: model.test_n,
    _testProtocol: model.test_protocol,
    _cvAccuracy: model.kind === 'qsvm-ovo' ? model.cv_accuracy : undefined,
    _cvSplits: model.kind === 'qsvm-ovo' ? model.cv_splits : undefined,
    _cite: /\(([^)]*)\)$/.exec(model.display?.label ?? '')?.[1],
  };
}

// Demo tier: load the in-browser models (the primary linear model plus the
// QSVM paper recreation) so the canvas / feature form predicts with no backend
// connected. Registered as session models so the metrics table surfaces their
// real test accuracies (no handwaving).
async function initLocalModels(): Promise<void> {
  const files = window.UI_CONFIG?.local_models ?? [window.UI_CONFIG?.name ?? 'mnist'];
  for (const file of files) {
    let model: ClassifierModel;
    try {
      model = await ClassifierInfer.loadModel(file);
    } catch {
      continue; // model asset missing — degrade to whatever loaded
    }
    // "QSVM (Yang et al. 2019)" is listed as "QSVM (6 vs 9)": the citation moves to
    // the Models row, and the two classes it knows take its place in the name.
    const base = model.display?.label?.replace(/\s*\(.*\)$/, '') ?? 'Logistic Regression';
    const subset = model.display?.subset;
    const label = subset ? `${base} (${subset})` : base;
    const info = localModelInfo(model, file);
    state.models[label] = info;
  }
  buildSessionModelsList();
  buildMetricsTable();
  buildPredictionTable();
  // A digit drawn while the weights were still loading gets its prediction now.
  if (window.UI_CONFIG?.input_type === 'image' && !isBlank(Array.from(grid))) void runPredict();
}

void initLocalModels();
renderDatasetMenu();
applyTier();
modelNameInput.value = defaultName(modelTypeSelect.value);
void fetchModelInfo(modelTypeSelect.value);
