import { describe, test, expect } from 'vitest';
import {
  canMerge,
  fieldDiff,
  humanize,
  merge,
  patchShadow,
  pushCommand,
  seedShadow,
  COALESCE_MS,
  MAX_DEPTH,
  type Shadow,
  type UndoCommand,
} from '../src/editor/lib/undo';

const noop = () => {};
const cmd = (over: Partial<UndoCommand> = {}): UndoCommand => ({
  label: 'Edit',
  at: 1000,
  undo: noop,
  redo: noop,
  ...over,
});

describe('coalescing — typing undoes as a burst, not a character', () => {
  test('same mergeKey inside the window merges', () => {
    const top = cmd({ mergeKey: 'entry:1:position', at: 1000 });
    const next = cmd({ mergeKey: 'entry:1:position', at: 1000 + COALESCE_MS - 1 });
    expect(canMerge(top, next)).toBe(true);
  });

  test('a pause past the window starts a new command', () => {
    const top = cmd({ mergeKey: 'entry:1:position', at: 1000 });
    const next = cmd({ mergeKey: 'entry:1:position', at: 1000 + COALESCE_MS + 1 });
    expect(canMerge(top, next)).toBe(false);
  });

  test('a different field never merges, however fast the typing', () => {
    const top = cmd({ mergeKey: 'entry:1:position', at: 1000 });
    expect(canMerge(top, cmd({ mergeKey: 'entry:1:organization', at: 1001 }))).toBe(false);
    // …nor does the same field on a different object
    expect(canMerge(top, cmd({ mergeKey: 'entry:2:position', at: 1001 }))).toBe(false);
  });

  test('a command with no mergeKey (a delete, a reorder) never merges', () => {
    expect(canMerge(cmd({ mergeKey: 'k' }), cmd({ at: 1001 }))).toBe(false);
    expect(canMerge(cmd(), cmd({ mergeKey: 'k', at: 1001 }))).toBe(false);
  });

  test('nothing merges into an empty stack', () => {
    expect(canMerge(undefined, cmd({ mergeKey: 'k' }))).toBe(false);
  });

  test('merging keeps the OLDER undo and the NEWER redo', () => {
    // Undoing a typed word must restore what preceded the word, not the last keystroke.
    const firstUndo = () => 'was-empty';
    const latestRedo = () => 'is-hello';
    const top = cmd({ mergeKey: 'k', at: 1000, undo: firstUndo, redo: () => 'is-h' });
    const next = cmd({ mergeKey: 'k', at: 1100, undo: () => 'is-hell', redo: latestRedo });
    const merged = merge(top, next);
    expect(merged.undo).toBe(firstUndo);
    expect(merged.redo).toBe(latestRedo);
    expect(merged.at).toBe(1100);
  });
});

describe('pushCommand', () => {
  test('coalesces onto the top rather than growing the stack', () => {
    const stack = [cmd({ mergeKey: 'k', at: 1000 })];
    const out = pushCommand(stack, cmd({ mergeKey: 'k', at: 1200 }));
    expect(out).toHaveLength(1);
    expect(out[0].at).toBe(1200);
  });

  test('appends when the commands are unrelated', () => {
    const out = pushCommand([cmd({ mergeKey: 'a' })], cmd({ mergeKey: 'b', at: 1001 }));
    expect(out).toHaveLength(2);
  });

  test('drops the oldest beyond MAX_DEPTH, keeping the newest', () => {
    let stack: UndoCommand[] = [];
    for (let i = 0; i < MAX_DEPTH + 10; i += 1) {
      stack = pushCommand(stack, cmd({ label: `c${i}`, at: i * 5000 }));
    }
    expect(stack).toHaveLength(MAX_DEPTH);
    expect(stack[0].label).toBe('c10');
    expect(stack[stack.length - 1].label).toBe(`c${MAX_DEPTH + 9}`);
  });

  test('does not mutate the stack it was handed', () => {
    const stack = [cmd()];
    pushCommand(stack, cmd({ at: 9999 }));
    expect(stack).toHaveLength(1);
  });
});

describe('the field shadow — recovering an old value the store never saw', () => {
  test('an unseeded object is seeded and reports no change', () => {
    // We cannot invent a previous value we never observed.
    const shadow: Shadow = new WeakMap();
    const entry = { position: 'Engineer' };
    expect(fieldDiff(shadow, entry, entry)).toBeNull();
    expect(shadow.get(entry)).toEqual({ position: 'Engineer' });
  });

  test('reports the changed key and what it held before', () => {
    const shadow: Shadow = new WeakMap();
    const fields = { position: 'Engineer', org: 'Acme' };
    seedShadow(shadow, fields, fields);
    fields.position = 'Chief Tinkerer';
    expect(fieldDiff(shadow, fields, fields)).toEqual({
      key: 'position',
      old: 'Engineer',
      next: 'Chief Tinkerer',
    });
  });

  test('advances the shadow, so the next diff compares against the new value', () => {
    const shadow: Shadow = new WeakMap();
    const fields = { position: 'a' };
    seedShadow(shadow, fields, fields);
    fields.position = 'ab';
    fieldDiff(shadow, fields, fields);
    fields.position = 'abc';
    expect(fieldDiff(shadow, fields, fields)).toEqual({ key: 'position', old: 'ab', next: 'abc' });
  });

  test('no change reports null and leaves the shadow alone', () => {
    const shadow: Shadow = new WeakMap();
    const fields = { position: 'a' };
    seedShadow(shadow, fields, fields);
    expect(fieldDiff(shadow, fields, fields)).toBeNull();
  });

  test('treats undefined and empty string as the same absence', () => {
    const shadow: Shadow = new WeakMap();
    const fields: Record<string, string | undefined> = { title: undefined };
    seedShadow(shadow, fields, fields);
    fields.title = '';
    expect(fieldDiff(shadow, fields, fields)).toBeNull();
  });

  test('patchShadow keeps the shadow in step when a command writes a value back', () => {
    // Without this, the very next keystroke would record a bogus "old" value.
    const shadow: Shadow = new WeakMap();
    const fields = { position: 'new' };
    seedShadow(shadow, fields, fields);
    patchShadow(shadow, fields, 'position', 'old');
    fields.position = 'old';
    expect(fieldDiff(shadow, fields, fields)).toBeNull();
  });

  test('patchShadow on an unseeded object is a harmless no-op', () => {
    expect(() => patchShadow(new WeakMap(), {}, 'k', 'v')).not.toThrow();
  });

  test('is keyed by identity, so two equal objects shadow separately', () => {
    // Ids churn when an undone delete re-creates the row; identities do not.
    const shadow: Shadow = new WeakMap();
    const a = { body: 'x' };
    const b = { body: 'x' };
    seedShadow(shadow, a, a);
    expect(shadow.get(b)).toBeUndefined();
  });
});

describe('humanize — the Edit menu label', () => {
  test('splits camelCase and sentence-cases it', () => {
    expect(humanize('firstName')).toBe('First name');
    expect(humanize('position')).toBe('Position');
    expect(humanize('recipientAddress')).toBe('Recipient address');
  });

  test('handles separators and empties', () => {
    expect(humanize('photo_file')).toBe('Photo file');
    expect(humanize('')).toBe('Edit');
  });
});
