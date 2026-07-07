// The variant "lens" — decides which content a variant would keep vs. drop, so
// the document can dim what's excluded in place (rather than leaving the editor).
//
// This is a faithful client-side port of the backend resolver's inclusion test
// (cv/editor/lib/db/variants.js#_matchesTags + section scoping). Keeping it in
// sync with that file is a deliberate tradeoff: the lens works offline and
// updates instantly as rules change, at the cost of mirroring ~5 lines of logic
// (pinned by variant-lens.test.ts). NOTE: per-entry/item manual *overrides* are
// not part of getMaster and so are not reflected here — the compiled PDF (via
// GET /variants/:id/resolve) stays authoritative for those.
import type { Variant, VariantRules, Section, Entry, Item } from './types';

/**
 * Backend rule: an excluded tag vetoes; then an empty include set means
 * everything is in, otherwise at least one include tag must be present.
 */
export function matchesTags(tags: string[], rules: VariantRules): boolean {
  if (rules.exclude.length && tags.some((t) => rules.exclude.includes(t))) return false;
  if (rules.include.length === 0) return true;
  return tags.some((t) => rules.include.includes(t));
}

/** Does this variant enumerate an explicit section scope (vs. "all sections")? */
export function hasSectionScope(variant: Variant): boolean {
  return variant.sections.length > 0;
}

/** A section is scoped out when the variant lists sections and this one is off/absent. */
export function sectionScopedOut(section: Section, variant: Variant): boolean {
  if (!hasSectionScope(variant)) return false;
  const ref = variant.sections.find((r) => String(r.sectionId) === String(section.id));
  return ref ? !ref.enabled : true;
}

export function entryIncluded(entry: Entry, variant: Variant): boolean {
  return matchesTags(entry.tags, variant.rules);
}

export function itemIncluded(item: Item, variant: Variant): boolean {
  return matchesTags(item.tags, variant.rules);
}

/** Count entries the variant keeps across the whole document (for "shows X of Y"). */
export function countIncludedEntries(
  sections: Section[],
  variant: Variant,
): { shown: number; total: number } {
  let shown = 0;
  let total = 0;
  for (const s of sections) {
    const sectionOut = sectionScopedOut(s, variant);
    for (const e of s.entries) {
      total += 1;
      if (!sectionOut && entryIncluded(e, variant)) shown += 1;
    }
  }
  return { shown, total };
}
