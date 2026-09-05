/**
 * Server status navbar UI — one nav item + status dot per backend declared
 * by a <meta name="site-backend" content="svc" data-label="…">.
 *
 * STATUS-ONLY by design: there is no manual host/port connect form anymore.
 * The site's backends are deploy-based — the only ways an app connects are
 * the recruiter-pass / owner activation in pass.ts (health-gated, through the
 * gateway) and the allowlisted ?backend= override in ServiceConfig (which, on
 * the deployed site, admits only the gateway origin; localhost is possible
 * only when the page itself is served from localhost, i.e. local dev).
 *
 * Talks to the apps only through the navbar:* CustomEvents (connect-ready /
 * connect-pending / connect-failed / connect), so it has no per-app knowledge.
 * The dot is driven by pass.ts's waking lifecycle and by the apps' own
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
function createBackendUI(cfg: BackendDef): void {
  const { service, label: navLabel } = cfg;

  const connState: ConnState = { connected: false };
  let serverLi: HTMLLIElement | null = null;

  function init(): void {
    const ul = document.querySelector('.site-menubar ul[role="menubar"]');
    if (!ul) return;

    serverLi = document.createElement('li');
    serverLi.setAttribute('role', 'menuitem');
    serverLi.className = 'server-nav-item';

    const label = document.createElement('span');
    label.textContent = navLabel;
    label.style.pointerEvents = 'none';
    serverLi.appendChild(label);

    const dot = document.createElement('span');
    dot.className = 'sn-dot';
    serverLi.appendChild(dot);

    ul.appendChild(serverLi);

    dispatchReady();
  }

  const STATUS_LABELS: Partial<Record<string, string>> = {
    connected: 'Connected',
    connecting: 'Connecting',
    waking: 'Waking live backend…',
    degraded: 'Degraded',
    disconnected: 'Disconnected',
    error: 'Error',
    idle: 'Idle',
  };

  function updateNav(): void {
    if (!serverLi) return;
    const dot = serverLi.querySelector('.sn-dot');
    const s = connState.status ?? 'idle';
    if (dot) {
      dot.className = 'sn-dot';
      if (s === 'connected') dot.classList.add('sn-green');
      else if (s === 'connecting' || s === 'waking' || s === 'degraded')
        dot.classList.add('sn-yellow');
      else if (s === 'disconnected' || s === 'error') dot.classList.add('sn-red');
      dot.setAttribute('aria-label', (STATUS_LABELS[s] ?? 'Idle') + ' — ' + navLabel);
      dot.setAttribute('role', 'status');
    }
    serverLi.title = STATUS_LABELS[s] ?? 'Idle';
  }

  // Pass-activated live tier (pass.ts): the backend may be waking from sleep —
  // show that honestly until the health-gated activation either connects or
  // gives up (back to idle; the free tier stands).
  document.addEventListener('navbar:connect-pending', (e) => {
    const detail = (e as CustomEvent<{ service?: string }>).detail;
    if (detail.service !== service) return;
    connState.status = 'waking';
    updateNav();
  });
  document.addEventListener('navbar:connect-failed', (e) => {
    const detail = (e as CustomEvent<{ service?: string }>).detail;
    if (detail.service !== service) return;
    connState.status = 'idle';
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
