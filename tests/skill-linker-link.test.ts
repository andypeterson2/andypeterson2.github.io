/**
 * The viewer's arithmetic against the file it is served.
 *
 * The page claims a visitor can arrive at the published RP@5 by counting the rows in
 * front of them. These tests do exactly that: reduce the shipped candidates and
 * compare against the aggregate each model's own run recorded, which the export
 * carries alongside them.
 */
import { describe, test, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  applyFilters,
  armName,
  armRun,
  buildRows,
  outcome,
  pct,
  rankCell,
  rankOf,
  rpAt,
  setName,
  summarize,
  type SkillLinkerDemo,
} from '../src/apps/skill-linker/link';

const demo = JSON.parse(
  readFileSync(resolve(__dirname, '../public/skill-linker/demo.json'), 'utf-8'),
) as SkillLinkerDemo;
const rows = buildRows(demo);

describe('R-precision at 5', () => {
  test('one correct skill scores all or nothing', () => {
    expect(rpAt([7], [7, 1, 2, 3, 4])).toBe(1);
    expect(rpAt([7], [1, 2, 3, 4, 5, 7])).toBe(0);
  });

  test('two correct skills with one in the top five score a half', () => {
    expect(rpAt([7, 9], [7, 1, 2, 3, 4, 9])).toBe(0.5);
  });

  test('more correct skills than slots divide by the slots', () => {
    expect(rpAt([1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5])).toBe(1);
  });
});

describe('the shipped candidates', () => {
  test('cover every sentence in all three sets', () => {
    expect(rows).toHaveLength(926);
    const bySet = new Map<string, number>();
    for (const row of rows) bySet.set(row.set, (bySet.get(row.set) ?? 0) + 1);
    expect(Object.fromEntries(bySet)).toEqual({ tech: 338, house: 262, techwolf: 326 });
  });

  test('give every sentence at least one correct skill', () => {
    expect(rows.every((row) => row.gold.length > 0)).toBe(true);
  });

  test('name a skill for every index they use', () => {
    const highest = Math.max(
      ...rows.flatMap((row) => [
        ...row.gold,
        ...Object.values(row.top).flatMap((ranked) => ranked ?? []),
      ]),
    );
    expect(highest).toBeLessThan(demo.labels.length);
    expect(demo.labels.every((label) => label.length > 0)).toBe(true);
  });

  test('keep the depth the file declares', () => {
    for (const arm of Object.keys(demo.arms)) {
      expect(rows.every((row) => row.top[arm]?.length === demo.k)).toBe(true);
    }
  });
});

describe('recounting reproduces each run', () => {
  for (const [arm, spec] of Object.entries(demo.arms)) {
    if (!spec) continue;
    for (const [set, published] of Object.entries(spec.published_rp5)) {
      test(`${spec.label} on ${set.toUpperCase()}`, () => {
        const scored = summarize(
          rows.filter((row) => row.set === set),
          arm,
        );
        expect(scored.rp5).toBeCloseTo(published ?? NaN, 4);
      });
    }
  }
});

describe('the held-out skills', () => {
  test('are a fifth of the ones mentioned, and the arm that skipped them is named', () => {
    expect(demo.holdout_arm).toBe('holdout');
    expect(demo.arms[demo.holdout_arm]).toBeDefined();
    const share = demo.heldout.length / demo.labels.length;
    expect(share).toBeGreaterThan(0.1);
    expect(share).toBeLessThan(0.3);
  });

  test('mark only correct skills that were actually held out', () => {
    const heldout = new Set(demo.heldout);
    for (const row of rows) {
      expect(row.heldoutGold.every((g) => heldout.has(g) && row.gold.includes(g))).toBe(true);
    }
  });

  test('score the fine-tuned arm ahead of stock on the pairs it never trained on', () => {
    const kept = rows.filter((row) => row.heldoutGold.length > 0);
    const golds = (row: (typeof kept)[number]) => row.heldoutGold;
    const stock = summarize(kept, 'stock', golds);
    const held = summarize(kept, demo.holdout_arm, golds);
    expect(kept.length).toBeGreaterThan(0);
    expect(held.hit5).toBeGreaterThan(stock.hit5);
  });
});

