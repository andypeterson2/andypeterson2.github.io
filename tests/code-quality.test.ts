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

describe('BaseLayout readability', () => {
  test('details-bar rendering uses helper function instead of nested ternaries', () => {
    const src = readFileSync(resolve(ROOT, 'src/layouts/BaseLayout.astro'), 'utf-8');
    const mapBlock = src.slice(
      src.indexOf('detailsSegments.map'),
      src.indexOf('</div>', src.indexOf('detailsSegments.map')),
    );
    // Count chained ternaries — should not have 3+ levels deep
    const ternaryDepth = (mapBlock.match(/\?\s*\(/g) || []).length;
    expect(ternaryDepth, 'Too many nested ternaries in details-bar').toBeLessThanOrEqual(1);
  });
});
