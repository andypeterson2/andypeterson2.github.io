// The cv API's WIRE shapes: what the REST endpoints return before mapping into
// the editor's domain model. Hand-derived from the backend's route handlers (there
// is no OpenAPI); the e2e suite drives the real mapping over mocked responses.

// raw shapes as returned by GET /persons/:pid
export interface RawMainItem {
  id: number;
  title?: string;
  content?: string;
  tags?: string[];
}
export interface RawMainEntry {
  id: number;
  fields?: Record<string, string>;
  items?: RawMainItem[];
  tags?: string[];
}
export interface RawMainSection {
  id: number | string;
  slug?: string;
  type: string;
  title: string;
  entries?: RawMainEntry[];
}
export interface RawOverride {
  included?: number | null;
  textOverride?: string | null;
  sortOverride?: number | null;
  fieldsOverride?: Record<string, string> | null;
}
export interface RawMainVariant {
  id: number;
  name: string;
  /** absent in older rows — mapVariant defaults it to 'cv' */
  kind?: string;
  layout_id?: string | null;
  rules?: { include?: string[]; exclude?: string[] };
  sections?: { section_id: number | string; enabled?: number | boolean; sort_order?: number }[];
  entryOverrides?: Record<string, RawOverride>;
  itemOverrides?: Record<string, RawOverride>;
  /** personal.* overrides, unprefixed; an absent key inherits the person value */
  personal?: Record<string, string>;
}
export interface RawLetterSection {
  id: number;
  title?: string;
  body?: string;
}
export interface RawMain {
  person: { id: number; name: string };
  personal?: Record<string, string>;
  sections?: RawMainSection[];
  variants?: RawMainVariant[];
  coverletter?: Record<string, string>;
}
