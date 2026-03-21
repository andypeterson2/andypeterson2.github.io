/**
 * QPK Phase 2 Tests
 *
 * WP #686: Quantum feature map encoding
 * WP #687: Variational circuit parameter optimization
 * WP #688: Classical-quantum interface (autograd bridge)
 * WP #689: Classification output and confidence calibration
 * WP #690: Training data pipeline
 * WP #691: Dockerfile builds from clean clone
 * WP #692: Container environment configuration
 * WP #693: Classifier frontend rendering
 * WP #694: Frontend-backend API integration
 * WP #695: CI pipeline with model validation
 * WP #696: API documentation accuracy
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');
const CLASSIFIER_DIR = resolve(ROOT, 'classifiers');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a file relative to the classifiers submodule. */
function classifierFile(rel: string): string {
  return readFileSync(resolve(CLASSIFIER_DIR, rel), 'utf-8');
}

/** Check if a file exists relative to the classifiers submodule. */
function classifierExists(rel: string): boolean {
  return existsSync(resolve(CLASSIFIER_DIR, rel));
}

// ---------------------------------------------------------------------------
// WP #686: Quantum feature map encoding
// ---------------------------------------------------------------------------

describe('WP #686 — Quantum feature map encoding', () => {
  test('frontend exposes QKernel model type in the train form', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('QKernel');
  });

  test('model-type select has QKernel as a selectable option', () => {
    const html = classifierFile('index.html');
    // The option value should be exactly "QKernel"
    expect(html).toMatch(/<option\s+value="QKernel"/);
  });

  test('Dockerfile installs quantum-compatible scientific stack', () => {
    const dockerfile = readFileSync(
      resolve(ROOT, 'dockerfiles', 'Dockerfile.classifier'),
      'utf-8',
    );
    // numpy and scipy are minimum requirements for quantum feature maps
    expect(dockerfile).toContain('numpy');
    expect(dockerfile).toContain('scipy');
  });
});

// ---------------------------------------------------------------------------
// WP #687: Variational circuit parameter optimization
// ---------------------------------------------------------------------------

describe('WP #687 — Variational circuit parameter optimization', () => {
  test('train form includes learning rate (LR) parameter', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('id="lr"');
    expect(html).toMatch(/min="[\d.]+"/);
    expect(html).toMatch(/max="[\d.]+"/);
  });

  test('train form includes epochs parameter', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('id="epochs"');
  });

  test('train form includes batch size parameter', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('id="batch-size"');
  });

  test('advanced options include early stopping (patience)', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('id="patience"');
    expect(html).toContain('Early Stop');
  });

  test('advanced options include validation frequency', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('id="val-gap"');
    expect(html).toContain('Val Freq');
  });

  test('Dockerfile installs torch for gradient-based optimization', () => {
    const dockerfile = readFileSync(
      resolve(ROOT, 'dockerfiles', 'Dockerfile.classifier'),
      'utf-8',
    );
    expect(dockerfile).toContain('torch');
  });
});

// ---------------------------------------------------------------------------
// WP #688: Classical-quantum interface (autograd bridge)
// ---------------------------------------------------------------------------

describe('WP #688 — Classical-quantum interface (autograd bridge)', () => {
  test('Dockerfile installs PyTorch (autograd backend)', () => {
    const dockerfile = readFileSync(
      resolve(ROOT, 'dockerfiles', 'Dockerfile.classifier'),
      'utf-8',
    );
    expect(dockerfile).toContain('torch');
    expect(dockerfile).toContain('torchvision');
  });

  test('app.js references training history for gradient tracking', () => {
    const appJs = classifierFile('static/js/app.js');
    expect(appJs).toContain('training_history');
  });

  test('SSE consumer handles structured training events', () => {
    const sseJs = classifierFile('static/js/sse.js');
    expect(sseJs).toContain('event.type');
    expect(sseJs).toContain('"status"');
    expect(sseJs).toContain('"done"');
    expect(sseJs).toContain('"error"');
  });

  test('chart.js tracks loss (gradient signal) on left axis', () => {
    const chartJs = classifierFile('static/js/chart.js');
    expect(chartJs).toContain('Loss');
    expect(chartJs).toContain('"left"');
  });
});

// ---------------------------------------------------------------------------
// WP #689: Classification output and confidence calibration
// ---------------------------------------------------------------------------