describe('filters', () => {
  test('a set filter keeps only that set', () => {
    const kept = applyFilters(rows, {
      set: 'house',
      outcome: 'any',
      outcomeArm: 'tuned',
      heldoutOnly: false,
    });
    expect(kept).toHaveLength(262);
  });

  test('the three outcomes partition the sentences', () => {
    const counts = (['hit', 'partial', 'miss'] as const).map(
      (want) =>
        applyFilters(rows, {
          set: 'all',
          outcome: want,
          outcomeArm: 'tuned',
          heldoutOnly: false,
        }).length,
    );
    expect(counts.reduce((a, b) => a + b, 0)).toBe(rows.length);
  });

  test('an outcome agrees with the score it is derived from', () => {
    for (const row of rows.slice(0, 50)) {
      const score = rpAt(row.gold, row.top.tuned ?? []);
      const want = score === 0 ? 'miss' : score === 1 ? 'hit' : 'partial';
      expect(outcome(row, 'tuned')).toBe(want);
    }
  });
});

describe('what the view calls things', () => {
  test('an arm is named for a reader, and its run label is kept separately', () => {
    expect(armName(demo, 'stock')).toBe('Stock MiniLM');
    expect(armRun(demo, 'stock')).toBe('all-MiniLM-L6-v2');
    expect(armName(demo, 'tuned')).toBe('Fine-tuned');
    expect(armRun(demo, 'tuned')).toBe('ft-seed0');
  });

  test('an arm the export does not carry falls back to its key', () => {
    expect(armName(demo, 'nope')).toBe('nope');
    expect(armRun(demo, 'nope')).toBe('nope');
  });

  test('a set is named in capitals', () => {
    expect(setName('techwolf')).toBe('TECHWOLF');
    expect(setName('other')).toBe('OTHER');
  });

  test('a share reads as a percentage to one place', () => {
    expect(pct(0.4557)).toBe('45.6%');
    expect(pct(0)).toBe('0.0%');
    expect(pct(1)).toBe('100.0%');
  });
});

describe('a rank cell', () => {
  const row = {
    set: 'tech',
    q: 0,
    text: 'x',
    gold: [7, 9],
    heldoutGold: [],
    top: { tuned: [1, 7, 2, 3, 4, 5, 6, 8, 10, 11] },
  };

  test('counts ranks from one, in the order the gold skills are listed', () => {
    expect(rankCell(row, 'tuned', 10)).toBe('2, >10');
  });

  test('says nothing about an arm the row has no candidates for', () => {
    expect(rankCell(row, 'missing', 10)).toBe('>10, >10');
  });
});

describe('a rank past the export depth', () => {
  test('reads as absent rather than as rank zero', () => {
    expect(rankOf(999_999, [1, 2, 3])).toBe(-1);
  });

  test('leaves a third of the sentences with nothing in either top five', () => {
    const bothMiss = rows.filter(
      (row) => outcome(row, 'stock') === 'miss' && outcome(row, 'tuned') === 'miss',
    );
    // The page says this task is hard; the share saying so must stay true of the data.
    expect(bothMiss.length / rows.length).toBeGreaterThan(0.2);
  });
});

describe('loading the export', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** A fresh module each time: the promise cache lives at module scope. */
  async function freshModule() {
    vi.resetModules();
    return import('../src/apps/skill-linker/link');
  }

  test('reads the shipped path and hands back what it parsed', async () => {
    const payload = { schema: 1 };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) });
    vi.stubGlobal('fetch', fetchMock);
    const mod = await freshModule();
    await expect(mod.loadDemo()).resolves.toBe(payload);
    expect(fetchMock).toHaveBeenCalledWith('/skill-linker/demo.json');
  });

  test('fetches once however many callers ask', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    vi.stubGlobal('fetch', fetchMock);
    const mod = await freshModule();
    const [first, second] = await Promise.all([mod.loadDemo(), mod.loadDemo()]);
    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('names the status when the file is not served', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const mod = await freshModule();
    await expect(mod.loadDemo()).rejects.toThrow('benchmark data unavailable (404)');
  });
});
