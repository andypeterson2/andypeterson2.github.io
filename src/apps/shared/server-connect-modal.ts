/**
 * Server-connect navbar UI — one nav item + connect modal per backend declared
 * by a <meta name="site-backend" content="svc" data-port="…" data-label="…">.
 *
 * Pure consumer of the shared modules: reads/writes saved URLs via
 * ServiceConfig and drives the status dot from SiteContract.pollHealth. Talks
 * to the apps only through the navbar:* CustomEvents (connect-ready / connect /
 * disconnect / dismiss), so it has no per-app knowledge.
 *
 * Side-effect module: builds the UI on import (or DOMContentLoaded).
 */

import { ServiceConfig } from './service-config';
import { SiteContract, type DotStatus } from './contract-client';

interface BackendDef {
  service: string;
  port: number;
  label: string;
}

export interface ConnectWidget {
  getUrl(): string;
  setStatus(status: string): void;
}

type ConnState = { connected: boolean; status?: string };

// One-time migration: the qvc signaling service key was renamed qvc-server → qvc to
// match the API contract slug. Carry any saved URL forward so existing users stay
// connected.
const oldQvc = ServiceConfig.get('qvc-server', '');
if (oldQvc && !ServiceConfig.isConfigured('qvc')) {
  ServiceConfig.set('qvc', oldQvc);
  ServiceConfig.remove('qvc-server');
}

// ── Collect backend service definitions ──────────────────────────
const backends: BackendDef[] = [];
document.querySelectorAll('meta[name="site-backend"]').forEach((m) => {
  const svc = m.getAttribute('content') ?? '';
  if (!svc) return;
  backends.push({
    service: svc,
    port: parseInt(m.getAttribute('data-port') ?? '8080') || 8080,
    label: m.getAttribute('data-label') ?? 'Server',
  });
});

