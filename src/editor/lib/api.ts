// cv API client — credentialed fetches through the gateway (behind Cloudflare
// Access). The Access cookie rides along via credentials:'include'. READS ONLY
// for now; writes land in a later increment.
//
// The backend is id-addressable — there is NO active-person/session state.
// GET /persons lists profiles ({id,name}); GET /persons/:pid returns that
// profile's full "master" (person + personal + sections→entries→items→tags,
// variants, tag vocab) in one shot. The gateway tiers access: an allowlisted
// (owner) Access identity gets every profile; anyone else gets the public demo
// profile only. Contract: cv/editor/routes/persons.js + lib/db.js#getMaster.
import type { Person, Personal, Item, Entry } from './types';

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

// ---- raw shapes as returned by GET /persons/:pid (getMaster) ----
interface RawMasterItem {
  id: number;
  title?: string;
  content?: string;
  tags?: string[];
}
interface RawMasterEntry {
  id: number;
  fields?: Record<string, string>;
  items?: RawMasterItem[];
  tags?: string[];
}
interface RawMasterSection {
  id: number | string;
  slug?: string;
  type: string;
  title: string;
  entries?: RawMasterEntry[];
}
interface RawMaster {
  person: { id: number; name: string };
  personal?: Record<string, string>;
  sections?: RawMasterSection[];
}

/**
 * Minimal LaTeX→text for display. NOTE: intentionally one-directional for the
 * read-only increment. When writes are wired it MUST be paired with the inverse
 * (text→LaTeX) on the way out, or round-trips will corrupt data.
 */
function untex(s: string | undefined): string {
  if (!s) return '';
  return s
    .replace(/\\%/g, '%')
    .replace(/\\&/g, '&')
    .replace(/\\\$/g, '$')
    .replace(/\\#/g, '#')
    .replace(/\\_/g, '_')
    .replace(/\s*--\s*/g, ' – ')
    .replace(/~/g, ' ');
}

function mapItem(it: RawMasterItem): Item {
  return { id: it.id, title: untex(it.title), content: untex(it.content), tags: it.tags ?? [] };
}
function mapEntry(e: RawMasterEntry): Entry {
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(e.fields ?? {})) fields[k] = untex(v);
  return { id: e.id, fields, items: (e.items ?? []).map(mapItem), tags: e.tags ?? [] };
}
/** GET /persons/:pid (getMaster) → the editor's Person. Rows arrive pre-ordered. */
function mapMaster(m: RawMaster): Person {
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
  private getMaster(pid: number | string) {
    return this.req<RawMaster>(`/persons/${pid}`);
  }

  /** Load one profile by id and map it to the editor's Person shape. */
  async fetchPerson(pid: number | string): Promise<ApiResult<Person>> {
    const res = await this.getMaster(pid);
    if (!res.ok || !res.data) {
      return {
        ok: false,
        status: res.status,
        error: res.error ?? { code: 'load_failed', message: 'Could not load profile' },
      };
    }
    return { ok: true, status: 200, data: mapMaster(res.data) };
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
}

export const api = new CvApi();
