import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';

// Demo paths need no api mock (connected === false skips the network); the save
// machine is driven through the public `persist(op)`, and export reaches only the
// pure `tex()`. The connected-path suite below spies on the real `api` singleton
// (restored after each test) — so nothing here makes a real network call.
import { editor } from '../src/editor/lib/store.svelte';
import { api } from '../src/editor/lib/api';
import type { Person, Section } from '../src/editor/lib/types';

const experience = (): Section =>
  editor.person.sections.find((s) => s.type === 'experience') ?? editor.person.sections[0];
const person = (over: Partial<Person> = {}): Person => ({
  id: 1,
  name: 'X',
  personal: {},
  sections: [],
  variants: [],
  coverletter: {},
  ...over,
});

// The store is a singleton; resetDemo() re-clones the pristine sample and clears
// undo/selection/save state, giving each test a clean, isolated document.
beforeEach(() => {
  editor.connected = false;
  editor.connecting = false;
  editor.persons = [];
  editor.activePersonId = null;
  editor.saveError = null;
  editor.retryOp = null;
  editor.connectError = null;
  editor.resetDemo();
});
afterEach(() => vi.restoreAllMocks());

describe('EditorState — demo baseline + derived labels', () => {
  test('starts on the demo document, disconnected, Main lens', () => {
    expect(editor.connected).toBe(false);
    expect(editor.saveState).toBe('demo');
    expect(editor.activeVariant).toBe(null); // Main
    expect(editor.variantLabel).toBe('Main');
    expect(editor.letterMode).toBe(false);
    expect(editor.person.sections.length).toBeGreaterThan(0);
  });

  test('noProfiles is false in demo; profileLabel falls back to the CV name', () => {
    expect(editor.noProfiles).toBe(false); // only true when CONNECTED with zero profiles
    expect(typeof editor.profileLabel).toBe('string');
  });

  test('the active variant + letter mode track the selected lens', () => {
    const letterVariant = editor.person.variants.find((v) => v.kind === 'coverletter');
    expect(letterVariant).toBeDefined();
    editor.activeVariantId = letterVariant!.id;
    expect(editor.activeVariant?.id).toBe(letterVariant!.id);
    expect(editor.variantLabel).toBe(letterVariant!.name);
    expect(editor.letterMode).toBe(true);
  });

  test('selection round-trips through select / clearSelection', () => {
    editor.select({ kind: 'entry', sectionId: 's', entryId: 1 });
    expect(editor.selection).toEqual({ kind: 'entry', sectionId: 's', entryId: 1 });
    editor.clearSelection();
    expect(editor.selection).toEqual({ kind: 'none' });
  });
});

