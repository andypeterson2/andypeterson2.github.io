/**
 * Multi-Dataset Classifier App — client-side SPA logic.
 *
 * Reusable UI behaviours (theme toggle, drawer, dropdown, resize, log
 * terminal) come from UIKit; this module handles application-specific logic:
 * state management, SSE streaming, training, evaluation, prediction, model
 * persistence, and canvas drawing.
 *
 * Server responses are typed at the boundary with the Raw* interfaces below,
 * hand-derived from the classifier backend's route handlers.
 */

import { UIKit } from '../ui-kit/ui-kit';
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

// ── Backend config ───────────────────────────────────────────────────────────
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

// ── Connection-aware fetch wrapper ──────────────────────────────────────────

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

// ── Wire shapes (hand-derived from the classifier backend routes) ───────────

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
  addLog('The pass was refused, so predictions are back in your browser.', 'err');
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

// ── State ────────────────────────────────────────────────────────────────────

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
  /** In-browser demo model — no backend to ablate/export/remove against. */
  _local?: boolean;
  /** Model asset name for the in-browser tier. */
  _file?: string;
  /** Binary-subset caveat (e.g. the QSVM answers only "6 vs 9"). */
  _subset?: string | undefined;
  /** Binary classifiers (the QSVM) only know these classes — used to scope their answer. */
  _classes?: string[] | undefined;
  /** Computed in this page (the ensemble result); the backend has no model by this name. */
  _virtual?: boolean;
  /** The in-browser weights' source, e.g. "weights · 63fe983 · 2026-09-04". */
  _provenance?: string | undefined;
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

/** Models the live backend holds: not the in-browser ones, not the page's ensemble. */
function serverNames(): string[] {
  return modelEntries()
    .filter(([, m]) => !m._local && !m._virtual)
    .map(([name]) => name);
}

// ── Smart naming ─────────────────────────────────────────────────────────────

/** Generate the next available default name for a model type. */
function defaultName(modelType: string): string {
  const names = Object.keys(state.models);
  if (!names.includes(modelType)) return modelType;
  let n = 2;
  while (names.includes(`${modelType} ${String(n)}`)) n++;
  return `${modelType} ${String(n)}`;
}

// ── DOM helpers / refs ───────────────────────────────────────────────────────

function byId<T extends HTMLElement>(id: string, ctor: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof ctor))
    throw new Error(`classifier app: #${id} missing from the page (or wrong element kind)`);
  return el;
}

const drawer = UIKit.initDrawer(byId('log-drawer', HTMLElement), byId('log-handle', HTMLElement));
const dropdown = UIKit.initDropdown(
  byId('dataset-menu-btn', HTMLElement),
  byId('dataset-menu', HTMLElement),
);

UIKit.onEscape(() => {
  drawer.close();
  dropdown.close();
});

UIKit.initResize(
  byId('resize-h', HTMLElement),
  byId('left-col', HTMLElement),
  byId('split-layout', HTMLElement),
  {
    min: 180,
    default: 300,
    key: 'leftColWidth_v2',
  },
);

