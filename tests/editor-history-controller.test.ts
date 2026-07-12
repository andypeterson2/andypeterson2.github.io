import { vi, describe, test, expect, beforeEach } from 'vitest';

// The controller talks to the backend only through `api`; mock it so the demo
// path (no calls) and the connected path (calls + id reconciliation) are both
// checkable without a network. Runes in history.svelte.ts compile via the
// vite-plugin-svelte wired into vitest.config.ts (tech-debt round-two item 17).
vi.mock('../src/editor/lib/api', () => ({
  api: {
    listVersions: vi.fn(async () => ({ ok: true, status: 200, data: { versions: [] } })),
    commitVersion: vi.fn(async () => ({ ok: true, status: 200, data: { id: 900 } })),
    restoreVersion: vi.fn(async () => ({ ok: true, status: 200 })),
  },
}));

import { api } from '../src/editor/lib/api';
import { HistoryController, type HistoryHost } from '../src/editor/lib/history.svelte';
import type { Person } from '../src/editor/lib/types';

const SAMPLE: Person = {
  id: 1,
  name: 'Ada Lovelace',
  personal: { firstName: 'Ada' },
  sections: [{ id: 10, type: 'experience', title: 'Experience', entries: [] }],
  variants: [],
  coverletter: {},
};

function makeHost(over: Partial<HistoryHost> = {}) {
  const announced: string[] = [];
  const applied: Person[] = [];
  let seq = 1;
  const host: HistoryHost = {
    connected: () => false,
    nextId: () => seq++,
    markDirty: () => {},
    setSaving: () => {},
    persist: async (op) => op(),
    debounce: (_k, fn) => fn(),
    announce: (m) => announced.push(m),
    record: () => {},
    forgetHistory: () => {},
    activePersonId: () => null,
    capture: () => structuredClone(SAMPLE),
    apply: (doc) => applied.push(doc),
    reload: vi.fn(async () => {}),
    ...over,
  };
  return { host, announced, applied };
}

beforeEach(() => vi.clearAllMocks());

describe('HistoryController — demo (in-memory)', () => {
  test('lists checkpoints newest-first, each with a captured doc', async () => {
    const h = new HistoryController(makeHost().host);
    await h.snapshot('first');
    await h.snapshot('second');
    expect(h.versions.map((v) => v.label)).toEqual(['second', 'first']);
    expect(h.versions[0].doc.name).toBe('Ada Lovelace');
  });

  test('an untitled snapshot stores an empty label', async () => {
    const h = new HistoryController(makeHost().host);
    await h.snapshot('   ');
    expect(h.versions[0].label).toBe('');
  });

  test('never calls the backend in demo', async () => {
    const h = new HistoryController(makeHost().host);
    await h.snapshot('x');
    expect(api.commitVersion).not.toHaveBeenCalled();
  });

  test('restore applies an independent clone — the checkpoint stays pristine', async () => {
    const { host, applied } = makeHost();
    const h = new HistoryController(host);
    await h.snapshot('v1');
    await h.restore(h.versions[0].id);
    expect(applied).toHaveLength(1);
    // mutate the now-live document; the stored checkpoint must not follow
    applied[0].name = 'EDITED';
    expect(h.versions[0].doc.name).toBe('Ada Lovelace');
  });

  test('restore ignores an unknown id', async () => {
    const { host, applied } = makeHost();
    const h = new HistoryController(host);
    await h.snapshot('v1');
    await h.restore(99999);
    expect(applied).toHaveLength(0);
  });

  test('clear forgets the list', async () => {
    const h = new HistoryController(makeHost().host);
    await h.snapshot('v1');
    h.clear();
    expect(h.versions).toHaveLength(0);
  });

  test('announces the checkpoint and the restore', async () => {
    const { host, announced } = makeHost();
    const h = new HistoryController(host);
    await h.snapshot('Draft A');
    await h.restore(h.versions[0].id);
    expect(announced).toEqual(['Checkpoint “Draft A” saved', 'Restored “Draft A”']);
  });
});

describe('HistoryController — connected (persisted)', () => {
  test('a snapshot persists and reconciles the server id', async () => {
    const { host } = makeHost({ connected: () => true, activePersonId: () => 7 });
    const h = new HistoryController(host);
    await h.snapshot('milestone');
    expect(api.commitVersion).toHaveBeenCalledWith(7, expect.objectContaining({ label: 'milestone' }));
    expect(h.versions[0].id).toBe(900); // reconciled from the server response
  });

  test('restore goes through the server and reloads, never a local swap', async () => {
    const reload = vi.fn(async () => {});
    const { host, applied } = makeHost({
      connected: () => true,
      activePersonId: () => 7,
      reload,
    });
    const h = new HistoryController(host);
    await h.snapshot('v1');
    await h.restore(h.versions[0].id);
    expect(api.restoreVersion).toHaveBeenCalledWith(7, h.versions[0].id);
    expect(reload).toHaveBeenCalled();
    expect(applied).toHaveLength(0);
  });
});
