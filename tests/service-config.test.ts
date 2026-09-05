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
  test('rejects a crafted ?backend= attacker origin (prod) → falls through to an ALLOWED default', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sc = load('?backend=evil.example.com', PROD);
    const url = sc.resolveBackend('nonogram', 'https://api.andypeterson.dev');
    expect(url).not.toContain('evil.example.com');
    expect(url).toBe('https://api.andypeterson.dev'); // the deploy-based default
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test('rejects a crafted per-service ?nonogram= attacker origin (prod)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sc = load('?nonogram=https://evil.example.com', PROD);
    expect(sc.resolveBackend('nonogram', 'https://api.andypeterson.dev')).toBe(
      'https://api.andypeterson.dev',
    );
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
    // dev page → localhost backend allowed (param AND default)
    const dev = load('?backend=http://localhost:9999', DEV);
    expect(dev.resolveBackend('nonogram', 'http://localhost:5055')).toBe('http://localhost:9999');
    // prod page → localhost param rejected, and a localhost DEFAULT is inert too:
    // no local backend option can survive on the deployed site.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const prod = load('?backend=http://localhost:9999', PROD);
    expect(prod.resolveBackend('nonogram', 'http://localhost:5055')).toBe('');
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

  test('defaults and stored URLs are allowlist-gated too — deploy-based everywhere', () => {
    // A localhost default on a prod page resolves to NOTHING, not a dead local URL.
    const sc = load('', PROD);
    expect(sc.resolveBackend('nonogram', 'http://localhost:5055')).toBe('');
    // A gateway default resolves normally.
    expect(sc.resolveBackend('nonogram', 'https://api.andypeterson.dev')).toBe(
      'https://api.andypeterson.dev',
    );
    // A stale STORED localhost URL (manual-connect era) is ignored on prod…
    const sc2 = load('', PROD);
    sc2.set('nonogram', 'http://localhost:5055');
    expect(sc2.resolveBackend('nonogram', 'https://api.andypeterson.dev')).toBe(
      'https://api.andypeterson.dev',
    );
    // …but an allowed stored URL still wins over the default.
    const sc3 = load('', PROD);
    sc3.set('nonogram', 'https://api.andypeterson.dev');
    expect(sc3.resolveBackend('nonogram', '')).toBe('https://api.andypeterson.dev');
  });
});
