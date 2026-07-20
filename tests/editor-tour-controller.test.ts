import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';

// tour.svelte.ts imports the editor singleton (for its exported `tour` instance);
// stub it so importing the module doesn't drag in the whole store. We test the
// TourController class directly with a mock host, never the singleton.
vi.mock('../src/editor/lib/store.svelte', () => ({ editor: {} }));

import { TourController, type TourHost } from '../src/editor/lib/tour.svelte';
import { DWELL_MS, type TourStep } from '../src/editor/lib/tour';

const steps = (): TourStep[] => [
  { id: 'a', caption: 'First', spot: '.a', enter: () => {} },
  { id: 'b', caption: 'Second', spot: '.b', enter: () => {} },
];

function makeHost(over: Partial<TourHost> = {}) {
  const calls = { stage: 0, restore: 0, closeChrome: 0, announce: [] as string[] };
  const host: TourHost = {
    canRun: () => true,
    isLive: () => false,
    stage: () => {
      calls.stage++;
    },
    restore: () => {
      calls.restore++;
    },
    announce: (m) => calls.announce.push(m),
    closeChrome: () => {
      calls.closeChrome++;
    },
    steps: () => steps(),
    ...over,
  };
  return { host, calls };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('TourController — start / gating', () => {
  test('does nothing when it cannot run', () => {
    const { host, calls } = makeHost({ canRun: () => false });
    const c = new TourController(host);
    c.start();
    expect(c.state).toBe('idle');
    expect(calls.stage).toBe(0);
  });

  test('start stages the doc and plays from step 0, announcing the first caption', () => {
    const { host, calls } = makeHost();
    const c = new TourController(host);
    c.start();
    expect(c.state).toBe('playing');
    expect(c.active).toBe(true);
    expect(c.index).toBe(0);
    expect(c.total).toBe(2);
    expect(c.caption).toBe('First');
    expect(c.spot).toBe('.a');
    expect(calls.stage).toBe(1);
    expect(calls.announce).toContain('First');
  });
});

describe('TourController — advancing', () => {
  test('auto-advances to the next step after the dwell', async () => {
    const { host } = makeHost();
    const c = new TourController(host);
    c.start();
    await vi.advanceTimersByTimeAsync(DWELL_MS); // flush #enter, then fire the dwell
    expect(c.index).toBe(1);
    expect(c.caption).toBe('Second');
  });

  test('advancing past the last step finishes: done + restore + closeChrome', () => {
    const { host, calls } = makeHost();
    const c = new TourController(host);
    c.start();
    c.next(); // → step 1
    c.next(); // → past the end → finish
    expect(c.state).toBe('done');
    expect(calls.restore).toBe(1);
    expect(calls.closeChrome).toBe(1);
    expect(calls.announce.at(-1)).toContain('complete');
  });
});

describe('TourController — the interrupt', () => {
  test('a demo visitor taking the wheel pauses (and can resume)', () => {
    const { host, calls } = makeHost();
    const c = new TourController(host);
    c.start();
    c.takeover();
    expect(c.state).toBe('paused');
    expect(calls.announce.at(-1)).toContain('wheel');
    c.resume();
    expect(c.state).toBe('playing');
  });

  test('a signed-in owner taking the wheel ends the tour and restores their CV', () => {
    const { host, calls } = makeHost({ isLive: () => true });
    const c = new TourController(host);
    c.start();
    expect(c.liveAtStart).toBe(true);
    c.takeover();
    expect(c.state).toBe('idle');
    expect(calls.restore).toBe(1);
  });

  test('toggle flips paused ↔ playing', () => {
    const c = new TourController(makeHost().host);
    c.start();
    c.toggle();
    expect(c.state).toBe('paused');
    c.toggle();
    expect(c.state).toBe('playing');
  });

  test('end dismisses to idle, restoring and closing chrome', () => {
    const { host, calls } = makeHost();
    const c = new TourController(host);
    c.start();
    c.end();
    expect(c.state).toBe('idle');
    expect(c.index).toBe(0);
    expect(calls.restore).toBe(1);
    expect(calls.closeChrome).toBe(1);
  });
});
