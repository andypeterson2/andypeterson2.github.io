import { describe, test, expect } from 'vitest';
import { enabledItems, stepIndex, type MenuDef } from '../src/editor/lib/menus';

const menu = (...disabled: boolean[]): MenuDef => ({
  title: 'File',
  items: disabled.map((d, i) => ({ label: `item${i}`, onSelect: () => {}, disabled: d })),
});

describe('enabledItems', () => {
  test('skips disabled items', () => {
    expect(enabledItems(menu(false, true, false))).toEqual([0, 2]);
  });

  test('an all-disabled menu has nowhere to land', () => {
    expect(enabledItems(menu(true, true))).toEqual([]);
  });

  test('an empty menu has nowhere to land', () => {
    expect(enabledItems({ title: 'Edit', items: [] })).toEqual([]);
  });
});

describe('stepIndex — roving focus', () => {
  const pool = [0, 2, 5];

  test('steps forward and backward through selectable indices only', () => {
    expect(stepIndex(pool, 0, 1)).toBe(2);
    expect(stepIndex(pool, 2, 1)).toBe(5);
    expect(stepIndex(pool, 5, -1)).toBe(2);
  });

  test('wraps at both ends', () => {
    expect(stepIndex(pool, 5, 1)).toBe(0);
    expect(stepIndex(pool, 0, -1)).toBe(5);
  });

  test('nothing focused yet (-1) enters from the matching end', () => {
    expect(stepIndex(pool, -1, 1)).toBe(0);
    expect(stepIndex(pool, -1, -1)).toBe(5);
  });

  test('a `from` outside the pool enters from the matching end', () => {
    // e.g. focus sat on a disabled item, or on nothing at all
    expect(stepIndex(pool, 3, 1)).toBe(0);
    expect(stepIndex(pool, 3, -1)).toBe(5);
  });

  test('an empty pool has no next index', () => {
    expect(stepIndex([], 0, 1)).toBeNull();
    expect(stepIndex([], -1, -1)).toBeNull();
  });

  test('a single selectable index always returns itself', () => {
    expect(stepIndex([4], 4, 1)).toBe(4);
    expect(stepIndex([4], 4, -1)).toBe(4);
  });
});