describe('EditorState — content CRUD (demo: local, undoable, no network)', () => {
  test('addSection appends a section, targets it for scroll, records "Add section"', async () => {
    const before = editor.person.sections.length;
    await editor.addSection('projects');
    expect(editor.person.sections.length).toBe(before + 1);
    expect(editor.scrollTarget).not.toBe(null);
    expect(editor.dirty).toBe(true);
    expect(editor.undo.undoLabel).toBe('Add section');
  });

  test('deleteSection removes it and records "Delete section"; undo brings it back', async () => {
    await editor.addSection('projects');
    const target = editor.person.sections.at(-1)!;
    const count = editor.person.sections.length;
    editor.undo.clear();
    await editor.deleteSection(target.id);
    expect(editor.person.sections.length).toBe(count - 1);
    expect(editor.undo.undoLabel).toBe('Delete section');
    await editor.undo.undo();
    expect(editor.person.sections.some((s) => s.id === target.id)).toBe(true);
  });

  test('addEntry appends to a section, selects it, records "Add entry"', async () => {
    const sec = experience();
    const before = sec.entries.length;
    await editor.addEntry(sec);
    expect(sec.entries.length).toBe(before + 1);
    expect(editor.selection.kind).toBe('entry');
    expect(editor.undo.undoLabel).toBe('Add entry');
  });

  test('deleteEntry removes it, clears selection, records "Delete entry"', async () => {
    const sec = experience();
    await editor.addEntry(sec);
    const entry = sec.entries.at(-1)!;
    editor.undo.clear();
    await editor.deleteEntry(sec, entry.id);
    expect(sec.entries.some((e) => e.id === entry.id)).toBe(false);
    expect(editor.selection).toEqual({ kind: 'none' });
    expect(editor.undo.undoLabel).toBe('Delete entry');
  });

  test('addBullet records "Add bullet"; addEphemeralBullet records nothing (the tour)', async () => {
    const sec = experience();
    await editor.addEntry(sec);
    const entry = sec.entries.at(-1)!;
    editor.undo.clear();

    await editor.addBullet(entry);
    expect(entry.items).toHaveLength(1);
    expect(editor.undo.undoLabel).toBe('Add bullet');

    editor.undo.clear();
    const ghost = editor.addEphemeralBullet(entry);
    expect(entry.items).toContain(ghost);
    expect(editor.undo.canUndo).toBe(false); // ephemeral: never recorded
  });

  test('deleteBullet removes it and records "Delete bullet"', async () => {
    const sec = experience();
    await editor.addEntry(sec);
    const entry = sec.entries.at(-1)!;
    await editor.addBullet(entry);
    const bullet = entry.items.at(-1)!;
    editor.undo.clear();
    await editor.deleteBullet(entry, bullet.id);
    expect(entry.items.some((i) => i.id === bullet.id)).toBe(false);
    expect(editor.undo.undoLabel).toBe('Delete bullet');
  });

  test('reorderEntries moves an entry, announces its position, records "Reorder"', async () => {
    const sec = experience();
    await editor.addEntry(sec);
    await editor.addEntry(sec);
    const firstId = sec.entries[0].id;
    editor.undo.clear();
    await editor.reorderEntries(sec, 0, 1);
    expect(sec.entries[1].id).toBe(firstId);
    expect(editor.announce).toContain('position 2');
    expect(editor.undo.undoLabel).toBe('Reorder');
  });

  test('editing an entry field records a humanized, undoable change', async () => {
    const sec = experience();
    await editor.addEntry(sec);
    const entry = sec.entries.at(-1)!;
    editor.undo.clear();
    entry.fields.position = 'Chief Tinkerer'; // bind:value mutates first
    editor.saveEntry(entry);
    expect(editor.dirty).toBe(true);
    expect(editor.undo.undoLabel).toBe('Position');
  });
});

describe('EditorState — the save-state machine (persist / settle / retry)', () => {
  test('a demo persist is a silent success — no network, no state churn', async () => {
    const res = await editor.persist(async () => ({ ok: false, status: 500 }));
    expect(res.ok).toBe(true); // demo reports success and writes nothing
    expect(editor.saveState).toBe('demo'); // untouched offline
  });

  test('connected success settles to "saved"', async () => {
    editor.connected = true;
    await editor.persist(async () => ({ ok: true, status: 200 }));
    expect(editor.saveState).toBe('saved');
    expect(editor.saveError).toBe(null);
  });

  test('connected failure raises the retry toast; retrySave re-fires the op', async () => {
    editor.connected = true;
    const retry = vi.fn();
    await editor.persist(async () => ({ ok: false, status: 500 }), retry);
    expect(editor.saveState).toBe('error');
    expect(editor.saveError).toMatch(/still here/i);
    expect(editor.canRetry).toBe(true);
    editor.retrySave();
    expect(retry).toHaveBeenCalledOnce();
    expect(editor.canRetry).toBe(false); // consumed

    editor.dismissError();
    expect(editor.saveError).toBe(null);
  });

  test('a create-style failure (no retry) shows the non-retryable message', async () => {
    editor.connected = true;
    await editor.persist(async () => ({ ok: false, status: 500 }));
    expect(editor.saveState).toBe('error');
    expect(editor.canRetry).toBe(false);
    expect(editor.saveError).toMatch(/check your connection/i);
  });

  test('an op that throws still settles (never hangs on "saving…")', async () => {
    editor.connected = true;
    const res = await editor.persist(async () => {
      throw new Error('network down');
    });
    expect(res.ok).toBe(false);
    expect(editor.saveState).toBe('error');
  });
});