const logTerminal = byId('log-terminal', HTMLElement);
const addLog = UIKit.createLogger(logTerminal, 200);
// Closed, the log shows its newest line; open or closed, it stays at the bottom.
byId('log-handle', HTMLElement).addEventListener('click', () => {
  logTerminal.scrollTop = logTerminal.scrollHeight;
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
const predictBtn = document.getElementById('predict-btn');
const importBtn = byId('import-btn', HTMLButtonElement);
const refreshSavedBtn = byId('refresh-saved-btn', HTMLButtonElement);
const savedSelect = byId('saved-select', HTMLSelectElement);
const datasetList = byId('dataset-list', HTMLElement);
const datasetCurrent = byId('dataset-current', HTMLElement);
const evalProgress = byId('evaluate-progress', HTMLElement);
const evalBar = byId('eval-bar', HTMLElement);
const evalStatus = byId('eval-status', HTMLElement);
const metricsHead = byId('metrics-head', HTMLElement);
const metricsBody = byId('metrics-body', HTMLElement);
const predBody = byId('pred-body', HTMLElement);
const modelNameInput = byId('model-name', HTMLInputElement);
const sessionModels = byId('session-models', HTMLElement);
const chartArea = byId('chart-area', HTMLElement);
const trainChartCanvas = byId('train-chart', HTMLCanvasElement);
const ensembleBtn = byId('ensemble-btn', HTMLButtonElement);
const teacherSelect = byId('teacher-select', HTMLSelectElement);
const distillRow = byId('distill-row', HTMLElement);
const modelTypeSelect = byId('model-type', HTMLSelectElement);

let trainChart: MiniChart | null = null;

// ── Input-type visibility ────────────────────────────────────────────────────

function applyInputVisibility(): void {
  const image = window.UI_CONFIG?.input_type === 'image';
  canvasCol.classList.toggle('hidden', !image);
  tabularCol.classList.toggle('hidden', image);
}
applyInputVisibility();

// ── Model info panel ─────────────────────────────────────────────────────────

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

// ── Refresh default name when model type changes ──────────────────────────────

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

// ── Dataset menu (client-side switching, no navigation) ───────────────────────

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

// ── Canvas drawing (28×28 pixel grid for MNIST) ────────────────────────────────

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

// ── Utilities ─────────────────────────────────────────────────────────────────

function pct(v: number): string {
  return (v * 100).toFixed(1) + '%';
}
function accClass(v: number): string {
  return v >= 0.95 ? 'acc-high' : v >= 0.8 ? 'acc-med' : 'acc-low';
}
function confClass(v: number): string {
  return v >= 0.8 ? 'conf-high' : 'conf-low';
}

// ── Session models list (MODELS card) ────────────────────────────────────────

function buildSessionModelRow(name: string, m: ModelInfo): HTMLDivElement {
  const paramsStr = m.num_params ? `${m.num_params.toLocaleString()} params` : '';
  const row = document.createElement('div');
  row.className = 'ui-list-row';
  const nameSpan = document.createElement('span');
  nameSpan.className = 'ui-list-name';
  nameSpan.textContent = name;
  row.appendChild(nameSpan);
  const typeTag = document.createElement('span');
  typeTag.className = 'ui-list-tag';
  typeTag.textContent = m.model_type;
  row.appendChild(typeTag);
  if (paramsStr) {
    const paramsTag = document.createElement('span');
    paramsTag.className = 'ui-list-tag';
    paramsTag.textContent = paramsStr;
    row.appendChild(paramsTag);
  }
  if (m._subset) {
    // Binary-subset caveat (e.g. the QSVM answers only "6 vs 9").
    const subsetTag = document.createElement('span');
    subsetTag.className = 'ui-list-tag';
    subsetTag.textContent = m._subset;
    row.appendChild(subsetTag);
  }
  if (m._provenance) {
    const provTag = document.createElement('span');
    provTag.className = 'ui-list-tag';
    provTag.textContent = m._provenance;
    provTag.title = 'The commit the weights were exported from, and the export date';
    row.appendChild(provTag);
  }
  if (m._local) {
    // In-browser models have no backend to ablate/export/remove against.
    return row;
  }
  if (!m._virtual) {
    row.append(...serverModelActions(name));
  }
  const removeBtn = document.createElement('button');
  removeBtn.className = 's6-btn s6-btn--icon s6-btn--danger';
  removeBtn.dataset.remove = name;
  removeBtn.setAttribute('aria-label', 'Remove ' + name);
  removeBtn.textContent = '×';
  row.appendChild(removeBtn);
  return row;
}

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
  const entries = modelEntries();
  if (entries.length === 0) {
    sessionModels.innerHTML = '<p class="ui-list-empty">No models loaded</p>';
  } else {
    sessionModels.innerHTML = '';
    for (const [name, m] of entries) sessionModels.appendChild(buildSessionModelRow(name, m));
  }
  updateTeacherSelect();
  updateEnsembleBtn();
}

// ── Prediction table (TRY card) ───────────────────────────────────────────────

function predictionNameCell(name: string, m: ModelInfo | undefined): HTMLTableCellElement {
  const td = document.createElement('td');
  td.className = 'pred-model-name';
  td.textContent = name;
  // Say up front that a binary model only knows two classes.
  if (m?._subset) {
    const scope = document.createElement('span');
    scope.className = 'pred-scope';
    scope.textContent = ` · ${m._subset} only`;
    td.appendChild(scope);
  }
  return td;
}

function predictionAnswerCell(
  p: (Prediction & { outOfScope?: boolean }) | undefined,
  m: ModelInfo | undefined,
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
  if (p.outOfScope && m?._subset) {
    const note = document.createElement('span');
    note.className = 'pred-out-note';
    note.textContent = ` (only answers ${m._subset})`;
    td.appendChild(note);
  }
  return td;
}

/** A QSVM margin as shown: "s +0.31". */
function margin(s: number): string {
  return `s ${s >= 0 ? '+' : '-'}${Math.abs(s).toFixed(2)}`;
}

function predictionScoreCell(p: Prediction | undefined): HTMLTableCellElement {
  const td = document.createElement('td');
  if (p?.qsvm) {
    // A sign classifier has no probability; its margin is its strength.
    const { f1, f2, s } = p.qsvm;
    td.textContent = margin(s);
    const feats = document.createElement('span');
    feats.className = 'pred-scope';
    feats.textContent = ` (f1 ${f1.toFixed(2)}, f2 ${f2.toFixed(2)})`;
    td.appendChild(feats);
    td.title = 'Signed margin from the decision boundary, computed from the two features';
  } else if (p?.confidence != null) {
    const span = document.createElement('span');
    span.className = confClass(p.confidence);
    span.textContent = pct(p.confidence);
    td.appendChild(span);
    td.title = 'Softmax of the top class: uncalibrated, so high on a scribble too';
  } else {
    td.textContent = '—';
  }
  return td;
}

function buildPredictionTable(): void {
  const names = Object.keys(state.models);
  if (names.length === 0) {
    predBody.innerHTML = `<tr class="empty-row"><td colspan="3">No prediction yet</td></tr>`;
    return;
  }
  predBody.innerHTML = '';
  if (window.UI_CONFIG?.input_type === 'image' && Object.keys(state.predictions).length === 0) {
    predBody.innerHTML = `<tr class="empty-row"><td colspan="3">Draw a digit — predictions appear as you draw.</td></tr>`;
  }
  for (const name of names) {
    const p = state.predictions[name];
    const m = state.models[name];
    const tr = document.createElement('tr');
    tr.append(predictionNameCell(name, m), predictionAnswerCell(p, m), predictionScoreCell(p));
    predBody.appendChild(tr);
  }
}

// ── Columnar metrics table (TEST card) ───────────────────────────────────────

interface MetricRow {
  key: string;
  fn: (m: ModelInfo) => string;
  cls?: string;
  html?: boolean;
}

interface MetricSection {
  label: string;
  rows: MetricRow[];
}

function metricSections(labels: string[]): MetricSection[] {
  return [
    {
      label: 'Config',
      rows: [
        { key: 'Type', fn: (m) => m.model_type },
        { key: 'Epochs', fn: (m) => String(m.epochs), cls: 'cfg-cell' },
        { key: 'Batch', fn: (m) => String(m.batch_size), cls: 'cfg-cell' },
        {
          key: 'LR',
          fn: (m) => (m.lr != null ? parseFloat(m.lr.toPrecision(4)).toString() : '—'),
          cls: 'cfg-cell',
        },
        {
          key: 'Params',
          fn: (m) => (m.num_params ? m.num_params.toLocaleString() : '—'),
          cls: 'cfg-cell',
        },
        { key: 'Early Stop', fn: (m) => (m.stopped_early ? 'Yes' : '—'), cls: 'cfg-cell' },
      ],
    },
    {
      label: 'Evaluation',
      rows: [
        {
          key: 'Test Acc',
          fn: (m) =>
            m.eval_result
              ? `<span class="${accClass(m.eval_result.accuracy)}">${pct(m.eval_result.accuracy)}</span>`
              : '—',
          html: true,
        },
        {
          key: 'Test Loss',
          fn: (m) => (m.eval_result?.avg_loss != null ? m.eval_result.avg_loss.toFixed(4) : '—'),
        },
      ],
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
      })),
    },
  ];
}

