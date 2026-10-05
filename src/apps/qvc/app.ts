/**
 * Quantum-video-chat shell.
 *
 * Two tiers share one page. The simulation runs the real key engine in this tab
 * with no media and no peer, so a lone visitor sees the part of the project that
 * is actually novel. The call is the live tier: it needs a pass, a second
 * person and a camera, and stays disabled until `navbar:connect` says the
 * gateway answered.
 *
 * Nothing here imports the engine. Both tiers load it on demand, so the lobby
 * costs a few kilobytes and a static Lighthouse run logs no refused socket.
 */
import { state, parseRoomToken, resetSession } from './state';
import { renderLobby, renderCall } from './render';
import { drawQberChart } from './chart';
import { track } from '../../telemetry';

let toastTimer: number | null = null;
/** A token from an invite link, applied to the input once. */
let pendingRoomToken = '';

function root(): HTMLElement | null {
  return document.getElementById('qvc-app');
}

export function showToast(message: string): void {
  const el = document.getElementById('qvc-toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('qvc-toast--visible');
  if (toastTimer !== null) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('qvc-toast--visible'), 5000);
}

/** Values that must not travel through innerHTML go in after the markup. */
function applySinks(): void {
  const invite = document.getElementById('qvc-invite-link');
  if (invite instanceof HTMLInputElement) invite.value = state.joinLink;

  const roomInput = document.getElementById('qvc-room-input');
  if (roomInput instanceof HTMLInputElement && pendingRoomToken) {
    roomInput.value = pendingRoomToken;
    pendingRoomToken = '';
  }

  const roomRef = document.getElementById('qvc-room-ref');
  if (roomRef) roomRef.textContent = state.roomId ? `${state.roomId.slice(0, 4)}…` : '';

  const sasDigits = document.getElementById('qvc-sas-digits');
  if (sasDigits && state.sas) sasDigits.textContent = state.sas.digits;

  // The bench token is a credential, so it reaches the field through a value
  // sink rather than a rendered markup string.
  const benchUrl = document.getElementById('qvc-bench-url');
  if (benchUrl instanceof HTMLInputElement) benchUrl.value = state.optical.url;
  const benchToken = document.getElementById('qvc-bench-token');
  if (benchToken instanceof HTMLInputElement) benchToken.value = state.optical.token;

  // The strict style-src admits no inline style attribute, so the bar's width
  // rides a custom property set once the element is in the document.
  const fill = document.getElementById('qvc-distill-fill');
  if (fill) {
    const pct = state.mintBudget ? Math.min(1, state.reservoirBits / state.mintBudget) : 0;
    fill.style.setProperty('--qvc-fill', `${(pct * 100).toFixed(0)}%`);
  }
}

export function render(): void {
  const app = root();
  if (!app) return;
  // Re-renders happen while the user types, so the markup swap reads their
  // input back first and restores it.
  const typed =
    document.getElementById('qvc-room-input') instanceof HTMLInputElement
      ? (document.getElementById('qvc-room-input') as HTMLInputElement).value
      : '';
  app.innerHTML = state.peerConnected ? renderCall() : renderLobby();
  if (typed) {
    const roomInput = document.getElementById('qvc-room-input');
    if (roomInput instanceof HTMLInputElement) roomInput.value = typed;
  }
  applySinks();
  if (state.bb84Active && state.dashboardExpanded) drawQberChart();
}

