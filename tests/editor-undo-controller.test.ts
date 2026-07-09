import { describe, test, expect } from 'vitest';
import { UndoController } from '../src/editor/lib/undo.svelte';

/**
 * The first unit test of a `.svelte.ts` runes module (round-two item 17): the
 * svelte vitest plugin now compiles $state/$derived, so the reactive "shell" tier
 * is testable instead of e2e-only. UndoController is the ideal proof — its scope
 * stash/restore and the `applying` re-entrancy guard are load-bearing for
 * per-profile undo, and were unverifiable at the unit level when they were built.
 */
function make() {
  const announced: string[] = [];
  const c = new UndoController({ announce: (m) => announced.push(m) });
  return { c, announced };
}
const cmd = (over: Partial<Parameters<UndoController['record']>[0]> = {}) => ({
  label: 'x',
  undo: () => {},
  redo: () => {},
  ...over,
});

describe('UndoController — record / undo / redo', () => {
  test('$derived reacts: record makes undo available and labels it', () => {
    const { c } = make();
    expect(c.canUndo).toBe(false);
    c.record(cmd({ label: 'Position' }));
    expect(c.canUndo).toBe(true);
    expect(c.undoLabel).toBe('Position');
    expect(c.canRedo).toBe(false);
    expect(c.depth).toBe(1);
  });

  test('undo runs the inverse and moves the command to redo; redo restores', async () => {
    const { c, announced } = make();
    let v = 'new';
    c.record(
      cmd({
        undo: () => {
          v = 'old';
        },
        redo: () => {
          v = 'new';
        },
      }),
    );
    await c.undo();
    expect(v).toBe('old');
    expect(c.canUndo).toBe(false);
    expect(c.canRedo).toBe(true);
    await c.redo();
    expect(v).toBe('new');
    expect(c.canUndo).toBe(true);
    expect(announced.some((m) => /undid/i.test(m))).toBe(true);
  });

  test('a fresh action forks history — the redo branch is dropped', async () => {
    const { c } = make();
    c.record(cmd({ label: 'a' }));
    await c.undo();
    expect(c.canRedo).toBe(true);
    c.record(cmd({ label: 'b' }));
    expect(c.canRedo).toBe(false);
  });
});

describe('UndoController — the invariants that were e2e-only', () => {
  test('an inverse that records is ignored, so the stack drains', async () => {
    // `applying` guards record() during an inverse; without it undo would push a
    // new command and never empty.
    const { c } = make();
    c.record(
      cmd({
        undo: () => c.record(cmd({ label: 'sneaky' })),
      }),
    );
    await c.undo();
    expect(c.canUndo).toBe(false);
    expect(c.canRedo).toBe(true);
  });

  test('records sharing a mergeKey coalesce into one command', () => {
    const { c } = make();
    c.record(cmd({ label: 'a', mergeKey: 'k' }));
    c.record(cmd({ label: 'b', mergeKey: 'k' }));
    expect(c.depth).toBe(1);
  });
});

describe('UndoController — per-profile scopes (item behind the profile-switch feature)', () => {
  test('each scope keeps its own history, restored on return', () => {
    const { c } = make(); // starts in the default 'demo' scope
    c.record(cmd({ label: 'A-edit' }));

    c.setScope('p7');
    expect(c.canUndo).toBe(false); // a first-seen scope is empty
    c.record(cmd({ label: 'B-edit' }));
    expect(c.undoLabel).toBe('B-edit');

    c.setScope('demo'); // back to where we started
    expect(c.canUndo).toBe(true);
    expect(c.undoLabel).toBe('A-edit'); // its history survived the trip

    c.setScope('p7');
    expect(c.undoLabel).toBe('B-edit'); // and so did p7's
  });

  test('dropScope forgets a profile’s history (deleted person)', () => {
    const { c } = make();
    c.record(cmd());
    c.dropScope('demo'); // the current scope
    expect(c.canUndo).toBe(false);
  });

  test('clear empties only the current scope', () => {
    const { c } = make();
    c.record(cmd({ label: 'A' }));
    c.setScope('p7');
    c.record(cmd({ label: 'B' }));
    c.clear(); // clears p7
    expect(c.canUndo).toBe(false);
    c.setScope('demo');
    expect(c.undoLabel).toBe('A'); // demo untouched
  });
});
