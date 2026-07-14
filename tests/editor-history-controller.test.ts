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
  const appliedEntries: { source: Person; entryId: number }[] = [];
  let current: Person = structuredClone(SAMPLE);
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
    capture: () => structuredClone(current),
    apply: (doc) => {
      applied.push(doc);
      current = doc; // a restore/switch makes `doc` the working document
    },
    applyEntry: (source, entryId) => {
      appliedEntries.push({ source, entryId });
      return true;
    },
    reload: vi.fn(async () => {}),
    ...over,
  };
  return { host, announced, applied, appliedEntries, setCurrent: (d: Person) => (current = d) };
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

describe('HistoryController — branches, tags, cherry-restore (inc 3)', () => {
  test('snapshots land on the current branch; visible filters to it', async () => {
    const h = new HistoryController(makeHost().host);
    await h.snapshot('a');
    expect(h.versions[0].branch).toBe('main');
    expect(h.visible).toHaveLength(1);
  });

  test('fork starts a branch off the current state and switches onto it', async () => {
    const { host, announced } = makeHost();
    const h = new HistoryController(host);
    await h.snapshot('main-1');
    await h.fork('industry');
    expect(h.currentBranch).toBe('industry');
    expect(h.branches).toEqual(['main', 'industry']);
    expect(h.visible[0].branch).toBe('industry');
    expect(h.visible[0].parent).toBeDefined(); // parented to main's tip
    expect(announced.at(-1)).toContain('industry');
  });

  test('a fork name that already exists is ignored', async () => {
    const h = new HistoryController(makeHost().host);
    await h.fork('main');
    expect(h.branches).toEqual(['main']);
    expect(h.currentBranch).toBe('main');
  });

  test('switchTo restores the target branch tip and sets the current branch', async () => {
    const { host, applied } = makeHost();
    const h = new HistoryController(host);
    await h.snapshot('main-tip');
    await h.fork('industry');
    const industryTip = h.visible[0].id;
    await h.switchTo('main');
    expect(h.currentBranch).toBe('main');
    expect(applied.length).toBeGreaterThan(0);
    await h.switchTo('industry');
    expect(h.currentBranch).toBe('industry');
    expect(h.versions.some((v) => v.id === industryTip)).toBe(true);
  });

  test('switchTo auto-checkpoints uncommitted work before leaving', async () => {
    const { host, setCurrent } = makeHost();
    const h = new HistoryController(host);
    await h.snapshot('main-1');
    await h.fork('industry');
    const edited = structuredClone(SAMPLE);
    edited.personal.firstName = 'Edited'; // a change diffDocuments will see
    setCurrent(edited);
    const before = h.versions.filter((v) => v.branch === 'industry').length;
    await h.switchTo('main');
    const industry = h.versions.filter((v) => v.branch === 'industry');
    expect(industry).toHaveLength(before + 1);
    expect(industry[0].label).toContain('Auto-saved');
  });

  test('tag sets a checkpoint provenance name', async () => {
    const { host, announced } = makeHost();
    const h = new HistoryController(host);
    await h.snapshot('sent');
    await h.tag(h.versions[0].id, 'sent-to-google');
    expect(h.versions[0].tag).toBe('sent-to-google');
    expect(announced.at(-1)).toContain('sent-to-google');
  });

  test('cherryRestore resolves the checkpoint doc and applies one entry', async () => {
    const { host, appliedEntries } = makeHost();
    const h = new HistoryController(host);
    await h.snapshot('cp');
    await h.cherryRestore(h.versions[0].id, 100);
    expect(appliedEntries).toHaveLength(1);
    expect(appliedEntries[0].entryId).toBe(100);
    expect(appliedEntries[0].source.name).toBe('Ada Lovelace');
  });

  test('clear resets branch state', async () => {
    const h = new HistoryController(makeHost().host);
    await h.fork('x');
    h.clear();
    expect(h.currentBranch).toBe('main');
    expect(h.branches).toEqual(['main']);
    expect(h.versions).toHaveLength(0);
  });
});
