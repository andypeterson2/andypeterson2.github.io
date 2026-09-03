/**
 * Tests for src/apps/shared/service-config.ts (ServiceConfig) — focused on the
 * URL-param origin allowlist (the security property): a crafted ?backend=/?service=
 * link must not be able to repoint a frontend at an attacker origin.
 *
 * ServiceConfig initialises its state (URL params + stored map) lazily on first
 * use, so each scenario swaps the window/localStorage shims and calls
 * `_resetForTests()` to make the next call re-read them.
 */
import { describe, test, expect, vi } from 'vitest';

const PROD = { origin: 'https://andypeterson.dev', hostname: 'andypeterson.dev' };
const DEV = { origin: 'http://localhost:4321', hostname: 'localhost' };

// The module publishes window.ServiceConfig at import — shim window first.
(globalThis as { window?: unknown }).window = {
  location: { search: '', origin: PROD.origin, hostname: PROD.hostname },
};
const { ServiceConfig } = await import('../src/apps/shared/service-config');

/** Point ServiceConfig at a fresh page origin + query string + empty storage. */
function load(search: string, page: { origin: string; hostname: string } = PROD) {
  const store: Record<string, string> = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- test shim
      delete store[k];
    },
  };
  (globalThis as { window?: unknown }).window = {
    location: { search, origin: page.origin, hostname: page.hostname },
  };
  ServiceConfig._resetForTests();
  return ServiceConfig;
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
