// @vitest-environment jsdom
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { autogrow } from '../src/editor/lib/autogrow';

/** A textarea whose scrollHeight answers from a value the test controls. */
function field(height: () => number) {
  const el = document.createElement('textarea');
  Object.defineProperty(el, 'scrollHeight', { get: height, configurable: true });
  document.body.appendChild(el);
  return el;
}

let observed: HTMLElement[];
let fire: (width: number) => void;

beforeEach(() => {
  document.body.innerHTML = '';
  observed = [];
  // jsdom ships no ResizeObserver; this one hands the test the callback.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private cb: (entries: { contentRect: { width: number } }[]) => void) {
        fire = (width) => {
          this.cb([{ contentRect: { width } }]);
        };
      }
      observe(el: HTMLElement) {
        observed.push(el);
      }
      disconnect() {
        observed = [];
      }
    },
  );
});

// The textarea that is always as tall as its text. jsdom lays nothing out, so each
// test drives scrollHeight itself: what is pinned here is when the action measures.
describe('autogrow', () => {
  test('sizes the field to its text as soon as it mounts', () => {
    const el = field(() => 120);
    autogrow(el);
    expect(el.style.height).toBe('120px');
  });

  test('re-measures as the profile types', () => {
    let tall = 40;
    const el = field(() => tall);
    autogrow(el);
    expect(el.style.height).toBe('40px');

    tall = 90;
    el.dispatchEvent(new Event('input'));
    expect(el.style.height).toBe('90px');
  });

  test('a width change re-wraps the text, so it measures again', () => {
    let tall = 40;
    const el = field(() => tall);
    autogrow(el);
    expect(observed).toEqual([el]);

    tall = 200;
    fire(300);
    expect(el.style.height).toBe('200px');

    // The same width again is the height this action just set coming back round.
    tall = 999;
    fire(300);
    expect(el.style.height).toBe('200px');
  });

  test('a value that arrives from undo waits a frame before measuring', () => {
    let tall = 40;
    const el = field(() => tall);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    const action = autogrow(el);

    tall = 300;
    action.update();
    // Measuring now would read the height the old text needed.
    expect(el.style.height).toBe('40px');
    frames.forEach((cb) => {
      cb(0);
    });
    expect(el.style.height).toBe('300px');
  });

  test('destroy lets the field go', () => {
    let tall = 40;
    const el = field(() => tall);
    const action = autogrow(el);
    action.destroy();

    tall = 500;
    el.dispatchEvent(new Event('input'));
    expect(el.style.height).toBe('40px');
    expect(observed).toEqual([]);
  });
});
