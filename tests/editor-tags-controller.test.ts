import { vi, describe, test, expect, beforeEach } from 'vitest';

// The tag mutations reach the backend only through `api`, always inside a
// host.persist() closure — so a mock host whose persist runs the op lets us
// check both the local mutation and the call, no network. Runes in tags.svelte.ts
// compile via the vite-plugin-svelte wired into vitest.config.ts.
vi.mock('../src/editor/lib/api', () => ({
  api: {
    addEntryTags: vi.fn(async () => ({ ok: true, status: 200 })),
    removeEntryTag: vi.fn(async () => ({ ok: true, status: 200 })),
    addItemTags: vi.fn(async () => ({ ok: true, status: 200 })),
    removeItemTag: vi.fn(async () => ({ ok: true, status: 200 })),
  },
}));

import { api } from '../src/editor/lib/api';
import { TagController, type TagHost } from '../src/editor/lib/tags.svelte';
import type { Entry, Item, Section } from '../src/editor/lib/types';

const entry = (over: Partial<Entry> = {}): Entry => ({
  id: 1,
  fields: {},
  items: [],
  tags: [],
  ...over,
});
const item = (over: Partial<Item> = {}): Item => ({ id: 1, content: '', tags: [], ...over });

function makeHost(sections: Section[] = []) {
  const records: Parameters<TagHost['record']>[0][] = [];
  const calls = { markDirty: 0, persist: 0 };
  const host: TagHost = {
    connected: () => true,
    nextId: () => 1,
    markDirty: () => {
      calls.markDirty++;
    },
    setSaving: () => {},
    persist: async (op) => {
      calls.persist++;
      return op();
    },
    debounce: (_k, fn) => fn(),
    announce: () => {},
    record: (cmd) => records.push(cmd),
    forgetHistory: () => {},
    sections: () => sections,
  };
  return { host, records, calls };
}

beforeEach(() => vi.clearAllMocks());

describe('TagController — entry tags', () => {
  test('adds only fresh tags (trims blanks, drops dupes) and persists the delta', async () => {
    const { host, records, calls } = makeHost();
    const c = new TagController(host);
    const e = entry({ tags: ['quantum'] });
    await c.addToEntry(e, ['quantum', 'research', '   ']); // dupe-of-existing + blank dropped
    expect(e.tags).toEqual(['quantum', 'research']);
    expect(records.at(-1)?.label).toBe('Tag #research');
    expect(calls.markDirty).toBe(1);
    expect(api.addEntryTags).toHaveBeenCalledWith(1, ['research']);
  });

  test('a multi-tag add is labelled "Tags"', async () => {
    const { host, records } = makeHost();
    await new TagController(host).addToEntry(entry(), ['a', 'b']);
    expect(records.at(-1)?.label).toBe('Tags');
  });

  test('nothing fresh → no record, no persist, no call', async () => {
    const { host, records, calls } = makeHost();
    await new TagController(host).addToEntry(entry({ tags: ['x'] }), ['x', '  ']);
    expect(records).toHaveLength(0);
    expect(calls.persist).toBe(0);
    expect(api.addEntryTags).not.toHaveBeenCalled();
  });

  test('remove drops the tag, records "Untag", and its undo re-adds it', async () => {
    const { host, records } = makeHost();
    const c = new TagController(host);
    const e = entry({ tags: ['x', 'y'] });
    await c.removeFromEntry(e, 'x');
    expect(e.tags).toEqual(['y']);
    expect(records.at(-1)?.label).toBe('Untag #x');
    expect(api.removeEntryTag).toHaveBeenCalledWith(1, 'x');
    await records.at(-1)?.undo(); // the recorded inverse really re-adds
    expect(e.tags).toContain('x');
  });

  test('removing a tag that is not present is a no-op', async () => {
    const { host, calls } = makeHost();
    await new TagController(host).removeFromEntry(entry({ tags: ['y'] }), 'x');
    expect(calls.persist).toBe(0);
    expect(api.removeEntryTag).not.toHaveBeenCalled();
  });
});

describe('TagController — bullet (item) tags', () => {
  test('addToItem adds fresh, records, persists', async () => {
    const { host, records } = makeHost();
    const it = item({ id: 9, tags: [] });
    await new TagController(host).addToItem(it, ['security']);
    expect(it.tags).toEqual(['security']);
    expect(records.at(-1)?.label).toBe('Tag #security');
    expect(api.addItemTags).toHaveBeenCalledWith(9, ['security']);
  });

  test('removeFromItem removes + persists', async () => {
    const { host } = makeHost();
    const it = item({ id: 9, tags: ['a', 'b'] });
    await new TagController(host).removeFromItem(it, 'a');
    expect(it.tags).toEqual(['b']);
    expect(api.removeItemTag).toHaveBeenCalledWith(9, 'a');
  });
});

describe('TagController — vocab + spotlight', () => {
  test('vocab counts every tag across entries and bullets, sorted by name', () => {
    const sections: Section[] = [
      {
        id: 's1',
        type: 'experience',
        title: 'Experience',
        entries: [
          entry({
            id: 1,
            tags: ['quantum', 'leadership'],
            items: [item({ id: 1, tags: ['quantum'] })],
          }),
          entry({ id: 2, tags: ['leadership'] }),
        ],
      },
    ];
    const c = new TagController(makeHost(sections).host);
    expect(c.vocab).toEqual([
      { tag: 'leadership', count: 2 },
      { tag: 'quantum', count: 2 },
    ]);
  });

  test('highlight is reactive state, default null', () => {
    const c = new TagController(makeHost().host);
    expect(c.highlight).toBe(null);
    c.highlight = 'quantum';
    expect(c.highlight).toBe('quantum');
  });
});