function buildMetricsHead(names: string[]): void {
  const htr = document.createElement('tr');
  const corner = document.createElement('th');
  corner.className = 'corner-cell';
  corner.scope = 'col';
  // An empty header announces nothing: name it for screen readers, visually hidden.
  const cornerLabel = document.createElement('span');
  cornerLabel.className = 'sr-only';
  cornerLabel.textContent = 'Metric';
  corner.appendChild(cornerLabel);
  htr.appendChild(corner);
  for (const name of names) {
    const th = document.createElement('th');
    th.scope = 'col';
    const head = document.createElement('div');
    head.className = 'model-col-head';
    const colName = document.createElement('span');
    colName.className = 'col-model-name';
    colName.textContent = name;
    head.appendChild(colName);
    th.appendChild(head);
    htr.appendChild(th);
  }
  metricsHead.innerHTML = '';
  metricsHead.appendChild(htr);
}

function buildMetricsTable(): void {
  const entries = modelEntries();
  const labels = window.UI_CONFIG?.class_labels ?? [];

  if (entries.length === 0) {
    metricsHead.innerHTML = '';
    metricsBody.innerHTML = `<tr class="empty-row"><td>No models trained yet</td></tr>`;
    return;
  }

  buildMetricsHead(entries.map(([name]) => name));

  metricsBody.innerHTML = '';
  for (const section of metricSections(labels)) renderMetricSection(section, entries);
}

