/**
 * SitePass — client-side handling of a recruiter pass (?pass=<token>).
 *
 * A pass (minted by the owner via the gateway's POST /gate/pass) unlocks the
 * LIVE tier of a demo-first app: it routes the app's backend calls through the
 * gateway (api.andypeterson.dev/<service>) and attaches the pass as a Bearer
 * token. Without a pass the app stays on its free, in-browser tier. On any
 * live-call failure (expired / invalid / over-quota / backend asleep-and-down)
 * the app falls back to that free tier — a pass only ever ADDS capability, it
 * never breaks the page.
 *
 * On load: read the pass from #pass= (a fragment never reaches a server or a log) or
 * ?pass=, keep it in sessionStorage (so it survives in-app navigation), and strip it
 * from the visible URL so the token is not shown or bookmarked. This module's side effects (URL scrub, fetch wrapper, live-tier
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
  const frag = new URLSearchParams(location.hash.slice(1));
  const fromUrl = frag.get('pass') ?? params.get('pass');
  if (fromUrl) {
    sessionStorage.setItem(KEY, fromUrl);
    params.delete('pass');
    frag.delete('pass');
    const qs = params.toString();
    const hash = frag.toString();
    history.replaceState(
      null,
      '',
      location.pathname + (qs ? '?' + qs : '') + (hash ? '#' + hash : ''),
    );
  }
} catch {
  /* private-mode storage / history quirks — degrade to no pass */
}

// ── Attach the Bearer to GATEWAY-origin fetches only, while a pass is held ──
// One wrapper covers every fetch transport; a broader rule leaks the token to third parties.
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
  if (!isGatewayRequest(input)) return originalFetch(input, init);
  // Credentials on every gateway call, so an owner's Cloudflare Access cookie
  // reaches the front door. Cross-origin fetches send none by default, which is
  // why a signed-in owner looked anonymous and got the pass gate's 402. The
  // gateway answers with a named origin and allow-credentials, never a wildcard.
  const opts: RequestInit = { ...init, credentials: init?.credentials ?? 'include' };
  const pass = token();
  return originalFetch(input, pass ? withBearer(input, opts, pass) : opts);
};

// ── With a pass, activate the live tier: point the app at the gateway ──
// The gated backends sleep when idle, so activation is HEALTH-GATED: show a waking state
// in the service's nav widget, warm-ping /health (GETs ride free through the pass gate and
// wake the box) with backoff for up to ~30s, and dispatch navbar:connect only once the
// backend answers. On give-up the widget returns to idle and the client-side tier stands.

const WARM_DEADLINE_MS = 30_000;

/** Why a warm-up ended: the backend answered, the pass was refused, or it never woke. */
export type WarmResult = 'ok' | 'unauthorized' | 'unreachable';

/** Ping the service's /health through the gateway until it answers (or we give up). */
export async function warmUntilHealthy(
  service: string,
  deadlineMs: number = WARM_DEADLINE_MS,
  { stopOnUnreachable = false }: { stopOnUnreachable?: boolean } = {},
): Promise<WarmResult> {
  const deadline = Date.now() + deadlineMs;
  let delay = 1000;
  while (Date.now() < deadline) {
    try {
      // Goes through the wrapped fetch → the pass Bearer is attached; GETs
      // spend no quota. The first ping is what wakes a sleeping backend.
      const r = await fetch(`${GATEWAY}/${service}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (r.ok) return 'ok';
      // 402/401: the pass is bad — waking will never help; stop immediately.
      if (r.status === 401 || r.status === 402) return 'unauthorized';
    } catch {
      // A throw is the gateway not answering at all, not a box warming up: no
      // CORS headers, no network, wrong origin. Nothing claimed a credential
      // here, so there is nothing for a retry to win.
      if (stopOnUnreachable) return 'unreachable';
      /* still waking / network blip — retry below */
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * 1.5, 5000);
  }
  return 'unreachable';
}

async function activateLive(): Promise<void> {
  const service = document.querySelector('meta[name="site-backend"]')?.getAttribute('content');
  if (!service) return;
  // A pass is one way in; an owner's Access session is the other, and the
  // browser cannot read that cookie to tell. So the probe runs either way and
  // the gateway's answer decides. Without a pass this costs one request, since
  // a refusal ends the loop on the first pass through it.
  const held = active();
  if (held) {
    document.dispatchEvent(new CustomEvent('navbar:connect-pending', { detail: { service } }));
  }
  const result = await warmUntilHealthy(service, WARM_DEADLINE_MS, {
    stopOnUnreachable: !held,
  });
  if (result !== 'ok') {
    // Nothing was claimed, so a refusal is the ordinary case rather than a
    // failure worth showing: the client-side tier is what this visitor gets.
    if (!held) return;
    // A refused pass is forgotten, so a dead Bearer stops riding on later requests;
    // a backend that never woke keeps its pass for a retry.
    if (result === 'unauthorized') SitePass.clear();
    document.dispatchEvent(
      new CustomEvent('navbar:connect-failed', { detail: { service, reason: result } }),
    );
    return;
  }
  // navbar:connect is the app's own connected path: it takes the gateway URL from
  // here and runs everything it would for any other backend, with the Bearer.
  document.dispatchEvent(
    new CustomEvent('navbar:connect', {
      detail: { service, url: `${GATEWAY}/${service}` },
    }),
  );
}
// Re-runs the same health-gated activation for a caller that wants another attempt
// after a give-up. The lifecycle events above are the seam a status UI listens on.
document.addEventListener('navbar:connect-retry', () => {
  void activateLive();
});
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
