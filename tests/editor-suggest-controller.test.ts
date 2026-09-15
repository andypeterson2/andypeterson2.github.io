import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';

// Suggestions and feedback reach the backend only through `api`, so a mocked
// api plus fake timers covers the debounce, filtering, stale responses, and
// every event the controller reports.
vi.mock('../src/editor/lib/api', () => ({
  api: {
    suggestTags: vi.fn(),
    recordTagEvents: vi.fn(async () => ({ ok: true, status: 200 })),
    addEntryTags: vi.fn(async () => ({ ok: true, status: 200 })),
    removeEntryTag: vi.fn(async () => ({ ok: true, status: 200 })),
    addItemTags: vi.fn(async () => ({ ok: true, status: 200 })),
    removeItemTag: vi.fn(async () => ({ ok: true, status: 200 })),
  },
}));

import { api } from '../src/editor/lib/api';
import { SuggestionController, SHOWN, canonicalTag } from '../src/editor/lib/suggest.svelte';
import { TagController, type TagHost } from '../src/editor/lib/tags.svelte';
import type { Item } from '../src/editor/lib/types';

const suggestTags = api.suggestTags as unknown as ReturnType<typeof vi.fn>;
const recordTagEvents = api.recordTagEvents as unknown as ReturnType<typeof vi.fn>;

const results = (...tags: string[]) => ({
  ok: true,
  status: 200,
  data: { query: '', results: tags.map((tag, i) => ({ tag, score: 0.5 - i / 100 })) },
});

function makeController(connected = true) {
  const host: TagHost = {
    connected: () => connected,
    nextId: () => 1,
    markDirty: () => {},
    setSaving: () => {},
    persist: async (op) => op(),
    debounce: (_k, fn) => fn(),
    announce: () => {},
    record: () => {},
    forgetHistory: () => {},
    sections: () => [],
  };
  const tags = new TagController(host);
  const c = new SuggestionController(
    { connected: () => connected, activePersonId: () => 7 },
    tags,
    100,
  );
  return c;
}
const item = (over: Partial<Item> = {}): Item => ({ id: 3, content: '', tags: [], ...over });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('SuggestionController', () => {
  test('waits for a pause, then shows the top suggestions not already applied', async () => {
    suggestTags.mockResolvedValue(results('python', 'Back End', 'postgresql', 'sql', 'flask'));
    const c = makeController();
    const it = item({ tags: ['back-end'] });
    c.request('item', it, 'Built a REST API');
    c.request('item', it, 'Built a REST API in Python');
    expect(suggestTags).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(suggestTags).toHaveBeenCalledTimes(1);
    expect(suggestTags).toHaveBeenCalledWith(7, 'Built a REST API in Python', 8);
    expect(c.for('item', 3).map((s) => s.tag)).toEqual(['python', 'postgresql', 'sql']);
    expect(c.for('item', 3)).toHaveLength(SHOWN);
  });

  test("an older response never overwrites a newer one's suggestions", async () => {
    let resolveOld: (v: unknown) => void = () => {};
    suggestTags
      .mockImplementationOnce(() => new Promise((r) => (resolveOld = r)))
      .mockResolvedValueOnce(results('newer'));
    const c = makeController();
    const it = item();
    c.request('item', it, 'first');
    await vi.advanceTimersByTimeAsync(100);
    c.request('item', it, 'second');
    await vi.advanceTimersByTimeAsync(100);
    resolveOld(results('older'));
    await vi.runAllTimersAsync();
    expect(c.for('item', 3).map((s) => s.tag)).toEqual(['newer']);
  });

  test('accepting adds the tag and reports its rank and score', async () => {
    suggestTags.mockResolvedValue(results('python', 'flask'));
    const c = makeController();
    const it = item();
    c.request('item', it, 'Built it in Flask');
    await vi.runAllTimersAsync();
    await c.accept('item', it, 'flask');
    expect(it.tags).toEqual(['flask']);
    expect(api.addItemTags).toHaveBeenCalledWith(3, ['flask']);
    expect(c.for('item', 3).map((s) => s.tag)).toEqual(['python']);
    expect(recordTagEvents).toHaveBeenCalledWith(7, [
      {
        target: 'item',
        id: 3,
        tag: 'flask',
        action: 'accept',
        rank: 1,
        score: 0.49,
        scorer: 'embedding',
      },
    ]);
  });

  test('a dismissed suggestion is reported and stays hidden on the next fetch', async () => {
    suggestTags.mockResolvedValue(results('sales', 'python'));
    const c = makeController();
    const it = item();
    c.request('item', it, 'text');
    await vi.runAllTimersAsync();
    c.dismiss('item', it, 'sales');
    expect(recordTagEvents).toHaveBeenLastCalledWith(7, [
      expect.objectContaining({ tag: 'sales', action: 'dismiss', rank: 0 }),
    ]);
    c.request('item', it, 'text again');
    await vi.runAllTimersAsync();
    expect(c.for('item', 3).map((s) => s.tag)).toEqual(['python']);
  });

  test('a hand-typed tag records whether it was on show', async () => {
    suggestTags.mockResolvedValue(results('machine-learning'));
    const c = makeController();
    const it = item();
    c.request('item', it, 'text');
    await vi.runAllTimersAsync();
    c.manual('item', it, 'Machine Learning');
    c.manual('item', it, 'qkd');
    expect(recordTagEvents.mock.calls.map((call) => call[1][0])).toEqual([
      expect.objectContaining({ tag: 'Machine Learning', action: 'manual', rank: 0 }),
      { target: 'item', id: 3, tag: 'qkd', action: 'manual' },
    ]);
  });

  test('offline (the demo), nothing is fetched or reported', async () => {
    const c = makeController(false);
    const it = item();
    c.request('item', it, 'text');
    await vi.runAllTimersAsync();
    c.removed('item', it, 'python');
    expect(suggestTags).not.toHaveBeenCalled();
    expect(recordTagEvents).not.toHaveBeenCalled();
    expect(c.for('item', 3)).toEqual([]);
  });

  test('tags compare the way the backend stores them', () => {
    expect(canonicalTag('  Front_End  ')).toBe('front-end');
    expect(canonicalTag('Résumé')).toBe('resume');
  });
});
