import { describe, test, expect } from 'vitest';
import { sleep, tourIntent, typeText, DWELL_MS, TYPE_MS } from '../src/editor/lib/tour';

/**
 * The guided tour's pure core. The reactive shell (tour.svelte.ts) is exercised
 * by the e2e suite; what's pinned here is the part with actual decisions in it —
 * above all the interrupt rule, which is the tour's signature interaction.
 */
describe('tourIntent — who has the wheel', () => {
  test("the tour's own controls are never an interruption", () => {
    expect(tourIntent({ type: 'pointerdown', insideTour: true })).toBe('ignore');
    expect(tourIntent({ type: 'keydown', key: 'Enter', insideTour: true })).toBe('ignore');
    expect(tourIntent({ type: 'keydown', key: ' ', insideTour: true })).toBe('ignore');
  });

  test('a click or a scroll anywhere else yields control immediately', () => {
    expect(tourIntent({ type: 'pointerdown' })).toBe('yield');
    expect(tourIntent({ type: 'wheel' })).toBe('yield');
  });

  test('Escape ends the tour; Space toggles it', () => {
    expect(tourIntent({ type: 'keydown', key: 'Escape' })).toBe('end');
    expect(tourIntent({ type: 'keydown', key: ' ' })).toBe('toggle');
    expect(tourIntent({ type: 'keydown', key: 'Spacebar' })).toBe('toggle');
  });

  test('in a text field, Space is a character — so it yields rather than toggling', () => {
    expect(tourIntent({ type: 'keydown', key: ' ', editable: true })).toBe('yield');
  });

  test('any other keystroke means the visitor started driving', () => {
    for (const key of ['a', 'Tab', 'ArrowDown', 'Backspace', 'Enter']) {
      expect(tourIntent({ type: 'keydown', key })).toBe('yield');
    }
  });

  test('a bare modifier is not intent — nobody takes the wheel by pressing Shift', () => {
    for (const key of ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']) {
      expect(tourIntent({ type: 'keydown', key })).toBe('ignore');
    }
  });
});

describe('sleep', () => {
  test('resolves false when it runs to term', async () => {
    expect(await sleep(1, new AbortController().signal)).toBe(false);
  });

  test('resolves true at once when the signal is already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    expect(await sleep(60_000, ac.signal)).toBe(true); // would hang if the guard were missing
  });

  test('resolves true when aborted mid-wait', async () => {
    const ac = new AbortController();
    const pending = sleep(60_000, ac.signal);
    ac.abort();
    expect(await pending).toBe(true);
  });
});

describe('typeText', () => {
  test('types one character at a time, in order', async () => {
    const frames: string[] = [];
    await typeText('abc', (p) => frames.push(p), new AbortController().signal, 0);
    expect(frames).toEqual(['abc']); // perChar 0 → instant, one frame
  });

  test('emits a frame per character when given a cadence', async () => {
    const frames: string[] = [];
    await typeText('abcd', (p) => frames.push(p), new AbortController().signal, 1);
    expect(frames).toEqual(['a', 'ab', 'abc', 'abcd']);
  });

  test('abandons mid-word the moment it is aborted, leaving the partial text', async () => {
    const ac = new AbortController();
    const frames: string[] = [];
    const pending = typeText(
      'a long sentence that will never finish',
      (p) => {
        frames.push(p);
        if (frames.length === 3) ac.abort(); // the visitor grabbed the wheel
      },
      ac.signal,
      1,
    );
    await pending;
    expect(frames).toHaveLength(3);
    expect(frames.at(-1)).toBe('a l');
  });

  test('writes nothing when aborted before it starts', async () => {
    const ac = new AbortController();
    ac.abort();
    const frames: string[] = [];
    await typeText('abc', (p) => frames.push(p), ac.signal, 1);
    expect(frames).toEqual([]);
  });
});

describe('motion tokens', () => {
  test('dwell leaves time to read a caption; typing is at human speed', () => {
    expect(DWELL_MS).toBeGreaterThanOrEqual(2000);
    expect(TYPE_MS).toBeGreaterThan(0);
    expect(TYPE_MS).toBeLessThan(100);
  });
});
