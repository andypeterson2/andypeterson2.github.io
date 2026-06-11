/**
 * Integration tests for public/js/contract-client.js (window.SiteContract).
 *
 * The client is a browser IIFE that attaches to `window`; here we shim `window`
 * to globalThis, eval the file, then exercise it against a real local HTTP stub
 * that speaks the backend API contract (health / discovery / error envelope).
 * This mirrors the live-HTTP contract tests each backend runs in its own repo.
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

// ── Load the browser client into this (node) context ──────────────────────────
(globalThis as { window?: unknown }).window = globalThis;
const clientCode = readFileSync(
  resolve(import.meta.dirname!, '../public/js/contract-client.js'),
  'utf-8',
);
// Indirect eval runs in global scope, where fetch/AbortController exist (Node ≥18).
(0, eval)(clientCode);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SiteContract = (globalThis as any).SiteContract;

// ── A stub backend implementing the contract ──────────────────────────────────
let server: http.Server;
let base: string;

function send(res: http.ServerResponse, status: number, body: unknown) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(text);
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    switch (req.url) {
      case '/health':
        return send(res, 200, { status: 'ok', service: 'nonogram', version: '1.2.3', uptime_s: 5 });
      case '/api':
        return send(res, 200, {
          service: 'nonogram',
          version: '1.2.3',
          endpoints: [
            { method: 'POST', path: '/api/solve/classical/sync', summary: 'Solve synchronously.' },
            { method: 'GET', path: '/api/config', summary: 'Solver config.' },
          ],
          streaming: [{ protocol: 'socket.io', event: 'cl_done', description: 'Classical result.' }],
        });
      // cv-style: /health is absent (404), /api/health is the alias.
      case '/cv/health':
        return send(res, 404, { error: { code: 'not_found', message: 'use /api/health' } });
      case '/cv/api/health':
        return send(res, 200, { status: 'ok', service: 'cv', version: '2.0.0', uptime_s: 9 });
      case '/boom':
        return send(res, 400, {
          error: { code: 'invalid_clues', message: 'rows must be 1..30', details: { rows: 99 } },
        });
      case '/degraded':
        return send(res, 200, { status: 'degraded', service: 'qvc', version: '1.0.0', uptime_s: 1 });
      case '/plain500':
        return send(res, 500, 'internal boom'); // non-JSON, no envelope
      default:
        return send(res, 404, { error: { code: 'not_found', message: 'nope' } });
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  base = `http://127.0.0.1:${port}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe('SiteContract.request', () => {
  test('200 JSON → ok with parsed data', async () => {
    const r = await SiteContract.request(`${base}/health`);
    expect(r.ok).toBe(true);
    expect(r.status).toBe(200);
    expect(r.data.service).toBe('nonogram');
    expect(r.error).toBeNull();
  });

  test('4xx with envelope → ok:false, surfaces error.code/message/details', async () => {
    const r = await SiteContract.request(`${base}/boom`);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
    expect(r.error.code).toBe('invalid_clues');
    expect(r.error.message).toMatch(/rows/);
    expect(r.error.details).toEqual({ rows: 99 });
  });

  test('error without envelope → synthesised code http_<status>', async () => {
    const r = await SiteContract.request(`${base}/plain500`);
    expect(r.ok).toBe(false);
    expect(r.error.code).toBe('http_500');
  });

  test('network failure → network_error, never throws', async () => {
    const r = await SiteContract.request('http://127.0.0.1:1/nope', { timeoutMs: 500 });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(0);
    expect(['network_error', 'timeout']).toContain(r.error.code);
  });
});

describe('SiteContract.health', () => {
  test('normalises a healthy /health response', async () => {
    const h = await SiteContract.health(base);
    expect(h.reachable).toBe(true);
    expect(h.status).toBe('ok');
    expect(h.service).toBe('nonogram');
    expect(h.version).toBe('1.2.3');
    expect(h.uptime_s).toBe(5);
  });

  test('falls back to /api/health on 404 (cv compatibility)', async () => {
    const h = await SiteContract.health(`${base}/cv`);
    expect(h.reachable).toBe(true);
    expect(h.service).toBe('cv');
  });

  test('unreachable backend → reachable:false', async () => {
    const h = await SiteContract.health('http://127.0.0.1:1', { timeoutMs: 500 });
    expect(h.reachable).toBe(false);
  });
});

describe('SiteContract.dotStatus', () => {
  test('maps health/status to dot states', () => {
    expect(SiteContract.dotStatus({ reachable: true, status: 'ok' })).toBe('connected');
    expect(SiteContract.dotStatus({ reachable: true, status: 'degraded' })).toBe('degraded');
    expect(SiteContract.dotStatus({ reachable: true, status: 'error' })).toBe('error');
    expect(SiteContract.dotStatus({ reachable: false })).toBe('error');
    expect(SiteContract.dotStatus(null)).toBe('error');
  });
});

describe('SiteContract.discover + hasSyncEndpoint', () => {
  test('returns the discovery manifest', async () => {
    const m = await SiteContract.discover(base);
    expect(m.service).toBe('nonogram');
    expect(Array.isArray(m.endpoints)).toBe(true);
  });

  test('detects an advertised /sync route', async () => {
    const m = await SiteContract.discover(base);
    expect(SiteContract.hasSyncEndpoint(m)).toBe(true);
    expect(SiteContract.hasSyncEndpoint(m, '/api/solve/classical/sync')).toBe(true);
    expect(SiteContract.hasSyncEndpoint(m, '/does/not/exist')).toBe(false);
    expect(SiteContract.hasSyncEndpoint(null)).toBe(false);
  });
});
