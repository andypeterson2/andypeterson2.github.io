/**
 * Unit tests for the variant lens matcher (src/editor/lib/variant-lens.ts).
 * This is a client-side port of the cv backend resolver's inclusion test
 * (cv/editor/lib/db/variants.js#_matchesTags + section scoping); these tests
 * pin the exact semantics so the port can't silently drift.
 */
import { describe, test, expect } from 'vitest';
import {
  matchesTags,
  sectionScopedOut,
  entryIncluded,
  itemIncluded,
  countIncludedEntries,
} from '../src/editor/lib/variant-lens';
import type { Variant, Section, Entry } from '../src/editor/lib/types';

function variant(over: Partial<Variant> = {}): Variant {
  return {
    id: 1,
    name: 'V',
    kind: 'cv',
    rules: { include: [], exclude: [] },
    sections: [],
    ...over,
  };
}
function entry(id: number, tags: string[], items: { id: number; tags: string[] }[] = []): Entry {
  return { id, fields: {}, tags, items: items.map((i) => ({ ...i, content: '' })) };
}

describe('matchesTags — backend inclusion semantics', () => {
  test('empty rules include everything', () => {
    expect(matchesTags([], { include: [], exclude: [] })).toBe(true);
    expect(matchesTags(['x'], { include: [], exclude: [] })).toBe(true);
  });

  test('an excluded tag vetoes, even if also an include', () => {
    // Backend order: exclude is checked first and wins.
    expect(matchesTags(['backend'], { include: ['backend'], exclude: ['backend'] })).toBe(false);
    expect(matchesTags(['a', 'b'], { include: [], exclude: ['b'] })).toBe(false);
  });

  test('a non-empty include set requires at least one matching tag', () => {
    expect(matchesTags(['backend'], { include: ['backend'], exclude: [] })).toBe(true);
    expect(matchesTags(['frontend'], { include: ['backend'], exclude: [] })).toBe(false);
    expect(matchesTags([], { include: ['backend'], exclude: [] })).toBe(false);
  });

  test('exclude with an empty include still defaults the rest in', () => {
    expect(matchesTags(['keep'], { include: [], exclude: ['drop'] })).toBe(true);
    expect(matchesTags(['drop'], { include: [], exclude: ['drop'] })).toBe(false);
  });
});

describe('sectionScopedOut', () => {
  const s: Section = { id: 5, type: 'experience', title: 'Experience', entries: [] };

  test('no explicit scope = every section in', () => {
    expect(sectionScopedOut(s, variant({ sections: [] }))).toBe(false);
  });
  test('listed + enabled = in; listed + disabled = out', () => {
    expect(sectionScopedOut(s, variant({ sections: [{ sectionId: 5, enabled: true }] }))).toBe(
      false,
    );
    expect(sectionScopedOut(s, variant({ sections: [{ sectionId: 5, enabled: false }] }))).toBe(
      true,
    );
  });
  test('not listed while a scope exists = out', () => {
    expect(sectionScopedOut(s, variant({ sections: [{ sectionId: 9, enabled: true }] }))).toBe(
      true,
    );
  });
  test('matches by string/number id coercion', () => {
    const strSection: Section = { ...s, id: '5' };
    expect(
      sectionScopedOut(strSection, variant({ sections: [{ sectionId: 5, enabled: true }] })),
    ).toBe(false);
  });
});

describe('entry / item inclusion', () => {
  test('entry and item share the same tag semantics', () => {
    const v = variant({ rules: { include: ['backend'], exclude: [] } });
    expect(entryIncluded(entry(1, ['backend']), v)).toBe(true);
    expect(entryIncluded(entry(1, ['ops']), v)).toBe(false);
    expect(itemIncluded({ id: 1, content: '', tags: ['backend'] }, v)).toBe(true);
    expect(itemIncluded({ id: 1, content: '', tags: [] }, v)).toBe(false);
  });
});

describe('countIncludedEntries', () => {
  const sections: Section[] = [
    { id: 1, type: 'summary', title: 'Summary', entries: [entry(1, [])] },
    {
      id: 2,
      type: 'experience',
      title: 'Experience',
      entries: [entry(2, ['backend']), entry(3, ['ops'])],
    },
  ];

  test('include:[backend] keeps only backend entries', () => {
    const { shown, total } = countIncludedEntries(
      sections,
      variant({ rules: { include: ['backend'], exclude: [] } }),
    );
    expect(total).toBe(3);
    expect(shown).toBe(1);
  });
  test('a scoped-out section drops all its entries from the count', () => {
    const v = variant({ sections: [{ sectionId: 2, enabled: true }] });
    const { shown, total } = countIncludedEntries(sections, v);
    expect(total).toBe(3);
    expect(shown).toBe(2); // only the Experience section's two entries
  });
});
