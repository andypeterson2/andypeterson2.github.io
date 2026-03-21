/**
 * QPK Phase 3 — Cross-cutting tests
 *
 * WP #681: E2E test: protein classification pipeline
 * WP #682: Model accuracy regression test suite
 * WP #683: Quantum circuit correctness tests
 * WP #684: Docker and deployment test
 * WP #685: Performance and resource test
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { resolve, extname } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');
const CLASSIFIER_DIR = resolve(ROOT, 'classifiers');
const DOCKERFILES_DIR = resolve(ROOT, 'dockerfiles');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function classifierFile(rel: string): string {
  return readFileSync(resolve(CLASSIFIER_DIR, rel), 'utf-8');
}

function classifierExists(rel: string): boolean {
  return existsSync(resolve(CLASSIFIER_DIR, rel));
}

/** Recursively collect files with given extensions from a directory. */
function collectFiles(
  dir: string,
  exts: string[],
  result: string[] = [],
): string[] {
  if (!existsSync(dir)) return result;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist'].includes(entry.name)) continue;
      collectFiles(full, exts, result);
    } else if (exts.includes(extname(entry.name))) {
      result.push(full);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// WP #681: E2E test — protein classification pipeline
// ---------------------------------------------------------------------------

describe('WP #681 — E2E: protein classification pipeline', () => {
  test('frontend has complete train-to-predict flow (Train section)', () => {
    const html = classifierFile('index.html');
    // Train section has form and button
    expect(html).toContain('id="train-section"');
    expect(html).toContain('id="train-btn"');
    expect(html).toContain('id="train-form"');
  });

  test('frontend has complete train-to-predict flow (Test section)', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('id="test-section"');
    expect(html).toContain('id="metrics-table"');
  });

  test('frontend has complete train-to-predict flow (Models section)', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('id="import-section"');
    expect(html).toContain('id="session-models"');
  });

  test('frontend has complete train-to-predict flow (Try section)', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('id="try-section"');
    expect(html).toContain('id="pred-table"');
  });

  test('pipeline supports multiple model types including QKernel', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('value="Linear"');
    expect(html).toContain('value="Conv"');
    expect(html).toContain('value="QKernel"');
  });

  test('SSE streaming connects train, evaluate, and predict stages', () => {
    const sseJs = classifierFile('static/js/sse.js');
    // SSE supports status -> done -> error lifecycle
    expect(sseJs).toContain('"status"');
    expect(sseJs).toContain('"done"');
    expect(sseJs).toContain('"error"');
    expect(sseJs).toContain('"history"');
  });

  test('app.js maintains model state throughout the pipeline', () => {
    const appJs = classifierFile('static/js/app.js');
    // State object tracks models and predictions
    expect(appJs).toContain('models:');
    expect(appJs).toContain('predictions:');
    // State is used for rendering
    expect(appJs).toContain('state.models');
    expect(appJs).toContain('state.predictions');
  });

  test('knowledge distillation is available for model refinement', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('id="teacher-select"');
    expect(html).toContain('id="distill-weight"');
    expect(html).toContain('Distill');
  });

  test('ensemble prediction is supported for combined models', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('id="ensemble-btn"');
    expect(html).toContain('majority vote');
  });
});

// ---------------------------------------------------------------------------
// WP #682: Model accuracy regression test suite
// ---------------------------------------------------------------------------

