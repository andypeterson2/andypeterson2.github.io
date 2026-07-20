import { vi, describe, test, expect, beforeEach } from 'vitest';

vi.mock('../src/editor/lib/api', () => ({
  api: {
    createVariant: vi.fn(async () => ({ ok: true, status: 200, data: { id: 500 } })),
    renameVariant: vi.fn(async () => ({ ok: true, status: 200 })),
    deleteVariant: vi.fn(async () => ({ ok: true, status: 200 })),
    setVariantRules: vi.fn(async () => ({ ok: true, status: 200 })),
  },
}));

import { api } from '../src/editor/lib/api';
import { VariantController, type VariantHost } from '../src/editor/lib/variants.svelte';
import type { Variant } from '../src/editor/lib/types';

const variant = (over: Partial<Variant> = {}): Variant => ({
  id: 1,
  name: 'V',
  kind: 'cv',
  rules: { include: [], exclude: [] },
  sections: [],
  ...over,
});

function makeHost(opts: { connected?: boolean; pid?: number | null } = {}) {
  let variants: Variant[] = [];
  let activeId: number | null = null;
  let seq = 1000;
  const records: Parameters<VariantHost['record']>[0][] = [];
  const calls = { markDirty: 0, persist: 0, forgetHistory: 0, syncActive: [] as boolean[] };
  const host: VariantHost = {
    connected: () => opts.connected ?? false,
    nextId: () => seq++,
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
    forgetHistory: () => {
      calls.forgetHistory++;
    },
    activePersonId: () => opts.pid ?? null,
    activeId: () => activeId,
    setActiveId: (id) => {
      activeId = id;
    },
    variants: () => variants,
    setVariants: (v) => {
      variants = v;
    },
    syncActive: (load) => {
      calls.syncActive.push(load);
    },
  };
  return {
    host,
    records,
    calls,
    get variants() {
      return variants;
    },
    get activeId() {
      return activeId;
    },
  };
}

beforeEach(() => vi.clearAllMocks());

describe('VariantController — select', () => {
  test('select points the active lens and coordinates a letter-load sync', () => {
    const h = makeHost();
    new VariantController(h.host).select(3);
    expect(h.activeId).toBe(3);
    expect(h.calls.syncActive).toEqual([true]);
  });
});

describe('VariantController — add', () => {
  test('offline: pushes locally with a temp id and never persists', async () => {
    const h = makeHost({ connected: false });
    await new VariantController(h.host).add('  ', 'coverletter');
    expect(h.variants).toHaveLength(1);
    expect(h.variants[0].name).toBe('New cover letter'); // blank → kind default
    expect(h.variants[0].kind).toBe('coverletter');
    expect(h.activeId).toBe(h.variants[0].id); // becomes active
    expect(h.calls.persist).toBe(0);
    expect(api.createVariant).not.toHaveBeenCalled();
  });

  test('connected: persists and reconciles temp id → server id', async () => {
    const h = makeHost({ connected: true, pid: 7 });
    await new VariantController(h.host).add('Quantum Research');
    expect(api.createVariant).toHaveBeenCalledWith(7, { name: 'Quantum Research', kind: 'cv' });
    expect(h.variants[0].id).toBe(500); // reconciled
    expect(h.activeId).toBe(500);
  });

  test('connected but the create fails: rolls back and falls to Main', async () => {
    (api.createVariant as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 500 });
    const h = makeHost({ connected: true, pid: 7 });
    await new VariantController(h.host).add('Doomed');
    expect(h.variants).toHaveLength(0); // rolled back
    expect(h.activeId).toBe(null); // fell back to Main
    expect(h.calls.syncActive.at(-1)).toBe(false);
  });
});

describe('VariantController — rename / remove', () => {
  test('rename persists a trimmed, changed name; a no-op name is ignored', async () => {
    const h = makeHost({ connected: true, pid: 7 });
    const c = new VariantController(h.host);
    const v = variant({ id: 42, name: 'Old' });
    await c.rename(v, '  New  ');
    expect(v.name).toBe('New');
    expect(api.renameVariant).toHaveBeenCalledWith(42, 'New');

    (api.renameVariant as ReturnType<typeof vi.fn>).mockClear();
    await c.rename(v, 'New'); // unchanged
    await c.rename(v, '   '); // blank
    expect(api.renameVariant).not.toHaveBeenCalled();
  });

  test('remove forgets history (delete is not undoable), drops it, clears active', async () => {
    const h = makeHost({ connected: true, pid: 7 });
    const v = variant({ id: 42 });
    (h.host as VariantHost).setVariants([v]);
    h.host.setActiveId(42);
    await new VariantController(h.host).remove(v);
    expect(h.calls.forgetHistory).toBe(1);
    expect(h.variants).toHaveLength(0);
    expect(h.activeId).toBe(null);
    expect(api.deleteVariant).toHaveBeenCalledWith(42);
  });
});

describe('VariantController — include/exclude rules (undoable)', () => {
  test('addRule strips a leading #, records its inverse, persists the whole rule set', async () => {
    const h = makeHost({ connected: true, pid: 7 });
    const v = variant({ id: 42 });
    await new VariantController(h.host).addRule(v, 'include', '#quantum');
    expect(v.rules.include).toEqual(['quantum']);
    expect(h.records.at(-1)?.label).toBe('Include #quantum');
    expect(api.setVariantRules).toHaveBeenCalledWith(42, { include: ['quantum'], exclude: [] });
  });

  test('addRule is a no-op for a blank tag or one already present', async () => {
    const h = makeHost({ connected: true });
    const v = variant({ rules: { include: ['quantum'], exclude: [] } });
    const c = new VariantController(h.host);
    await c.addRule(v, 'include', 'quantum');
    await c.addRule(v, 'include', '   ');
    expect(v.rules.include).toEqual(['quantum']);
    expect(h.calls.persist).toBe(0);
  });

  test('removeRule drops the tag and records "Remove"; its undo re-adds', async () => {
    const h = makeHost({ connected: true });
    const v = variant({ rules: { include: ['quantum', 'web'], exclude: [] } });
    const c = new VariantController(h.host);
    await c.removeRule(v, 'include', 'web');
    expect(v.rules.include).toEqual(['quantum']);
    expect(h.records.at(-1)?.label).toBe('Remove #web');
    await h.records.at(-1)?.undo();
    expect(v.rules.include).toContain('web');
  });
});
