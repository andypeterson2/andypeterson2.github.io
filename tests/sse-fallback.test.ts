/**
 * Tests for src/apps/classifiers/sse.ts — the consumeSSE() streaming consumer
 * and its synchronous-REST fallback, driven against a local HTTP stub that can
 * stream SSE, return a contract error envelope, or serve a /...sync route.
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

// The sse module imports contract-client, which publishes window.SiteContract
// at import — shim window first, so the import is dynamic.
(globalThis as { window?: unknown }).window = globalThis;
const { consumeSSE } = await import('../src/apps/classifiers/sse');

// ── Stub backend ──────────────────────────────────────────────────────────────
let server: http.Server;
let base: string;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/stream-ok' && req.method === 'POST') {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write('data: {"type":"status","msg":"working"}\n\n');
      res.write('data: {"type":"done","name":"streamed","epochs":5}\n\n');
      res.end();
      return;
    }
    if (req.url === '/train' && req.method === 'POST') {
      // streaming route is down → triggers the sync fallback
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { code: 'unavailable', message: 'streaming down' } }));
      return;
    }
    if (req.url === '/train/sync' && req.method === 'POST') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ name: 'sync-model', model_type: 'Linear', epochs: 3 }));
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 'not_found', message: 'nope' } }));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

function collector() {
  const r = { status: [] as unknown[], done: null as unknown, error: null as unknown };
  return {
    r,
    onStatus: (m: unknown) => r.status.push(m),
    onDone: (e: unknown) => (r.done = e),
    onError: (e: unknown) => (r.error = e),
  };
}

describe('consumeSSE streaming', () => {
  test('parses an SSE stream and delivers the done event', async () => {
    const c = collector();
    await consumeSSE(`${base}/stream-ok`, {}, c);
    expect(c.r.done).toMatchObject({ name: 'streamed', epochs: 5 });
    expect(c.r.status).toContain('working');
    expect(c.r.error).toBeNull();
  });
});

describe('consumeSSE sync fallback', () => {
  test('falls back to the /...sync route when the stream response is not ok', async () => {
    const c = collector();
    await consumeSSE(
      `${base}/train`,
      { model_type: 'Linear' },
      { ...c, syncUrl: `${base}/train/sync` },
    );
    // The done payload came from /train/sync, delivered to onDone unchanged.
    expect(c.r.done).toMatchObject({ name: 'sync-model', model_type: 'Linear' });
    expect(c.r.error).toBeNull();
  });

  test('surfaces the envelope error when no sync route is provided', async () => {
    const c = collector();
    await consumeSSE(`${base}/train`, {}, c);
    expect(c.r.done).toBeNull();
    expect(String(c.r.error)).toMatch(/unavailable/);
  });
});
