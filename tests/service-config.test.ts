/**
 * Tests for public/js/service-config.js (window.ServiceConfig) — focused on the
 * URL-param origin allowlist (the security property): a crafted ?backend=/?service=
 * link must not be able to repoint a frontend at an attacker origin.
 *
 * ServiceConfig is a browser IIFE that reads window.location + localStorage at load
 * time (`_params` is computed once). So each scenario re-evals the file against a
 * fresh window shim with a given page origin + query string — mirroring the
 * window-shim + eval pattern in tests/contract-client.test.ts.
 */
import { describe, test, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const code = readFileSync(resolve(import.meta.dirname!, '../public/js/service-config.js'), 'utf-8');

const PROD = { origin: 'https://andypeterson.dev', hostname: 'andypeterson.dev' };
const DEV = { origin: 'http://localhost:4321', hostname: 'localhost' };

/** Load a fresh ServiceConfig with a given query string + page origin. */
function load(search: string, page: { origin: string; hostname: string } = PROD) {
  const store: Record<string, string> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).window = {
    location: { search, origin: page.origin, hostname: page.hostname },
  };
  (0, eval)(code); // sets window.ServiceConfig; URL/URLSearchParams/console are Node globals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).window.ServiceConfig;
}

describe('ServiceConfig backend-origin allowlist', () => {
  test('rejects a crafted ?backend= attacker origin (prod) → falls through to default', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sc = load('?backend=evil.example.com', PROD);
    const url = sc.resolveBackend('nonogram', 'http://localhost:5055');
    expect(url).not.toContain('evil.example.com');
    expect(url).toBe('http://localhost:5055'); // the trusted default, not the attacker URL
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test('rejects a crafted per-service ?nonogram= attacker origin (prod)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sc = load('?nonogram=https://evil.example.com', PROD);
    expect(sc.resolveBackend('nonogram', 'http://localhost:5055')).toBe('http://localhost:5055');
    vi.restoreAllMocks();
  });

  test('allows the production gateway origin', () => {
    const sc = load('?backend=api.andypeterson.dev', PROD);
    expect(sc.resolveBackend('cv', 'http://localhost:5001')).toBe('https://api.andypeterson.dev');
  });

  test('allows a same-origin backend URL', () => {
    const sc = load('?backend=https://andypeterson.dev/proxy', PROD);
    expect(sc.resolveBackend('nonogram', 'x')).toBe('https://andypeterson.dev/proxy');
  });

  test('allows localhost/LAN only when the page itself is dev', () => {
    // dev page → localhost backend allowed
    const dev = load('?backend=http://localhost:9999', DEV);
    expect(dev.resolveBackend('nonogram', 'http://localhost:5055')).toBe('http://localhost:9999');
    // prod page → localhost backend rejected (falls through to default)
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const prod = load('?backend=http://localhost:9999', PROD);
    expect(prod.resolveBackend('nonogram', 'http://localhost:5055')).toBe('http://localhost:5055');
    vi.restoreAllMocks();
  });

  test('get() applies the same allowlist to a per-service param', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sc = load('?classifiers=evil.example.com', PROD);
    expect(sc.get('classifiers', 'http://localhost:5001')).toBe('http://localhost:5001');
    vi.restoreAllMocks();
  });

  test('getAll() drops disallowed param origins', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sc = load('?backend=evil.example.com&nonogram=api.andypeterson.dev', PROD);
    const all = sc.getAll();
    expect(all.backend).toBeUndefined(); // attacker origin dropped
    expect(all.nonogram).toBe('https://api.andypeterson.dev'); // allowed one kept
    vi.restoreAllMocks();
  });

  test('the default and stored URLs are trusted (not gated by the allowlist)', () => {
    const sc = load('', PROD);
    // default passes through untouched even though it is a localhost origin in prod
    expect(sc.resolveBackend('nonogram', 'http://localhost:5055')).toBe('http://localhost:5055');
  });
});
