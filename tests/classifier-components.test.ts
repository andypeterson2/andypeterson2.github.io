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
    // Measure the orchestration (frontmatter + markup) only — the co-located
    // scoped <style> block is styling, and prettier may reflow it.
    const template = src.replace(/<style>[\s\S]*?<\/style>/g, '');
    expect(template.split('\n').length).toBeLessThan(80);
  });
});

// Every page gets the pass lane; only a demo with a backend gets the live tier.
describe('Live tier is mounted where a backend is', () => {
  const read = (f: string) => readFileSync(resolve(ROOT, f), 'utf-8');

  test('the base layout mounts the pass lane, not the live tier', () => {
    const layout = read('src/layouts/BaseLayout.astro');
    expect(layout).toContain('<PassLane />');
    expect(layout).not.toContain('LiveTier');
  });

  test('a demo with a backend mounts the live tier', () => {
    expect(read('src/layouts/DemoShell.astro')).toMatch(/\{backend && <LiveTier \/>\}/);
  });

  test('the pass lane is the pass module and nothing else', () => {
    const lane = read('src/components/PassLane.astro');
    expect(lane.match(/import '[^']+'/g)).toEqual(["import '../apps/shared/pass'"]);
  });

  test('the beacon comes after the pass lane', () => {
    const layout = read('src/layouts/BaseLayout.astro');
    expect(layout.indexOf('<CfBeacon')).toBeGreaterThan(layout.indexOf('<PassLane />'));
  });
});
