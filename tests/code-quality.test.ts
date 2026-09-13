/**
 * Code quality tests — enforce clean patterns across the codebase.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, globSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

describe('No inline display:none', () => {
  test('ClassifierApp uses .hidden class instead of inline display:none', () => {
    const src = readFileSync(resolve(ROOT, 'src/components/ClassifierApp.astro'), 'utf-8');
    const template = src.split('<style>')[0];
    expect(template).not.toContain('style="display:none"');
  });
});

describe('Button props typing', () => {
  test('Button.astro has no catch-all prop type', () => {
    const src = readFileSync(resolve(ROOT, 'src/components/Button.astro'), 'utf-8');
    expect(src).not.toContain('[key: string]: unknown');
  });
});

// Astro drops the newline between a word and an inline element that starts the next
// line, so "and\n<strong>X</strong>" renders as "andX". Such a break must carry an
// explicit {' '} (the audit found two of these on the home page's first paragraph).
describe('No dropped spaces before wrapped inline elements', () => {
  test('.astro prose lines that wrap before <strong>/<em>/<code>/<a> keep the space', () => {
    const files = globSync('src/**/*.astro', { cwd: ROOT });
    const offenders: string[] = [];
    for (const f of files) {
      const lines = readFileSync(resolve(ROOT, f), 'utf-8').split('\n');
      for (let i = 0; i < lines.length - 1; i++) {
        const a = lines[i].trimEnd();
        const b = lines[i + 1].trimStart();
        const prose =
          /[A-Za-z0-9,;:)—]$/.test(a) &&
          !/^\s*(<|\{|\/\/|\/\*|\*|import |const |let |if |\}|\))/.test(a);
        if (prose && /^<(strong|em|code|b|i|a)\b/.test(b)) offenders.push(`${f}:${i + 1}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

// Colour and type in the apps' scripts go through the design tokens, where the
// stylelint gates can see them: no hex colours, no hard-coded font faces, and no
// token that isn't defined (it would silently fall back to another colour).
describe('App scripts draw with the design tokens', () => {
  const files = globSync('src/apps/**/*.ts', { cwd: ROOT });
  const code = (f: string) =>
    readFileSync(resolve(ROOT, f), 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/&#x?[0-9a-f]+;/gi, ''); // HTML entities aren't colours

  test('no hex colours', () => {
    const offenders = files.flatMap((f) =>
      (code(f).match(/#[0-9a-f]{3,8}\b/gi) ?? []).map((m) => `${f}: ${m}`),
    );
    expect(offenders).toEqual([]);
  });

  test('no hard-coded font families', () => {
    const faces = /font-family=|(?:\d+px|bold)\s+(?:Inter|Helvetica|Arial|monospace|sans-serif)/;
    expect(files.filter((f) => faces.test(code(f)))).toEqual([]);
  });

  test('every token a script reads is defined in a stylesheet', () => {
    const css = globSync('{src,packages}/**/*.{css,astro,svelte}', { cwd: ROOT })
      .map((f) => readFileSync(resolve(ROOT, f), 'utf-8'))
      .join('\n');
    const read = files.flatMap((f) =>
      [...code(f).matchAll(/(?:getPropertyValue|token)\('(--[a-z0-9-]+)'/g)].map((m) => [f, m[1]]),
    );
    const undefinedTokens = read
      .filter(([, t]) => !new RegExp(`${t}\\s*:`).test(css))
      .map(([f, t]) => `${f}: ${t}`);
    expect(undefinedTokens).toEqual([]);
  });
});
