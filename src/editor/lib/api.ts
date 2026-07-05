// cv API client — credentialed fetches through the gateway (behind Cloudflare
// Access). The Access cookie rides along via credentials:'include'. Contract +
// endpoints: docs/editor-redesign.md §2 and §6.
import type { Person } from './types';

/** The gateway's cv upstream. The cv API itself lives under `/api`. */
const DEFAULT_BASE = 'https://api.andypeterson.dev/cv';

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: { code: string; message: string };
}

export class CvApi {
  constructor(private base: string = DEFAULT_BASE) {}

  private async req<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
    try {
      const res = await fetch(`${this.base}/api${path}`, {
        credentials: 'include',
        headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
        ...init,
      });
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
    return this.req<{ status: string; service: string; version: string }>('/health');
  }
  listPersons() {
    return this.req<Person[]>('/persons');
  }
  getPerson(id: number) {
    return this.req<Person>(`/persons/${id}`);
  }
  // Writes (PUT/PATCH/POST/DELETE) are wired in a later increment — see the
  // feature→endpoint checklist in docs/editor-redesign.md §6.
}

export const api = new CvApi();