// ── Create one nav item + modal per backend ─────────────────────
function createBackendUI(cfg: BackendDef): void {
  const { service, port: defaultPort, label: navLabel } = cfg;

  const connState: ConnState = { connected: false };
  let serverLi: HTMLLIElement | null = null;
  let serverSubUl: HTMLUListElement | null = null;
  let modalOverlay: HTMLDivElement | null = null;
  let hostInput: HTMLInputElement | null = null;
  let portInput: HTMLInputElement | null = null;
  let stopHealthPoll: (() => void) | null = null;
  let appManaged = false;

  // Unique IDs to avoid collisions when multiple backends exist
  const uid = 'sn-' + service.replace(/[^a-z0-9]/gi, '-');

  // Faithful to the legacy `parseInt(...) || default`: NaN and 0 both fall back.
  function portOrDefault(input: HTMLInputElement | null): number {
    const p = input ? parseInt(input.value) : NaN;
    return p > 0 ? p : defaultPort;
  }

  function init(): void {
    const ul = document.querySelector('.site-menubar ul[role="menubar"]');
    if (!ul) return;

    serverLi = document.createElement('li');
    serverLi.setAttribute('role', 'menuitem');
    serverLi.setAttribute('aria-haspopup', 'false');
    serverLi.style.cursor = 'pointer';
    serverLi.className = 'server-nav-item';

    const label = document.createElement('span');
    label.textContent = navLabel;
    label.style.pointerEvents = 'none';
    serverLi.appendChild(label);

    const dot = document.createElement('span');
    dot.className = 'sn-dot';
    serverLi.appendChild(dot);

    serverSubUl = document.createElement('ul');
    serverSubUl.setAttribute('role', 'menu');
    serverSubUl.style.display = 'none';

    const reconnLi = document.createElement('li');
    reconnLi.setAttribute('role', 'menuitem');
    const reconnA = document.createElement('a');
    reconnA.href = '#';
    reconnA.textContent = 'Re-connect';
    reconnA.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openModal();
    });
    reconnLi.appendChild(reconnA);
    serverSubUl.appendChild(reconnLi);

    const disconnLi = document.createElement('li');
    disconnLi.setAttribute('role', 'menuitem');
    const disconnA = document.createElement('a');
    disconnA.href = '#';
    disconnA.textContent = 'Disconnect';
    disconnA.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      doDisconnect();
    });
    disconnLi.appendChild(disconnA);
    serverSubUl.appendChild(disconnLi);

    serverLi.appendChild(serverSubUl);

    serverLi.addEventListener('click', (e) => {
      if (!connState.connected) {
        e.preventDefault();
        e.stopPropagation();
        openModal();
      }
    });

    ul.appendChild(serverLi);

    const mobileSelect = document.querySelector<HTMLSelectElement>('.mobile-nav-select');
    if (mobileSelect) {
      const opt = document.createElement('option');
      opt.value = '__' + uid + '__';
      opt.textContent = navLabel + '...';
      mobileSelect.appendChild(opt);
      mobileSelect.addEventListener('change', () => {
        if (mobileSelect.value === '__' + uid + '__') {
          mobileSelect.value = '';
          openModal();
        }
      });
    }

    buildModal();
    dispatchReady();
  }

  function buildModal(): void {
    modalOverlay = document.createElement('div');
    modalOverlay.className = 'sn-modal-overlay';
    modalOverlay.style.display = 'none';

    const dialog = document.createElement('div');
    dialog.className = 'sn-modal';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-label', 'Connect to ' + navLabel.toLowerCase());

    const header = document.createElement('div');
    header.className = 'sn-modal-header';
    header.textContent = 'Connect to ' + navLabel;
    dialog.appendChild(header);

    const form = document.createElement('form');
    form.className = 'sn-connect-form';

    const hostRow = document.createElement('div');
    hostRow.className = 'sn-form-row';
    const hostLbl = document.createElement('label');
    hostLbl.setAttribute('for', uid + '-host');
    hostLbl.textContent = 'Host';
    const hostInp = document.createElement('input');
    hostInp.id = uid + '-host';
    hostInp.type = 'text';
    hostInp.placeholder = 'localhost';
    hostInp.value = 'localhost';
    hostInp.spellcheck = false;
    hostInp.autocomplete = 'off';
    hostRow.appendChild(hostLbl);
    hostRow.appendChild(hostInp);
    form.appendChild(hostRow);

    const portRow = document.createElement('div');
    portRow.className = 'sn-form-row';
    const portLbl = document.createElement('label');
    portLbl.setAttribute('for', uid + '-port');
    portLbl.textContent = 'Port';
    const portInp = document.createElement('input');
    portInp.id = uid + '-port';
    portInp.type = 'number';
    portInp.placeholder = String(defaultPort);
    portInp.value = String(defaultPort);
    portInp.min = '1';
    portInp.max = '65535';
    portRow.appendChild(portLbl);
    portRow.appendChild(portInp);
    form.appendChild(portRow);

    dialog.appendChild(form);

    const footer = document.createElement('div');
    footer.className = 'sn-modal-footer';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'sn-btn';
    cancelBtn.setAttribute('data-action', 'cancel');
    cancelBtn.textContent = 'Cancel';
    const connectBtn = document.createElement('button');
    connectBtn.type = 'button';
    connectBtn.className = 'sn-btn sn-btn-primary';
    connectBtn.setAttribute('data-action', 'connect');
    connectBtn.textContent = 'Connect';
    footer.appendChild(cancelBtn);
    footer.appendChild(connectBtn);
    dialog.appendChild(footer);

    modalOverlay.appendChild(dialog);
    document.body.appendChild(modalOverlay);

    hostInput = hostInp;
    portInput = portInp;

    // Seed from any previously-saved ServiceConfig URL (shared with standalone apps).
    const savedUrl = ServiceConfig.get(service, '');
    if (savedUrl) {
      try {
        const u = new URL(savedUrl);
        if (u.hostname) hostInput.value = u.hostname;
        if (u.port) portInput.value = u.port;
      } catch {
        /* ignore a malformed saved URL */
      }
    }

    cancelBtn.addEventListener('click', closeModal);
    connectBtn.addEventListener('click', doConnect);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      doConnect();
    });
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalOverlay && modalOverlay.style.display !== 'none') closeModal();
    });
  }

  function openModal(): void {
    if (!modalOverlay) return;
    modalOverlay.style.display = '';
    if (hostInput) {
      setTimeout(() => {
        hostInput?.focus();
        hostInput?.select();
      }, 50);
    }
  }

  function closeModal(): void {
    if (modalOverlay) modalOverlay.style.display = 'none';
    if (!connState.connected) {
      document.dispatchEvent(new CustomEvent('navbar:dismiss', { detail: { service } }));
    }
  }

  // ── Drive the status dot from the backend's /health contract endpoint ──
  function onPollStatus(status: DotStatus | 'connecting'): void {
    connState.status = status;
    connState.connected = status === 'connected' || status === 'degraded';
    updateNav();
  }

  function stopHealthPolling(): void {
    if (stopHealthPoll) {
      stopHealthPoll();
      stopHealthPoll = null;
    }
  }

  function startHealthPolling(url: string): void {
    stopHealthPolling();
    // An app that reports its own status (via widget.setStatus) owns the dot; defer to it.
    if (appManaged) return;
    stopHealthPoll = SiteContract.pollHealth(url, onPollStatus, { intervalMs: 15000 });
  }

  function doConnect(): void {
    const host = hostInput?.value.trim() ?? '';
    const hostVal = host || 'localhost';
    const portVal = portOrDefault(portInput);
    const proto = location.protocol === 'https:' ? 'https://' : 'http://';
    const url = proto + hostVal + ':' + String(portVal);
    // Persist + share with standalone apps (same localStorage-backed ServiceConfig).
    ServiceConfig.set(service, url);
    appManaged = false;
    connState.connected = true;
    connState.status = 'connecting';
    updateNav();
    closeModal();
    document.dispatchEvent(
      new CustomEvent('navbar:connect', {
        detail: { service, host: hostVal, port: portVal, url },
      }),
    );
    // Poll /health so the dot reflects real reachability for every backend. Apps that
    // manage their own status (e.g. classifiers SSE) take over via widget.setStatus.
    startHealthPolling(url);
  }

  function doDisconnect(): void {
    stopHealthPolling();
    appManaged = false;
    connState.connected = false;
    connState.status = 'idle';
    updateNav();
    document.dispatchEvent(new CustomEvent('navbar:disconnect', { detail: { service } }));
    openModal();
  }

  const STATUS_LABELS: Partial<Record<string, string>> = {
    connected: 'Connected',
    connecting: 'Connecting',
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
      else if (s === 'connecting' || s === 'degraded') dot.classList.add('sn-yellow');
      else if (s === 'disconnected' || s === 'error') dot.classList.add('sn-red');
      dot.setAttribute('aria-label', (STATUS_LABELS[s] ?? 'Idle') + ' — ' + navLabel);
      dot.setAttribute('role', 'status');
    }
    if (connState.connected) {
      serverLi.setAttribute('aria-haspopup', 'true');
      if (serverSubUl) serverSubUl.style.display = '';
    } else {
      serverLi.setAttribute('aria-haspopup', 'false');
      if (serverSubUl) serverSubUl.style.display = 'none';
    }
  }

  function dispatchReady(): void {
    const widget: ConnectWidget = {
      getUrl() {
        const h = hostInput?.value.trim() ?? '';
        const p = portOrDefault(portInput);
        const proto = location.protocol === 'https:' ? 'https://' : 'http://';
        return proto + (h || 'localhost') + ':' + String(p);
      },
      setStatus(status) {
        // An app reporting its own status owns the dot — stop the generic health poll.
        appManaged = true;
        stopHealthPolling();
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
  // ordering (apps first, then this modal's connect-ready dispatch).
  if (document.readyState !== 'complete') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

for (const backend of backends) createBackendUI(backend);
