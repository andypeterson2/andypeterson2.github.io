import { vi, describe, test, expect, beforeEach } from 'vitest';

vi.mock('../src/editor/lib/api', () => ({
  api: {
    createVariant: vi.fn(async () => ({ ok: true, status: 200, data: { id: 500 } })),
    renameVariant: vi.fn(async () => ({ ok: true, status: 200 })),
    deleteVariant: vi.fn(async () => ({ ok: true, status: 200 })),
    setVariantRules: vi.fn(async () => ({ ok: true, status: 200 })),
    setVariantOverride: vi.fn(async () => ({ ok: true, status: 200 })),
  },
}));

import { api } from '../src/editor/lib/api';
import { VariantController, type VariantHost } from '../src/editor/lib/variants.svelte';
import type { Variant, Entry, Item } from '../src/editor/lib/types';

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
    (api.createVariant as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });
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

describe('VariantController — per-variant overrides (field patch + force include/out)', () => {
  const entry = (over: Partial<Entry> = {}): Entry => ({
    id: 11,
    fields: { position: 'Analyst' },
    tags: [],
    items: [],
    ...over,
  });
  const item = (over: Partial<Item> = {}): Item => ({
    id: 200,
    content: 'Python',
    tags: [],
    ...over,
  });

  test('setEntryFieldOverride writes a fields patch, records undo, persists the whole row', async () => {
    const h = makeHost({ connected: true });
    const v = variant({ id: 42 });
    await new VariantController(h.host).setEntryFieldOverride(
      v,
      entry(),
      'position',
      'Senior Analyst',
    );
    expect(v.entryOverrides?.[11]?.fieldsOverride).toEqual({ position: 'Senior Analyst' });
    expect(api.setVariantOverride).toHaveBeenCalledWith(42, {
      targetType: 'entry',
      targetId: 11,
      included: null,
      textOverride: null,
      sortOverride: null,
      fieldsOverride: { position: 'Senior Analyst' },
    });
    expect(h.records.at(-1)?.label).toBe('Override position');
  });

  test('typing a field back to its Main value auto-clears the override row', async () => {
    const h = makeHost({ connected: true });
    const v = variant({ id: 42 });
    const e = entry();
    const c = new VariantController(h.host);
    await c.setEntryFieldOverride(v, e, 'position', 'Senior Analyst');
    await c.setEntryFieldOverride(v, e, 'position', 'Analyst'); // === base → clears the key → row drops
    expect(v.entryOverrides?.[11]).toBeUndefined();
  });

  test('resetEntryField reverts a single field to Main', async () => {
    const h = makeHost({ connected: true });
    const v = variant({ id: 42 });
    const e = entry();
    const c = new VariantController(h.host);
    await c.setEntryFieldOverride(v, e, 'date', '2024');
    await c.resetEntryField(v, e, 'date');
    expect(v.entryOverrides?.[11]).toBeUndefined();
  });

  test('setEntryIncluded forces out (0) then clears back to auto (null), dropping the row', async () => {
    const h = makeHost({ connected: true });
    const v = variant({ id: 42 });
    const e = entry();
    const c = new VariantController(h.host);
    await c.setEntryIncluded(v, e, 0);
    expect(v.entryOverrides?.[11]?.included).toBe(0);
    expect(api.setVariantOverride).toHaveBeenLastCalledWith(
      42,
      expect.objectContaining({ targetType: 'entry', targetId: 11, included: 0 }),
    );
    await c.setEntryIncluded(v, e, null);
    expect(v.entryOverrides?.[11]).toBeUndefined();
  });

  test('a field patch and a force-in coexist on one row (neither wipes the other)', async () => {
    const h = makeHost({ connected: true });
    const v = variant({ id: 42 });
    const e = entry();
    const c = new VariantController(h.host);
    await c.setEntryFieldOverride(v, e, 'position', 'X');
    await c.setEntryIncluded(v, e, 1);
    expect(v.entryOverrides?.[11]).toMatchObject({
      included: 1,
      fieldsOverride: { position: 'X' },
    });
  });

  test('setItemIncluded targets an item and drops the row on reset', async () => {
    const h = makeHost({ connected: true });
    const v = variant({ id: 42 });
    const c = new VariantController(h.host);
    await c.setItemIncluded(v, item(), 0);
    expect(v.itemOverrides?.[200]?.included).toBe(0);
    expect(api.setVariantOverride).toHaveBeenLastCalledWith(42, {
      targetType: 'item',
      targetId: 200,
      included: 0,
      textOverride: null,
      sortOverride: null,
    });
    await c.setItemIncluded(v, item(), null);
    expect(v.itemOverrides?.[200]).toBeUndefined();
  });

  test('undo restores the prior override state; redo re-applies', async () => {
    const h = makeHost({ connected: true });
    const v = variant({ id: 42 });
    const e = entry();
    const c = new VariantController(h.host);
    await c.setEntryFieldOverride(v, e, 'position', 'Senior');
    const rec = h.records.at(-1)!;
    await rec.undo();
    expect(v.entryOverrides?.[11]).toBeUndefined();
    await rec.redo();
    expect(v.entryOverrides?.[11]?.fieldsOverride).toEqual({ position: 'Senior' });
  });
});