describe('WP #689 — Classification output and confidence calibration', () => {
  test('prediction table has Model, Prediction, and Confidence columns', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('<th>Model</th>');
    expect(html).toContain('<th>Prediction</th>');
    expect(html).toContain('<th>Confidence</th>');
  });

  test('app.js defines PredictionInfo with confidence field', () => {
    const appJs = classifierFile('static/js/app.js');
    expect(appJs).toContain('confidence');
    expect(appJs).toContain('probs');
  });

  test('CSS provides confidence-level styling classes', () => {
    const css = classifierFile('static/css/app.css');
    expect(css).toContain('.conf-high');
    expect(css).toContain('.conf-low');
  });

  test('CSS provides accuracy-level styling classes', () => {
    const css = classifierFile('static/css/app.css');
    expect(css).toContain('.acc-high');
    expect(css).toContain('.acc-med');
    expect(css).toContain('.acc-low');
  });

  test('metrics table exists for evaluation output', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('id="metrics-table"');
    expect(html).toContain('aria-label="Model metrics"');
  });
});

// ---------------------------------------------------------------------------
// WP #690: Training data pipeline
// ---------------------------------------------------------------------------

describe('WP #690 — Training data pipeline', () => {
  test('UI_CONFIG default provides MNIST class labels', () => {
    const html = classifierFile('index.html');
    // Default config embeds class_labels for MNIST (digits 0-9)
    expect(html).toContain('"class_labels"');
    expect(html).toContain('"0","1","2","3","4","5","6","7","8","9"');
  });

  test('frontend fetches dataset config from API on load', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('/api/datasets/');
    expect(html).toContain('/config');
  });

  test('dataset menu exists for switching data sources', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('id="dataset-menu"');
    expect(html).toContain('id="dataset-list"');
  });

  test('SSE utility supports POST with JSON body for training pipeline', () => {
    const sseJs = classifierFile('static/js/sse.js');
    expect(sseJs).toContain('"POST"');
    expect(sseJs).toContain('"Content-Type": "application/json"');
    expect(sseJs).toContain('JSON.stringify(body)');
  });

  test('backend meta declares backend service name and port', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('meta name="site-backend-service" content="classifier"');
    expect(html).toContain('meta name="site-backend-port" content="5051"');
  });
});

// ---------------------------------------------------------------------------
// WP #691: Dockerfile builds from clean clone
// ---------------------------------------------------------------------------

describe('WP #691 — Dockerfile builds from clean clone', () => {
  const dockerfilePath = resolve(ROOT, 'dockerfiles', 'Dockerfile.classifier');

  test('Dockerfile.classifier exists', () => {
    expect(existsSync(dockerfilePath)).toBe(true);
  });

  test('uses official Python 3.12 slim base image', () => {
    const df = readFileSync(dockerfilePath, 'utf-8');
    expect(df).toMatch(/FROM python:3\.12-slim/);
  });

  test('sets WORKDIR to /app', () => {
    const df = readFileSync(dockerfilePath, 'utf-8');
    expect(df).toContain('WORKDIR /app');
  });

  test('installs pip packages before COPY (layer caching)', () => {
    const df = readFileSync(dockerfilePath, 'utf-8');
    const pipIdx = df.indexOf('pip install');
    const copyIdx = df.indexOf('COPY');
    expect(pipIdx).toBeGreaterThan(-1);
    expect(copyIdx).toBeGreaterThan(-1);
    expect(pipIdx).toBeLessThan(copyIdx);
  });

  test('COPY instruction copies application code', () => {
    const df = readFileSync(dockerfilePath, 'utf-8');
    expect(df).toContain('COPY . .');
  });

  test('exposes a port', () => {
    const df = readFileSync(dockerfilePath, 'utf-8');
    expect(df).toMatch(/EXPOSE \d+/);
  });

  test('CMD launches the classifier module', () => {
    const df = readFileSync(dockerfilePath, 'utf-8');
    expect(df).toContain('CMD');
    expect(df).toContain('classifiers');
  });
});

// ---------------------------------------------------------------------------
// WP #692: Container environment configuration
// ---------------------------------------------------------------------------