function renderMetricSection(section: MetricSection, entries: [string, ModelInfo][]): void {
  const sepTr = document.createElement('tr');
  sepTr.className = 'metrics-section-row';
  const sepTd = document.createElement('td');
  sepTd.colSpan = entries.length + 1;
  sepTd.textContent = section.label;
  sepTr.appendChild(sepTd);
  metricsBody.appendChild(sepTr);

  for (const row of section.rows) {
    const tr = document.createElement('tr');
    const labelTh = document.createElement('th');
    labelTh.scope = 'row';
    labelTh.className = 'metric-label';
    labelTh.textContent = row.key;
    tr.appendChild(labelTh);
    for (const [, m] of entries) {
      const td = document.createElement('td');
      if (row.cls) td.className = row.cls;
      const val = row.fn(m);
      if (row.html) td.innerHTML = val;
      else td.textContent = val;
      tr.appendChild(td);
    }
    metricsBody.appendChild(tr);
  }
}

// ── Load models from server on page load ──────────────────────────────────────

async function loadModels(): Promise<void> {
  if (isOffline()) return;
  try {
    const data = await apiJson<Record<string, RawModelInfo | undefined>>(`${base()}/models`);
    for (const [name, info] of Object.entries(data)) {
      if (info?.model_type) state.models[name] = { eval_result: null, ...info };
    }
  } catch (err) {
    addLog(`Couldn't load the live models — ${errText(err)}`, 'err');
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
    addLog(`Couldn't load the model types — ${errText(err)}`, 'err');
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

// ── Evaluate all session models ───────────────────────────────────────────────

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

// ── Train ─────────────────────────────────────────────────────────────────────

/** Dash patterns for the training-curve series: told apart by line, not colour. */
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
      addLog('Choose a model type first: the list comes from the live backend.', 'err');
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

    logTerminal.innerHTML = '';
    addLog(
      `Training '${name}'  ·  ${modelType}  ·  ${String(epochs)} epoch${epochs !== 1 ? 's' : ''}  ·  lr ${String(lr)}`,
    );
    if (patience != null)
      addLog(`Early stopping: patience=${String(patience)}, val every ${String(valGap)} batches`);
    if (teacher) addLog(`Distillation: teacher='${teacher}', α=${String(distillW)}`);

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
          addLog(msg);
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
        addLog(
          `loss: ${hist.train_loss.toFixed(4)}` +
            (hist.val_accuracy != null
              ? `  val_acc: ${(hist.val_accuracy * 100).toFixed(1)}%`
              : ''),
        );
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
        if (event.stopped_early)
          addLog(`Early stopping triggered at epoch ${String(event.epochs_completed)}`, 'ok');
        if (event.best_val_accuracy != null)
          addLog(`Best val accuracy: ${(event.best_val_accuracy * 100).toFixed(1)}%`, 'ok');
        buildMetricsTable();
        buildPredictionTable();
        buildSessionModelsList();
        modelNameInput.value = defaultName(modelTypeSelect.value);
      },
      onError(err) {
        addLog(`Error: ${err}`, 'err');
      },
    });

    trainBtn.disabled = false;
    trainBtn.classList.remove('btn-loading');
    trainBtn.textContent = '▶ Train';

    if (trained.name) {
      addLog(`'${trained.name}' trained successfully`, 'ok');
      await runEvaluate();
    }
  })();
});

// ── Predict ───────────────────────────────────────────────────────────────────

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
    addLog(`Live predict failed — ${errText(err)}`, 'err');
  }
}

/** One log line per prediction: each model's answer and its score. */
function logPredictions(names: string[]): void {
  const parts = names.flatMap((name) => {
    const p = state.predictions[name];
    if (!p) return [];
    const score = p.qsvm ? margin(p.qsvm.s) : p.confidence != null ? pct(p.confidence) : '';
    return [`${name.replace(/ \(in-browser\)$/, '')} ${p.prediction}${score ? ` (${score})` : ''}`];
  });
  if (parts.length) addLog(`predict: ${parts.join(' · ')}`);
}