const ACTIONS = new Map<string, (el: HTMLElement) => void>(
  Object.entries({
    'run-demo': () => {
      void startDemo();
    },
    'toggle-dashboard': () => {
      state.dashboardExpanded = !state.dashboardExpanded;
      render();
    },
    'toggle-eve': () => {
      state.eavesdropper = !state.eavesdropper;
      void setDemoEavesdropper(state.eavesdropper);
      render();
    },
    'sas-verify': () => {
      state.sasVerified = true;
      render();
    },
    'sas-mismatch': () => {
      showToast('Hang up. A mismatch means someone is relaying this call.');
    },
    'toggle-bench': (el) => {
      if (el instanceof HTMLInputElement) state.optical.enabled = el.checked;
      void saveBench();
      render();
    },
    'bench-url': (el) => {
      if (el instanceof HTMLInputElement) state.optical.url = el.value.trim();
      void saveBench();
    },
    'bench-token': (el) => {
      if (el instanceof HTMLInputElement) state.optical.token = el.value;
      void saveBench();
    },
    'copy-link': () => {
      void navigator.clipboard.writeText(state.joinLink).then(
        () => {
          showToast('Invite link copied.');
        },
        () => {
          showToast('Copy failed — select the link and copy it.');
        },
      );
    },
    'create-room': () => {
      void startCall();
    },
    leave: () => {
      resetSession();
      render();
    },
  }),
);

function onClick(e: Event): void {
  const target = e.target;
  if (!(target instanceof Element)) return;
  const el = target.closest('[data-action]');
  if (!(el instanceof HTMLElement)) return;
  const action = el.dataset.action;
  if (!action) return;
  // The join form carries a data-action too, and its submit is handled there.
  const handler = ACTIONS.get(action);
  if (!handler) return;
  e.preventDefault();
  handler(el);
}

function onSubmit(e: Event): void {
  const form = e.target;
  if (!(form instanceof HTMLFormElement) || form.dataset.action !== 'join-room') return;
  e.preventDefault();
  const input = document.getElementById('qvc-room-input');
  const token = parseRoomToken(input instanceof HTMLInputElement ? input.value.trim() : '');
  if (!token) {
    showToast('Paste an invite link to join.');
    return;
  }
  void joinCall(token);
}

async function startDemo(): Promise<void> {
  const { runDemo, setPhaseSink } = await import('./demo');
  const { applyEnginePhase } = await import('./engine-state');
  let firstKey = true;
  setPhaseSink((s) => {
    applyEnginePhase(s, showToast);
    // The first mint is what says the exchange works; later ones are the same
    // event repeating, and a key every few seconds is not worth a beacon each.
    if (s.phase === 'minted' && firstKey) {
      firstKey = false;
      track({ app: 'qvc', event: 'run.done', tier: 'browser', outcome: 'ok', variant: 'sim' });
    }
    render();
  });
  state.demoRunning = true;
  state.bb84Active = true;
  state.mode = 'sim';
  state.dashboardExpanded = true;
  // The simulation drives alice, so the eavesdropper toggle belongs to it.
  state.isInitiator = true;
  track({ app: 'qvc', event: 'run.start', tier: 'browser', variant: 'sim' });
  render();
  await runDemo();
}

async function saveBench(): Promise<void> {
  const { saveSettings } = await import('./optical');
  saveSettings(state.optical);
}

async function setDemoEavesdropper(on: boolean): Promise<void> {
  const { currentDemo } = await import('./demo');
  currentDemo()?.setEavesdropper(on);
  track({
    app: 'qvc',
    event: 'run.start',
    tier: 'browser',
    variant: on ? 'eavesdropper' : 'sim',
  });
}

async function startCall(): Promise<void> {
  const { startCall: begin } = await import('./signalling');
  track({ app: 'qvc', event: 'run.start', tier: 'live', variant: 'create' });
  await begin();
}

async function joinCall(token: string): Promise<void> {
  const { joinCall: join } = await import('./signalling');
  track({ app: 'qvc', event: 'run.start', tier: 'live', variant: 'join' });
  await join(token);
}

document.addEventListener('navbar:connect', (e) => {
  const detail = (e as CustomEvent<{ service?: string; url?: string }>).detail;
  if (detail.service !== 'qvc' || !detail.url) return;
  const url = detail.url;
  void import('./signalling').then(({ connect }) => {
    connect(url);
    state.connected = true;
    state.liveAvailable = true;
    render();
  });
});

void import('./optical').then(({ loadSettings }) => {
  state.optical = loadSettings();
  render();
});
pendingRoomToken = parseRoomToken(window.location.hash);
state.invited = pendingRoomToken !== '';
document.addEventListener('click', onClick);
document.addEventListener('submit', onSubmit);
render();
