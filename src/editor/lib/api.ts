// cv API client — credentialed fetches through the gateway (behind Cloudflare
// Access). The Access cookie rides along via credentials:'include'. READS ONLY
// for now; writes land in a later increment.
//
// The backend is id-addressable — there is NO active-person/session state.
// GET /persons lists profiles ({id,name}); GET /persons/:pid returns that
// profile's full "main" record (person + personal + sections→entries→items→tags,
// variants, tag vocab) in one shot. The gateway tiers access: an allowlisted
// (owner) Access identity gets every profile; anyone else gets the public demo
// profile only. Contract: cv/editor/routes/persons.js (the GET /persons/:pid route).
import type {
  Person,
  Personal,
  Item,
  Entry,
  Variant,
  CoverletterHeader,
  LetterSection,
} from './types';
import { GLYPH_BY_CMD } from './symbols';

/** The gateway's cv upstream. The cv API itself lives under `/api`. */
const DEFAULT_BASE = 'https://api.andypeterson.dev/cv';

export type ApiError = { code: string; message: string };
export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: ApiError;
}

export interface PersonMeta {
  id: number;
  name: string;
}
export interface ActiveLoad {
  person: Person;
  persons: PersonMeta[];
}

// ---- raw shapes as returned by GET /persons/:pid ----
interface RawMainItem {
  id: number;
  title?: string;
  content?: string;
  tags?: string[];
}
interface RawMainEntry {
  id: number;
  fields?: Record<string, string>;
  items?: RawMainItem[];
  tags?: string[];
}
interface RawMainSection {
  id: number | string;
  slug?: string;
  type: string;
  title: string;
  entries?: RawMainEntry[];
}
interface RawMainVariant {
  id: number;
  name: string;
  kind: string;
  layout_id?: string | null;
  rules?: { include?: string[]; exclude?: string[] };
  sections?: { section_id: number | string; enabled?: number | boolean; sort_order?: number }[];
}
interface RawLetterSection {
  id: number;
  title?: string;
  body?: string;
}
interface RawMain {
  person: { id: number; name: string };
  personal?: Record<string, string>;
  sections?: RawMainSection[];
  variants?: RawMainVariant[];
  coverletter?: Record<string, string>;
}

/** Every LaTeX special → its literal-text escape. Full coverage, not the old subset. */
const ESCAPE: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '{': '\\{',
  '}': '\\}',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
  '%': '\\%',
  '&': '\\&',
  $: '\\$',
  '#': '\\#',
  _: '\\_',
};

/**
 * LaTeX → display text, for reads. Reverses `tex`'s escaping so the field shows as
 * typed. Multi-char escapes first, so their trailing `{}` isn't mistaken for an
 * escaped brace. Permitted-symbol glyphs (→, α) are already Unicode and pass
 * straight through — the substitution is one-way (see `tex`).
 */
