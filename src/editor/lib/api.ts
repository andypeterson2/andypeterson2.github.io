// cv API client: credentialed fetches through the gateway, whose session cookie
// rides along via credentials:'include'. The backend is id-addressable with no
// active-profile state: GET /profiles lists profiles ({id,name}); GET /profiles/:pid
// returns one profile's full record (profile, sections, variants, tag vocab).
// The allowlisted owner sees every profile; other signed-in users see their own.
import type {
  LayoutInfo,
  LayoutReview,
  LayoutCheck,
  SettingValue,
  Profile,
  Item,
  Entry,
  Variant,
  EntryOverride,
  ItemOverride,
  CoverletterHeader,
  LetterSection,
} from './types';
import { loginUrl as gatewayLoginUrl } from '../../lib/gateway';
import { GLYPH_BY_CMD } from './symbols';
import type {
  RawMain,
  RawMainEntry,
  RawMainItem,
  RawMainVariant,
  RawLetterSection,
  RawOverride,
} from './wire';

/** The gateway's cv upstream. The cv API itself lives under `/api`. */
const DEFAULT_BASE = 'https://api.andypeterson.dev/cv';

export interface ApiError {
  code: string;
  message: string;
}
/** One ranked suggestion from the backend's tag suggester. */
export interface TagSuggestion {
  tag: string;
  score: number;
}

/** What the author did with a suggestion (or a tag they typed or removed). */
export interface TagEvent {
  target: 'entry' | 'item';
  id: number;
  tag: string;
  action: 'accept' | 'dismiss' | 'manual' | 'remove';
  rank?: number;
  score?: number;
  scorer?: 'lexical' | 'embedding';
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: ApiError;
}

export interface ProfileMeta {
  id: number;
  name: string;
}
export interface ActiveLoad {
  profile: Profile;
  profiles: ProfileMeta[];
}

