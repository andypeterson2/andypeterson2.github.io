import { describe, test, expect } from 'vitest';
import { FieldShadow } from '../src/editor/lib/undo';
import { ProfileCache } from '../src/editor/lib/profile-cache';
import { createDemoPerson } from '../src/editor/lib/demo';

/**
 * FieldShadow and ProfileCache were pulled out of the 983-line store (round-two
 * item 19): the field-shadow was duplicated in the store AND the letter
 * controller, and neither concept was directly testable while buried in a runes
 * module. Now they are.
 */
describe('FieldShadow', () => {
  test('uid is stable per object and distinct across objects', () => {
    const s = new FieldShadow();
    const a = {};
    const b = {};
    expect(s.uid(a)).toBe(s.uid(a));
    expect(s.uid(a)).not.toBe(s.uid(b));
  });

  test('diff seeds an unseen object (no change), then tracks the edit, then advances', () => {
    const s = new FieldShadow();
    const f = { position: 'Engineer' };
    expect(s.diff(f, f)).toBeNull(); // first sight: baseline set, nothing to report
    f.position = 'Chief';
    expect(s.diff(f, f)).toEqual({ key: 'position', old: 'Engineer', next: 'Chief' });
    expect(s.diff(f, f)).toBeNull(); // baseline advanced — no further change
  });

  test('patch keeps the baseline in step, so a command write is not seen as a new edit', () => {
    const s = new FieldShadow();
    const f = { x: 'new' };
    s.seed(f, f);
    s.patch(f, 'x', 'old'); // undo wrote 'old' back
    f.x = 'old';
    expect(s.diff(f, f)).toBeNull();
  });

  test('reseat baselines a whole document — every field starts unchanged', () => {
    const s = new FieldShadow();
    const p = createDemoPerson();
    const style: Record<string, string> = { accentColor: 'spinel' };
    s.reseat(p, style);

    const entry = p.sections.find((x) => x.type === 'experience')!.entries[0];
    expect(s.diff(entry, entry.fields)).toBeNull(); // seeded by reseat
    entry.fields.position = 'Changed';
    expect(s.diff(entry, entry.fields)?.key).toBe('position');

    // personal + style + bullets are seeded too
    expect(s.diff(p.personal, p.personal as Record<string, string>)).toBeNull();
    expect(s.diff(style, style)).toBeNull();
    const bullet = entry.items[0];
    expect(s.diff(bullet, { title: bullet.title ?? '', content: bullet.content })).toBeNull();
  });

  test('is identity-keyed — two equal objects shadow separately', () => {
    const s = new FieldShadow();
    const a = { body: 'x' };
    const b = { body: 'x' };
    s.seed(a, a);
    a.body = 'y';
    expect(s.diff(a, a)?.next).toBe('y');
    expect(s.diff(b, b)).toBeNull(); // b was never seeded — its own baseline
  });
});

describe('ProfileCache', () => {
  test('round-trips a working tree by id and drops it', () => {
    const c = new ProfileCache();
    const p = createDemoPerson();
    expect(c.get(7)).toBeUndefined();
    c.set(7, p);
    expect(c.get(7)).toBe(p); // the SAME reference back (the reused, edited proxy)
    c.drop(7);
    expect(c.get(7)).toBeUndefined();
  });
});
