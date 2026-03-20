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
  { path: '/dashboard/', title: 'Dashboard', id: 'connect-log' },
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

const BACKEND_PAGES = ['/nonogram/', '/classifiers/', '/cv/', '/dashboard/', '/qvc/client/'];

describe('ServiceConfig integration', () => {
  for (const p of BACKEND_PAGES) {
    test(`${p} references service-config.js`, async () => {
      const { text } = await fetchText(p);
      assert.ok(text.includes('service-config.js'), `${p} should load service-config.js`);
    });
  }

  for (const p of ['/nonogram/', '/classifiers/', '/cv/', '/dashboard/']) {
    test(`${p} defines API_BASE`, async () => {
      const { text } = await fetchText(p);
      assert.ok(text.includes('API_BASE'), `${p} should define API_BASE`);
    });
  }

  for (const p of ['/nonogram/', '/classifiers/', '/cv/', '/dashboard/']) {
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
  test('dashboard app.js loads', async () => {
    const { status } = await fetchText('/dashboard/static/js/app.js');
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
    for (const href of ['nonogram/', 'classifiers/', 'qvc/client/', 'cv/', 'tech-tree/', 'dashboard/', 'ui-kit/']) {
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
      '/dashboard/': { service: 'dashboard', defaultPort: 5050 },
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
