/**
 * The benchmark viewer's wiring, and the one place its data must agree with the site.
 *
 * Two files now carry skill-linker numbers: the export the page recounts, and the
 * table the writeup's figures are drawn from. They came from the same runs, so a
 * disagreement means one of them was edited by hand.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import benchmarks from '../src/data/skill-linker-benchmarks.json';
import { projects } from '../src/data/projects';
import { buildRows, type SkillLinkerDemo } from '../src/apps/skill-linker/link';

const read = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf-8');
const page = read('src/pages/projects/tiny-skill-linker/app.astro');
// Wrapped source: compare prose against one line so a line break is not a failure.
const pageText = page.replace(/\s+/g, ' ');
const demo = JSON.parse(read('public/skill-linker/demo.json')) as SkillLinkerDemo;

describe('the page shell', () => {
  test('mounts through DemoShell and the app entry', () => {
    expect(page).toContain('DemoShell');
    expect(page).toContain("import '../../../apps/skill-linker/entry'");
  });

  test('declares no backend, so nothing reaches for a server', () => {
    expect(page).not.toContain('backend=');
    expect(page).not.toContain('service:');
  });

  test('credits the benchmark sets and the taxonomy it ranks against', () => {
    expect(pageText).toContain('CC BY 4.0');
    expect(pageText).toContain('European Union');
  });
});

describe('the project entry', () => {
  const project = projects.find((p) => p.slug === 'tiny-skill-linker');

  test('points at the viewer and says no model runs here', () => {
    expect(project?.appUrl).toBe('/projects/tiny-skill-linker/app/');
    expect(project?.tier).toBe('precomputed');
  });
});

describe('the export carries its own provenance', () => {
  const provenance = demo.provenance as Record<string, string>;

  test('names the repo and commit that produced it', () => {
    expect(provenance.source_repo).toBe('tiny-skill-linker');
    expect(provenance.source_sha).toMatch(/^[0-9a-f]{40}$/);
  });

  test('records how the candidates were computed', () => {
    expect(provenance.precision).toBe('fp32');
    expect(provenance.backend).toBe('torch');
    expect(demo.esco_version).toBe('1.1.0');
  });
});

describe('the export agrees with the figures the writeup is drawn from', () => {
  test('on the size of each benchmark set', () => {
    const counts = Object.fromEntries(
      Object.entries(demo.sets).map(([set, data]) => [set, data.n_queries]),
    );
    expect(counts).toEqual(benchmarks.sets);
  });

  test('on how many skills were ranked per sentence', () => {
    for (const data of Object.values(demo.sets)) {
      expect(data.n_targets).toBe(benchmarks.targets);
    }
  });

  test('on the stock model it is compared against', () => {
    const stock = demo.arms.stock?.published_rp5 ?? {};
    for (const [set, value] of Object.entries(benchmarks.rp5.stock)) {
      expect((stock[set] ?? NaN) * 100).toBeCloseTo(value, 2);
    }
  });

  test('on the pairs the held-out ablation counted', () => {
    const heldout = new Set(demo.heldout);
    const rows = buildRows(demo);
    const pairs = rows.reduce((n, row) => n + row.heldoutGold.length, 0);
    const all = rows.reduce((n, row) => n + row.gold.length, 0);
    expect(pairs).toBe(benchmarks.unseen.n_unseen);
    expect(all - pairs).toBe(benchmarks.unseen.n_seen);
  });

  test('on the skills kept out of training, which cannot exceed the list of them', () => {
    expect(demo.heldout.length).toBeLessThanOrEqual(benchmarks.unseen.held_out_skills);
    expect(demo.heldout.length).toBeGreaterThan(0);
  });
});

describe('the page states the one seed it ships', () => {
  test('and the set where the small model stays behind', () => {
    expect(pageText).toContain('Seed 0');
    expect(pageText).toContain('TECHWOLF');
  });

  test('and that sentences with no skill were dropped before the models saw them', () => {
    expect(pageText).toContain('dropped upstream');
  });
});