// Demo tier: run every in-browser model over the current canvas / feature
// inputs, producing the same shape the server /predict returns. Each model
// reads its own feature subset (the QSVM uses 2 of the 4 iris inputs).
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
  logPredictions(locals.map(([name]) => name));
}

/** The form's values in the order the model names its features. */
function featureValues(model: ClassifierModel): number[] {
  return (model.features ?? []).map((f) => {
    const inp = document.querySelector<HTMLInputElement>(`.feature-input[data-feature="${f}"]`);
    return inp ? parseFloat(inp.value) || 0 : 0;
  });
}

/**
 * A binary model (the QSVM) answers every input with one of its two classes; when the
 * full model's answer is outside that pair, the binary answer is out of scope.
 */
function markOutOfScope(locals: [string, ModelInfo][]): void {
  const reference = locals.find(([, m]) => !m._classes)?.[0];
  const refPred = reference ? state.predictions[reference]?.prediction : undefined;
  for (const [name, m] of locals) {
    const p = state.predictions[name];
    if (p && m._classes && refPred !== undefined) p.outOfScope = !m._classes.includes(refPred);
  }
}

// ── Client-side dataset switching ─────────────────────────────────────────────

// Build the tabular feature form (Iris) from the model's feature list + ranges,
// re-predicting live as inputs change.
function buildFeatureInputs(model: ClassifierModel): void {
  const wrap = document.querySelector('#tabular-col .feature-inputs');
  if (!wrap) return;
  wrap.innerHTML = '';
  const feats = model.features ?? [];
  const ranges = model.feature_ranges ?? [];
  feats.forEach((f, i) => {
    const [min, max] = ranges[i] ?? [0, 10];
    const row = document.createElement('label');
    row.className = 'feature-row';
    const span = document.createElement('span');
    span.className = 'feature-label';
    span.textContent = f.replace(/_/g, ' ');
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'feature-input';
    input.dataset.feature = f;
    input.step = '0.1';
    input.min = String(min);
    input.max = String(max);
    input.value = ((min + max) / 2).toFixed(1);
    // Typing re-scores the in-browser models; the live ones answer on Predict.
    input.addEventListener('input', () => {
      void runPredictLocal();
    });
    row.appendChild(span);
    row.appendChild(input);
    wrap.appendChild(row);
  });
}

// Switch the active dataset entirely in the browser: swap UI_CONFIG, flip the
// input UI (canvas ↔ tabular), reload that dataset's weights, and re-predict.
async function switchDataset(name: string): Promise<void> {
  const ds = (window.CLASSIFIER_DATASETS ?? []).find((d) => d.name === name);
  if (!ds) return;
  window.UI_CONFIG = ds;
  const image = ds.input_type === 'image';
  applyInputVisibility();
  addLog(`dataset → ${ds.display_name}`);
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

if (predictBtn)
  predictBtn.addEventListener('click', () => {
    void runPredict();
  });
const predictBtnTab = document.getElementById('predict-btn-tab');
if (predictBtnTab)
  predictBtnTab.addEventListener('click', () => {
    void runPredict();
  });

clearBtn.addEventListener('click', () => {
  clearCanvas();
  state.predictions = {};
  buildPredictionTable();
  addLog('canvas cleared');
});

// ── Saved models on disk ──────────────────────────────────────────────────────

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
    addLog(`Couldn't list the saved models — ${errText(err)}`, 'err');
  }
}
savedSelect.addEventListener('change', () => {
  importBtn.disabled = !savedSelect.value;
});
refreshSavedBtn.addEventListener('click', () => {
  void loadSavedModels();
});

// ── Import from disk ──────────────────────────────────────────────────────────

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
      addLog(`Import failed — ${errText(err)}`, 'err');
    } finally {
      importBtn.disabled = !savedSelect.value;
    }
  })();
});

// ── Export (delegated save buttons in session rows) ───────────────────────────

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
      addLog(`Export failed — ${errText(err)}`, 'err');
    } finally {
      btn.disabled = false;
    }
  })();
});

// ── Remove model from session (delegated close buttons) ──────────────────────

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

// ── Ensemble ──────────────────────────────────────────────────────────────────

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
      addLog(`Ensemble accuracy: ${(data.accuracy * 100).toFixed(1)}%`, 'ok');
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
      addLog(`Ensemble error — ${errText(err)}`, 'err');
    } finally {
      ensembleBtn.disabled = false;
      ensembleBtn.textContent = 'Ensemble';
    }
  })();
});

// ── Ablation (delegated from session model rows) ──────────────────────────────