describe('EditorState — demo / identity / tour lifecycle', () => {
  test('hydrateDemoIdentity overlays contacts onto the demo person', () => {
    editor.hydrateDemoIdentity({ firstName: 'Andrew', email: 'a@b.dev' });
    expect(editor.person.personal.firstName).toBe('Andrew');
    expect(editor.person.personal.email).toBe('a@b.dev');
  });

  test('resetDemo re-clones a pristine sample and announces it', async () => {
    const sec = experience();
    await editor.addEntry(sec);
    editor.dirty = true;
    editor.resetDemo();
    expect(editor.dirty).toBe(false);
    expect(editor.saveState).toBe('demo');
    expect(editor.undo.canUndo).toBe(false); // fresh objects → cleared history
    expect(editor.announce).toMatch(/back to its original/i);
  });

  test('resetDemo is a no-op when connected (real data to protect)', () => {
    editor.connected = true;
    editor.person.personal.firstName = 'REAL';
    editor.resetDemo();
    expect(editor.person.personal.firstName).toBe('REAL');
  });

  test('staging the tour in demo resets to the pristine sample', async () => {
    const sec = experience();
    await editor.addEntry(sec);
    const dirtyCount = sec.entries.length;
    editor.stageTour();
    expect(experience().entries.length).toBe(dirtyCount - 1); // reset dropped the added entry
  });

  test('exportJson is gated by noProfiles and runs offline without touching the backend', async () => {
    await editor.exportJson(); // demo: serializes client-side, download is a no-op in node
    // now simulate the connected-with-zero-profiles state — export must bail
    editor.connected = true;
    editor.persons = [];
    expect(editor.noProfiles).toBe(true);
    await expect(editor.exportJson()).resolves.toBeUndefined();
  });
});

describe('EditorState — connect() (api spied on the singleton)', () => {
  test('loads the newest profile and goes live', async () => {
    vi.spyOn(api, 'fetchActive').mockResolvedValue({
      ok: true,
      status: 200,
      data: { person: person({ id: 8, name: 'Ada' }), persons: [{ id: 8, name: 'Ada' }] },
    });
    await editor.connect();
    expect(editor.connected).toBe(true);
    expect(editor.activePersonId).toBe(8);
    expect(editor.persons).toEqual([{ id: 8, name: 'Ada' }]);
    expect(editor.saveState).toBe('saved');
    expect(editor.person.name).toBe('Ada');
  });

  test('a signed-in account with zero profiles enters the empty state', async () => {
    vi.spyOn(api, 'fetchActive').mockResolvedValue({
      ok: false,
      status: 404,
      error: { code: 'no_persons', message: '' },
    });
    await editor.connect();
    expect(editor.connected).toBe(true);
    expect(editor.noProfiles).toBe(true);
    expect(editor.person.sections).toHaveLength(0);
  });

  test('auth_required stays offline and raises the sign-in prompt', async () => {
    vi.spyOn(api, 'fetchActive').mockResolvedValue({
      ok: false,
      status: 403,
      error: { code: 'auth_required', message: '' },
    });
    await editor.connect();
    expect(editor.connected).toBe(false);
    expect(editor.connectError).toBe('signin');
  });

  test('a network error is classified via the health probe (reachable → signin, down → offline)', async () => {
    vi.spyOn(api, 'fetchActive').mockResolvedValue({
      ok: false,
      status: 0,
      error: { code: 'network_error', message: '' },
    });
    const health = vi.spyOn(api, 'health').mockResolvedValue({ ok: true, status: 200 });
    await editor.connect();
    expect(editor.connectError).toBe('signin'); // gateway up → just needs sign-in

    editor.connecting = false;
    health.mockResolvedValue({ ok: false, status: 0 });
    await editor.connect();
    expect(editor.connectError).toBe('offline'); // gateway down → real outage
  });
});

describe('EditorState — connected content CRUD (persist + reconcile / rollback)', () => {
  beforeEach(() => {
    editor.connected = true;
    editor.activePersonId = 7;
  });

  test('addEntry reconciles the temp id from the server and settles "saved"', async () => {
    vi.spyOn(api, 'createEntry').mockResolvedValue({ ok: true, status: 200, data: { id: 555 } });
    const sec = experience();
    await editor.addEntry(sec);
    expect(sec.entries.at(-1)!.id).toBe(555);
    expect(editor.saveState).toBe('saved');
  });

  test('addEntry rolls back the phantom and errors on a rejected create', async () => {
    vi.spyOn(api, 'createEntry').mockResolvedValue({ ok: false, status: 500 });
    const sec = experience();
    const before = sec.entries.length;
    await editor.addEntry(sec);
    expect(sec.entries.length).toBe(before);
    expect(editor.selection).toEqual({ kind: 'none' });
    expect(editor.saveState).toBe('error');
  });

  test('addSection reconciles the temp id', async () => {
    vi.spyOn(api, 'createSection').mockResolvedValue({ ok: true, status: 200, data: { id: 999 } });
    await editor.addSection('projects');
    expect(editor.person.sections.at(-1)!.id).toBe(999);
  });

  test('addBullet reconciles the temp id', async () => {
    vi.spyOn(api, 'createEntry').mockResolvedValue({ ok: true, status: 200, data: { id: 1 } });
    vi.spyOn(api, 'createItem').mockResolvedValue({ ok: true, status: 200, data: { id: 42 } });
    const sec = experience();
    await editor.addEntry(sec);
    const entry = sec.entries.at(-1)!;
    await editor.addBullet(entry);
    expect(entry.items.at(-1)!.id).toBe(42);
  });
});

