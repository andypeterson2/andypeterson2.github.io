/**
 * Service Configuration for static-hosted frontends.
 *
 * When frontends are hosted on GitHub Pages (or any static host), they need
 * to know where their backend services are running. This module provides a
 * unified way to read/write backend URLs via URL parameters and localStorage.
 *
 * Priority order:  URL parameter  >  localStorage  >  default
 *
 * URL-param origins are allowlisted (same-origin, api.andypeterson.dev, or a
 * localhost/LAN host when the page itself is dev) — mirroring the CSP connect-src
 * list — so a crafted ?backend= link cannot silently repoint a frontend at an
 * attacker origin. Defaults and user-entered URLs (set()) are trusted, not gated.
 *
 * State (URL params + stored map) is initialised lazily on first use rather
 * than at load time, so tests can reset it (`_resetForTests`) and import order
 * relative to history/location mutation doesn't matter.
 */

const STORAGE_KEY = 'service-config';

export interface ServiceConfigApi {
  isAllowedUrl(url: string): boolean;
  get(name: string, defaultUrl?: string): string;
  set(name: string, url: string): void;
  remove(name: string): void;
  isConfigured(name: string): boolean;
  resolveBackend(name: string, defaultUrl?: string): string;
  getAll(): Record<string, string>;
  /** Test hook: drop cached params/storage so the next call re-reads them. */
  _resetForTests(): void;
}

interface State {
  params: URLSearchParams;
  stored: Partial<Record<string, string>>;
}

let _state: State | undefined;

function state(): State {
  if (!_state) {
    let stored: Partial<Record<string, string>> = {};
    try {
      stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<
        Record<string, string>
      >;
    } catch {
      /* corrupt JSON / private-mode storage — start empty */
    }
    _state = { params: new URLSearchParams(window.location.search), stored };
  }
  return _state;
}

function save(stored: Partial<Record<string, string>>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

function normalise(url: string | undefined): string {
  if (!url) return '';
  let out = url.trim();
  if (!out) return '';
  if (out.endsWith('/')) out = out.slice(0, -1);
  if (!/^https?:\/\//.test(out)) out = 'https://' + out;
  return out;
}

// Backend origins an (untrusted) URL param may point at. Mirrors the CSP
// connect-src allowlist in astro.config.mjs — belt-and-suspenders: in production
// the CSP already blocks the fetch, this rejects it earlier and more legibly.
const ALLOWED_ORIGINS = ['https://api.andypeterson.dev'];

function isLocalHost(h: string): boolean {
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '::1' ||
    h === '[::1]' ||
    /\.local$/i.test(h) ||
    h.startsWith('127.') ||
    h.startsWith('10.') ||
    h.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  );
}

function isAllowed(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.origin === window.location.origin) return true; // same-origin
  if (ALLOWED_ORIGINS.includes(u.origin)) return true; // prod gateway
  // Dev only: localhost/LAN backends, but only when the page itself is served
  // from a localhost/LAN host (mirrors the non-prod branch of the CSP list).
  if (isLocalHost(window.location.hostname) && isLocalHost(u.hostname)) return true;
  return false;
}

// Normalise + allowlist a value that came from an untrusted URL param. Returns ''
// (and warns) if it's not allowed, so callers fall through to storage/default.
function fromParam(raw: string): string {
  const url = normalise(raw);
  if (!url) return '';
  if (isAllowed(url)) return url;
  console.warn('[ServiceConfig] Ignoring backend URL outside the allowlist:', url);
  return '';
}

export const ServiceConfig: ServiceConfigApi = {
  /** Public allowlist check — apps validate navbar:connect URLs with this. */
  isAllowedUrl(url: string): boolean {
    return isAllowed(normalise(url) || url);
  },

  /** Get the base URL for a named service (no trailing slash). */
  get(name, defaultUrl) {
    const { params, stored } = state();
    const raw = params.get(name);
    if (raw) {
      const url = fromParam(raw);
      if (url) return url;
    }
    return stored[name] ?? normalise(defaultUrl);
  },

  /** Persist a service URL in localStorage (normalised). */
  set(name, url) {
    const { stored } = state();
    stored[name] = normalise(url);
    save(stored);
  },

  /** Remove a persisted service URL. */
  remove(name) {
    const s = state();
    s.stored = Object.fromEntries(Object.entries(s.stored).filter(([key]) => key !== name));
    save(s.stored);
  },

  /** Check if a service URL is configured (via param or storage). */
  isConfigured(name) {
    const { params, stored } = state();
    return !!(params.get(name) ?? stored[name]);
  },

  /**
   * Resolve a backend URL with support for the unified ?backend= param.
   * Priority: ?serviceName= > ?backend= > localStorage > default
   */
  resolveBackend(name, defaultUrl) {
    const { params, stored } = state();
    // 1. Per-service URL param (?nonogram=host:port) — allowlist-gated
    const perService = params.get(name);
    if (perService) {
      const url = fromParam(perService);
      if (url) return url;
    }
    // 2. Unified backend param (?backend=host:port) — allowlist-gated
    const unified = params.get('backend');
    if (unified) {
      const url = fromParam(unified);
      if (url) return url;
    }
    // 3. localStorage, then 4. default
    return stored[name] ?? normalise(defaultUrl);
  },

  /** Get all configured services (storage overlaid by allowed URL params). */
  getAll() {
    const { params, stored } = state();
    const result: Record<string, string> = {};
    for (const [key, val] of Object.entries(stored)) {
      if (val) result[key] = val;
    }
    params.forEach((val, key) => {
      const url = fromParam(val);
      if (url) result[key] = url;
    });
    return result;
  },

  _resetForTests() {
    _state = undefined;
  },
};

window.ServiceConfig = ServiceConfig;
