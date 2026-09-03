/**
 * Multi-Dataset Classifier App — client-side SPA logic.
 *
 * Reusable UI behaviours (theme toggle, drawer, dropdown, resize, log
 * terminal) come from UIKit; this module handles application-specific logic:
 * state management, SSE streaming, training, evaluation, prediction, model
 * persistence, and canvas drawing.
 *
 * Server responses are typed at the boundary with the Raw* interfaces below,
 * hand-derived from the classifier backend's route handlers (the same
 * convention as the editor's wire.ts).
 */

import { UIKit } from '../ui-kit/ui-kit';
import { connectionManager } from './connection';
import { consumeSSE, type SseStructuredEvent } from './sse';
import { MiniChart } from './chart';
import { ClassifierInfer, type ClassifierModel, type Prediction } from './infer';

// ── Shorthand ────────────────────────────────────────────────────────────────
const ICONS = UIKit.ICONS;

// ── Backend config ───────────────────────────────────────────────────────────
// window.API_BASE / window.UI_CONFIG are seeded by config.ts (imported first);
// API_BASE is refreshed whenever the user connects a backend, so the per-dataset
// URL prefix is computed live via base() rather than frozen at module-load time.
document.addEventListener('navbar:connect', (e) => {
  const detail = (e as CustomEvent<{ service?: string; url?: string }>).detail;
  if (detail.service === 'classifiers' && detail.url) window.API_BASE = detail.url;
});

/** Live URL prefix for all API calls scoped to the active dataset. */
function base(): string {
  const ds = window.UI_CONFIG?.name ?? 'mnist';
  return (window.API_BASE ?? '') + `/d/${ds}`;
}

// ── Connection-aware fetch wrapper ──────────────────────────────────────────

/**
 * Thin wrapper around fetch that checks the connection manager state before
 * issuing a request. Throws immediately when disconnected so callers can
 * surface a user-visible error instead of hanging silently.
 */
