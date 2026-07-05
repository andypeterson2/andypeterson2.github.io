// cv API client — credentialed fetches through the gateway (behind Cloudflare
// Access). The Access cookie rides along via credentials:'include'. READS ONLY
// for now; writes land in a later increment.
//
// The backend is active-person + resource oriented (there is no single
// person-tree endpoint): GET /persons gives the active id + names, personal
// info comes from /settings?prefix=personal (flat `personal.*` keys), the
// document's ordered/enabled sections from /documents/:variant, and each
// section's entries+items from /sections/:id. `fetchActivePerson()` composes
// those into the editor's Person shape. Contract mirrored from
// public/cv/api-paths.js + app-*.js.
import type { Person, Section, Entry, Item, Personal } from './types';

/** The gateway's cv upstream. The cv API itself lives under `/api`. */
const DEFAULT_BASE = 'https://api.andypeterson.dev/cv';

export type ApiError = { code: string; message: string };
export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: ApiError;
}

// ---- raw shapes as returned by the cv backend ----
interface RawItem {
  id: number;
  title?: string;
  content?: string;
  sort_order?: number;
}
interface RawEntry {
  id: number;
  fields?: Record<string, string>;
  items?: RawItem[];
  sort_order?: number;
}
interface RawSectionData {
  type?: string;
  entries?: RawEntry[];
}
interface RawSectionMeta {
  id: number | string;
  type: string;
  title: string;
}
interface RawPersonsResp {
  persons: { id: number; name: string }[];
  activePersonId: number;
}
interface RawDocRef {
  sectionId: number | string;
  enabled?: boolean;
  sortOrder?: number;
}
interface RawDocResp {
  sections: RawDocRef[];
}

/**
 * Minimal LaTeX→text for display. NOTE: this is intentionally one-directional
 * for the read-only increment. When writes are wired, it MUST be paired with
 * the inverse (text→LaTeX) on the way out, or round-trips will corrupt data.
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

function mapItems(items: RawItem[] = []): Item[] {
  return [...items]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((it) => ({ id: it.id, title: untex(it.title), content: untex(it.content), tags: [] }));
}
function mapEntry(e: RawEntry): Entry {
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(e.fields ?? {})) fields[k] = untex(v);
  return { id: e.id, fields, items: mapItems(e.items), tags: [] };
}
function stripPersonalPrefix(flat: Record<string, string>): Personal {
  const p: Record<string, string> = {};
  for (const [k, v] of Object.entries(flat ?? {})) p[k.replace(/^personal\./, '')] = untex(v);
  return p as Personal;
}

export class CvApi {
  constructor(private base: string = DEFAULT_BASE) {}

  private async req<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
    try {
      const res = await fetch(`${this.base}/api${path}`, {
        credentials: 'include',
        // Access answers an unauthenticated request with a 302 to the IdP. With
        // redirect:'manual' the browser surfaces it as an opaqueredirect instead
        // of chasing it cross-origin and logging a CORS error — that's our
        // "not signed in" signal.
        redirect: 'manual',
        headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
        ...init,
      });
      if (res.type === 'opaqueredirect' || res.status === 401 || res.status === 403) {
        return {
          ok: false,
          status: res.status || 0,
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
  getPersons() {
    return this.req<RawPersonsResp>('/persons');
  }
  getPersonal() {
    return this.req<Record<string, string>>('/settings?prefix=personal');
  }
  getSections() {
    return this.req<RawSectionMeta[]>('/sections');
  }
  getDocument(variant: string) {
    return this.req<RawDocResp>(`/documents/${variant}`);
  }
  getSectionData(id: number | string) {
    return this.req<RawSectionData>(`/sections/${id}`);
  }

  /**
   * Assemble the active person's full 'cv' document into the editor's Person
   * shape. Returns an `auth_required` error when the caller isn't signed into
   * Access, so the UI can offer a sign-in and fall back to the local demo.
   */
  async fetchActivePerson(): Promise<ApiResult<Person>> {
    const persons = await this.getPersons();
    if (!persons.ok || !persons.data) {
      return { ok: false, status: persons.status, error: persons.error };
    }

    const [personal, sections, doc] = await Promise.all([
      this.getPersonal(),
      this.getSections(),
      this.getDocument('cv'),
    ]);
    if (!sections.ok || !sections.data) {
      return {
        ok: false,
        status: sections.status,
        error: sections.error ?? { code: 'load_failed', message: 'Could not load sections' },
      };
    }

    const meta = sections.data;
    const refs: RawDocRef[] =
      doc.ok && doc.data?.sections?.length
        ? doc.data.sections
            .filter((r) => r.enabled !== false)
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        : meta.map((s, i) => ({ sectionId: s.id, sortOrder: i }));

    const datas = await Promise.all(refs.map((r) => this.getSectionData(r.sectionId)));
    const outSections: Section[] = refs.map((r, i) => {
      const m = meta.find((s) => String(s.id) === String(r.sectionId));
      const d = datas[i].ok ? datas[i].data : undefined;
      const entries = [...(d?.entries ?? [])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      );
      return {
        id: r.sectionId,
        type: m?.type ?? d?.type ?? 'summary',
        title: m?.title ?? '',
        entries: entries.map(mapEntry),
      };
    });

    const activeId = persons.data.activePersonId ?? 0;
    const person: Person = {
      id: activeId,
      name: persons.data.persons.find((p) => p.id === activeId)?.name ?? '',
      personal: personal.ok && personal.data ? stripPersonalPrefix(personal.data) : {},
      sections: outSections,
    };
    return { ok: true, status: 200, data: person };
  }
}

export const api = new CvApi();
