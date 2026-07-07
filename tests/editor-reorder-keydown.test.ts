/**
 * Unit tests for keyboard reordering (src/editor/lib/sortable.ts#reorderKeydown).
 * Alt+Arrow/Home/End moves a focused item; anything else is left for the caller.
 */
import { describe, test, expect } from 'vitest';
import { reorderKeydown } from '../src/editor/lib/sortable';

type Mods = { altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean };
function keyEvent(key: string, mods: Mods = {}) {
  const e = {
    key,
    altKey: mods.altKey ?? false,
    ctrlKey: mods.ctrlKey ?? false,
    metaKey: mods.metaKey ?? false,
    shiftKey: mods.shiftKey ?? false,
    prevented: false,
    preventDefault() {
      this.prevented = true;
    },
  };
  return e as unknown as KeyboardEvent & { prevented: boolean };
}

/** Run the handler, capturing any (from,to) move it requests. */
function run(key: string, index: number, length: number, mods: Mods = {}) {
  const moves: Array<[number, number]> = [];
  const e = keyEvent(key, mods);
  const handled = reorderKeydown(e, index, length, (f, t) => moves.push([f, t]));
  return { handled, moves, prevented: e.prevented };
}

describe('reorderKeydown', () => {
  test('ignores keys without the Alt modifier (caller handles them)', () => {
    const r = run('ArrowDown', 0, 3, { altKey: false });
    expect(r.handled).toBe(false);
    expect(r.moves).toEqual([]);
    expect(r.prevented).toBe(false);
  });

  test('ignores Alt combined with another modifier', () => {
    for (const mods of [
      { altKey: true, ctrlKey: true },
      { altKey: true, metaKey: true },
      { altKey: true, shiftKey: true },
    ]) {
      expect(run('ArrowDown', 0, 3, mods).handled).toBe(false);
    }
  });

  test('ignores non-reorder keys even with Alt', () => {
    expect(run('ArrowLeft', 0, 3, { altKey: true }).handled).toBe(false);
    expect(run('a', 0, 3, { altKey: true }).handled).toBe(false);
  });

  test('Alt+ArrowDown / ArrowUp move by one and preventDefault', () => {
    const down = run('ArrowDown', 0, 3, { altKey: true });
    expect(down.moves).toEqual([[0, 1]]);
    expect(down.handled).toBe(true);
    expect(down.prevented).toBe(true);

    expect(run('ArrowUp', 2, 3, { altKey: true }).moves).toEqual([[2, 1]]);
  });

  test('clamps at the ends — consumed but no move', () => {
    const top = run('ArrowUp', 0, 3, { altKey: true });
    expect(top.handled).toBe(true); // consumed so the page does not scroll
    expect(top.moves).toEqual([]);

    const bottom = run('ArrowDown', 2, 3, { altKey: true });
    expect(bottom.handled).toBe(true);
    expect(bottom.moves).toEqual([]);
  });

  test('Alt+Home / End jump to the first / last position', () => {
    expect(run('Home', 2, 3, { altKey: true }).moves).toEqual([[2, 0]]);
    expect(run('End', 0, 3, { altKey: true }).moves).toEqual([[0, 2]]);
    // Already at the end → no move.
    expect(run('Home', 0, 3, { altKey: true }).moves).toEqual([]);
  });
});
