import { vi, describe, test, expect, beforeEach } from 'vitest';

// No api mock is needed: every demo-mode path is local (connected === false skips
// the network), the save-state machine is driven through the public `persist(op)`
// with a hand-rolled op, and export only reaches the pure `tex()` — so nothing in
// this file makes a real network call, and the real `api`/`export` modules load fine.
import { editor } from '../src/editor/lib/store.svelte';
import type { Section } from '../src/editor/lib/types';

const experience = (): Section =>
  editor.person.sections.find((s) => s.type === 'experience') ?? editor.person.sections[0];

// The store is a singleton; resetDemo() re-clones the pristine sample and clears
// undo/selection/save state, giving each test a clean, isolated document.
beforeEach(() => {
  editor.connected = false;
  editor.persons = [];
  editor.activePersonId = null;
  editor.saveError = null;
  editor.retryOp = null;
  editor.resetDemo();
});

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