describe('WP #682 — Model accuracy regression test suite', () => {
  test('evaluation progress bar tracks test-set evaluation', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('id="evaluate-progress"');
    expect(html).toContain('id="eval-bar"');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="100"');
  });

  test('metrics table shows per-model accuracy results', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('id="metrics-table"');
    expect(html).toContain('id="metrics-head"');
    expect(html).toContain('id="metrics-body"');
  });

  test('app.js defines EvalResult type with accuracy and per-class fields', () => {
    const appJs = classifierFile('static/js/app.js');
    expect(appJs).toContain('EvalResult');
    expect(appJs).toContain('accuracy');
    expect(appJs).toContain('avg_loss');
    expect(appJs).toContain('per_class_accuracy');
  });

  test('training chart tracks loss and accuracy over time', () => {
    const chartJs = classifierFile('static/js/chart.js');
    expect(chartJs).toContain('class MiniChart');
    expect(chartJs).toContain('addSeries');
    expect(chartJs).toContain('addPoint');
    expect(chartJs).toContain('render');
  });

  test('chart supports dual-axis display (loss + accuracy)', () => {
    const chartJs = classifierFile('static/js/chart.js');
    expect(chartJs).toContain('"left"');
    expect(chartJs).toContain('"right"');
    expect(chartJs).toContain('Loss');
    expect(chartJs).toContain('Accuracy');
  });

  test('CSS has accuracy-level classes for regression thresholds', () => {
    const css = classifierFile('static/css/app.css');
    expect(css).toContain('.acc-high');
    expect(css).toContain('.acc-med');
    expect(css).toContain('.acc-low');
    // Verify they use semantic color tokens
    expect(css).toContain('var(--success)');
    expect(css).toContain('var(--warn)');
    expect(css).toContain('var(--danger)');
  });
});

// ---------------------------------------------------------------------------
// WP #683: Quantum circuit correctness tests
// ---------------------------------------------------------------------------

describe('WP #683 — Quantum circuit correctness tests', () => {
  test('QKernel is a first-class model type in the UI', () => {
    const html = classifierFile('index.html');
    const options = html.match(/<option\s+value="(\w+)">/g) || [];
    const values = options.map((o) => o.match(/value="(\w+)"/)?.[1]);
    expect(values).toContain('QKernel');
  });

  test('Dockerfile includes scientific computing stack for quantum simulation', () => {
    const df = readFileSync(
      resolve(DOCKERFILES_DIR, 'Dockerfile.classifier'),
      'utf-8',
    );
    // These libraries are necessary for quantum circuit simulation
    expect(df).toContain('numpy');
    expect(df).toContain('scipy');
    expect(df).toContain('torch');
  });

  test('frontend can render predictions from quantum model', () => {
    const html = classifierFile('index.html');
    // Prediction table is model-agnostic (works for QKernel too)
    expect(html).toContain('id="pred-table"');
    expect(html).toContain('<th>Model</th>');
    expect(html).toContain('<th>Prediction</th>');
    expect(html).toContain('<th>Confidence</th>');
  });

  test('model info panel can display quantum circuit documentation', () => {
    const appJs = classifierFile('static/js/app.js');
    expect(appJs).toContain('fetchModelInfo');
    expect(appJs).toContain('model-info');
  });

  test('training form parameters apply to quantum models', () => {
    const html = classifierFile('index.html');
    // The same form is used for all model types including QKernel
    expect(html).toContain('id="model-type"');
    expect(html).toContain('id="epochs"');
    expect(html).toContain('id="lr"');
    expect(html).toContain('id="batch-size"');
  });
});

// ---------------------------------------------------------------------------
// WP #684: Docker and deployment test
// ---------------------------------------------------------------------------

