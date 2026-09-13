/**
 * Server status navbar UI — one nav item + status dot per backend declared
 * by a <meta name="site-backend" content="svc" data-label="…">.
 *
 * STATUS-ONLY by design: there is no manual host/port connect form.
 * The site's backends are deploy-based — the only ways an app connects are
 * the recruiter-pass / owner activation (health-gated, through the gateway)
 * and the allowlisted ?backend= override in ServiceConfig (which, on the
 * deployed site, admits only the gateway origin; localhost is possible only
 * when the page itself is served from localhost, i.e. local dev).
 *
 * Talks to the apps only through the navbar:* CustomEvents (connect-ready /
 * connect-pending / connect-failed / connect), so it has no per-app knowledge.
 * The dot is driven by the pass activation's waking lifecycle and the apps' own
 * widget.setStatus reports.
 *
 * Side-effect module: builds the UI on import (or DOMContentLoaded).
 */

export interface ConnectWidget {
  setStatus(status: string): void;
}

interface BackendDef {
  service: string;
  label: string;
}

type ConnState = { connected: boolean; status?: string };

// ── Collect backend service definitions ──────────────────────────
const backends: BackendDef[] = [];

document.querySelectorAll('meta[name="site-backend"]').forEach((m) => {
  const svc = m.getAttribute('content') ?? '';
  if (!svc) return;
  backends.push({
    service: svc,
    label: m.getAttribute('data-label') ?? 'Server',
  });
});

// ── Create one nav status item per backend ───────────────────────
// The state is a visible word, not only a dot: the site's thesis is honest state, and a
// 9px half-transparent dot says little. Words name the tier the visitor is on, not the socket.
const STATE_WORDS: Partial<Record<string, string>> = {
  idle: 'in your browser',
  waking: 'waking the live backend… (up to 30s)',
  connecting: 'connecting…',
  connected: 'live',
  degraded: 'live · checking…',
  disconnected: 'offline — in your browser',
  error: 'error — in your browser',
  failed: "live backend didn't wake — in your browser",
  unauthorized: 'pass expired or invalid — in your browser',
};

function createBackendUI(cfg: BackendDef): void {
  const { service, label: navLabel } = cfg;

  const connState: ConnState = { connected: false };
  let serverLi: HTMLLIElement | null = null;
  const words: HTMLElement[] = [];
  const dots: HTMLElement[] = [];
  const retries: HTMLButtonElement[] = [];

  function statusParts(): { item: DocumentFragment; word: HTMLElement; retry: HTMLButtonElement } {
    const item = document.createDocumentFragment();
    const label = document.createElement('span');
    label.textContent = navLabel;
    label.style.pointerEvents = 'none';
    const dot = document.createElement('span');
    dot.className = 'sn-dot';
    dot.setAttribute('aria-hidden', 'true');
    const word = document.createElement('span');
    word.className = 'sn-state';
    // Plain text that announces its changes — not a menu item, since clicking it
    // does nothing.
    word.setAttribute('role', 'status');
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'sn-retry';
    retry.textContent = 'Retry';
    retry.hidden = true;
    retry.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('navbar:connect-retry', { detail: { service } }));
    });
    item.append(label, dot, word, retry);
    dots.push(dot);
    words.push(word);
    retries.push(retry);
    return { item, word, retry };
  }

  function init(): void {
    const ul = document.querySelector('.site-menubar ul');
    if (ul) {
      serverLi = document.createElement('li');
      serverLi.className = 'server-nav-item';
      serverLi.appendChild(statusParts().item);
      ul.appendChild(serverLi);
    }
    // Phones: the same status in the site menu.
    const mobile = document.getElementById('mobile-nav-menu');
    if (mobile) {
      const li = document.createElement('li');
      li.className = 'server-nav-item server-nav-item--mobile';
      li.appendChild(statusParts().item);
      mobile.appendChild(li);
    }
    updateNav();
    dispatchReady();
  }

  function updateNav(): void {
    const s = connState.status ?? 'idle';
    for (const dot of dots) {
      dot.className = 'sn-dot';
      if (s === 'connected') dot.classList.add('sn-green');
      else if (s === 'connecting' || s === 'waking' || s === 'degraded')
        dot.classList.add('sn-yellow');
      else if (s === 'disconnected' || s === 'error' || s === 'failed' || s === 'unauthorized')
        dot.classList.add('sn-red');
    }
    for (const w of words) w.textContent = STATE_WORDS[s] ?? STATE_WORDS.idle ?? '';
    for (const r of retries) r.hidden = s !== 'failed';
    if (serverLi) serverLi.title = `${navLabel}: ${STATE_WORDS[s] ?? ''}`;
  }

  // Pass-activated live tier: the backend may be waking from sleep —
  // show that honestly until the health-gated activation either connects or
  // gives up. On give-up, say so and offer a retry; the browser tier stands.
  document.addEventListener('navbar:connect-pending', (e) => {
    const detail = (e as CustomEvent<{ service?: string }>).detail;
    if (detail.service !== service) return;
    connState.status = 'waking';
    updateNav();
  });
  document.addEventListener('navbar:connect-failed', (e) => {
    const detail = (e as CustomEvent<{ service?: string; reason?: string }>).detail;
    if (detail.service !== service) return;
    // Retry shows only for 'failed' (a backend that may still wake), never for a
    // refused pass.
    connState.status = detail.reason === 'unauthorized' ? 'unauthorized' : 'failed';
    connState.connected = false;
    updateNav();
  });

  function dispatchReady(): void {
    const widget: ConnectWidget = {
      setStatus(status) {
        // The app reporting its own status owns the dot.
        connState.status = status;
        connState.connected = status === 'connected' || status === 'degraded';
        updateNav();
      },
    };
    document.dispatchEvent(
      new CustomEvent('navbar:connect-ready', { detail: { service, widget } }),
    );
  }

  // Wait for DOMContentLoaded unless the document is fully loaded: module
  // scripts evaluate at readyState 'interactive', BEFORE the app tiers'
  // modules later in the document have registered their navbar:* listeners.
  // Deferring init past DOMContentLoaded preserves the classic-script era's
  // ordering (apps first, then this module's connect-ready dispatch).
  if (document.readyState !== 'complete') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

for (const backend of backends) createBackendUI(backend);
