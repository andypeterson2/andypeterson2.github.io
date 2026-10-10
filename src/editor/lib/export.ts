// Client-side JSON export in the cv backend's import-compatible shape, for the
// offline demo, so unsaved work re-imports losslessly. Connected exports fetch the
// authoritative backend /export instead.

import type { Profile, Variant, LetterSection } from './types';
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
  header?: Record<string, string>;
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
function slugOf(profile: Profile, sectionId: number | string): string {
  const s = profile.sections.find((x) => String(x.id) === String(sectionId));
  return s?.slug ?? s?.type ?? String(sectionId);
}

/**
 * Build the import-compatible export for a profile from in-memory editor state.
 * `letterFor` / `headerFor` supply a coverletter variant's paragraphs + header
 * (only the active variant's are loaded in the store, so the caller resolves the
 * rest). All display text is re-escaped to LaTeX so a re-import round-trips.
 */
export function buildExport(
  profile: Profile,
  letterFor: (v: Variant) => LetterSection[],
  headerFor: (v: Variant) => Record<string, string | undefined>,
): ExportDoc {
  const name =
    profile.name ||
    `${profile.personal.firstName ?? ''} ${profile.personal.lastName ?? ''}`.trim() ||
    'resume';
  return {
    name,
    personal: texMap(profile.personal),
    coverletter: texMap(profile.coverletter),
    sections: profile.sections.map((s, si) => ({
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
    variants: profile.variants.map((v) => ({
      name: v.name,
      kind: v.kind,
      rules: v.rules,
      sections: v.sections.map((r, i) => ({
        slug: slugOf(profile, r.sectionId),
        enabled: r.enabled,
        sortOrder: i,
      })),
      entryOverrides: [],
      itemOverrides: [],
      ...(v.kind === 'coverletter'
        ? {
            letterSections: letterFor(v).map((s) => ({ title: tex(s.title), body: tex(s.body) })),
            header: texMap(headerFor(v)),
          }
        : {}),
    })),
  };
}
