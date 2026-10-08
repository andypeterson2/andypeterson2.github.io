/**
 * LinkedIn / Indeed / Handshake export — a pure, downstream consumer of a resolved
 * variant, mirroring the cv backend's own transform so a demo session can produce
 * the same blocks offline. None of those sites expose a write API, so the resume
 * stays the authority and this produces paste-ready work-history blocks plus a
 * per-entry fingerprint. The fingerprint is what lets a later run say which
 * positions have changed since they were last pasted.
 *
 * No DB or network: feed it a resolved document, get blocks back.
 */

import type { Entry, Section, Variant } from './types';
import { entryIncluded, entryFieldsFor, itemIncluded, sectionScopedOut } from './variant-lens';

/** Position-description limits. LinkedIn truncates at ~2000, so the caller is told. */
export const LIMITS = { description: 2000, headline: 220, about: 2600 } as const;

/** Bullet glyph per consumer. The fingerprint is glyph-free, so the format is not part of it. */
const BULLETS: Record<string, string> = { linkedin: '• ', plaintext: '', markdown: '- ' };

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

export interface DatePoint {
  month: number | null;
  year: number;
}
export interface LinkedinPosition {
  entryId: number;
  title: string;
  company: string;
  location: string;
  start: DatePoint | null;
  end: DatePoint | null;
  description: string;
  overLimit: boolean;
  fingerprint: string;
}

/**
 * Strip stored XeLaTeX source down to plain text a form field can take: unescape
 * LaTeX specials, turn `\textrightarrow{}` into an arrow, drop any other control
 * word, normalise `--`/`---` dashes, `~` and `\\` line breaks, then collapse the
 * whitespace that removals leave behind.
 */
export function clean(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/\\([&%$#_{}])/g, '$1')
    .replace(/\\textrightarrow\s*\{\}/g, ' → ')
    .replace(/\\[a-zA-Z]+\s*\{\}/g, '')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/---/g, '—')
    .replace(/--/g, '–')
    .replace(/~/g, ' ')
    .replace(/\\\\/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse a date field into LinkedIn's start/end month-year. Real data is
 * `"July 2022 -- December 2024"` (full month names, LaTeX `--`) but this also takes
 * en/em dashes, year-only ranges, and "Present"/"Current" (→ end: null, i.e. "I
 * currently work here"). A lone date is treated as an open-ended start.
 * `month` is null when the source gives only a year — the pasting user picks one.
 */
export function parseRange(raw: string | null | undefined): {
  start: DatePoint | null;
  end: DatePoint | null;
} {
  const parts = clean(raw).split(/\s*(?:–|—|-)\s*/); // clean() already made -- / --- into – / —
  const one = (t: string | undefined): DatePoint | null => {
    const v = (t ?? '').trim();
    if (!v || /present|current|now|ongoing/i.test(v)) return null;
    const m = /([A-Za-z]+)?\s*(\d{4})/.exec(v); // "July 2022" | "2022"
    if (!m) return null;
    return {
      month: m[1] ? (MONTHS[m[1].slice(0, 3).toLowerCase()] ?? null) : null,
      year: Number(m[2]),
    };
  };
  return { start: one(parts[0]), end: parts.length > 1 ? one(parts[1]) : null };
}

/** SHA-256 as hex, via the platform digest the browser already exposes. */
async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Turn the document, seen through a variant, into work-history blocks. The role is
 * `fields.position` and the organisation is `fields.organization`: experience
 * entries carry no `title`.
 */
export async function exportLinkedin(
  sections: Section[],
  variant: Variant | null,
  format = 'linkedin',
): Promise<{ format: string; limits: typeof LIMITS; positions: LinkedinPosition[] }> {
  const bullet = BULLETS[format] ?? BULLETS.linkedin;
  const exp = sections.find((s) => s.type === 'experience');
  const kept: Entry[] =
    exp && !(variant && sectionScopedOut(exp, variant))
      ? exp.entries.filter((e) => !variant || entryIncluded(e, variant))
      : [];

  const positions = await Promise.all(
    kept.map(async (e): Promise<LinkedinPosition> => {
      const f = entryFieldsFor(e, variant);
      const bullets = e.items
        .filter((i) => !variant || itemIncluded(i, variant))
        .map((i) => clean(i.content))
        .filter(Boolean);
      const description = bullets.map((b) => bullet + b).join('\n');
      const { start, end } = parseRange(f.date);
      const title = clean(f.position);
      const company = clean(f.organization);
      const location = clean(f.location);
      return {
        entryId: e.id,
        title,
        company,
        location,
        start,
        end,
        description,
        overLimit: description.length > LIMITS.description,
        // Over normalised, glyph-free values: a cosmetic escaping or format change
        // must leave it alone, while a real content change must move it.
        fingerprint: await sha256(
          JSON.stringify([title, company, location, start, end, bullets.join('\n')]),
        ),
      };
    }),
  );
  return { format, limits: LIMITS, positions };
}
