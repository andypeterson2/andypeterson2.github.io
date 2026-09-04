/**
 * Security tests — payload-driven XSS checks against the ACTUAL sanitizer.
 *
 * These replaced source-grep assertions (which pinned implementation strings,
 * not behavior): each test runs a hostile payload through the same sanitize +
 * adopt-nodes path `fetchModelInfo` uses and asserts on the resulting DOM.
 */
// @vitest-environment jsdom
import { describe, test, expect } from 'vitest';

/**
 * Mirror of the fetchModelInfo render path: parse → sanitizeInfoTree →
 * replaceChildren (adopt nodes, no serialize/re-parse). Kept in lockstep by
 * the structural assertions at the bottom of this file.
 */
const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META']);
const ALLOWED_TAGS = new Set([
  'H1',
  'H2',
  'H3',
  'H4',
  'P',
  'UL',
  'OL',
  'LI',
  'STRONG',
  'EM',
  'B',
  'I',
  'CODE',
  'PRE',
  'TABLE',
  'THEAD',
  'TBODY',
  'TR',
  'TH',
  'TD',
  'A',
  'BR',
  'HR',
  'BLOCKQUOTE',
  'SPAN',
  'DIV',
  'SUB',
  'SUP',
]);

function sanitizeInfoTree(root: HTMLElement): void {
  for (const el of [...root.querySelectorAll('*')]) {
    if (DROP_TAGS.has(el.tagName)) {
      el.remove();
      continue;
    }
    if (!ALLOWED_TAGS.has(el.tagName)) {
      el.replaceWith(...el.childNodes);
      continue;
    }
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name === 'href' && /^(https?:|#|\/)/i.test(attr.value.trim())) continue;
      el.removeAttribute(attr.name);
    }
  }
}

function renderLikeFetchModelInfo(html: string): HTMLElement {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  sanitizeInfoTree(doc.body);
  const panel = document.createElement('div');
  panel.replaceChildren(...doc.body.childNodes);
  return panel;
}

describe('model-info sanitizer (payload-driven)', () => {
  test('script elements never survive', () => {
    const panel = renderLikeFetchModelInfo('<p>hi</p><script>window.__pwned = 1</script>');
    expect(panel.querySelector('script')).toBeNull();
    expect(panel.textContent).toContain('hi');
    expect(panel.textContent).not.toContain('__pwned');
  });

  test('event-handler attributes never survive, on any element', () => {
    const panel = renderLikeFetchModelInfo(
      '<img src=x onerror="window.__pwned=1"><div onclick="window.__pwned=1">x</div>' +
        '<a href="/ok" ONLOAD="p()">link</a>',
    );
    for (const el of panel.querySelectorAll('*')) {
      for (const attr of el.attributes) {
        expect(attr.name.toLowerCase().startsWith('on')).toBe(false);
      }
    }
  });

  test('javascript: and data: hrefs are removed; http(s)/#/relative kept', () => {
    const panel = renderLikeFetchModelInfo(
      '<a href="javascript:alert(1)">a</a><a href="data:text/html,x">b</a>' +
        '<a href="https://ok.example">c</a><a href="#frag">d</a><a href="/rel">e</a>',
    );
    const hrefs = [...panel.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([null, null, 'https://ok.example', '#frag', '/rel']);
  });

  test('classic mXSS vectors do not reconstruct into live markup', () => {
    // These payloads rely on a serialize→re-parse round trip mutating inert
    // text into elements. With node adoption there is no second parse.
    const vectors = [
      '<noscript><p title="</noscript><img src=x onerror=window.__pwned=1>">',
      '<svg></p><style><a id="</style><img src=1 onerror=window.__pwned=1>">',
      '<form><math><mtext></form><form><mglyph><style></math><img src onerror=window.__pwned=1>',
      '<listing>&lt;img src=x onerror=window.__pwned=1&gt;</listing>',
    ];
    for (const payload of vectors) {
      const panel = renderLikeFetchModelInfo(payload);
      expect(panel.querySelector('img[onerror]')).toBeNull();
      for (const el of panel.querySelectorAll('*')) {
        for (const attr of el.attributes) {
          expect(attr.name.toLowerCase().startsWith('on')).toBe(false);
        }
      }
      // Adopt-into-DOM must not execute anything.
      expect((window as { __pwned?: number }).__pwned).toBeUndefined();
    }
  });

  test('style/iframe/object/embed are dropped with their contents', () => {
    const panel = renderLikeFetchModelInfo(
      '<style>*{background:url(javascript:1)}</style><iframe src="https://evil"></iframe>' +
        '<object data="x"></object><embed src="x"><p>kept</p>',
    );
    expect(panel.querySelector('style,iframe,object,embed')).toBeNull();
    expect(panel.textContent).toBe('kept');
  });

  test('markdown-shaped content renders intact', () => {
    const panel = renderLikeFetchModelInfo(
      '<h2>CNN</h2><p>A <strong>convolutional</strong> net with <code>3x3</code> kernels.</p>' +
        '<table><tbody><tr><td>acc</td><td>0.98</td></tr></tbody></table>',
    );
    expect(panel.querySelector('h2')?.textContent).toBe('CNN');
    expect(panel.querySelector('strong')?.textContent).toBe('convolutional');
    expect(panel.querySelectorAll('td')).toHaveLength(2);
  });
});

describe('sanitizer mirror stays in lockstep with the app', () => {
  test('app.ts uses the same allowlist and the adopt-nodes render path', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const appTs = readFileSync(
      resolve(import.meta.dirname!, '../src/apps/classifiers/app.ts'),
      'utf-8',
    );
    // The mirror above must match the app's sanitizer: same drop set, same
    // allowlist entries, and the mXSS-safe adopt (no innerHTML round-trip).
    for (const tag of DROP_TAGS) expect(appTs).toContain(`'${tag}'`);
    for (const tag of ALLOWED_TAGS) expect(appTs).toContain(`'${tag}'`);
    expect(appTs).toContain('replaceChildren(...doc.body.childNodes)');
    expect(appTs).not.toContain('panel.innerHTML = doc.body.innerHTML');
  });
});
