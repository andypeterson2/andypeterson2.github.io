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
  /**
   * Drive the module's load-time activation. `session` is what the menu bar's
   * `GET /auth/me` answered, or undefined when it never answered at all.
   */
  async function activate(status: number, session?: boolean) {
    vi.resetModules();
    sessionStorage.clear();
    delete window.SITE_SESSION;
    if (session !== undefined) window.SITE_SESSION = { authenticated: session };
    document.head.innerHTML = '<meta name="site-backend" content="classifiers" />';
    const seen: string[] = [];
    for (const n of ['navbar:connect', 'navbar:connect-pending', 'navbar:connect-failed']) {
      document.addEventListener(n, () => seen.push(n));
    }
    const urls: string[] = [];
    window.fetch = vi.fn(async (input: RequestInfo | URL) => {
      urls.push(String(input instanceof Request ? input.url : input));
      return new Response('{}', { status });
    }) as typeof window.fetch;
    await import('../src/apps/shared/pass');
    await vi.runAllTimersAsync();
    return { seen, probes: urls.filter((u) => u.includes('/health')).length };
  }

  // The owner's credential is a cookie the page cannot read, so the menu bar's
  // answer is what identifies them: a 200 means the gateway let this caller through.
  test('a signed-in visitor connects even though no pass is held', async () => {
    const { seen, probes } = await activate(200, true);
    expect(probes).toBe(1);
    expect(seen).toContain('navbar:connect');
  });

  test('a refused probe stays quiet rather than reporting a failure', async () => {
    const { seen } = await activate(402, true);
    expect(seen).not.toContain('navbar:connect');
    // Nothing was claimed, so there is no failure to show — the client-side
    // tier is simply what this visitor gets.
    expect(seen).not.toContain('navbar:connect-failed');
    expect(seen).not.toContain('navbar:connect-pending');
  });

  // The gate answers an unauthorized probe with 402, which the browser logs as a
  // failed request. A stranger has nothing to gain from asking, so it never asks.
  test('a signed-out visitor never probes the gated backend', async () => {
    const { seen, probes } = await activate(200, false);
    expect(probes).toBe(0);
    expect(seen).toEqual([]);
  });

  test('no answer from the menu bar reads as signed out', async () => {
    const { probes } = await activate(200, undefined);
    expect(probes).toBe(0);
  });
});
