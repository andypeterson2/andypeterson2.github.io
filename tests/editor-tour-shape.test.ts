import { describe, test, expect } from 'vitest';
import { createDemoPerson, DEMO_LETTERS } from '../src/editor/lib/demo';
import {
  findExperience,
  findFirstEntry,
  findLensVariant,
  findLetterVariant,
  contentHasTag,
  SPOTLIT_TAG,
  LENS_TAG,
} from '../src/editor/lib/tour-shape';

/**
 * The guided tour (tour-steps.ts) drives the demo by SHAPE, not by id — it finds
 * an experience section, a lens variant, a cover-letter variant, and spotlights a
 * tag. If demo.ts is reshaped so one of those disappears, the tour still "runs" but
 * narrates over a document where nothing happens — and CI stays green. This pins
 * the contract so that silent failure fails loudly instead.
 */
describe('the demo seed carries every shape the guided tour drives', () => {
  const person = createDemoPerson();

  test('step 1–2: an experience section with at least one entry', () => {
    // inline-edit + typed-bullet steps select the first experience entry.
    expect(findExperience(person)).not.toBeNull();
    expect(findFirstEntry(person)).not.toBeNull();
  });

  test('step 3: the spotlight tag exists in the content', () => {
    // Otherwise "spotlight #management and the rest fades" fades nothing.
    expect(contentHasTag(person, SPOTLIT_TAG)).toBe(true);
  });

  test('step 4–5: a CV variant whose lens filters on the caption tag', () => {
    const v = findLensVariant(person);
    expect(v).not.toBeNull();
    expect(v?.rules.include).toContain(LENS_TAG);
    // …and the tag it keeps is actually present, so the lens dims something.
    expect(contentHasTag(person, LENS_TAG)).toBe(true);
  });

  test('step 6: a cover-letter variant with demo paragraphs to show', () => {
    const v = findLetterVariant(person);
    expect(v).not.toBeNull();
    expect(DEMO_LETTERS[v!.id]?.length ?? 0).toBeGreaterThan(0);
  });
});
