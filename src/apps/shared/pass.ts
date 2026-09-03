/**
 * SitePass — client-side handling of a recruiter pass (?pass=<token>).
 *
 * A pass (minted by the owner — see the gateway's POST /gate/pass) unlocks the
 * LIVE tier of a demo-first app: it routes the app's backend calls through the
 * gateway (api.andypeterson.dev/<service>) and attaches the pass as a Bearer
 * token. Without a pass the app stays on its free, in-browser tier. On ANY
 * live-call failure (expired / invalid / over-quota / backend asleep-and-down)
 * the app falls back to that free tier — a pass only ever ADDS capability, it
 * never breaks the page.
 *
 * On load: read ?pass=, keep it in sessionStorage (so it survives in-app
 * navigation), and strip it from the visible URL so the token is not shown or
 * bookmarked. This module's side effects (URL scrub, fetch wrapper, live-tier
 * activation) run at import — it must be the FIRST import of the shared entry
 * so the wrapped fetch is installed before anything calls out.
 */

const GATEWAY = 'https://api.andypeterson.dev'; // the single API front door
const KEY = 'site-pass';

export interface SitePassApi {
  token(): string | null;
  active(): boolean;
  gatewayBase(service: string): string;
  clear(): void;
}

function token(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
function active(): boolean {
  return !!token();
}

// ── Read + persist the pass, then scrub it from the URL ──
try {
  const params = new URLSearchParams(location.search);
  const fromUrl = params.get('pass');
  if (fromUrl) {
    sessionStorage.setItem(KEY, fromUrl);
    params.delete('pass');
    const qs = params.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  }
} catch {
  /* private-mode storage / history quirks — degrade to no pass */
}

// ── Attach the Bearer to cross-origin backend calls while a pass is held ──
// One interception point covers every transport that goes through fetch
// (SiteContract, the apps' raw fetch, Socket.IO's polling handshake). Same-
// origin fetches (model weights, page assets) are left untouched.
const originalFetch = window.fetch.bind(window);

function isCrossOrigin(input: RequestInfo | URL): boolean {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  try {
    return new URL(url, location.href).origin !== location.origin;
  } catch {
    return false; // opaque input — treat as same-origin, no header
  }
}

function withBearer(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  pass: string,
): RequestInit {
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined),
  );
  if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${pass}`);
  return { ...init, headers };
}

window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const pass = token();
  if (pass && isCrossOrigin(input)) {
    return originalFetch(input, withBearer(input, init, pass));
  }
  return originalFetch(input, init);
};

// ── With a pass, activate the live tier: point the app at the gateway ──
// Dispatches the same navbar:connect the connect modal uses, so the app's
// existing connected path runs — now through the gateway, with the Bearer.
function activateLive(): void {
  if (!active()) return;
  const service = document.querySelector('meta[name="site-backend"]')?.getAttribute('content');
  if (!service) return;
  document.dispatchEvent(
    new CustomEvent('navbar:connect', {
      detail: { service, url: `${GATEWAY}/${service}` },
    }),
  );
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(activateLive, 0); // after the apps have registered their listeners
  });
} else {
  setTimeout(activateLive, 0);
}

export const SitePass: SitePassApi = {
  token,
  active,
  gatewayBase: (service) => `${GATEWAY}/${service}`,
  clear() {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};

window.SitePass = SitePass;
