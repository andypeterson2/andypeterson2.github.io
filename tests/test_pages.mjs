/**
 * Static site integration tests.
 * Validates that all project pages load correctly without Jinja2 artifacts.
 * Run: node tests/test_pages.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test, describe, before, after } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Simple static file server
function createStaticServer(root) {
  return http.createServer((req, res) => {
    let filePath = path.join(root, decodeURIComponent(req.url));
    if (filePath.endsWith('/')) filePath = path.join(filePath, 'index.html');
    if (!path.extname(filePath)) {
      const withIndex = path.join(filePath, 'index.html');
      if (fs.existsSync(withIndex)) filePath = withIndex;
    }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.writeHead(404); res.end('Not Found'); return;
    }
    const ext = path.extname(filePath);
    const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

let server, BASE;

before(async () => {
  server = createStaticServer(ROOT);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  BASE = `http://127.0.0.1:${server.address().port}`;
});

after(() => server?.close());

async function fetchText(urlPath) {
  const res = await fetch(`${BASE}${urlPath}`);
  return { status: res.status, text: await res.text(), headers: res.headers };
}

// -- Page load tests --

const PAGES = [
  { path: '/', title: 'Andrew Peterson', id: 'about' },
  { path: '/nonogram/', title: 'Nonogram', id: 'sidebar' },
  { path: '/classifiers/', title: 'Classifiers', id: 'train-section' },
  { path: '/cv/', title: 'CV Editor', id: 'section-list' },
  { path: '/tech-tree/', title: 'Knowledge Tech Tree', id: 'sidebar' },
  { path: '/qvc/client/', title: 'Video Chat', id: 'app' },
];

describe('Page loads', () => {
  for (const page of PAGES) {
    test(`${page.path} returns 200 with expected title`, async () => {
      const { status, text } = await fetchText(page.path);
      assert.equal(status, 200, `${page.path} should return 200`);
      assert.ok(text.includes(`<title>`), `${page.path} should have a <title>`);
      assert.ok(text.toLowerCase().includes(page.title.toLowerCase()),
        `${page.path} should contain "${page.title}"`);
    });

    test(`${page.path} contains expected DOM element #${page.id}`, async () => {
      const { text } = await fetchText(page.path);
      assert.ok(text.includes(`id="${page.id}"`),
        `${page.path} should contain #${page.id}`);
    });
  }
});

// -- No Jinja2 artifacts --

describe('No Jinja2 artifacts', () => {
  for (const page of PAGES) {
    test(`${page.path} has no Jinja2 template tags`, async () => {
      const { text } = await fetchText(page.path);
      assert.ok(!text.includes('{{ '), `${page.path} contains Jinja2 {{ variable tag`);
      assert.ok(!text.includes('{%'), `${page.path} contains Jinja2 {% block tag`);
    });
  }
});

// -- Service config present on backend pages --

const BACKEND_PAGES = ['/nonogram/', '/classifiers/', '/cv/', '/qvc/client/'];

describe('ServiceConfig integration', () => {
  for (const p of BACKEND_PAGES) {
    test(`${p} references service-config.js`, async () => {
      const { text } = await fetchText(p);
      assert.ok(text.includes('service-config.js'), `${p} should load service-config.js`);
    });
  }

  for (const p of ['/nonogram/', '/classifiers/', '/cv/']) {
    test(`${p} defines API_BASE`, async () => {
      const { text } = await fetchText(p);
      assert.ok(text.includes('API_BASE'), `${p} should define API_BASE`);
    });
  }

  for (const p of ['/nonogram/', '/classifiers/', '/cv/']) {
    test(`${p} uses resolveBackend`, async () => {
      const { text } = await fetchText(p);
      assert.ok(text.includes('resolveBackend'), `${p} should use resolveBackend`);
    });
  }
});

// -- Static assets resolve --

describe('Static assets', () => {
  test('nonogram CSS loads', async () => {
    const { status } = await fetchText('/nonogram/static/style.css');
    assert.equal(status, 200);
  });
  test('nonogram app.js loads', async () => {
    const { status } = await fetchText('/nonogram/static/app.js');
    assert.equal(status, 200);
  });
  test('classifiers app.js loads', async () => {
    const { status } = await fetchText('/classifiers/static/js/app.js');
    assert.equal(status, 200);
  });
  test('cv app.js loads', async () => {
    const { status } = await fetchText('/cv/app.js');
    assert.equal(status, 200);
  });
  test('tech-tree app.js loads', async () => {
    const { status } = await fetchText('/tech-tree/app.js');
    assert.equal(status, 200);
  });
  test('tech-tree data loads', async () => {
    const { status } = await fetchText('/tech-tree/data/qsvm.json');
    assert.equal(status, 200);
  });
  test('qvc app.js loads', async () => {
    const { status } = await fetchText('/qvc/client/static/app.js');
    assert.equal(status, 200);
  });
  test('main site CSS loads', async () => {
    const { status } = await fetchText('/style.css');
    assert.equal(status, 200);
  });
  test('main site github.js loads', async () => {
    const { status } = await fetchText('/github.js');
    assert.equal(status, 200);
  });
});

// -- Demo bar links --

describe('Demo bar', () => {
  test('main page has demo-bar with all project links', async () => {
    const { text } = await fetchText('/');
    assert.ok(text.includes('demo-bar'), 'main page should have demo-bar');
    for (const href of ['nonogram/', 'classifiers/', 'qvc/client/', 'cv/', 'tech-tree/', 'ui-kit/']) {
      assert.ok(text.includes(`href="${href}"`), `demo-bar should link to ${href}`);
    }
  });
});

// -- Manifest backend metadata --

describe('Manifest backend metadata', () => {
  test('manifest has backend metadata for backend apps', async () => {
    const { text } = await fetchText('/site-manifest.json');
    const manifest = JSON.parse(text);

    const expected = {
      '/classifiers/': { service: 'classifier', defaultPort: 5001 },
      '/cv/': { service: 'cv', defaultPort: 3000 },
      '/nonogram/': { service: 'nonogram', defaultPort: 5055 },
      '/qvc/client/': { service: 'qvc', defaultPort: 5002 },
    };

    for (const [appPath, expectedBackend] of Object.entries(expected)) {
      const app = manifest.apps.find(a => a.path === appPath);
      assert.ok(app, `manifest should have ${appPath}`);
      assert.ok(app.backend, `${appPath} should have backend metadata`);
      assert.equal(app.backend.service, expectedBackend.service);
      assert.equal(app.backend.defaultPort, expectedBackend.defaultPort);
    }
  });

  test('non-backend apps do not have backend metadata', async () => {
    const { text } = await fetchText('/site-manifest.json');
    const manifest = JSON.parse(text);

    for (const appPath of ['/', '/tech-tree/', '/ui-kit/']) {
      const app = manifest.apps.find(a => a.path === appPath);
      assert.ok(app, `manifest should have ${appPath}`);
      assert.ok(!app.backend, `${appPath} should NOT have backend metadata`);
    }
  });
});

// -- Shared navbar connects backend pages via site-nav.js --

describe('Shared navbar connect', () => {
  test('site-nav.js contains initConnect logic for bottom tray', async () => {
    const { text } = await fetchText('/shared/site-nav.js');
    assert.ok(text.includes('navbar-backend-connect'), 'site-nav.js should create #navbar-backend-connect');
    assert.ok(text.includes('initConnect'), 'site-nav.js should call initConnect');
    assert.ok(text.includes('navbar:connect-ready'), 'site-nav.js should dispatch navbar:connect-ready event');
    assert.ok(text.includes('resolveBackend'), 'site-nav.js should use resolveBackend');
  });

  for (const p of BACKEND_PAGES) {
    test(`${p} has backend meta tags`, async () => {
      const { text } = await fetchText(p);
      assert.ok(text.includes('site-backend-service'), `${p} should have site-backend-service meta`);
      assert.ok(text.includes('site-backend-port'), `${p} should have site-backend-port meta`);
    });
  }

  test('service-config.js has resolveBackend method', async () => {
    const { text } = await fetchText('/lib/ui-kit/v1.1/service-config.js');
    assert.ok(text.includes('resolveBackend'), 'service-config.js should define resolveBackend');
  });
});

// -- Classifier connection gating --

describe('Classifier connection gating', () => {
  test('classifier app.js has checkBackendConnection function', async () => {
    const { text } = await fetchText('/classifiers/static/js/app.js');
    assert.ok(text.includes('checkBackendConnection'), 'app.js should define checkBackendConnection');
  });

  test('classifier app.js tracks _backendConnected state', async () => {
    const { text } = await fetchText('/classifiers/static/js/app.js');
    assert.ok(text.includes('_backendConnected'), 'app.js should track _backendConnected');
  });

  test('classifier app.js gates training behind connection', async () => {
    const { text } = await fetchText('/classifiers/static/js/app.js');
    assert.ok(text.includes('if (!_backendConnected)'), 'train handler should check _backendConnected');
  });

  test('classifier app.js gates prediction behind connection', async () => {
    const { text } = await fetchText('/classifiers/static/js/app.js');
    assert.ok(text.includes('!_backendConnected || Object.keys(state.models)'),
      'runPredict should check _backendConnected');
  });

  test('classifier app.js listens for navbar:connect-ready', async () => {
    const { text } = await fetchText('/classifiers/static/js/app.js');
    assert.ok(text.includes('navbar:connect-ready'), 'app.js should listen for navbar:connect-ready');
  });

  test('classifier app.js disables train button when disconnected', async () => {
    const { text } = await fetchText('/classifiers/static/js/app.js');
    assert.ok(text.includes('setTrainEnabled'), 'app.js should define setTrainEnabled');
  });
});

// -- Nonogram frontend structure --

describe('Nonogram frontend structure', () => {
  test('nonogram/index.html loads all required JS modules in order', async () => {
    const { text } = await fetchText('/nonogram/');
    const scripts = [...text.matchAll(/src="([^"]+\.js[^"]*)"/g)].map(m => m[1]);
    // Core modules must appear in dependency order
    const coreModules = ['state.js', 'grid.js', 'solver.js', 'ui.js', 'app.js'];
    const corePositions = coreModules.map(m => scripts.findIndex(s => s.includes(m)));
    for (let i = 1; i < corePositions.length; i++) {
      assert.ok(corePositions[i] > corePositions[i - 1],
        `${coreModules[i]} should load after ${coreModules[i - 1]}`);
    }
  });

  test('nonogram loads socket.io client', async () => {
    const { text } = await fetchText('/nonogram/');
    assert.ok(text.includes('socket.io'), 'nonogram should load socket.io');
  });

  test('nonogram defines MAX_CLUES and MAX_GRID', async () => {
    const { text } = await fetchText('/nonogram/');
    assert.ok(text.includes('MAX_CLUES'), 'should define MAX_CLUES');
    assert.ok(text.includes('MAX_GRID'), 'should define MAX_GRID');
  });

  test('nonogram has site-backend-service=nonogram meta', async () => {
    const { text } = await fetchText('/nonogram/');
    assert.ok(text.includes('content="nonogram"'), 'should have service=nonogram');
    assert.ok(text.includes('content="5055"'), 'should have port=5055');
  });

  test('all nonogram static JS files load', async () => {
    for (const file of ['state.js', 'grid.js', 'solver.js', 'ui.js', 'app.js']) {
      const { status } = await fetchText(`/nonogram/static/${file}`);
      assert.equal(status, 200, `${file} should load`);
    }
  });

  test('nonogram CSS loads', async () => {
    const { status } = await fetchText('/nonogram/static/style.css');
    assert.equal(status, 200);
  });
});

describe('Nonogram app.js Socket.IO integration', () => {
  test('app.js listens for navbar:connect-ready', async () => {
    const { text } = await fetchText('/nonogram/static/app.js');
    assert.ok(text.includes('navbar:connect-ready'),
      'app.js should listen for navbar:connect-ready');
  });

  test('app.js binds Socket.IO lifecycle events', async () => {
    const { text } = await fetchText('/nonogram/static/app.js');
    assert.ok(text.includes('socket.on("connect"') || text.includes("s.on(\"connect\""),
      'app.js should handle socket connect events');
    assert.ok(text.includes('"disconnect"'), 'app.js should handle disconnect');
    assert.ok(text.includes('"connect_error"'), 'app.js should handle connect_error');
  });

  test('app.js handles all solver events', async () => {
    const { text } = await fetchText('/nonogram/static/app.js');
    for (const event of ['status', 'busy', 'cl_done', 'qu_done', 'bench_done', 'solver_error', 'hw_status']) {
      assert.ok(text.includes(`"${event}"`), `app.js should handle "${event}" event`);
    }
  });
});

describe('Nonogram grid.js logic', () => {
  test('grid.js exports required functions', async () => {
    const { text } = await fetchText('/nonogram/static/grid.js');
    for (const fn of ['initGrid', 'recomputeClues', 'buildGrid', 'getCurrentPuzzle', 'getBestSolSize']) {
      assert.ok(text.includes(fn), `grid.js should export ${fn}`);
    }
  });

  test('grid.js has rle implementation', async () => {
    const { text } = await fetchText('/nonogram/static/grid.js');
    assert.ok(text.includes('function rle'), 'grid.js should have rle function');
  });
});

describe('Nonogram solver.js logic', () => {
  test('solver.js exports required functions', async () => {
    const { text } = await fetchText('/nonogram/static/solver.js');
    for (const fn of ['renderClassical', 'renderQuantum', 'renderBenchmark', 'clearSolverResults']) {
      assert.ok(text.includes(fn), `solver.js should export ${fn}`);
    }
  });

  test('solver.js has computeThreshold', async () => {
    const { text } = await fetchText('/nonogram/static/solver.js');
    assert.ok(text.includes('computeThreshold'), 'solver.js should compute threshold');
  });
});