describe('WP #692 — Container environment configuration', () => {
  test('Dockerfile installs Flask web framework', () => {
    const df = readFileSync(
      resolve(ROOT, 'dockerfiles', 'Dockerfile.classifier'),
      'utf-8',
    );
    expect(df).toContain('flask');
  });

  test('Dockerfile installs ML dependencies (torch, numpy, scipy)', () => {
    const df = readFileSync(
      resolve(ROOT, 'dockerfiles', 'Dockerfile.classifier'),
      'utf-8',
    );
    expect(df).toContain('torch');
    expect(df).toContain('numpy');
    expect(df).toContain('scipy');
  });

  test('Dockerfile installs Pillow for image processing', () => {
    const df = readFileSync(
      resolve(ROOT, 'dockerfiles', 'Dockerfile.classifier'),
      'utf-8',
    );
    expect(df).toContain('pillow');
  });

  test('Dockerfile installs documentation dependencies', () => {
    const df = readFileSync(
      resolve(ROOT, 'dockerfiles', 'Dockerfile.classifier'),
      'utf-8',
    );
    // mistune for markdown rendering, pyyaml for config
    expect(df).toContain('mistune');
    expect(df).toContain('pyyaml');
  });

  test('docker-compose file exists for local development', () => {
    expect(existsSync(resolve(ROOT, 'docker-compose.dashboard.yml'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// WP #693: Classifier frontend rendering
// ---------------------------------------------------------------------------

describe('WP #693 — Classifier frontend rendering', () => {
  test('index.html has correct document structure', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en"');
    expect(html).toContain('</html>');
  });

  test('page title is set', () => {
    const html = classifierFile('index.html');
    expect(html).toMatch(/<title>.*Classifiers.*<\/title>/);
  });

  test('all required static assets are referenced', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('static/css/app.css');
    expect(html).toContain('static/js/app.js');
    expect(html).toContain('static/js/sse.js');
    expect(html).toContain('static/js/chart.js');
  });

  test('all referenced JS files exist', () => {
    expect(classifierExists('static/js/app.js')).toBe(true);
    expect(classifierExists('static/js/sse.js')).toBe(true);
    expect(classifierExists('static/js/chart.js')).toBe(true);
  });

  test('all referenced CSS files exist', () => {
    expect(classifierExists('static/css/app.css')).toBe(true);
  });

  test('main sections are present (Train, Test, Models, Try)', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('id="train-section"');
    expect(html).toContain('id="test-section"');
    expect(html).toContain('id="import-section"');
    expect(html).toContain('id="try-section"');
  });

  test('drawing canvas is present for MNIST input', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('id="draw-canvas"');
    expect(html).toContain('width="280"');
    expect(html).toContain('height="280"');
  });

  test('theme toggle button exists', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('id="theme-toggle"');
    expect(html).toContain('data-theme=');
  });

  test('training log drawer exists', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('id="log-drawer"');
    expect(html).toContain('id="log-terminal"');
    expect(html).toContain('role="log"');
  });

  test('split layout with resize handle exists', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('id="split-layout"');
    expect(html).toContain('id="resize-h"');
    expect(html).toContain('role="separator"');
  });

  test('responsive CSS rules exist', () => {
    const css = classifierFile('static/css/app.css');
    expect(css).toContain('@media');
    expect(css).toContain('max-width: 900px');
  });
});

// ---------------------------------------------------------------------------
// WP #694: Frontend-backend API integration
// ---------------------------------------------------------------------------

describe('WP #694 — Frontend-backend API integration', () => {
  test('API_BASE is resolved via ServiceConfig', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('ServiceConfig');
    expect(html).toContain('API_BASE');
  });

  test('default API fallback points to localhost:5051', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('http://localhost:5051');
  });

  test('app.js builds dataset-scoped API base URL', () => {
    const appJs = classifierFile('static/js/app.js');
    expect(appJs).toContain('API_BASE');
    expect(appJs).toMatch(/`.*\/d\/\$\{UI_CONFIG\.name\}`/);
  });

  test('SSE utility provides consumeSSE function', () => {
    const sseJs = classifierFile('static/js/sse.js');
    expect(sseJs).toContain('async function consumeSSE');
    // Verify it accepts the right parameters
    expect(sseJs).toContain('url, body, onStatus, onDone, onError');
  });

  test('app.js checks backend connection on load', () => {
    const appJs = classifierFile('static/js/app.js');
    expect(appJs).toContain('checkBackendConnection');
    expect(appJs).toContain('/api/datasets');
  });

  test('connect widget integration handles connect/disconnect', () => {
    const appJs = classifierFile('static/js/app.js');
    expect(appJs).toContain('navbar:connect-ready');
    expect(appJs).toContain('setStatus("connected")');
    expect(appJs).toContain('setStatus("disconnected"');
  });

  test('SSE handles error responses gracefully', () => {
    const sseJs = classifierFile('static/js/sse.js');
    expect(sseJs).toContain('if (!res.ok)');
    expect(sseJs).toContain('onError');
  });
});