/** Every LaTeX special → its literal-text escape. */
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
 * Display text → LaTeX, for writes. A field is made breakage-proof: a permitted
 * `\command` is substituted to its Unicode glyph FIRST, then every remaining
 * LaTeX special is escaped to literal text, so a token is either a known
 * glyph or literal prose. `\rightarrow` → `→` normalizes on the way in (one-way; the
 * glyph is canonical); an unknown `\foobar` becomes the literal text “\foobar”.
 *
 * This is display-safety and defense-in-depth, behind the real boundary: it runs in
 * the browser, so a `curl` bypasses it. The server-side compile path (xelatex) is the
 * real boundary — it must re-escape untrusted field content independently and run
 * sandboxed (no `-shell-escape`, `openin_any=p`).
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
function mapEntryOverrides(raw?: Record<string, RawOverride>): Record<string, EntryOverride> {
  const out: Record<string, EntryOverride> = {};
  for (const [id, o] of Object.entries(raw ?? {})) {
    out[id] = {
      included: o.included ?? null,
      textOverride: o.textOverride == null ? null : untex(o.textOverride),
      sortOverride: o.sortOverride ?? null,
      fieldsOverride: o.fieldsOverride
        ? Object.fromEntries(Object.entries(o.fieldsOverride).map(([k, val]) => [k, untex(val)]))
        : null,
    };
  }
  return out;
}
function mapItemOverrides(raw?: Record<string, RawOverride>): Record<string, ItemOverride> {
  const out: Record<string, ItemOverride> = {};
  for (const [id, o] of Object.entries(raw ?? {})) {
    out[id] = {
      included: o.included ?? null,
      textOverride: o.textOverride == null ? null : untex(o.textOverride),
      sortOverride: o.sortOverride ?? null,
    };
  }
  return out;
}
/** A variant's personal.* overrides, unescaped for display. */
function mapVariantPersonal(p?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p ?? {})) out[k] = untex(v);
  return out;
}
function mapVariant(v: RawMainVariant): Variant {
  return {
    id: v.id,
    name: v.name,
    kind: (v.kind ?? 'cv') as Variant['kind'],
    layoutId: v.layout_id ?? null,
    rules: { include: v.rules?.include ?? [], exclude: v.rules?.exclude ?? [] },
    sections: (v.sections ?? []).map((r) => ({ sectionId: r.section_id, enabled: !!r.enabled })),
    entryOverrides: mapEntryOverrides(v.entryOverrides),
    itemOverrides: mapItemOverrides(v.itemOverrides),
    personal: mapVariantPersonal(v.personal),
    settings: { ...(v.settings ?? {}) },
  };
}
/** coverletter.* header fields, unescaped for display. `tex`/`sections` are internal. */
function mapCoverletter(cl?: Record<string, string>): CoverletterHeader & Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(cl ?? {})) {
    if (k === 'tex' || k === 'sections') continue;
    out[k] = untex(v);
  }
  return out;
}
/** GET /profiles/:pid → the editor's Profile. Rows arrive pre-ordered. */
function mapMain(m: RawMain): Profile {
  const personal: Record<string, string> = {};
  for (const [k, v] of Object.entries(m.personal ?? {})) personal[k] = untex(v);
  return {
    id: m.profile.id,
    name: m.profile.name,
    personal: personal,
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

/** Narrow an unknown response body to the contract error envelope, if present. */
function parseErrorEnvelope(data: unknown): ApiError | undefined {
  if (typeof data !== 'object' || data === null || !('error' in data)) return undefined;
  const err = data.error;
  if (typeof err !== 'object' || err === null) return undefined;
  const { code, message } = err as { code?: unknown; message?: unknown };
  if (typeof code !== 'string' || typeof message !== 'string') return undefined;
  return { code, message };
}

/** Defaults for the length settings, by prefix, and the units a length may use. */
export interface RenderCatalog {
  spacing: Record<string, string>;
  fonts: Record<string, string>;
  units: string[];
}

export class CvApi {
  constructor(private base: string = DEFAULT_BASE) {}

  // self-hosted Google sign-in
  // Auth lives at the gateway root (/auth/*), a sibling of the /cv app, outside
  // /cv/api — so these bypass `req()` and hit `authBase` directly.
  /** The gateway origin (…/cv → …). */
  get authBase(): string {
    return this.base.replace(/\/cv\/?$/, '');
  }
  /** Full-page Google sign-in URL; `redirect` returns the browser to the editor. */
  loginUrl(redirect: string): string {
    return gatewayLoginUrl(this.authBase, redirect);
  }
  /** Where the site's published resume lives — the same URL the home page links. */
  get publishedResumeUrl(): string {
    return `${this.authBase}/resume.pdf`;
  }
  /**
   * The resume PDF the site publishes, served from the gateway's root rather than
   * compiled here. It is what the demo shows: a visitor sees a finished document
   * without an account, and nothing of a real session is involved.
   */
  async fetchPublishedResume(): Promise<Blob | null> {
    try {
      // No cookie: this is a public file, and a credentialed request would ask the
      // gateway to treat it as part of someone's session. The gateway answers these
      // two documents to every origin, which a credentialed request forbids.
      const res = await fetch(this.publishedResumeUrl, {
        credentials: 'omit',
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('pdf')) return null;
      return await res.blob();
    } catch {
      return null; // offline, blocked or too slow — the pane says what it can't show
    }
  }
  /**
   * The backend's render-setting defaults (by prefix) and the LaTeX units a length
   * may use, or null when it cannot be reached.
   */
  async fetchRenderCatalog(): Promise<RenderCatalog | null> {
    try {
      const res = await fetch(`${this.base}/api/catalog`, {
        credentials: 'omit',
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const d = (await res.json()) as {
        styleDefaults?: Partial<Record<string, Record<string, string>>>;
        latexUnits?: string[];
      };
      const sd = d.styleDefaults ?? {};
      if (!sd.SPACING_DEFAULTS || !sd.FONT_DEFAULTS || !Array.isArray(d.latexUnits)) return null;
      return { spacing: sd.SPACING_DEFAULTS, fonts: sd.FONT_DEFAULTS, units: d.latexUnits };
    } catch {
      return null;
    }
  }
  /** The backend's permitted-symbol list, or null when it cannot be reached. */
  async fetchSymbols(): Promise<unknown[] | null> {
    try {
      const res = await fetch(`${this.base}/api/catalog`, {
        credentials: 'omit',
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const d = (await res.json()) as { symbols?: unknown };
      return Array.isArray(d.symbols) ? d.symbols : null;
    } catch {
      return null;
    }
  }
  /** Who is signed in (self-hosted session), or unauthenticated. Never throws. */
  async me(): Promise<{ authenticated: boolean; email: string | null; name: string | null }> {
    try {
      const res = await fetch(`${this.authBase}/auth/me`, {
        credentials: 'include',
        // A hung gateway must not leave the editor saying "connecting" forever.
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return { authenticated: false, email: null, name: null };
      const d = (await res.json()) as { authenticated?: boolean; email?: string; name?: string };
      return { authenticated: !!d.authenticated, email: d.email ?? null, name: d.name ?? null };
    } catch {
      return { authenticated: false, email: null, name: null };
    }
  }
  /** Drop the session server-side. Best-effort; never throws. */
  async logout(): Promise<void> {
    try {
      await fetch(`${this.authBase}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {
      /* best-effort — the local reset happens regardless */
    }
  }

  private async req<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
    try {
      // redirect:'follow' (the default): an AUTHENTICATED request can pass
      // through an Access redirect before landing on its 200, so we must follow
      // it. (redirect:'manual' stops at that hop and misreads a signed-in user
      // as signed-out.) A not-signed-in request 302s to the IdP on another
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
      const data: unknown = isJson ? await res.json() : undefined;
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          error: parseErrorEnvelope(data) ?? {
            code: `http_${res.status}`,
            message: res.statusText,
          },
        };
      }
      // The one wire-boundary cast: the response body is trusted to match the
      // endpoint's declared shape; everything downstream is typed.
      return { ok: true, status: res.status, data: data as T };
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
  listProfiles() {
    return this.req<{ profiles?: ProfileMeta[] }>('/profiles');
  }
  private getMain(pid: number | string) {
    return this.req<RawMain>(`/profiles/${pid}`);
  }

  /** Load one profile by id and map it to the editor's Profile shape. */
  async fetchProfile(pid: number | string): Promise<ApiResult<Profile>> {
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
    const list = await this.listProfiles();
    if (!list.ok || !list.data) {
      return { ok: false, status: list.status, error: list.error };
    }
    const profiles = list.data.profiles ?? [];
    if (!profiles.length) {
      return {
        ok: false,
        status: 404,
        error: { code: 'no_profiles', message: 'No profiles available' },
      };
    }
    // Default to the most recently created (highest id) profile; the user can
    // switch via the profile picker.
    const pid = profiles[profiles.length - 1].id;
    const loaded = await this.fetchProfile(pid);
    if (!loaded.ok || !loaded.data) {
      return { ok: false, status: loaded.status, error: loaded.error };
    }
    return { ok: true, status: 200, data: { profile: loaded.data, profiles } };
  }

  // profile (profile) CRUD
  createProfile(name: string) {
    return this.req<{ id: number }>('/profiles', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }
  renameProfile(id: number, name: string) {
    return this.req(`/profiles/${id}`, { method: 'PUT', body: JSON.stringify({ name }) });
  }
  deleteProfile(id: number) {
    return this.req(`/profiles/${id}`, { method: 'DELETE' });
  }

  // ---- version history. A version's `doc` is the editor's Profile snapshot,
  // stored as an opaque JSON blob; the backend rebuilds its tables from it on
  // restore.
  listVersions(pid: number) {
    return this.req<{
      versions: {
        id: number;
        label?: string;
        createdAt: number;
        branch: string;
        tag?: string | null;
        parent?: number | null;
        doc: Profile;
      }[];
    }>(`/profiles/${pid}/versions`);
  }
  /** One checkpoint in full, including its `doc` snapshot — for the diff view. */
  getVersion(pid: number, id: number) {
    return this.req<{
      id: number;
      label: string;
      createdAt: number;
      branch: string;
      tag?: string | null;
      parent?: number | null;
      doc: Profile;
    }>(`/profiles/${pid}/versions/${id}`);
  }
  commitVersion(pid: number, v: { label: string; doc: Profile; branch?: string; parent?: number }) {
    return this.req<{ id: number }>(`/profiles/${pid}/versions`, {
      method: 'POST',
      body: JSON.stringify(v),
    });
  }
  restoreVersion(pid: number, id: number) {
    return this.req(`/profiles/${pid}/versions/${id}/restore`, { method: 'POST' });
  }
  /** Set (or clear, with '') a checkpoint's frozen provenance tag. */
  tagVersion(pid: number, id: number, tag: string) {
    return this.req(`/profiles/${pid}/versions/${id}/tag`, {
      method: 'POST',
      body: JSON.stringify({ tag }),
    });
  }

  // writes (display text is LaTeX-escaped on the way out)
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
    return this.req(`/profiles/${pid}/personal`, {
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
    return this.req<{ id: number }>(`/profiles/${pid}/sections`, {
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
    return this.req(`/profiles/${pid}/sections/order`, {
      method: 'PATCH',
      body: JSON.stringify({ ids }),
    });
  }

  // global settings (style/spacing/fonts) + layouts
  getSettings(prefix: string) {
    return this.req<Record<string, unknown>>(`/settings?prefix=${prefix}`);
  }
  /** A null value resets the key to its default. */
  patchSettings(patch: Record<string, SettingValue | null>) {
    return this.req('/settings', { method: 'PATCH', body: JSON.stringify(patch) });
  }
  /** A variant's own style/spacing/fonts; a null value drops the override. */
  patchVariantSettings(variantId: number, patch: Record<string, SettingValue | null>) {
    return this.req(`/variants/${variantId}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }
  getLayouts() {
    return this.req<{ layouts?: LayoutInfo[]; default?: string | null; canReview?: boolean }>(
      '/layouts',
    );
  }
  setDefaultLayout(id: string) {
    return this.req<{ warnings?: string[] }>('/layouts/default', {
      method: 'PUT',
      body: JSON.stringify({ layout_id: id }),
    });
  }
  /** Pin a variant to a layout, or null to follow the account default. */
  setVariantLayout(variantId: number, layoutId: string | null) {
    return this.req<{ warnings?: string[] }>(`/variants/${variantId}/layout`, {
      method: 'PUT',
      body: JSON.stringify({ layout_id: layoutId }),
    });
  }
  publishLayout(id: string) {
    return this.req(`/layouts/${encodeURIComponent(id)}/publish`, { method: 'POST', body: '{}' });
  }
  unpublishLayout(id: string) {
    return this.req(`/layouts/${encodeURIComponent(id)}/unpublish`, { method: 'POST', body: '{}' });
  }
  deleteLayout(id: string) {
    return this.req(`/layouts/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
  getLayoutReviews() {
    return this.req<{ pending?: LayoutReview[]; maxCompileMs?: number }>('/layouts/review');
  }
  reviewLayout(id: string, decision: 'approve' | 'reject', note: string) {
    return this.req(`/layouts/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, note }),
    });
  }
  /**
   * Check a layout zip (`install: false`) or install it. Multipart, so it goes
   * around `req`, which always sends JSON.
   */
  async sendLayoutZip(file: File, { install }: { install: boolean }): Promise<LayoutCheck> {
    const form = new FormData();
    form.append('bundle', file);
    try {
      const res = await fetch(`${this.base}/api/layouts${install ? '' : '/check'}`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        missing?: string[];
        layout?: LayoutInfo;
        error?: { message?: string };
      } | null;
      const missing = body?.missing ?? [];
      if (res.ok) return { ok: install ? true : !!body?.ok, missing, installed: body?.layout };
      return { ok: false, missing, error: body?.error?.message ?? `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, missing: [], error: e instanceof Error ? e.message : String(e) };
    }
  }
  /** A layout's bundle as a zip Blob, or null when it cannot be downloaded. */
  async downloadLayout(id: string): Promise<Blob | null> {
    try {
      const res = await fetch(`${this.base}/api/layouts/${encodeURIComponent(id)}/bundle`, {
        credentials: 'include',
      });
      return res.ok ? await res.blob() : null;
    } catch {
      return null;
    }
  }

  // tags on entries + items
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

  // tag suggestion
  suggestTags(pid: number, text: string, limit: number) {
    return this.req<{ query: string; results: TagSuggestion[] }>(`/profiles/${pid}/tags/suggest`, {
      method: 'POST',
      body: JSON.stringify({ text, limit, scorer: 'embedding' }),
    });
  }
  recordTagEvents(pid: number, events: TagEvent[]) {
    return this.req(`/profiles/${pid}/tags/events`, {
      method: 'POST',
      body: JSON.stringify({ events }),
    });
  }

  // variants (the lens)
  createVariant(pid: number, variant: { name: string; kind: Variant['kind'] }) {
    return this.req<{ id: number }>(`/profiles/${pid}/variants`, {
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
  /**
   * Set (or clear) a per-variant override on an entry or item. The backend upsert is
   * whole-row and deletes the row when every field is null, so callers pass the
   * complete desired state. `fieldsOverride` (entry only) and
   * `textOverride` are tex-escaped on the way out; reads `untex` in `mapVariant`.
   */
  setVariantOverride(
    id: number,
    o: {
      targetType: 'entry' | 'item';
      targetId: number;
      included?: number | boolean | null;
      textOverride?: string | null;
      sortOverride?: number | null;
      fieldsOverride?: Record<string, string> | null;
    },
  ) {
    const body: Record<string, unknown> = {
      targetType: o.targetType,
      targetId: o.targetId,
      included: o.included == null ? null : !!o.included,
      textOverride: o.textOverride == null ? null : tex(o.textOverride),
      sortOverride: o.sortOverride ?? null,
    };
    if (o.targetType === 'entry') {
      body.fieldsOverride = o.fieldsOverride ? texFields(o.fieldsOverride) : null;
    }
    return this.req(`/variants/${id}/overrides`, { method: 'PUT', body: JSON.stringify(body) });
  }

  // cover letter: header + body paragraphs, both per variant
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
  /**
   * Per-variant personal.* overrides. A null value clears the override, so the
   * field inherits the profile value again; '' suppresses it for this variant.
   */
  updateVariantPersonal(variantId: number, patch: Record<string, string | null>) {
    const body: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(patch)) body[k] = v === null ? null : tex(v);
    return this.req(`/variants/${variantId}/personal`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
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
  /** POST /profiles/:pid/import — load an export tree into a (new, empty) profile. Used to
   *  carry a visitor's demo edits into their account after sign-in. */
  importProfile(pid: number, tree: unknown) {
    return this.req(`/profiles/${pid}/import`, { method: 'POST', body: JSON.stringify(tree) });
  }
  /** GET /profiles/:pid/export → the backend's import-compatible tree (authoritative). */
  exportProfile(pid: number) {
    return this.req<unknown>(`/profiles/${pid}/export`);
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

  /**
   * Compile the full "main" document to PDF (GET /variants/main/:pid/pdf — the whole
   * CV with no variant lens). Same shape as compilePdf: application/pdf → Blob on
   * success, { success:false, log } → error message on failure. Owner-gated (the
   * backend treats any /pdf GET as a compile GET regardless of profile).
   */
  async compileMainPdf(profileId: number): Promise<ApiResult<Blob>> {
    try {
      const res = await fetch(`${this.base}/api/variants/main/${profileId}/pdf`, {
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
