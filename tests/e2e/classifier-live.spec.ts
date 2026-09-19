import { test, expect, type Page } from '@playwright/test';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

// The live tier against a stub classifier backend on localhost (the dev CSP and the
// URL allowlist admit localhost only when the page is served from localhost). A real
// server rather than page.route, because /connect is an SSE stream that must stay open.

interface Stub {
  url: string;
  predictBodies: { image?: string }[];
  close(): Promise<void>;
}

interface StubOpts {
  /** The /d/mnist/models response: status and body. */
  models?: { status: number; body: unknown };
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'Content-Type, Authorization',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
};

async function startStub(opts: StubOpts = {}): Promise<Stub> {
  const predictBodies: { image?: string }[] = [];
  const open = new Set<http.ServerResponse>();
  const json = (res: http.ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { ...CORS, 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const server = http.createServer((req, res) => {
    const path = (req.url ?? '').split('?')[0];
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS);
      res.end();
      return;
    }
    if (path === '/health') return json(res, 200, { status: 'ok', service: 'classifiers' });
    if (path === '/connect') {
      res.writeHead(200, { ...CORS, 'content-type': 'text/event-stream' });
      res.write('data: {"type":"welcome","client_id":"c1","heartbeat_interval":25}\n\n');
      open.add(res);
      return;
    }
    if (path === '/pong' || path === '/disconnect') {
      res.writeHead(204, CORS);
      res.end();
      return;
    }
    if (path === '/api/datasets/mnist/config')
      return json(res, 200, { ui_config: { name: 'mnist' }, model_types: ['CNN', 'Linear'] });
    if (path === '/d/mnist/models') {
      const m = opts.models ?? {
        status: 200,
        body: { 'CNN 1': { model_type: 'CNN', epochs: 3, batch_size: 64, lr: 0.001 } },
      };
      return json(res, m.status, m.body);
    }
    if (path === '/d/mnist/models/disk') return json(res, 200, []);
    if (path.startsWith('/d/mnist/model-info/')) return json(res, 404, {});
    if (path === '/d/mnist/predict') {
      let raw = '';
      req.on('data', (c: Buffer) => (raw += c.toString()));
      req.on('end', () => {
        predictBodies.push(JSON.parse(raw) as { image?: string });
        json(res, 200, { results: { 'CNN 1': { prediction: '7', confidence: 0.9, probs: [] } } });
      });
      return;
    }
    json(res, 404, { error: { code: 'not_found', message: path } });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://localhost:${String(port)}`,
    predictBodies,
    close: () =>
      new Promise<void>((r) => {
        for (const res of open) res.destroy();
        server.close(() => r());
        // The page reconnects when its stream drops; don't wait on those sockets.
        server.closeAllConnections();
      }),
  };
}

/** Load the app on its in-browser models, then bring the live tier up against the stub. */
async function connect(page: Page, stub: Stub): Promise<void> {
  await page.goto('/projects/ai-ml/app/');
  await expect(page.locator('.pred-model-name').filter({ hasText: 'QSVM' })).toBeVisible();
  await page.evaluate((url) => {
    document.dispatchEvent(
      new CustomEvent('navbar:connect', { detail: { service: 'classifiers', url } }),
    );
  }, stub.url);
}

async function drawSeven(page: Page): Promise<void> {
  const b = (await page.locator('#draw-canvas').boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.22);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.7, b.y + b.height * 0.22, { steps: 20 });
  await page.mouse.move(b.x + b.width * 0.45, b.y + b.height * 0.8, { steps: 20 });
  await page.mouse.up();
}

test.describe('Classifier live tier', () => {
  test('connecting fills the model types and lists the server models', async ({ page }) => {
    const stub = await startStub();
    try {
      await connect(page, stub);
      await expect(page.locator('#model-type option')).toHaveText(['CNN', 'Linear']);
      await expect(page.locator('#model-type-row')).toBeVisible();
      await expect(page.locator('#train-btn')).toBeEnabled();
      await expect(page.locator('#model-name')).toHaveValue('CNN');
      await expect(page.locator('#session-models')).toContainText('CNN 1');
      const log = page.locator('#log-terminal');
      await expect(log).toContainText('Connected to the live backend');
      await expect(log).toContainText('Connecting to the live backend');
      await expect(log).not.toContainText('Reconnecting');
    } finally {
      await stub.close();
    }
  });

  test('in-browser models are not offered as server models', async ({ page }) => {
    const stub = await startStub();
    try {
      await connect(page, stub);
      await expect(page.locator('#session-models')).toContainText('CNN 1');
      // Only one server model: no ensemble, and only it can be a distillation teacher.
      await expect(page.locator('#ensemble-btn')).toBeHidden();
      await expect(page.locator('#teacher-select option')).toHaveText(['— none —', 'CNN 1']);
    } finally {
      await stub.close();
    }
  });

  test('a drawing is sent as the 28×28 digit, and every model answers', async ({ page }) => {
    const stub = await startStub();
    try {
      await connect(page, stub);
      await expect(page.locator('#session-models')).toContainText('CNN 1');
      await drawSeven(page);
      await expect.poll(() => stub.predictBodies.length).toBeGreaterThan(0);
      const png = Buffer.from(stub.predictBodies[0]?.image ?? '', 'base64');
      // PNG IHDR: width and height as big-endian ints at bytes 16 and 20.
      expect(png.readUInt32BE(16)).toBe(28);
      expect(png.readUInt32BE(20)).toBe(28);
      const rows = page.locator('#pred-body tr');
      await expect(rows.filter({ hasText: 'CNN 1' })).toContainText('7');
      await expect(rows.filter({ hasText: 'QSVM' }).locator('.pred-label')).not.toHaveText('');
    } finally {
      await stub.close();
    }
  });

  test('an error envelope is reported, not listed as a model', async ({ page }) => {
    const stub = await startStub({
      models: { status: 500, body: { error: { code: 'internal_error', message: 'boom' } } },
    });
    try {
      await connect(page, stub);
      await expect(page.locator('#log-terminal')).toContainText(
        "Couldn't load the live models — internal_error: boom",
      );
      await expect(page.locator('#session-models')).not.toContainText('error');
    } finally {
      await stub.close();
    }
  });

  test('a refused pass drops the page back to the browser tier', async ({ page }) => {
    const stub = await startStub({
      models: { status: 401, body: { error: { code: 'needs_pass', message: 'expired' } } },
    });
    try {
      await connect(page, stub);
      await expect(page.locator('.site-menubar .sn-state')).toHaveText(
        'pass expired or invalid — in your browser',
      );
      await expect(page.locator('#train-btn')).toBeDisabled();
      await expect(page.locator('#log-terminal')).toContainText('The pass was refused');
    } finally {
      await stub.close();
    }
  });
});
