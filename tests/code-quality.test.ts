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
