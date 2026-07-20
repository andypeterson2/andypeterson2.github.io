import { vi, describe, test, expect } from 'vitest';
import { resolveAccent, ACCENT_COLORS } from '../src/editor/lib/accent';
import { insertAtCaret } from '../src/editor/lib/caret';

const INK = '#1c1b19';

describe('resolveAccent', () => {
  test('resolves a palette key to its hex', () => {
    expect(resolveAccent('spinel', '')).toBe('#b21f5c');
    expect(resolveAccent('awesome-emerald', '')).toBe('#00a388');
  });

  test('custom + a valid 6-digit hex returns it (trimmed)', () => {
    expect(resolveAccent('custom', '#abcdef')).toBe('#abcdef');
    expect(resolveAccent('custom', '  #ABCDEF ')).toBe('#ABCDEF');
  });

  test('custom + an invalid hex falls back to ink', () => {
    expect(resolveAccent('custom', 'not-a-hex')).toBe(INK);
    expect(resolveAccent('custom', '#fff')).toBe(INK); // 3-digit is rejected
    expect(resolveAccent('custom', '')).toBe(INK);
  });

  test('an unknown palette key falls back to ink', () => {
    expect(resolveAccent('bogus', '')).toBe(INK);
  });

  test('the palette has all nine Awesome-CV accents, keyed and labelled', () => {
    expect(ACCENT_COLORS).toHaveLength(9);
    expect(ACCENT_COLORS.map((c) => c.key)).toContain('spinel');
    expect(ACCENT_COLORS.every((c) => /^#[0-9a-f]{6}$/i.test(c.hex) && c.label)).toBe(true);
  });
});

// A minimal stand-in for an <input>/<textarea>: insertAtCaret only touches
// value / selectionStart / selectionEnd / focus / setSelectionRange / dispatchEvent.
function makeField(value: string, start: number | null, end: number | null) {
  const events: Event[] = [];
  const el = {
    value,
    selectionStart: start,
    selectionEnd: end,
    focus: vi.fn(),
    setSelectionRange: vi.fn((s: number, e: number) => {
      el.selectionStart = s;
      el.selectionEnd = e;
    }),
    dispatchEvent: vi.fn((ev: Event) => {
      events.push(ev);
      return true;
    }),
  };
  return { el, events };
}

describe('insertAtCaret', () => {
  test('replaces the selection, advances the caret, and fires an input event', () => {
    const { el, events } = makeField('hello world', 0, 5); // "hello" selected
    insertAtCaret(el as unknown as HTMLInputElement, 'HI');
    expect(el.value).toBe('HI world');
    expect(el.selectionStart).toBe(2); // caret sits just past the insert
    expect(el.selectionEnd).toBe(2);
    expect(el.focus).toHaveBeenCalled();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('input');
    expect((events[0] as Event).bubbles).toBe(true);
  });

  test('with no selection, appends at the end', () => {
    const { el } = makeField('abc', null, null);
    insertAtCaret(el as unknown as HTMLInputElement, 'Z');
    expect(el.value).toBe('abcZ');
    expect(el.selectionStart).toBe(4);
  });

  test('inserts a glyph into the middle at the caret', () => {
    const { el } = makeField('ab', 1, 1); // caret between a and b
    insertAtCaret(el as unknown as HTMLInputElement, '→');
    expect(el.value).toBe('a→b');
  });
});
