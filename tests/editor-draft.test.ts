/**
 * Demo edits survive sign-in. The draft module stashes the demo tree in
 * sessionStorage before the same-tab Google redirect; after sign-in the store offers
 * to import it as the visitor's own profile, with the sample's contact header
 * replaced by the signed-in identity.
 */
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import {
  stashDemoDraft,
  peekDemoDraft,
  clearDemoDraft,
  forNewOwner,
} from '../src/editor/lib/draft';
import type { ExportDoc } from '../src/editor/lib/export';
import { editor } from '../src/editor/lib/store.svelte';
import { api } from '../src/editor/lib/api';

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

const doc = (): ExportDoc =>
  ({
    name: 'Sample',
    personal: {
      firstName: 'Owner',
      lastName: 'Person',
      email: 'owner@example.com',
      github: 'owner',
      linkedin: 'owner',
      position: 'Software Developer',
    },
    coverletter: {},
    sections: [],
    variants: [],
  }) as unknown as ExportDoc;

describe('draft stash', () => {
  test('stash → peek round-trips, and clear removes it', () => {
    const s = memoryStorage();
    expect(stashDemoDraft(doc(), 1000, s)).toBe(true);
    expect(peekDemoDraft(1000, s)?.name).toBe('Sample');
    clearDemoDraft(s);
    expect(peekDemoDraft(1000, s)).toBeNull();
  });

  test('a stash older than an hour is ignored', () => {
    const s = memoryStorage();
    stashDemoDraft(doc(), 0, s);
    expect(peekDemoDraft(60 * 60 * 1000 + 1, s)).toBeNull();
  });

  test('blocked or broken storage reports failure instead of throwing', () => {
    expect(stashDemoDraft(doc(), 0, null)).toBe(false);
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => undefined,
    };
    expect(stashDemoDraft(doc(), 0, throwing)).toBe(false);
    expect(peekDemoDraft(0, throwing)).toBeNull();
  });

  test("forNewOwner swaps the owner's contacts for the visitor's and keeps the body", () => {
    const out = forNewOwner(doc(), { name: 'Ada King Lovelace', email: 'ada@example.com' });
    expect(out.personal).toEqual({
      firstName: 'Ada',
      lastName: 'King Lovelace',
      email: 'ada@example.com',
      position: 'Software Developer',
    });
    expect(out.name).toBe('Ada King Lovelace (from demo)');
    expect(forNewOwner(doc(), { name: null, email: null }).personal).toEqual({
      position: 'Software Developer',
    });
  });
});

describe('store: sign in keeps demo edits, then offers them as a profile', () => {
  let store: ReturnType<typeof memoryStorage>;
  beforeEach(() => {
    store = memoryStorage();
    vi.stubGlobal('sessionStorage', store);
    vi.stubGlobal('window', {
      location: { href: 'https://example.test/editor/' },
      confirm: vi.fn(),
    });
    editor.connected = false;
    editor.connecting = false;
    editor.signingIn = false;
    editor.persons = [];
    editor.activePersonId = null;
    editor.pendingDraft = null;
    editor.resetDemo();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('an untouched demo stashes nothing', () => {
    editor.signIn();
    expect(peekDemoDraft(Date.now(), store)).toBeNull();
    expect(editor.signingIn).toBe(true);
  });

  test('an edited demo is stashed before the redirect', () => {
    editor.edited();
    editor.signIn();
    const stashed = peekDemoDraft(Date.now(), store);
    expect(stashed?.sections.length).toBeGreaterThan(0);
    expect(editor.signingIn).toBe(true);
  });

  test('if the edits cannot be kept, the visitor is asked first', () => {
    vi.stubGlobal('sessionStorage', undefined);
    const confirm = vi.fn(() => false);
    vi.stubGlobal('window', { location: { href: '' }, confirm });
    editor.edited();
    editor.signIn();
    expect(confirm).toHaveBeenCalledOnce();
    expect(editor.signingIn).toBe(false);
  });

  test('after sign-in into an empty account the draft is offered, then imported', async () => {
    stashDemoDraft(doc(), Date.now(), store);
    vi.spyOn(api, 'me').mockResolvedValue({
      authenticated: true,
      email: 'ada@example.com',
      name: 'Ada',
    });
    vi.spyOn(api, 'fetchActive').mockResolvedValue({
      ok: false,
      status: 404,
      error: { code: 'no_persons', message: '' },
    });
    await editor.connect();
    expect(editor.connected).toBe(true);
    expect(editor.pendingDraft?.name).toBe('Sample');

    const create = vi.spyOn(api, 'createPerson').mockResolvedValue({
      ok: true,
      status: 200,
      data: { id: 42 },
    });
    const importPerson = vi.spyOn(api, 'importPerson').mockResolvedValue({ ok: true, status: 200 });
    vi.spyOn(api, 'fetchPerson').mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        id: 42,
        name: 'Ada (from demo)',
        personal: {},
        sections: [],
        variants: [],
        coverletter: {},
      },
    });
    await editor.importDraft();
    expect(create).toHaveBeenCalledWith('Ada (from demo)');
    const [pid, tree] = importPerson.mock.calls[0] as [number, ExportDoc];
    expect(pid).toBe(42);
    expect(tree.personal.email).toBe('ada@example.com');
    expect(tree.personal.github).toBeUndefined();
    expect(editor.pendingDraft).toBeNull();
    expect(peekDemoDraft(Date.now(), store)).toBeNull();
    expect(editor.persons.map((p) => p.id)).toContain(42);
  });

  test('a failed import keeps the offer so it can be retried', async () => {
    editor.connected = true;
    editor.identity = { name: 'Ada', email: 'ada@example.com' };
    editor.pendingDraft = doc();
    vi.spyOn(api, 'createPerson').mockResolvedValue({
      ok: false,
      status: 500,
      error: { code: 'x', message: 'x' },
    });
    await editor.importDraft();
    expect(editor.pendingDraft).not.toBeNull();
  });

  test('"Start fresh" discards the draft', () => {
    stashDemoDraft(doc(), Date.now(), store);
    editor.pendingDraft = doc();
    editor.discardDraft();
    expect(editor.pendingDraft).toBeNull();
    expect(peekDemoDraft(Date.now(), store)).toBeNull();
  });
});
