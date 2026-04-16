/**
 * ClassifierApp component structure and code quality tests.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

describe('ClassifierApp sub-components', () => {
  const subComponents = [
    'ClassifierNavbar.astro',
    'ClassifierTrainCard.astro',
    'ClassifierModelsCard.astro',
    'ClassifierResultsPanel.astro',
    'ClassifierLogDrawer.astro',
  ];

  test.each(subComponents)('%s exists', (name) => {
    expect(existsSync(resolve(ROOT, 'src/components/classifier', name))).toBe(true);
  });

  test('ClassifierApp imports all sub-components', () => {
    const src = readFileSync(resolve(ROOT, 'src/components/ClassifierApp.astro'), 'utf-8');
    for (const name of subComponents) {
      expect(src).toContain(name.replace('.astro', ''));
    }
  });

  test('ClassifierApp template is under 80 lines', () => {
    const src = readFileSync(resolve(ROOT, 'src/components/ClassifierApp.astro'), 'utf-8');
    expect(src.split('\n').length).toBeLessThan(80);
  });
});

describe('ServerConnectModal code organization', () => {
  test('inline script block is under 50 lines', () => {
    const src = readFileSync(resolve(ROOT, 'src/components/ServerConnectModal.astro'), 'utf-8');
    const scriptMatch = src.match(/<script is:inline>([\s\S]*?)<\/script>/);
    if (scriptMatch) {
      const scriptLines = scriptMatch[1].split('\n').length;
      expect(scriptLines).toBeLessThan(50);
    }
  });
});
