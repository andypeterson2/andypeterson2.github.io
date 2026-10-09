// @vitest-environment jsdom
import { describe, test, expect, beforeEach } from 'vitest';
import { holdModal, modal } from '../src/editor/lib/modal';

/** A page with an opener button outside the panel and two buttons inside it. */
function page() {
  document.body.innerHTML = `
    <div class="page">
      <button id="opener">Open</button>
      <p id="prose">Behind the panel.</p>
    </div>
    <div class="panel" tabindex="-1">
      <button id="first">First</button>
      <button id="last">Last</button>
    </div>`;
  const id = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;
  return {
    panel: id<HTMLDivElement>('.panel'),
    behind: id<HTMLDivElement>('.page'),
    opener: id<HTMLButtonElement>('#opener'),
    first: id<HTMLButtonElement>('#first'),
    last: id<HTMLButtonElement>('#last'),
  };
}

// jsdom lays nothing out, so every element reports no client rects and the focus
// trap would find no tab stops. One rect each is enough to make them "visible".
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'getClientRects', {
    configurable: true,
    value: () => [{ width: 10, height: 10 }],
  });
});

// The in-page modal: the page goes inert, Tab wraps inside the panel, and
// releasing gives the page and the caller's focus back.
describe('holdModal', () => {
  test('everything outside the panel goes inert, and comes back on release', () => {
    const { panel, behind } = page();
    const release = holdModal(panel);
    expect(behind.inert).toBe(true);
    // Never set on the panel itself — jsdom leaves it undefined until something assigns.
    expect(panel.inert).toBeFalsy();

    release();
    expect(behind.inert).toBe(false);
  });

  test('focus moves into the panel and returns to whoever opened it', () => {
    const { panel, opener, first } = page();
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const release = holdModal(panel, first);
    expect(document.activeElement).toBe(first);

    release();
    expect(document.activeElement).toBe(opener);
  });

  test('Tab off the last stop wraps to the first', () => {
    const { panel, first, last } = page();
    holdModal(panel);
    last.focus();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
    expect(document.activeElement).toBe(first);
  });

  test('Shift-Tab off the first stop wraps to the last', () => {
    const { panel, first, last } = page();
    holdModal(panel);
    first.focus();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(last);
  });

  test('any other key is left alone', () => {
    const { panel, last } = page();
    holdModal(panel);
    last.focus();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', cancelable: true }));
    expect(document.activeElement).toBe(last);
  });

  test('a released modal stops trapping Tab', () => {
    const { panel, first, last } = page();
    const release = holdModal(panel);
    release();
    last.focus();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
    expect(document.activeElement).toBe(last);
    expect(document.activeElement).not.toBe(first);
  });

  test('a panel with nothing to focus takes the focus itself', () => {
    document.body.innerHTML = `<div class="page"></div><div class="panel" tabindex="-1"></div>`;
    const panel = document.querySelector<HTMLDivElement>('.panel')!;
    holdModal(panel);
    expect(document.activeElement).toBe(panel);

    // No stops, so Tab has nowhere to wrap to and the browser keeps it.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
    expect(document.activeElement).toBe(panel);
  });
});

describe('the Svelte action form', () => {
  test('focuses what the selector names, and destroy releases the page', () => {
    const { panel, behind, first } = page();
    const action = modal(panel, '#first');
    expect(document.activeElement).toBe(first);
    expect(behind.inert).toBe(true);

    action.destroy();
    expect(behind.inert).toBe(false);
  });
});