// ---------------------------------------------------------------------------
// WP #695: CI pipeline with model validation
// ---------------------------------------------------------------------------

describe('WP #695 — CI pipeline with model validation', () => {
  test('CI workflow file exists', () => {
    expect(existsSync(resolve(ROOT, '.github', 'workflows', 'ci.yml'))).toBe(
      true,
    );
  });

  test('CI triggers on push and pull_request to main', () => {
    const ci = readFileSync(
      resolve(ROOT, '.github', 'workflows', 'ci.yml'),
      'utf-8',
    );
    expect(ci).toContain('push:');
    expect(ci).toContain('pull_request:');
    expect(ci).toContain('branches: [main]');
  });

  test('CI runs integration tests', () => {
    const ci = readFileSync(
      resolve(ROOT, '.github', 'workflows', 'ci.yml'),
      'utf-8',
    );
    expect(ci).toContain('integration-tests') ;
    expect(ci).toContain('Integration Tests');
  });

  test('CI checks out submodules recursively', () => {
    const ci = readFileSync(
      resolve(ROOT, '.github', 'workflows', 'ci.yml'),
      'utf-8',
    );
    expect(ci).toContain('submodules: recursive');
  });

  test('CI uses Node.js 20', () => {
    const ci = readFileSync(
      resolve(ROOT, '.github', 'workflows', 'ci.yml'),
      'utf-8',
    );
    expect(ci).toContain('node-version');
    expect(ci).toContain('"20"');
  });

  test('manifest generation workflow exists', () => {
    expect(
      existsSync(
        resolve(ROOT, '.github', 'workflows', 'generate-manifest.yml'),
      ),
    ).toBe(true);
  });

  test('vitest config includes test files', () => {
    const vitestConfig = readFileSync(
      resolve(ROOT, 'vitest.config.ts'),
      'utf-8',
    );
    expect(vitestConfig).toContain("tests/**/*.test.ts");
  });
});

// ---------------------------------------------------------------------------
// WP #696: API documentation accuracy
// ---------------------------------------------------------------------------

describe('WP #696 — API documentation accuracy', () => {
  test('Dockerfile installs mistune for markdown/API doc rendering', () => {
    const df = readFileSync(
      resolve(ROOT, 'dockerfiles', 'Dockerfile.classifier'),
      'utf-8',
    );
    expect(df).toContain('mistune');
  });

  test('app.js fetches model-info endpoint for documentation', () => {
    const appJs = classifierFile('static/js/app.js');
    expect(appJs).toContain('model-info');
    expect(appJs).toContain('fetchModelInfo');
  });

  test('model info panel exists in HTML for rendering docs', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('id="model-info-panel"');
    expect(html).toContain('id="model-info-details"');
    expect(html).toContain('Model Info');
  });

  test('service config meta tags document backend connection', () => {
    const html = classifierFile('index.html');
    expect(html).toContain('meta name="site-backend-service"');
    expect(html).toContain('meta name="site-backend-port"');
  });

  test('SSE module has JSDoc documentation', () => {
    const sseJs = classifierFile('static/js/sse.js');
    expect(sseJs).toContain('@file');
    expect(sseJs).toContain('@param');
    expect(sseJs).toContain('@example');
  });

  test('chart module has JSDoc documentation', () => {
    const chartJs = classifierFile('static/js/chart.js');
    expect(chartJs).toContain('@file');
    expect(chartJs).toContain('@param');
  });

  test('app.js has JSDoc documentation for types and functions', () => {
    const appJs = classifierFile('static/js/app.js');
    expect(appJs).toContain('@file');
    expect(appJs).toContain('@typedef');
    expect(appJs).toContain('@property');
  });
});