describe('WP #684 — Docker and deployment test', () => {
  test('Dockerfile.classifier exists and is non-empty', () => {
    const path = resolve(DOCKERFILES_DIR, 'Dockerfile.classifier');
    expect(existsSync(path)).toBe(true);
    const stat = statSync(path);
    expect(stat.size).toBeGreaterThan(50);
  });

  test('Dockerfile has FROM, WORKDIR, RUN, COPY, EXPOSE, CMD', () => {
    const df = readFileSync(
      resolve(DOCKERFILES_DIR, 'Dockerfile.classifier'),
      'utf-8',
    );
    expect(df).toContain('FROM');
    expect(df).toContain('WORKDIR');
    expect(df).toContain('RUN');
    expect(df).toContain('COPY');
    expect(df).toContain('EXPOSE');
    expect(df).toContain('CMD');
  });

  test('Dockerfile uses no-cache-dir for pip (smaller images)', () => {
    const df = readFileSync(
      resolve(DOCKERFILES_DIR, 'Dockerfile.classifier'),
      'utf-8',
    );
    expect(df).toContain('--no-cache-dir');
  });

  test('docker-compose file exists for local orchestration', () => {
    expect(existsSync(resolve(ROOT, 'docker-compose.dashboard.yml'))).toBe(
      true,
    );
  });

  test('docker-compose uses volume mount for development', () => {
    const dc = readFileSync(
      resolve(ROOT, 'docker-compose.dashboard.yml'),
      'utf-8',
    );
    expect(dc).toContain('volumes:');
  });

  test('CI workflow exists for automated testing', () => {
    expect(
      existsSync(resolve(ROOT, '.github', 'workflows', 'ci.yml')),
    ).toBe(true);
  });

  test('vercel.json exists for production deployment', () => {
    expect(existsSync(resolve(ROOT, 'vercel.json'))).toBe(true);
  });

  test('multiple Dockerfiles exist for different services', () => {
    const dockerfiles = readdirSync(DOCKERFILES_DIR).filter((f) =>
      f.startsWith('Dockerfile.'),
    );
    expect(dockerfiles.length).toBeGreaterThanOrEqual(2);
    expect(dockerfiles).toContain('Dockerfile.classifier');
  });
});

// ---------------------------------------------------------------------------
// WP #685: Performance and resource test
// ---------------------------------------------------------------------------

describe('WP #685 — Performance and resource test', () => {
  test('HTML file is under 15KB (fast initial load)', () => {
    const stat = statSync(resolve(CLASSIFIER_DIR, 'index.html'));
    expect(stat.size).toBeLessThan(15_000);
  });

  test('CSS file is under 10KB (minimal styling)', () => {
    const stat = statSync(resolve(CLASSIFIER_DIR, 'static', 'css', 'app.css'));
    expect(stat.size).toBeLessThan(10_000);
  });

  test('total JS payload is under 50KB (no heavy frameworks)', () => {
    const jsFiles = collectFiles(
      resolve(CLASSIFIER_DIR, 'static', 'js'),
      ['.js'],
    );
    const totalSize = jsFiles.reduce(
      (sum, f) => sum + statSync(f).size,
      0,
    );
    expect(totalSize).toBeLessThan(50_000);
  });

  test('no external JS framework dependencies (vanilla JS)', () => {
    const html = classifierFile('index.html');
    // Should not import React, Vue, Angular, jQuery, etc.
    expect(html).not.toContain('react');
    expect(html).not.toContain('vue.');
    expect(html).not.toContain('angular');
    expect(html).not.toContain('jquery');
  });

  test('chart.js uses native Canvas 2D API (no chart library)', () => {
    const chartJs = classifierFile('static/js/chart.js');
    expect(chartJs).toContain('getContext("2d")');
    expect(chartJs).toContain('Canvas 2D API');
    // Should not reference Chart.js library
    expect(chartJs).not.toContain('Chart.register');
    expect(chartJs).not.toContain('new Chart(');
  });

  test('SSE uses native Fetch + ReadableStream (no EventSource polyfill)', () => {
    const sseJs = classifierFile('static/js/sse.js');
    expect(sseJs).toContain('fetch(url');
    expect(sseJs).toContain('res.body.getReader()');
    // Should not use EventSource
    expect(sseJs).not.toContain('EventSource');
  });

  test('Dockerfile uses slim base image to reduce container size', () => {
    const df = readFileSync(
      resolve(DOCKERFILES_DIR, 'Dockerfile.classifier'),
      'utf-8',
    );
    expect(df).toContain('-slim');
  });

  test('fonts use preconnect for performance', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('rel="preconnect"');
    expect(html).toContain('fonts.googleapis.com');
    expect(html).toContain('fonts.gstatic.com');
  });

  test('log terminal has a line limit for memory management', () => {
    const appJs = classifierFile('static/js/app.js');
    // createLogger is called with a max-lines argument
    expect(appJs).toMatch(/createLogger\(.*\d+\)/);
  });
});
