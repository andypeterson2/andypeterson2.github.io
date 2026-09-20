/**
 * Where a statically hosted frontend finds its backend.
 *
 * The site deploys to Cloudflare Pages with no server of its own, so each app
 * resolves a backend base URL at runtime: a `?backend=` or `?<service>=` URL
 * parameter if one is present, otherwise the default its page was built with.
 *
 * Every candidate passes the same allowlist — same-origin, api.andypeterson.dev,
 * or a localhost/LAN host while the page itself is served from one. It mirrors the
 * CSP connect-src list, so a crafted `?backend=` link is refused here before the
 * browser would refuse the fetch, and a localhost default is inert in production.
 *
 * Parameters are read lazily on first use, so tests can swap the location shim and
 * call `_resetForTests()` rather than depending on import order.
 */

export interface ServiceConfigApi {
  isAllowedUrl(url: string): boolean;
  resolveBackend(name: string, defaultUrl?: string): string;
  /** Test hook: drop the cached parameters so the next call re-reads them. */
  _resetForTests(): void;
}

let _params: URLSearchParams | undefined;

function params(): URLSearchParams {
  _params ??= new URLSearchParams(window.location.search);
  return _params;
}

function normalise(url: string | undefined): string {
  if (!url) return '';
  let out = url.trim();
  if (!out) return '';
  if (out.endsWith('/')) out = out.slice(0, -1);
  if (!/^https?:\/\//.test(out)) out = 'https://' + out;
  return out;
}

// Backend origins an (untrusted) URL param may point at. Mirrors the CSP connect-src
// allowlist, which already blocks the fetch in production; this rejects it earlier.
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
  if (u.origin === window.location.origin) return true;
  if (ALLOWED_ORIGINS.includes(u.origin)) return true; // prod gateway
  // Dev only: localhost/LAN backends, when the page itself is served from localhost/LAN.
  if (isLocalHost(window.location.hostname) && isLocalHost(u.hostname)) return true;
  return false;
}

// Normalise + allowlist a value that came from an untrusted URL param. Returns ''
// (and warns) when it is not allowed, so the caller falls through to the default.
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

  /**
   * Resolve a backend base URL, most specific source first:
   * `?<service>=`, then `?backend=`, then the default the page supplies.
   * Each is allowlist-gated, so a localhost default is inert in production.
   */
  resolveBackend(name, defaultUrl) {
    const p = params();
    for (const raw of [p.get(name), p.get('backend')]) {
      if (!raw) continue;
      const url = fromParam(raw);
      if (url) return url;
    }
    const fallback = normalise(defaultUrl);
    return fallback && isAllowed(fallback) ? fallback : '';
  },

  _resetForTests() {
    _params = undefined;
  },
};
