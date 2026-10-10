// Data model for the CV editor — mirrors the cv API's normalized profile tree
// returned by GET /api/profiles/:id.

// A type alias ON PURPOSE (not an interface): all-optional string shapes get an
// implicit index signature only as aliases, which texMap/diffFields rely on.
export type Personal = {
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
};

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

/** The cover-letter header (per-profile `coverletter.*` settings). */
// Type alias ON PURPOSE — same implicit-index-signature reason as Personal.
export type CoverletterHeader = {
  title?: string;
  recipientName?: string;
  recipientAddress?: string;
  opening?: string;
  closing?: string;
  enclosureLabel?: string;
  enclosureContent?: string;
};

/** A body paragraph of a cover letter (per coverletter variant). */
export interface LetterSection {
  id: number;
  title: string;
  body: string;
}

export interface Profile {
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

/** A per-variant exception for one entry — overrides tag rules and/or fields. */
export interface EntryOverride {
  /** 1 = force in, 0 = force out, null = defer to tags. */
  included: number | null;
  textOverride: string | null;
  sortOverride: number | null;
  /** Sparse per-variant field patch merged over the entry's fields. */
  fieldsOverride: Record<string, string> | null;
}

/** A per-variant exception for one bullet (items have no fields). */
export interface ItemOverride {
  included: number | null;
  textOverride: string | null;
  sortOverride: number | null;
}

/** An account's storage against its limits, as GET /usage reports it. */
export interface StorageUsage {
  /** The site owner and the demo account have no limits. */
  unlimited: boolean;
  bytes: { used: number; content: number; layouts: number; limit: number };
  profiles: { used: number; limit: number };
  layouts: { used: number; limit: number };
  pendingLayouts: { used: number; limit: number };
  versionsPerProfile: { limit: number };
}

/** The public GitHub repository a layout follows. */
export interface LayoutSource {
  /** owner/repo */
  repo: string;
  /** Folder in the repo holding layout.json; '' for the root. */
  path: string;
  track: 'release' | 'branch';
  branch: string | null;
  lastSha: string | null;
  lastRef: string | null;
  lastCheckedAt: string | null;
  /** Only on the caller's own layouts. */
  lastError?: string | null;
  trusted?: boolean;
  shared?: boolean;
}

/** One layout the account can see, as GET /layouts lists it. */
export interface LayoutInfo {
  id: string;
  name: string;
  status: string;
  kinds: string[];
  builtin: boolean;
  /** The caller uploaded it (their private upload or one of its versions). */
  own: boolean;
  author: string | null;
  /** The upload a version was published from (the layout's own id when unversioned). */
  family: string;
  versionNo: number | null;
  state: 'private' | 'pending' | 'public' | 'unlisted' | 'rejected';
  /** Id of a newer public version of the same family, when there is one. */
  updateAvailable: string | null;
  /** The repo it follows; null for a builtin or an upload not linked to one. */
  source?: LayoutSource | null;
}

/** A pending version in the owner's review queue. */
export interface LayoutReview extends LayoutInfo {
  compileMs: number | null;
  warnings: string[];
  report: { ok: boolean; checks: { name: string; ok: boolean; detail?: string }[] } | null;
}

/** The result of checking or installing a layout zip. */
export interface LayoutCheck {
  ok: boolean;
  missing: string[];
  installed?: LayoutInfo;
  error?: string;
}

/** A render setting: a plain string, or a length kept as number + LaTeX unit. */
export type SettingValue = string | { num: number; unit: string };

export interface Variant {
  id: number;
  name: string;
  kind: 'cv' | 'resume' | 'coverletter';
  layoutId?: string | null;
  rules: VariantRules;
  /** Explicit section scope; empty = every section is in. */
  sections: VariantSectionRef[];
  /** Manual overrides keyed by entry/item id (from getMain), so the lens can show them live. */
  entryOverrides?: Record<string, EntryOverride>;
  itemOverrides?: Record<string, ItemOverride>;
  /**
   * personal.* overrides for this variant, unprefixed and unescaped. A missing key
   * inherits the profile value; an empty string suppresses the field.
   */
  personal?: Record<string, string>;
  /**
   * style/spacing/fonts overrides for this variant, keyed prefixed
   * (`spacing.marginTop`). A missing key inherits the account value.
   */
  settings?: Record<string, SettingValue>;
}
