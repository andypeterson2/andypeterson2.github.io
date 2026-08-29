import { vi, describe, test, expect, beforeEach } from 'vitest';

vi.mock('../src/editor/lib/api', () => ({
  api: {
    getLetterData: vi.fn(),
    createLetterSection: vi.fn(async () => ({ ok: true, status: 200, data: { id: 777 } })),
    updateLetterSection: vi.fn(async () => ({ ok: true, status: 200 })),
    deleteLetterSection: vi.fn(async () => ({ ok: true, status: 200 })),
    reorderLetterSections: vi.fn(async () => ({ ok: true, status: 200 })),
    updateVariantHeader: vi.fn(async () => ({ ok: true, status: 200 })),
  },
}));

import { api } from '../src/editor/lib/api';
import { LetterController, type LetterHost } from '../src/editor/lib/letters.svelte';
import type { LetterSection, Variant } from '../src/editor/lib/types';

const variant = (over: Partial<Variant> = {}): Variant => ({
  id: 1,
  name: 'V',
  kind: 'cv',
  rules: { include: [], exclude: [] },
  sections: [],
  ...over,
});
const flush = () => new Promise((r) => setTimeout(r, 0));

function makeHost(
  opts: {
    connected?: boolean;
    variant?: Variant | null;
    coverletter?: Record<string, string>;
  } = {},
) {
  let seq = 2000;
  const records: Parameters<LetterHost['record']>[0][] = [];
  const calls = { markDirty: 0, persist: 0, announce: [] as string[] };
  const host: LetterHost = {
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
    debounce: (_k, fn) => fn(), // fire immediately in the test
    announce: (m) => calls.announce.push(m),
    record: (cmd) => records.push(cmd),
    forgetHistory: () => {},
    activeVariant: () => opts.variant ?? null,
    activeVariantId: () => opts.variant?.id ?? null,
    coverletter: () => opts.coverletter ?? {},
  };
  return { host, records, calls };
}

beforeEach(() => vi.clearAllMocks());

describe('LetterController — load', () => {
  test('a CV (non-letter) variant clears any loaded letter', () => {
    const c = new LetterController(makeHost({ variant: variant({ kind: 'cv' }) }).host);
    c.sections = [{ id: 9, title: '', body: 'x' }];
    c.header = { opening: 'stale' };
    c.load();
    expect(c.sections).toEqual([]);
    expect(c.header).toEqual({});
  });

  test('offline: a cover-letter variant loads the demo paragraphs + shared header', () => {
    const v = variant({ id: 3, kind: 'coverletter' }); // DEMO_LETTERS is keyed by id 3
    const c = new LetterController(
      makeHost({ connected: false, variant: v, coverletter: { opening: 'Dear Hiring Team,' } })
        .host,
    );
    c.load();
    expect(c.sections.length).toBeGreaterThan(0);
    expect(c.header.opening).toBe('Dear Hiring Team,');
  });

  test('connected: fetches the letter and applies it once (guarded against a stale switch)', async () => {
    const v = variant({ id: 5, kind: 'coverletter' });
    (api.getLetterData as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      data: { sections: [{ id: 1, title: '', body: 'Para 1' }], header: { opening: 'Dear X,' } },
    });
    const c = new LetterController(makeHost({ connected: true, variant: v }).host);
    c.load();
    await flush();
    expect(api.getLetterData).toHaveBeenCalledWith(5);
    expect(c.sections).toEqual([{ id: 1, title: '', body: 'Para 1' }]);
    expect(c.header).toEqual({ opening: 'Dear X,' });
  });
});

describe('LetterController — paragraph CRUD', () => {
  test('offline addParagraph appends and records an undoable "Add paragraph"', async () => {
    const v = variant({ id: 5, kind: 'coverletter' });
    const { host, records } = makeHost({ connected: false, variant: v });
    const c = new LetterController(host);
    await c.addParagraph();
    expect(c.sections).toHaveLength(1);
    expect(records.at(-1)?.label).toBe('Add paragraph');
    expect(api.createLetterSection).not.toHaveBeenCalled();
  });

  test('connected addParagraph persists and reconciles the server id', async () => {
    const v = variant({ id: 5, kind: 'coverletter' });
    const c = new LetterController(makeHost({ connected: true, variant: v }).host);
    await c.addParagraph();
    expect(api.createLetterSection).toHaveBeenCalledWith(5, { title: '', body: '' });
    expect(c.sections[0].id).toBe(777);
  });

  test('addParagraph rolls back a paragraph the backend rejects', async () => {
    (api.createLetterSection as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });
    const v = variant({ id: 5, kind: 'coverletter' });
    const c = new LetterController(makeHost({ connected: true, variant: v }).host);
    await c.addParagraph();
    expect(c.sections).toHaveLength(0);
  });

  test('deleteParagraph removes it, records, and persists the delete', async () => {
    const v = variant({ id: 5, kind: 'coverletter' });
    const { host, records } = makeHost({ connected: true, variant: v });
    const c = new LetterController(host);
    c.sections = [{ id: 10, title: '', body: 'A' }];
    await c.deleteParagraph(10);
    expect(c.sections).toHaveLength(0);
    expect(records.at(-1)?.label).toBe('Delete paragraph');
    expect(api.deleteLetterSection).toHaveBeenCalledWith(5, 10);
  });

  test('deleteParagraph ignores an unknown id', async () => {
    const c = new LetterController(makeHost({ connected: true, variant: variant({ id: 5 }) }).host);
    c.sections = [{ id: 10, title: '', body: 'A' }];
    await c.deleteParagraph(999);
    expect(c.sections).toHaveLength(1);
    expect(api.deleteLetterSection).not.toHaveBeenCalled();
  });

  test('reorder moves a paragraph, announces its new position, persists the order', async () => {
    const v = variant({ id: 5, kind: 'coverletter' });
    const { host, calls } = makeHost({ connected: true, variant: v });
    const c = new LetterController(host);
    c.sections = [
      { id: 1, title: '', body: 'A' },
      { id: 2, title: '', body: 'B' },
    ];
    await c.reorderParagraphs(0, 1);
    expect(c.sections.map((s: LetterSection) => s.id)).toEqual([2, 1]);
    expect(calls.announce.at(-1)).toContain('position 2 of 2');
    expect(api.reorderLetterSections).toHaveBeenCalledWith(5, [2, 1]);
  });
});

describe('LetterController — header + paragraph saves', () => {
  test('saveHeader persists the edited field via the debounce', async () => {
    const v = variant({ id: 5, kind: 'coverletter' });
    const c = new LetterController(makeHost({ connected: true, variant: v }).host);
    c.header = { opening: 'Dear Team,' };
    c.saveHeader('opening');
    await flush();
    expect(api.updateVariantHeader).toHaveBeenCalledWith(5, { opening: 'Dear Team,' });
  });

  test('saveParagraph persists the paragraph body', async () => {
    const v = variant({ id: 5, kind: 'coverletter' });
    const c = new LetterController(makeHost({ connected: true, variant: v }).host);
    const s: LetterSection = { id: 10, title: '', body: 'edited' };
    c.sections = [s];
    c.saveParagraph(s);
    await flush();
    expect(api.updateLetterSection).toHaveBeenCalledWith(5, 10, { title: '', body: 'edited' });
  });
});
