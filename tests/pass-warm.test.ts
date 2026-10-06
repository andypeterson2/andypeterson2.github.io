/**
 * Health-gated pass activation — warmUntilHealthy retries a sleeping backend
 * and stops immediately on an auth verdict (waking can't fix a bad pass).
 */
// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

async function loadWarm() {
  // The module runs side effects at import (URL scrub, fetch wrap, activation
  // timer); with no ?pass= and no stored token they are all no-ops here.
  const mod = await import('../src/apps/shared/pass');
  return mod.warmUntilHealthy;
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('warmUntilHealthy', () => {
  test('succeeds on the first healthy answer', async () => {
    const warm = await loadWarm();
    vi.spyOn(window, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    const resultP = warm('nonogram', 10_000);
    await vi.runAllTimersAsync();
    expect(await resultP).toBe('ok');
  });

  test('retries through cold-box errors until the backend wakes', async () => {
    const warm = await loadWarm();
    const fetchMock = vi
      .spyOn(window, 'fetch')
      .mockRejectedValueOnce(new TypeError('cold'))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValue(new Response('{}', { status: 200 }));
    const resultP = warm('nonogram', 20_000);
    await vi.runAllTimersAsync();
    expect(await resultP).toBe('ok');
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.andypeterson.dev/nonogram/health');
  });

  test('gives up at the deadline when the backend never answers', async () => {
    const warm = await loadWarm();
    vi.spyOn(window, 'fetch').mockRejectedValue(new TypeError('down'));
    const resultP = warm('nonogram', 8_000);
    await vi.runAllTimersAsync();
    expect(await resultP).toBe('unreachable');
  });

  // The caller says "pass expired or invalid" and forgets the pass, instead of the
  // "didn't wake" + Retry a sleeping backend gets.
  test('stops immediately on an auth verdict — waking cannot fix a bad pass', async () => {
    const warm = await loadWarm();
    const fetchMock = vi
      .spyOn(window, 'fetch')
      .mockResolvedValue(new Response('', { status: 402 }));
    const resultP = warm('classifiers', 30_000);
    await vi.runAllTimersAsync();
    expect(await resultP).toBe('unauthorized');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('gateway requests carry the owner session', () => {
  /** Install the spy first, so the wrapper closes over it as the real fetch. */
  async function wrapWith(spy: ReturnType<typeof vi.fn>) {
    vi.resetModules();
    window.fetch = spy as unknown as typeof window.fetch;
    await import('../src/apps/shared/pass');
  }

  test('a gateway call sends credentials, so an Access cookie reaches the front door', async () => {
    const spy = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{}', { status: 200 }),
    );
    await wrapWith(spy);
    await window.fetch('https://api.andypeterson.dev/classifiers/health');
    const init = spy.mock.calls[0][1] as RequestInit | undefined;
    expect(init?.credentials).toBe('include');
  });

  test('a caller that chose its own credentials keeps them', async () => {
    const spy = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{}', { status: 200 }),
    );
    await wrapWith(spy);
    await window.fetch('https://api.andypeterson.dev/classifiers/health', {
      credentials: 'omit',
    });
    const init = spy.mock.calls[0][1] as RequestInit | undefined;
    expect(init?.credentials).toBe('omit');
  });

  test('a call to another origin is left alone', async () => {
    const spy = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{}', { status: 200 }),
    );
    await wrapWith(spy);
    await window.fetch('https://example.test/thing');
    const init = spy.mock.calls[0][1] as RequestInit | undefined;
    expect(init?.credentials).toBeUndefined();
  });
});

describe('activation without a pass', () => {
  /** The page as a demo page sees it: a backend named, no pass stored. */
  async function activate(status: number) {
    vi.resetModules();
    sessionStorage.clear();
    document.head.innerHTML = '<meta name="site-backend" content="classifiers" />';
    const seen: string[] = [];
    for (const n of ['navbar:connect', 'navbar:connect-pending', 'navbar:connect-failed']) {
      document.addEventListener(n, () => seen.push(n));
    }
    window.fetch = vi.fn(async () => new Response('{}', { status })) as typeof window.fetch;
    await import('../src/apps/shared/pass');
    await vi.runAllTimersAsync();
    return seen;
  }

  // The owner's credential is a cookie the page cannot read, so the only way to
  // know is to ask: a 200 means the gateway let this caller through.
  test('an authorised probe connects even though no pass is held', async () => {
    expect(await activate(200)).toContain('navbar:connect');
  });

  test('a refused probe stays quiet rather than reporting a failure', async () => {
    const seen = await activate(402);
    expect(seen).not.toContain('navbar:connect');
    // Nothing was claimed, so there is no failure to show — the client-side
    // tier is simply what this visitor gets.
    expect(seen).not.toContain('navbar:connect-failed');
    expect(seen).not.toContain('navbar:connect-pending');
  });
});
