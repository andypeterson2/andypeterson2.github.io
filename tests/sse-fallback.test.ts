/**
 * Tests for public/classifiers/js/sse.js — the consumeSSE() streaming consumer and its
 * synchronous-REST fallback. Loads the browser scripts into this (node) context with a
 * window shim, then drives them against a local HTTP stub that can stream SSE, return a
 * contract error envelope, or serve a /...sync route.
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

// ── Load contract-client.js (window.SiteContract) then sse.js (consumeSSE) ─────
(globalThis as { window?: unknown }).window = globalThis;
const dir = import.meta.dirname!;
(0, eval)(readFileSync(resolve(dir, '../public/js/contract-client.js'), 'utf-8'));
// sse.js declares functions in strict mode; append an explicit export so eval exposes them.
(0, eval)(
  readFileSync(resolve(dir, '../public/classifiers/js/sse.js'), 'utf-8') +
    '\nglobalThis.__SSE = { consumeSSE };',
);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const consumeSSE = (globalThis as any).__SSE.consumeSSE;

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
    await consumeSSE(`${base}/stream-ok`, {}, c.onStatus, c.onDone, c.onError);
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
      c.onStatus,
      c.onDone,
      c.onError,
      `${base}/train/sync`,
    );
    // The done payload came from /train/sync, delivered to onDone unchanged.
    expect(c.r.done).toMatchObject({ name: 'sync-model', model_type: 'Linear' });
    expect(c.r.error).toBeNull();
  });

  test('surfaces the envelope error when no sync route is provided', async () => {
    const c = collector();
    await consumeSSE(`${base}/train`, {}, c.onStatus, c.onDone, c.onError);
    expect(c.r.done).toBeNull();
    expect(String(c.r.error)).toMatch(/unavailable/);
  });
});
