// Client-side JSON export in the cv backend's import-compatible shape
// (mirrors lib/db/import-export.js#getPersonExport). Used offline / for the demo
// so unsaved work can be taken away as a file that re-imports losslessly;
// connected exports fetch the authoritative backend /export instead.
import type { Person, Variant, LetterSection } from './types';
import { tex, texFields } from './api';

export interface ExportSection {
  slug: string;
  type: string;
  title: string;
  sortOrder: number;
  entries: {
    fields: Record<string, string>;
    tags: string[];
    items: { content: string; title: string; tags: string[] }[];
  }[];
}
export interface ExportVariant {
  name: string;
  kind: string;
  rules: { include: string[]; exclude: string[] };
  sections: { slug: string; enabled: boolean; sortOrder: number }[];
  entryOverrides: never[];
  itemOverrides: never[];
  letterSections?: { title: string; body: string }[];
}
export interface ExportDoc {
  name: string;
  personal: Record<string, string>;
  coverletter: Record<string, string>;
  sections: ExportSection[];
  variants: ExportVariant[];
}

/** Re-escape a flat string map to LaTeX (undefined/empty values dropped). */
function texMap(obj: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) if (v) out[k] = tex(v);
  return out;
}
function slugOf(person: Person, sectionId: number | string): string {
  const s = person.sections.find((x) => String(x.id) === String(sectionId));
  return s?.slug ?? s?.type ?? String(sectionId);
}

/**
 * Build the import-compatible export for a person from in-memory editor state.
 * `letterFor` supplies a coverletter variant's paragraphs (only the active
 * variant's are loaded in the store, so the caller resolves the rest). All
 * display text is re-escaped to LaTeX so a re-import round-trips.
 */
export function buildExport(person: Person, letterFor: (v: Variant) => LetterSection[]): ExportDoc {
  const name =
    person.name ||
    `${person.personal.firstName ?? ''} ${person.personal.lastName ?? ''}`.trim() ||
    'resume';
  return {
    name,
    personal: texMap(person.personal),
    coverletter: texMap(person.coverletter),
    sections: person.sections.map((s, si) => ({
      slug: s.slug ?? s.type,
      type: s.type,
      title: s.title,
      sortOrder: si,
      entries: s.entries.map((e) => ({
        fields: texFields(e.fields),
        tags: e.tags,
        items: e.items.map((it) => ({
          content: tex(it.content),
          title: tex(it.title ?? ''),
          tags: it.tags,
        })),
      })),
    })),
    variants: person.variants.map((v) => ({
      name: v.name,
      kind: v.kind,
      rules: v.rules,
      sections: v.sections.map((r, i) => ({
        slug: slugOf(person, r.sectionId),
        enabled: r.enabled,
        sortOrder: i,
      })),
      entryOverrides: [],
      itemOverrides: [],
      ...(v.kind === 'coverletter'
        ? { letterSections: letterFor(v).map((s) => ({ title: tex(s.title), body: tex(s.body) })) }
        : {}),
    })),
  };
}
