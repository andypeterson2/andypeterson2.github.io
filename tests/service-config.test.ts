/**
 * Tests for ServiceConfig, focused on the
 * URL-param origin allowlist (the security property): a crafted ?backend=/?service=
 * link must not be able to repoint a frontend at an attacker origin.
 *
 * ServiceConfig reads the URL parameters lazily on first use, so each scenario
 * swaps the window shim and calls `_resetForTests()` to make the next call re-read
 * them.
 */
import { describe, test, expect, vi } from 'vitest';
import { ServiceConfig } from '../src/apps/shared/service-config';

const PROD = { origin: 'https://andypeterson.dev', hostname: 'andypeterson.dev' };
const DEV = { origin: 'http://localhost:4321', hostname: 'localhost' };

/** Point ServiceConfig at a fresh page origin + query string. */
function load(search: string, page: { origin: string; hostname: string } = PROD) {
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

  test('a default is allowlist-gated too — deploy-based everywhere', () => {
    // A localhost default on a prod page resolves to nothing at all.
    const sc = load('', PROD);
    expect(sc.resolveBackend('nonogram', 'http://localhost:5055')).toBe('');
    // A gateway default resolves normally.
    expect(sc.resolveBackend('nonogram', 'https://api.andypeterson.dev')).toBe(
      'https://api.andypeterson.dev',
    );
  });

  test('a per-service param outranks the unified one', () => {
    const sc = load('?backend=https://andypeterson.dev/unified&cv=https://api.andypeterson.dev');
    expect(sc.resolveBackend('cv', '')).toBe('https://api.andypeterson.dev');
    expect(sc.resolveBackend('nonogram', '')).toBe('https://andypeterson.dev/unified');
  });
});