describe('EditorState — profile CRUD + restore', () => {
  test('selectPerson fetches an uncached profile and activates it', async () => {
    editor.connected = true;
    editor.activePersonId = 1;
    vi.spyOn(api, 'fetchPerson').mockResolvedValue({
      ok: true,
      status: 200,
      data: person({ id: 9, name: 'Grace' }),
    });
    await editor.selectPerson(9);
    expect(editor.activePersonId).toBe(9);
    expect(editor.person.name).toBe('Grace');
  });

  test('addPerson creates a profile, appends it, and switches onto it', async () => {
    editor.connected = true;
    editor.persons = [{ id: 1, name: 'Ada' }];
    vi.spyOn(api, 'createPerson').mockResolvedValue({ ok: true, status: 200, data: { id: 20 } });
    vi.spyOn(api, 'fetchPerson').mockResolvedValue({
      ok: true,
      status: 200,
      data: person({ id: 20, name: 'New profile' }),
    });
    await editor.addPerson();
    expect(editor.persons.some((p) => p.id === 20)).toBe(true);
    expect(editor.activePersonId).toBe(20);
  });

  test('renamePerson updates the label and rolls back on failure', async () => {
    editor.connected = true;
    editor.persons = [{ id: 1, name: 'Old' }];
    const spy = vi.spyOn(api, 'renamePerson').mockResolvedValue({ ok: true, status: 200 });
    await editor.renamePerson(1, ' New ');
    expect(editor.persons[0].name).toBe('New');
    spy.mockResolvedValue({ ok: false, status: 500 });
    await editor.renamePerson(1, 'Newer');
    expect(editor.persons[0].name).toBe('New'); // rolled back
  });

  test('deletePerson removes a non-active profile and rolls back on failure', async () => {
    editor.connected = true;
    editor.activePersonId = 99; // deleting a different id → no reactivation branch
    editor.persons = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ];
    const spy = vi.spyOn(api, 'deletePerson').mockResolvedValue({ ok: true, status: 200 });
    await editor.deletePerson(1);
    expect(editor.persons.some((p) => p.id === 1)).toBe(false);

    editor.persons = [{ id: 3, name: 'C' }];
    spy.mockResolvedValue({ ok: false, status: 500 });
    await editor.deletePerson(3);
    expect(editor.persons.some((p) => p.id === 3)).toBe(true); // restored
  });

  test('restoreDocument swaps in a checkpoint, drops undo, and announces it', () => {
    editor.restoreDocument(person({ personal: { firstName: 'Snapshot' } }));
    expect(editor.person.personal.firstName).toBe('Snapshot');
    expect(editor.saveState).toBe('demo');
    expect(editor.undo.canUndo).toBe(false);
    expect(editor.announce).toMatch(/restored to the selected checkpoint/i);
  });

  test('applyEntryFrom cherry-restores one entry by id into its section', () => {
    const sec = experience();
    const source = person({
      sections: [
        {
          id: sec.id,
          type: 'experience',
          title: 'Experience',
          entries: [{ id: 88888, fields: { position: 'Restored' }, items: [], tags: [] }],
        },
      ],
    });
    const before = sec.entries.length;
    expect(editor.applyEntryFrom(source, 88888)).toBe(true);
    expect(sec.entries.some((e) => e.id === 88888)).toBe(true);
    expect(sec.entries.length).toBe(before + 1);
    expect(editor.applyEntryFrom(source, 404)).toBe(false); // absent id
  });

  test('reloadActive drops the cache and re-activates the server copy', async () => {
    editor.connected = true;
    editor.activePersonId = 5;
    vi.spyOn(api, 'fetchPerson').mockResolvedValue({
      ok: true,
      status: 200,
      data: person({ id: 5, name: 'Reloaded' }),
    });
    await editor.reloadActive();
    expect(editor.person.name).toBe('Reloaded');
  });
});