document.addEventListener('click', (e) => {
  const btn =
    e.target instanceof Element ? e.target.closest<HTMLButtonElement>('[data-ablation]') : null;
  const modelName = btn?.dataset.ablation;
  if (!btn || !modelName) return;
  void (async () => {
    btn.disabled = true;
    addLog(`Running ablation study on '${modelName}'…`);

    await consumeSSE(
      `${base()}/ablation`,
      { model_name: modelName },
      {
        fetchImpl: apiFetch,
        onStatus(msg) {
          if (typeof msg === 'string') {
            addLog(msg);
            return;
          }
          if (
            msg.type === 'ablation_result' &&
            typeof msg.accuracy === 'number' &&
            typeof msg.drop === 'number'
          ) {
            addLog(
              `  ${String(msg.layer)}: acc=${(msg.accuracy * 100).toFixed(1)}%, drop=${(msg.drop * 100).toFixed(1)}%`,
            );
          }
        },
        onDone() {
          addLog(`Ablation complete for '${modelName}'`, 'ok');
        },
        onError(err) {
          addLog(`Ablation error: ${err}`, 'err');
        },
      },
    );
    btn.disabled = false;
  })();
});

// ── Tier-aware controls ──────────────────────────────────────────────────────
// Training, ensembles and saved models run on the live backend, so offline they're
// disabled, with the reason shown once in the Train card.
const BACKEND_CONTROLS = [
  'train-btn',
  'ensemble-btn',
  'refresh-saved-btn',
  'import-btn',
  'saved-select',
  'model-type',
  'teacher-select',
];
function applyTier(): void {
  const off = isOffline();
  for (const id of BACKEND_CONTROLS) {
    const el = document.getElementById(id);
    if (el instanceof HTMLButtonElement || el instanceof HTMLSelectElement) {
      el.disabled = off;
      el.title = off ? 'Needs the live backend' : '';
    }
  }
  const note = document.getElementById('backend-note');
  if (note) note.hidden = !off;
  const tier = document.getElementById('tier-label');
  if (tier) tier.textContent = off ? 'Runs in your browser' : 'Live backend';
  // The Model list comes from the live backend; until it arrives the field can't be filled.
  const typeRow = document.getElementById('model-type-row');
  if (typeRow) typeRow.hidden = modelTypeSelect.options.length === 0;
}

// ── Connection state observer ────────────────────────────────────────────────

document.addEventListener('connection:statechange', (e) => {
  const { state: s, previous } = (e as CustomEvent<{ state: string; previous: string }>).detail;
  applyTier();
  if (s === 'connecting')
    addLog(connectionManager.everConnected ? 'Reconnecting…' : 'Connecting to the live backend…');
  if (s === 'degraded') addLog('Missed a heartbeat: checking the live backend…');
  if (s === 'connected' && previous === 'degraded') addLog('The live backend answered', 'ok');
  if (s === 'connected' && previous !== 'degraded') {
    addLog('Connected to the live backend', 'ok');
    void loadModels();
    void loadSavedModels();
    void loadModelTypes();
  }
  if (s === 'disconnected' && (previous === 'connected' || previous === 'degraded')) {
    addLog('Lost the live backend: predictions are back in your browser', 'err');
    dropServerModels();
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────

/** A shipped weight file as a session model, with its real test accuracy. */
function localModelInfo(model: ClassifierModel, file: string): ModelInfo {
  const numParams =
    model.kind === 'qsvm'
      ? (model.num_params ?? null)
      : model.weight.length * (model.weight[0]?.length ?? 0) + model.bias.length;
  const prov = model.provenance;
  return {
    model_type: model.kind === 'qsvm' ? 'QSVM' : 'Linear',
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
    _subset: model.display?.subset,
    _classes: model.kind === 'qsvm' ? [...model.classes] : undefined,
    _provenance: prov?.source_sha
      ? `weights · ${prov.source_sha.slice(0, 7)}${prov.exported_at ? ` · ${prov.exported_at}` : ''}`
      : undefined,
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
    const label = model.display?.label
      ? `${model.display.label} (in-browser)`
      : 'Logistic Regression (in-browser)';
    const info = localModelInfo(model, file);
    state.models[label] = info;
    addLog(`weights loaded: ${label} · ${info.num_params?.toLocaleString() ?? '?'} params`);
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
if (isOffline())
  addLog('Running in your browser: predictions are local; training needs the live backend.');
modelNameInput.value = defaultName(modelTypeSelect.value);
void fetchModelInfo(modelTypeSelect.value);
