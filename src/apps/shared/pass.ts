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

// ── Attach the Bearer to GATEWAY calls while a pass is held ──
// One interception point covers every transport that goes through fetch
// (SiteContract, the apps' raw fetch, Socket.IO's polling handshake). The
// header attaches ONLY to requests whose origin is the gateway itself: any
// broader rule (the original implementation used "any cross-origin URL")
// hands the recruiter token to whatever third-party host page code fetches.
const originalFetch = window.fetch.bind(window);

function isGatewayRequest(input: RequestInfo | URL): boolean {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  try {
    return new URL(url, location.href).origin === GATEWAY;
  } catch {
    return false; // opaque input — no header
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
  if (pass && isGatewayRequest(input)) {
    return originalFetch(input, withBearer(input, init, pass));
  }
  return originalFetch(input, init);
};

// ── With a pass, activate the live tier: point the app at the gateway ──
// The gated backends sleep when idle, so activation is HEALTH-GATED: announce a
// waking state to the service's nav widget, warm-ping /health (each GET rides
// free through the pass gate and wakes the box) with backoff for up to ~30s,
// and only dispatch navbar:connect once the backend actually answers — the
// recruiter never fires a real request into a cold box. On give-up the widget
// returns to idle and the free client-side tier stands untouched.

const WARM_DEADLINE_MS = 30_000;

/** Ping the service's /health through the gateway until it answers (or we give up). */
export async function warmUntilHealthy(
  service: string,
  deadlineMs: number = WARM_DEADLINE_MS,
): Promise<boolean> {
  const deadline = Date.now() + deadlineMs;
  let delay = 1000;
  while (Date.now() < deadline) {
    try {
      // Goes through the wrapped fetch → the pass Bearer is attached; GETs
      // spend no quota. The first ping is what wakes a sleeping backend.
      const r = await fetch(`${GATEWAY}/${service}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (r.ok) return true;
      // 402/401: the pass is bad — waking will never help; stop immediately.
      if (r.status === 401 || r.status === 402) return false;
    } catch {
      /* still waking / network blip — retry below */
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * 1.5, 5000);
  }
  return false;
}

async function activateLive(): Promise<void> {
  if (!active()) return;
  const service = document.querySelector('meta[name="site-backend"]')?.getAttribute('content');
  if (!service) return;
  document.dispatchEvent(new CustomEvent('navbar:connect-pending', { detail: { service } }));
  if (!(await warmUntilHealthy(service))) {
    document.dispatchEvent(new CustomEvent('navbar:connect-failed', { detail: { service } }));
    return;
  }
  // Dispatches the same navbar:connect the connect modal uses, so the app's
  // existing connected path runs — now through the gateway, with the Bearer.
  document.dispatchEvent(
    new CustomEvent('navbar:connect', {
      detail: { service, url: `${GATEWAY}/${service}` },
    }),
  );
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => void activateLive(), 0); // after the apps have registered their listeners
  });
} else {
  setTimeout(() => void activateLive(), 0);
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