async function apiFetch(url: string | URL | Request, opts?: RequestInit): Promise<Response> {
  if (connectionManager.state !== 'connected') {
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
}

/** Application state — single source of truth for loaded models and predictions. */
const state: {
  models: Partial<Record<string, ModelInfo>>;
  predictions: Partial<Record<string, Prediction>>;
} = {
  models: {},
  predictions: {},
};

function modelEntries(): [string, ModelInfo][] {
  return Object.entries(state.models).filter(
    (entry): entry is [string, ModelInfo] => entry[1] !== undefined,
  );
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

// The portal owns theming globally, so this embed has no #theme-toggle. Guard
// the init: passing null aborted the entire script here (a silent failure that
// left the classifier non-interactive since the portal integration).
const themeToggleEl = document.getElementById('theme-toggle');
if (themeToggleEl) UIKit.initThemeToggle(themeToggleEl);

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

const canvasCol = byId('canvas-col', HTMLElement);
const tabularCol = byId('tabular-col', HTMLElement);

const canvas = byId('draw-canvas', HTMLCanvasElement);
const canvasCtx = canvas.getContext('2d');
if (!canvasCtx) throw new Error('classifier app: 2d canvas context unavailable');
const ctx = canvasCtx;
const trainBtn = byId('train-btn', HTMLButtonElement);
const clearBtn = byId('clear-btn', HTMLButtonElement);
const predictBtn = document.getElementById('predict-btn');
const importBtn = byId('import-btn', HTMLButtonElement);
const refreshSavedBtn = byId('refresh-saved-btn', HTMLButtonElement);
const savedSelect = byId('saved-select', HTMLSelectElement);
const datasetList = byId('dataset-list', HTMLElement);
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

async function fetchModelInfo(modelType: string): Promise<void> {
  const details = byId('model-info-details', HTMLElement);
  const panel = byId('model-info-panel', HTMLElement);
  try {
    const res = await apiFetch(`${base()}/model-info/${encodeURIComponent(modelType)}`);
    if (!res.ok) {
      details.classList.add('hidden');
      return;
    }
    const data = (await res.json()) as { html?: string };
    const doc = new DOMParser().parseFromString(data.html ?? '', 'text/html');
    doc.querySelectorAll('script').forEach((s) => {
      s.remove();
    });
    // Strip event-handler attributes (onerror, onload, etc.) and javascript: URIs
    doc.body.querySelectorAll('*').forEach((el) => {
      for (const attr of [...el.attributes]) {
        if (
          attr.name.startsWith('on') ||
          (attr.name === 'href' && attr.value.trimStart().startsWith('javascript:'))
        ) {
          el.removeAttribute(attr.name);
        }
      }
    });
    panel.innerHTML = doc.body.innerHTML;
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
  for (const name of Object.keys(state.models)) {
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
  ensembleBtn.classList.toggle('hidden', Object.keys(state.models).length < 2);
}

// ── Dataset menu (client-side switching, no navigation) ───────────────────────

// Populate the dataset dropdown from the client-side list and switch in place.
// The portal has no per-dataset routes (/d/<name>/ would 404) and the demo runs
// entirely client-side, so switching just reconfigures the UI + reloads weights.
function renderDatasetMenu(): void {
  const datasets = window.CLASSIFIER_DATASETS ?? [];
  const current = window.UI_CONFIG?.name;
  datasetList.innerHTML = '';
  for (const ds of datasets) {
    const btn = document.createElement('button');
    btn.className = 'ui-dropdown-item' + (ds.name === current ? ' active' : '');
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

/** Render the pixel grid onto the canvas. */
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
  // Draw grid lines
  const gridColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--surface-muted')
    .trim();
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let i = 1; i < GRID; i++) {
    const pos = Math.round(i * CELL) + 0.5;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(canvas.width, pos);
    ctx.stroke();
  }
}

function clearCanvas(): void {
  grid.fill(0);
  renderGrid();
}
clearCanvas();

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
    }
  }
  renderGrid();
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
canvas.addEventListener('mouseleave', () => {
  drawing = false;
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
  if (m._local) {
    // In-browser models have no backend to ablate/export/remove against.
    return row;
  }
  const ablationBtn = document.createElement('button');
  ablationBtn.className = 'btn btn-icon btn-sm';
  ablationBtn.dataset.ablation = name;
  ablationBtn.title = 'Ablation study';
  ablationBtn.textContent = '⊘';
  row.appendChild(ablationBtn);
  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn btn-icon';
  exportBtn.dataset.export = name;
  exportBtn.title = 'Save to disk';
  exportBtn.innerHTML = ICONS.save;
  row.appendChild(exportBtn);
  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn btn-danger';
  removeBtn.dataset.remove = name;
  removeBtn.setAttribute('aria-label', 'Remove ' + name);
  removeBtn.innerHTML = ICONS.close;
  row.appendChild(removeBtn);
  return row;
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

function buildPredictionTable(): void {
  const names = Object.keys(state.models);
  if (names.length === 0) {
    predBody.innerHTML = `<tr class="empty-row"><td colspan="3">No prediction yet</td></tr>`;
    return;
  }
  predBody.innerHTML = '';
  for (const name of names) {
    const p = state.predictions[name];
    const tr = document.createElement('tr');
    const nameTd = document.createElement('td');
    nameTd.className = 'pred-model-name';
    nameTd.textContent = name;
    const predTd = document.createElement('td');
    predTd.innerHTML = p ? `<span class="pred-label">${p.prediction}</span>` : '—';
    const confTd = document.createElement('td');
    // A sign classifier (QSVM) has no probability — render an honest dash
    // rather than a fabricated percentage.
    confTd.innerHTML =
      p?.confidence != null
        ? `<span class="${confClass(p.confidence)}">${pct(p.confidence)}</span>`
        : '—';
    tr.appendChild(nameTd);
    tr.appendChild(predTd);
    tr.appendChild(confTd);
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
  try {
    const res = await apiFetch(`${base()}/models`);
    const data = (await res.json()) as Record<string, RawModelInfo>;
    for (const [name, info] of Object.entries(data)) {
      state.models[name] = { eval_result: null, ...info };
    }
    buildMetricsTable();
    buildPredictionTable();
    buildSessionModelsList();
    modelNameInput.value = defaultName(modelTypeSelect.value);
  } catch {
    /* silent */
  }
}

// ── Evaluate all session models ───────────────────────────────────────────────

async function runEvaluate(): Promise<void> {
  if (Object.keys(state.models).length === 0) return;
  evalProgress.classList.remove('hidden');
  evalBar.style.width = '5%';
  evalBar.setAttribute('aria-valuenow', '5');
  evalStatus.textContent = 'Starting evaluation…';
  let batchesDone = 0;
  const approxBatches = 10 * Object.keys(state.models).length;
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

/** Colours for training curve series (one per model). */
const cs = getComputedStyle(document.documentElement);
const SERIES_COLORS = [
  cs.getPropertyValue('--danger').trim() || '#ef4444',
  cs.getPropertyValue('--success').trim() || '#22c55e',
  cs.getPropertyValue('--accent-teal').trim() || '#3b82f6',
  cs.getPropertyValue('--accent').trim() || '#f59e0b',
  cs.getPropertyValue('--syntax-keyword').trim() || '#a855f7',
  cs.getPropertyValue('--accent-olive').trim() || '#ec4899',
];
let seriesColorIdx = 0;

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
    trainBtn.innerHTML = `${ICONS.spinner} Training…`;

    // Prepare chart for training curves
    const useChart = patience != null || teacher;
    if (useChart) {
      trainChart ??= new MiniChart(trainChartCanvas, {
        title: 'Training Curves',
        yLabel: 'Loss',
        y2Label: 'Val Accuracy',
      });
      const c = SERIES_COLORS[seriesColorIdx++ % SERIES_COLORS.length] ?? '#ef4444';
      const c2 = SERIES_COLORS[seriesColorIdx++ % SERIES_COLORS.length] ?? '#22c55e';
      trainChart.addSeries(`${name} loss`, c, 'left');
      trainChart.addSeries(`${name} acc`, c2, 'right');
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
    trainBtn.innerHTML = `${ICONS.play} Train`;

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

// True when no live backend is connected — the demo tier runs inference in-browser.
function isOffline(): boolean {
  return connectionManager.state !== 'connected';
}

async function runPredict(): Promise<void> {
  if (isOffline()) return runPredictLocal();
  if (Object.keys(state.models).length === 0) return;
  let body: { image: string } | { features: Record<string, number> };
  if (window.UI_CONFIG?.input_type === 'image') {
    const b64 = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
    body = { image: b64 };
  } else {
    const features: Record<string, number> = {};
    document.querySelectorAll<HTMLInputElement>('.feature-input').forEach((inp) => {
      features[inp.dataset.feature ?? ''] = parseFloat(inp.value) || 0;
    });
    body = { features };
  }
  try {
    const res = await apiFetch(`${base()}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as RawPredictResponse;
    if (data.error) return;
    Object.assign(state.predictions, data.results);
    buildPredictionTable();
  } catch {
    /* silent */
  }
}

// Demo tier: run every in-browser model over the current canvas / feature
// inputs, producing the same shape the server /predict returns. Each model
// reads its own feature subset (the QSVM uses 2 of the 4 iris inputs).
async function runPredictLocal(): Promise<void> {
  const locals = modelEntries().filter(([, m]) => m._local);
  for (const [name, m] of locals) {
    let model: ClassifierModel;
    try {
      model = await ClassifierInfer.loadModel(m._file ?? '');
    } catch {
      continue;
    }
    let raw: number[];
    if (window.UI_CONFIG?.input_type === 'image') {
      raw = Array.from(grid); // the 28×28 intensity grid (0–255) is the model input
    } else {
      raw = (model.features ?? []).map((f) => {
        const inp = document.querySelector<HTMLInputElement>(`.feature-input[data-feature="${f}"]`);
        return inp ? parseFloat(inp.value) || 0 : 0;
      });
    }
    state.predictions[name] = ClassifierInfer.predict(model, raw);
  }
  buildPredictionTable();
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
    input.addEventListener('input', () => {
      if (isOffline()) void runPredict();
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
  state.models = {};
  state.predictions = {};
  await initLocalModels(); // demo models for this dataset (rebuilds the tables)
  void loadModels(); // backend models too, when connected (no-op offline)
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
  if (isOffline()) void runPredict();
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
});

// ── Saved models on disk ──────────────────────────────────────────────────────

async function loadSavedModels(): Promise<void> {
  try {
    const res = await apiFetch(`${base()}/models/disk`);
    const files = (await res.json()) as RawSavedModel[];
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
  } catch {
    /* silent */
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
      const res = await apiFetch(`${base()}/models/disk/${encodeURIComponent(filename)}/load`, {
        method: 'POST',
      });
      const data = (await res.json()) as RawLoadedModel;
      const errMsg = !res.ok
        ? (envelopeError(data) ?? `HTTP ${String(res.status)}`)
        : envelopeError(data);
      if (errMsg) {
        addLog(`Import failed — ${errMsg}`, 'err');
        return;
      }
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
    } catch {
      /* silent */
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
      const res = await apiFetch(`${base()}/models/${encodeURIComponent(exportName)}/export`, {
        method: 'POST',
      });
      const data = (await res.json()) as RawEnvelope;
      const errMsg = !res.ok
        ? (envelopeError(data) ?? `HTTP ${String(res.status)}`)
        : envelopeError(data);
      if (errMsg) {
        addLog(`Export failed — ${errMsg}`, 'err');
        return;
      }
      await loadSavedModels();
    } catch {
      /* silent */
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
    const names = Object.keys(state.models);
    if (names.length < 2) return;
    ensembleBtn.disabled = true;
    ensembleBtn.textContent = 'Running…';
    try {
      const res = await apiFetch(`${base()}/ensemble`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_names: names }),
      });
      const data = (await res.json()) as RawEnsembleResponse;
      if (data.error) {
        addLog(`Ensemble error — ${envelopeError(data) ?? 'request failed'}`, 'err');
        return;
      }
      addLog(`Ensemble accuracy: ${(data.accuracy * 100).toFixed(1)}%`, 'ok');
      // Store as a virtual model for display
      state.models.Ensemble = {
        model_type: 'Ensemble',
        epochs: '—',
        batch_size: '—',
        lr: null,
        num_params: null,
        training_history: [],
        eval_result: {
          accuracy: data.accuracy,
          avg_loss: data.avg_loss,
          per_class_accuracy: data.per_class_accuracy,
          num_params: null,
        },
      };
      buildMetricsTable();
    } catch (err) {
      addLog(`Ensemble error: ${String(err)}`, 'err');
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

// ── Connection state observer ────────────────────────────────────────────────

document.addEventListener('connection:statechange', (e) => {
  const { state: s, previous } = (e as CustomEvent<{ state: string; previous: string }>).detail;
  if (s === 'connected') addLog('Connected to server', 'ok');
  if (s === 'degraded') addLog('Connection unstable — retrying…');
  if (s === 'disconnected' && (previous === 'connected' || previous === 'degraded'))
    addLog('Lost server connection', 'err');
  if (s === 'connecting' && previous === 'disconnected') addLog('Reconnecting…');
});

// ── Init ──────────────────────────────────────────────────────────────────────

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
    const numParams =
      model.kind === 'qsvm'
        ? (model.num_params ?? null)
        : model.weight.length * (model.weight[0]?.length ?? 0) + model.bias.length;
    const label = model.display?.label
      ? `${model.display.label} (in-browser)`
      : 'Logistic Regression (in-browser)';
    state.models[label] = {
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
    };
  }
  buildSessionModelsList();
  buildMetricsTable();
  buildPredictionTable();
}

void loadModels();
void loadSavedModels();
void initLocalModels();
renderDatasetMenu();
modelNameInput.value = defaultName(modelTypeSelect.value);
void fetchModelInfo(modelTypeSelect.value);
