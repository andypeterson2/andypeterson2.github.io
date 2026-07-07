// Data model for the CV editor — mirrors the cv API's normalized person tree
// returned by GET /api/persons/:id. See docs/editor-redesign.md §3.

export interface Personal {
  firstName?: string;
  lastName?: string;
  position?: string;
  email?: string;
  mobile?: string;
  address?: string;
  homepage?: string;
  github?: string;
  linkedin?: string;
  gitlab?: string;
  twitter?: string;
  orcid?: string;
  quote?: string;
  photoEnabled?: string;
  photoFile?: string;
}

/** A bullet within an entry. Carries both a short `title` and `content`. */
export interface Item {
  id: number;
  title?: string;
  content: string;
  tags: string[];
}

/** A row within a section. `fields` are type-specific (see SECTION_TYPES). */
export interface Entry {
  id: number;
  fields: Record<string, string>;
  items: Item[];
  tags: string[];
}

export interface Section {
  id: number | string;
  slug?: string;
  /** A key of SECTION_TYPES — drives the shape of `fields` and whether entries have items. */
  type: string;
  title: string;
  entries: Entry[];
}

/** The cover-letter header (per-person `coverletter.*` settings). */
export interface CoverletterHeader {
  title?: string;
  recipientName?: string;
  recipientAddress?: string;
  opening?: string;
  closing?: string;
  enclosureLabel?: string;
  enclosureContent?: string;
}

/** A body paragraph of a cover letter (per coverletter variant). */
export interface LetterSection {
  id: number;
  title: string;
  body: string;
}

export interface Person {
  id: number;
  name: string;
  personal: Personal;
  sections: Section[];
  variants: Variant[];
  coverletter: CoverletterHeader;
}

/** A variant's tag rules — the primary lever for what it includes. */
export interface VariantRules {
  include: string[];
  exclude: string[];
}

/** Explicit section scoping for a variant. */
export interface VariantSectionRef {
  sectionId: number | string;
  enabled: boolean;
}

export interface Variant {
  id: number;
  name: string;
  kind: 'cv' | 'resume' | 'coverletter';
  layoutId?: string | null;
  rules: VariantRules;
  /** Explicit section scope; empty = every section is in. */
  sections: VariantSectionRef[];
}

/** A selected node in the document (what the inspector edits). */
export type Selection =
  | { kind: 'none' }
  | { kind: 'personal' }
  | { kind: 'section'; sectionId: Section['id'] }
  | { kind: 'entry'; sectionId: Section['id']; entryId: number }
  | { kind: 'item'; entryId: number; itemId: number };
