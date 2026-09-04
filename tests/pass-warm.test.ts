/**
 * Health-gated pass activation — warmUntilHealthy retries a sleeping backend
 * and stops immediately on an auth verdict (waking can't fix a bad pass).
 */
// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

async function loadWarm() {
  // pass.ts runs side effects at import (URL scrub, fetch wrap, activation
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
    expect(await resultP).toBe(true);
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
    expect(await resultP).toBe(true);
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.andypeterson.dev/nonogram/health');
  });

  test('gives up at the deadline when the backend never answers', async () => {
    const warm = await loadWarm();
    vi.spyOn(window, 'fetch').mockRejectedValue(new TypeError('down'));
    const resultP = warm('nonogram', 8_000);
    await vi.runAllTimersAsync();
    expect(await resultP).toBe(false);
  });

  test('stops immediately on an auth verdict — waking cannot fix a bad pass', async () => {
    const warm = await loadWarm();
    const fetchMock = vi
      .spyOn(window, 'fetch')
      .mockResolvedValue(new Response('', { status: 402 }));
    const resultP = warm('classifiers', 30_000);
    await vi.runAllTimersAsync();
    expect(await resultP).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