export function untex(s: string | undefined): string {
  if (!s) return '';
  return s
    .replace(/\\textbackslash\{\}/g, '\\')
    .replace(/\\textasciitilde\{\}/g, '~')
    .replace(/\\textasciicircum\{\}/g, '^')
    .replace(/\\([{}%&$#_])/g, '$1');
}

/**
 * Display text → LaTeX, for writes. A field is made injection- and
 * breakage-proof: a permitted `\command` (see symbols.ts) is substituted to its
 * Unicode glyph FIRST, then EVERY remaining LaTeX special is escaped to literal
 * text. So the compiler never receives a raw control word from a field — a token
 * is either a known glyph or literal prose. `\rightarrow` → `→` normalizes on the
 * way in (one-way; the glyph is canonical); an unknown `\foobar` becomes the
 * literal text “\foobar”. Nothing is trusted through.
 */
export function tex(s: string): string {
  if (!s) return '';
  return s
    .replace(/\\([a-zA-Z]+)/g, (m, name: string) => GLYPH_BY_CMD.get(name) ?? m)
    .replace(/[\\{}~^%&$#_]/g, (c) => ESCAPE[c]);
}
export function texFields(fields: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = tex(v);
  return out;
}

function mapItem(it: RawMainItem): Item {
  return { id: it.id, title: untex(it.title), content: untex(it.content), tags: it.tags ?? [] };
}
function mapEntry(e: RawMainEntry): Entry {
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(e.fields ?? {})) fields[k] = untex(v);
  return { id: e.id, fields, items: (e.items ?? []).map(mapItem), tags: e.tags ?? [] };
}
function mapVariant(v: RawMainVariant): Variant {
  return {
    id: v.id,
    name: v.name,
    kind: (v.kind as Variant['kind']) ?? 'cv',
    layoutId: v.layout_id ?? null,
    rules: { include: v.rules?.include ?? [], exclude: v.rules?.exclude ?? [] },
    sections: (v.sections ?? []).map((r) => ({ sectionId: r.section_id, enabled: !!r.enabled })),
  };
}
/** coverletter.* header fields, unescaped for display. `tex`/`sections` are internal. */
function mapCoverletter(cl?: Record<string, string>): CoverletterHeader {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(cl ?? {})) {
    if (k === 'tex' || k === 'sections') continue;
    out[k] = untex(v);
  }
  return out as CoverletterHeader;
}
/** GET /persons/:pid → the editor's Person. Rows arrive pre-ordered. */
function mapMain(m: RawMain): Person {
  const personal: Record<string, string> = {};
  for (const [k, v] of Object.entries(m.personal ?? {})) personal[k] = untex(v);
  return {
    id: m.person.id,
    name: m.person.name,
    personal: personal as Personal,
    sections: (m.sections ?? []).map((s) => ({
      id: s.id,
      slug: s.slug,
      type: s.type,
      title: s.title,
      entries: (s.entries ?? []).map(mapEntry),
    })),
    variants: (m.variants ?? []).map(mapVariant),
    coverletter: mapCoverletter(m.coverletter),
  };
}

export class CvApi {
  constructor(private base: string = DEFAULT_BASE) {}

  private async req<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
    try {
      // redirect:'follow' (the default): an AUTHENTICATED request can pass
      // through an Access redirect before landing on its 200, so we must follow
      // it. (redirect:'manual' stops at that hop and misreads a signed-in user
      // as signed-out.) A NOT-signed-in request 302s to the IdP on another
      // origin and fails CORS on the follow → a network_error the caller
      // classifies via a health probe.
      const res = await fetch(`${this.base}/api${path}`, {
        credentials: 'include',
        headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
        ...init,
      });
      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          status: res.status,
          error: { code: 'auth_required', message: 'Sign-in required' },
        };
      }
      const isJson = res.headers.get('content-type')?.includes('json');
      const data = isJson ? await res.json() : undefined;
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          error: data?.error ?? { code: `http_${res.status}`, message: res.statusText },
        };
      }
      return { ok: true, status: res.status, data };
    } catch (e) {
      return {
        ok: false,
        status: 0,
        error: { code: 'network_error', message: e instanceof Error ? e.message : String(e) },
      };
    }
  }

  health() {
    return this.req<{ status: string; service: string }>('/health');
  }
  listPersons() {
    return this.req<{ persons: PersonMeta[] }>('/persons');
  }
  private getMain(pid: number | string) {
    return this.req<RawMain>(`/persons/${pid}`);
  }

  /** Load one profile by id and map it to the editor's Person shape. */
  async fetchPerson(pid: number | string): Promise<ApiResult<Person>> {
    const res = await this.getMain(pid);
    if (!res.ok || !res.data) {
      return {
        ok: false,
        status: res.status,
        error: res.error ?? { code: 'load_failed', message: 'Could not load profile' },
      };
    }
    return { ok: true, status: 200, data: mapMain(res.data) };
  }

  /**
   * List the accessible profiles and load a default (the most recently created).
   * Returns `auth_required` when not signed into Access, so the UI can offer a
   * sign-in and fall back to the local demo.
   */
  async fetchActive(): Promise<ApiResult<ActiveLoad>> {
    const list = await this.listPersons();
    if (!list.ok || !list.data) {
      return { ok: false, status: list.status, error: list.error };
    }
    const persons = list.data.persons ?? [];
    if (!persons.length) {
      return {
        ok: false,
        status: 404,
        error: { code: 'no_persons', message: 'No profiles available' },
      };
    }
    // Default to the most recently created (highest id) profile; the user can
    // switch via the profile picker.
    const pid = persons[persons.length - 1].id;
    const loaded = await this.fetchPerson(pid);
    if (!loaded.ok || !loaded.data) {
      return { ok: false, status: loaded.status, error: loaded.error };
    }
    return { ok: true, status: 200, data: { person: loaded.data, persons } };
  }

  // ---- person (profile) CRUD ----
  createPerson(name: string) {
    return this.req<{ id: number }>('/persons', { method: 'POST', body: JSON.stringify({ name }) });
  }
  renamePerson(id: number, name: string) {
    return this.req(`/persons/${id}`, { method: 'PUT', body: JSON.stringify({ name }) });
  }
  deletePerson(id: number) {
    return this.req(`/persons/${id}`, { method: 'DELETE' });
  }

  // ---- version history (ADR-006 increment 1; the /versions endpoints are the
  // paired backend increment). A version's `doc` is the editor's Person snapshot,
  // stored as an opaque JSON blob — the backend rebuilds its tables from it on
  // restore. ----
  listVersions(pid: number) {
    return this.req<{ versions: { id: number; label: string; createdAt: number; doc: Person }[] }>(
      `/persons/${pid}/versions`,
    );
  }
  commitVersion(pid: number, v: { label: string; doc: Person }) {
    return this.req<{ id: number }>(`/persons/${pid}/versions`, {
      method: 'POST',
      body: JSON.stringify(v),
    });
  }
  restoreVersion(pid: number, id: number) {
    return this.req(`/persons/${pid}/versions/${id}/restore`, { method: 'POST' });
  }

  // ---- writes (display text is LaTeX-escaped on the way out) ----
  updateEntry(id: number, fields: Record<string, string>) {
    return this.req(`/entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ fields: texFields(fields) }),
    });
  }
  updateItem(id: number, patch: { content?: string; title?: string }) {
    const body: Record<string, string> = {};
    if (patch.content !== undefined) body.content = tex(patch.content);
    if (patch.title !== undefined) body.title = tex(patch.title);
    return this.req(`/items/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  }
  updatePersonal(pid: number, patch: Record<string, string>) {
    const body: Record<string, string> = {};
    for (const [k, v] of Object.entries(patch)) body[k] = tex(v);
    return this.req(`/persons/${pid}/personal`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }
  createEntry(sectionId: number | string, fields: Record<string, string>) {
    return this.req<{ id: number }>(`/sections/${sectionId}/entries`, {
      method: 'POST',
      body: JSON.stringify({ fields: texFields(fields) }),
    });
  }
  deleteEntry(id: number) {
    return this.req(`/entries/${id}`, { method: 'DELETE' });
  }
  createItem(entryId: number, item: { content: string; title?: string }) {
    return this.req<{ id: number }>(`/entries/${entryId}/items`, {
      method: 'POST',
      body: JSON.stringify({ content: tex(item.content), title: tex(item.title ?? '') }),
    });
  }
  deleteItem(id: number) {
    return this.req(`/items/${id}`, { method: 'DELETE' });
  }
  createSection(pid: number, section: { slug: string; type: string; title: string }) {
    return this.req<{ id: number }>(`/persons/${pid}/sections`, {
      method: 'POST',
      body: JSON.stringify(section),
    });
  }
  deleteSection(id: number | string) {
    return this.req(`/sections/${id}`, { method: 'DELETE' });
  }
  reorderEntries(sectionId: number | string, ids: (number | string)[]) {
    return this.req(`/sections/${sectionId}/entries/order`, {
      method: 'PATCH',
      body: JSON.stringify({ ids }),
    });
  }
  reorderItems(entryId: number, ids: number[]) {
    return this.req(`/entries/${entryId}/items/order`, {
      method: 'PATCH',
      body: JSON.stringify({ ids }),
    });
  }
  reorderSections(pid: number, ids: (number | string)[]) {
    return this.req(`/persons/${pid}/sections/order`, {
      method: 'PATCH',
      body: JSON.stringify({ ids }),
    });
  }

  // ---- global settings (style/spacing/fonts) + layouts ----
  getSettings(prefix: string) {
    return this.req<Record<string, unknown>>(`/settings?prefix=${prefix}`);
  }
  patchSettings(patch: Record<string, string>) {
    return this.req('/settings', { method: 'PATCH', body: JSON.stringify(patch) });
  }
  getLayouts() {
    return this.req<{
      layouts: { id: string; name: string; status: string }[];
      default: string | null;
    }>('/layouts');
  }
  setDefaultLayout(id: string) {
    return this.req('/layouts/default', { method: 'PUT', body: JSON.stringify({ layout_id: id }) });
  }

  // ---- tags on entries + items ----
  addEntryTags(entryId: number, tags: string[]) {
    return this.req(`/entries/${entryId}/tags`, { method: 'POST', body: JSON.stringify({ tags }) });
  }
  removeEntryTag(entryId: number, tag: string) {
    return this.req(`/entries/${entryId}/tags/${encodeURIComponent(tag)}`, { method: 'DELETE' });
  }
  addItemTags(itemId: number, tags: string[]) {
    return this.req(`/items/${itemId}/tags`, { method: 'POST', body: JSON.stringify({ tags }) });
  }
  removeItemTag(itemId: number, tag: string) {
    return this.req(`/items/${itemId}/tags/${encodeURIComponent(tag)}`, { method: 'DELETE' });
  }

  // ---- variants (the lens) ----
  createVariant(pid: number, variant: { name: string; kind: Variant['kind'] }) {
    return this.req<{ id: number }>(`/persons/${pid}/variants`, {
      method: 'POST',
      body: JSON.stringify(variant),
    });
  }
  renameVariant(id: number, name: string) {
    return this.req(`/variants/${id}`, { method: 'PUT', body: JSON.stringify({ name }) });
  }
  deleteVariant(id: number) {
    return this.req(`/variants/${id}`, { method: 'DELETE' });
  }
  setVariantRules(id: number, rules: { include: string[]; exclude: string[] }) {
    return this.req(`/variants/${id}/rules`, { method: 'PUT', body: JSON.stringify(rules) });
  }

  // ---- cover letter: header (per person) + body paragraphs (per variant) ----
  updateCoverletter(pid: number, patch: Record<string, string>) {
    const body: Record<string, string> = {};
    for (const [k, v] of Object.entries(patch)) body[k] = tex(v);
    return this.req(`/persons/${pid}/coverletter`, { method: 'PATCH', body: JSON.stringify(body) });
  }
  /** Per-variant cover-letter header + paragraphs, in one fetch (GET /variants/:id). */
  async getLetterData(
    variantId: number,
  ): Promise<ApiResult<{ header: Record<string, string>; sections: LetterSection[] }>> {
    const res = await this.req<{
      header?: Record<string, string>;
      letterSections?: RawLetterSection[];
    }>(`/variants/${variantId}`);
    if (!res.ok || !res.data) return { ok: false, status: res.status, error: res.error };
    return {
      ok: true,
      status: 200,
      data: {
        header: mapCoverletter(res.data.header),
        sections: (res.data.letterSections ?? []).map((s) => ({
          id: s.id,
          title: untex(s.title),
          body: untex(s.body),
        })),
      },
    };
  }
  updateVariantHeader(variantId: number, patch: Record<string, string>) {
    const body: Record<string, string> = {};
    for (const [k, v] of Object.entries(patch)) body[k] = tex(v);
    return this.req(`/variants/${variantId}/header`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }
  async getLetterSections(variantId: number): Promise<ApiResult<LetterSection[]>> {
    const res = await this.req<RawLetterSection[]>(`/variants/${variantId}/letter-sections`);
    if (!res.ok || !res.data) return { ok: false, status: res.status, error: res.error };
    return {
      ok: true,
      status: 200,
      data: res.data.map((s) => ({ id: s.id, title: untex(s.title), body: untex(s.body) })),
    };
  }
  createLetterSection(variantId: number, s: { title: string; body: string }) {
    return this.req<{ id: number }>(`/variants/${variantId}/letter-sections`, {
      method: 'POST',
      body: JSON.stringify({ title: tex(s.title), body: tex(s.body) }),
    });
  }
  updateLetterSection(variantId: number, lid: number, patch: { title?: string; body?: string }) {
    const body: Record<string, string> = {};
    if (patch.title !== undefined) body.title = tex(patch.title);
    if (patch.body !== undefined) body.body = tex(patch.body);
    return this.req(`/variants/${variantId}/letter-sections/${lid}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }
  deleteLetterSection(variantId: number, lid: number) {
    return this.req(`/variants/${variantId}/letter-sections/${lid}`, { method: 'DELETE' });
  }
  /** GET /persons/:pid/export → the backend's import-compatible tree (authoritative). */
  exportPerson(pid: number) {
    return this.req<unknown>(`/persons/${pid}/export`);
  }
  reorderLetterSections(variantId: number, ids: number[]) {
    return this.req(`/variants/${variantId}/letter-sections/order`, {
      method: 'PATCH',
      body: JSON.stringify({ ids }),
    });
  }

  /**
   * Compile a variant to PDF (GET /variants/:id/pdf — spawns xelatex, rate-limited).
   * On success the body is application/pdf → returned as a Blob; on failure the
   * backend returns { success:false, log } → surfaced as the error message.
   */
  async compilePdf(variantId: number): Promise<ApiResult<Blob>> {
    try {
      const res = await fetch(`${this.base}/api/variants/${variantId}/pdf`, {
        credentials: 'include',
      });
      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          status: res.status,
          error: { code: 'auth_required', message: 'Sign-in required' },
        };
      }
      const ct = res.headers.get('content-type') ?? '';
      if (res.ok && ct.includes('pdf')) {
        return { ok: true, status: res.status, data: await res.blob() };
      }
      let message = `Compile failed (HTTP ${res.status})`;
      if (ct.includes('json')) {
        const body = (await res.json().catch(() => null)) as { log?: string } | null;
        if (body?.log) message = body.log;
      }
      return { ok: false, status: res.status, error: { code: 'compile_failed', message } };
    } catch (e) {
      return {
        ok: false,
        status: 0,
        error: { code: 'network_error', message: e instanceof Error ? e.message : String(e) },
      };
    }
  }
}

export const api = new CvApi();
