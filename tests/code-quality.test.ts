/**
 * Code quality tests — enforce clean patterns across the codebase.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
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

