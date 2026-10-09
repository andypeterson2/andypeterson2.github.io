// @vitest-environment jsdom
import { describe, test, expect, beforeEach } from 'vitest';
import { symbols } from '../src/editor/lib/symbol-input.svelte';

/** A focusin event aimed at `el`, as the editor root's handler would see it. */
const focusin = (el: EventTarget) => ({ target: el }) as unknown as FocusEvent;

beforeEach(() => {
  symbols.close();
  document.body.innerHTML = '';
});

// The symbols palette's shared state: one open flag for the editor, and one record
// of the field a glyph lands in. Each test starts from a closed palette.
describe('the symbols palette state', () => {
  test('starts closed, toggles, and closes again', () => {
    expect(symbols.open).toBe(false);
    symbols.toggle();
    expect(symbols.open).toBe(true);
    symbols.toggle();
    expect(symbols.open).toBe(false);

    symbols.toggle();
    symbols.close();
    expect(symbols.open).toBe(false);
  });

  test('a glyph lands at the caret of the field that had focus', () => {
    const input = document.createElement('input');
    input.value = 'alpha beta';
    document.body.appendChild(input);
    input.setSelectionRange(5, 5);

    symbols.track(focusin(input));
    symbols.insert('Ω');

    expect(input.value).toBe('alphaΩ beta');
    // Focus goes back to the field, so typing carries on where it left off.
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(6);
  });

  test('a glyph replaces whatever was selected', () => {
    const area = document.createElement('textarea');
    area.value = 'keep THIS keep';
    document.body.appendChild(area);
    area.setSelectionRange(5, 9);

    symbols.track(focusin(area));
    symbols.insert('→');
    expect(area.value).toBe('keep → keep');
  });

  test('inserting fires input, so autosave and bind:value see it', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    let fired = 0;
    input.addEventListener('input', () => {
      fired += 1;
    });

    symbols.track(focusin(input));
    symbols.insert('≤');
    expect(fired).toBe(1);
  });

  test('a focus that is not a text field is not remembered', () => {
    const input = document.createElement('input');
    input.value = 'text';
    document.body.appendChild(input);
    symbols.track(focusin(input));

    // Focus moves to a button — the palette keeps aiming at the field it knows.
    const button = document.createElement('button');
    document.body.appendChild(button);
    symbols.track(focusin(button));

    symbols.insert('Ω');
    expect(input.value).toBe('textΩ');
  });
});
