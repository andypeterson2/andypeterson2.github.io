// The shapes the guided tour drives, as pure predicates over a Person, so the tour
// script and a unit test over the demo seed share one definition of what the tour
// needs. This guards the seed against a reshape that would make the tour silently
// no-op.

import type { Person, Section, Entry, Variant } from './types';

/** The tag the spotlight step lifts out — one demo bullet must carry it. */
export const SPOTLIT_TAG = 'leadership';
/** The tag the lens step filters on — its caption names it, so they share this. */
export const LENS_TAG = 'quantum';

export function findExperience(person: Person): Section | null {
  return person.sections.find((s) => s.type === 'experience') ?? null;
}

export function findFirstEntry(person: Person): Entry | null {
  return findExperience(person)?.entries[0] ?? null;
}

/** A CV/resume variant that includes LENS_TAG — the one the lens step demonstrates. */
export function findLensVariant(person: Person): Variant | null {
  return (
    person.variants.find((v) => v.kind !== 'coverletter' && v.rules.include.includes(LENS_TAG)) ??
    null
  );
}

export function findLetterVariant(person: Person): Variant | null {
  return person.variants.find((v) => v.kind === 'coverletter') ?? null;
}

/** Does any entry or bullet carry `tag`? The spotlight/lens need real hits to land. */
export function contentHasTag(person: Person, tag: string): boolean {
  return person.sections.some((s) =>
    s.entries.some((e) => e.tags.includes(tag) || e.items.some((i) => i.tags.includes(tag))),
  );
}
