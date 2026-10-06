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
import { renderLobby, renderCall, fmtTime } from './render';
import { drawQberChart } from './chart';
import { attachStream } from './media';
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

/**
 * The call's streams, once the live tier has loaded. Reading them through a
 * captured function keeps socket.io out of the first chunk, which importing
 * the signalling module here would pull in.
 */
let mediaStreams: () => { local: MediaStream | null; remote: MediaStream | null } = () => ({
  local: null,
  remote: null,
});

/** Values that must not travel through innerHTML go in after the markup. */
function applySinks(): void {
  // Every render builds new <video> elements, and srcObject does not come with
  // them: without this the call shows two black rectangles.
  const { local, remote } = mediaStreams();
  attachStream('qvc-remote-video', remote);
  attachStream('qvc-local-video', local);

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
  // The engine repaints several times a second, which would otherwise take the
  // slider out from under a drag. Its value and focus survive the swap.
  const dragging = document.activeElement?.id === 'qvc-eve';
  // Re-renders happen while the user types, so the markup swap reads their
  // input back first and restores it.
  const typed =
    document.getElementById('qvc-room-input') instanceof HTMLInputElement
      ? (document.getElementById('qvc-room-input') as HTMLInputElement).value
      : '';
  app.innerHTML = state.peerConnected ? renderCall() : renderLobby();
  // A call that covers the viewport must not leave the page scrolling behind it.
  document.body.classList.toggle('qvc-staged', state.peerConnected && state.stageFullBleed);
  if (typed) {
    const roomInput = document.getElementById('qvc-room-input');
    if (roomInput instanceof HTMLInputElement) roomInput.value = typed;
  }
  applySinks();
  if (dragging) {
    const eve = document.getElementById('qvc-eve');
    if (eve instanceof HTMLInputElement) eve.focus();
  }
  if (state.bb84Active && state.dashboardExpanded) drawQberChart();
}

const ACTIONS = new Map<string, (el: HTMLElement) => void>(
  Object.entries({
    'run-demo': () => {
      void startDemo();
    },
    'toggle-stage': () => {
      state.stageFullBleed = !state.stageFullBleed;
      render();
    },
    'toggle-dashboard': () => {
      state.dashboardExpanded = !state.dashboardExpanded;
      render();
    },
    'set-eve': (el) => {
      if (!(el instanceof HTMLInputElement)) return;
      state.eveFraction = Math.min(1, Math.max(0, Number(el.value) / 100));
      state.eavesdropper = state.eveFraction > 0;
      if (state.demoRunning) {
        void setDemoEavesdropper(state.eveFraction);
      } else {
        void import('./signalling').then(({ setEavesdropper }) => {
          setEavesdropper(state.eveFraction);
        });
      }
      // The readout alone, so dragging does not rebuild the panel under the thumb.
      const read = document.getElementById('qvc-eve-read');
      if (read) read.textContent = `${String(Math.round(state.eveFraction * 100))}% of slots`;
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
    'open-analytics': () => {
      void import('./bus').then(({ openAnalyticsWindow }) => {
        openAnalyticsWindow();
      });
    },
    'check-devices': () => {
      void checkDevices();
    },
    'pick-camera': (el) => {
      if (el instanceof HTMLSelectElement) state.deviceChoice.cameraId = el.value;
      void saveDeviceChoice();
    },
    'pick-mic': (el) => {
      if (el instanceof HTMLSelectElement) state.deviceChoice.microphoneId = el.value;
      void saveDeviceChoice();
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
      void startCall().catch(reportCallFailure);
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

/** Ranges report through `input`, which `click` would miss while dragging. */
function onInput(e: Event): void {
  const el = e.target;
  if (!(el instanceof HTMLInputElement) || el.type !== 'range') return;
  const action = el.dataset.action;
  if (!action) return;
  ACTIONS.get(action)?.(el);
}

/** Selects report through `change`, which the click delegate does not see. */
function onChange(e: Event): void {
  const el = e.target;
  if (!(el instanceof HTMLSelectElement)) return;
  const action = el.dataset.action;
  if (!action) return;
  ACTIONS.get(action)?.(el);
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
  void joinCall(token).catch(reportCallFailure);
}

async function saveDeviceChoice(): Promise<void> {
  const { saveChoice } = await import('./media');
  saveChoice(state.deviceChoice);
}

/**
 * Open the chosen devices briefly, to prove they work and to learn their real
 * names. The stream is stopped straight after, so the camera light does not
 * stay on for a check.
 */
async function checkDevices(): Promise<void> {
  const { listDevices, constraintsFor, mediaFailure, stopStream, saveChoice } =
    await import('./media');
  let probe: MediaStream | null = null;
  try {
    probe = await navigator.mediaDevices.getUserMedia(constraintsFor(state.deviceChoice));
    const video = probe.getVideoTracks()[0]?.label ?? 'no camera track';
    const audio = probe.getAudioTracks()[0]?.label ?? 'no microphone track';
    state.deviceStatus = `Working — ${video}, ${audio}.`;
    state.mediaError = '';
  } catch (err) {
    console.warn('[qvc] device check failed:', err);
    state.deviceStatus = mediaFailure(err);
  } finally {
    stopStream(probe);
  }
  // Labels only exist once permission has been granted, so the list is read
  // after the probe rather than before it.
  const found = await listDevices();
  state.devices = { cameras: found.cameras, microphones: found.microphones };
  state.devicesLabelled = found.labelled;
  state.deviceChoice.cameraId ??= found.cameras[0]?.id ?? null;
  state.deviceChoice.microphoneId ??= found.microphones[0]?.id ?? null;
  saveChoice(state.deviceChoice);
  render();
}

/** Devices on arrival, but only where permission already exists: no prompt. */
async function loadDevicesQuietly(): Promise<void> {
  const { alreadyPermitted, listDevices, loadChoice } = await import('./media');
  state.deviceChoice = loadChoice();
  if (!(await alreadyPermitted())) return;
  const found = await listDevices();
  if (!found.labelled) return;
  state.devices = { cameras: found.cameras, microphones: found.microphones };
  state.devicesLabelled = true;
  state.deviceChoice.cameraId ??= found.cameras[0]?.id ?? null;
  state.deviceChoice.microphoneId ??= found.microphones[0]?.id ?? null;
  render();
}

async function startDemo(): Promise<void> {
  const { runDemo, setPhaseSink } = await import('./demo');
  const { applyEnginePhase, recordPeerDigest } = await import('./engine-state');
  const { openBus, startPublishing, logEvent } = await import('./bus');
  let firstKey = true;
  setPhaseSink((s, side) => {
    // Alice drives the dashboard; both run the same protocol, so taking both
    // would double every counter. Bob's SAS is kept to prove the two agree.
    if (side === 'bob') {
      if (s.phase === 'sas' && s.sas) state.peerSas = s.sas.digits;
      // The detector's own digest for the same mint: the receipt only claims
      // agreement once both ends have reported one.
      if (s.phase === 'minted' && typeof s.keyIndex === 'number') {
        recordPeerDigest(s.keyIndex, s.digest ?? null);
      }
      render();
      return;
    }
    applyEnginePhase(s, showToast);
    // The timeline is the point of the analytics screen, so each phase worth a
    // row goes on the bus as it happens rather than waiting for the next tick.
    if (s.phase === 'minted') logEvent('minted', { keyIndex: s.keyIndex });
    else if (s.phase === 'rotated') logEvent('rotated', { keyIndex: s.keyIndex });
    else if (s.phase === 'mode') logEvent('mode', { mode: s.mode });
    else if (s.phase === 'exhausted') logEvent('compromised');
    else if (s.phase === 'failed' && s.reason === 'qber-exceeded') logEvent('qber-abort');
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
  // There is no crypto worker in the simulation, so there is no cipher state to
  // report; a dash says that, where 'establishing' would imply one exists.
  state.cipherState = null;
  state.mode = 'sim';
  state.dashboardExpanded = true;
  // The simulation drives alice, so the eavesdropper toggle belongs to it.
  state.isInitiator = true;
  // The analytics screen reads the same snapshots a real call publishes, so the
  // simulation feeds it too.
  await openBus(() => undefined);
  startPublishing();
  logEvent('call-start');
  track({ app: 'qvc', event: 'run.start', tier: 'browser', variant: 'sim' });
  render();
  const run = await runDemo();
  state.demoAuthenticated = run.authenticated;
  render();
}

async function saveBench(): Promise<void> {
  const { saveSettings } = await import('./optical');
  saveSettings(state.optical);
}

async function setDemoEavesdropper(fraction: number): Promise<void> {
  const { currentDemo } = await import('./demo');
  currentDemo()?.setEavesdropper(fraction);
  const { logEvent } = await import('./bus');
  logEvent('eve', { fraction });
  track({
    app: 'qvc',
    event: 'run.start',
    tier: 'browser',
    variant: fraction > 0 ? 'eavesdropper' : 'sim',
  });
}

async function onCallStart(): Promise<void> {
  const { openBus, startPublishing, logEvent } = await import('./bus');
  const { setFingerprintSource } = await import('./bus');
  const { fingerprints } = await import('./signalling');
  await openBus(applyCommand);
  setFingerprintSource(fingerprints);
  startPublishing();
  logEvent('call-start');
  startTimer();
}

/** Commands the analytics window may send back, each already allowlisted. */
function applyCommand(cmd: 'toggle-eve' | 'force-rotate' | 'reset'): void {
  if (cmd === 'toggle-eve') {
    // Mirrors the in-call gate: the eavesdropper is the initiator's to run.
    if (state.isInitiator) {
      // The analytics window sends a plain toggle, so it swings between none
      // and all of the channel.
      state.eveFraction = state.eveFraction > 0 ? 0 : 1;
      state.eavesdropper = state.eveFraction > 0;
      void import('./signalling').then(({ setEavesdropper }) => {
        setEavesdropper(state.eveFraction);
      });
    }
  } else if (cmd === 'reset') {
    void leaveCall();
  }
  render();
}

let elapsedTimer: number | null = null;

function startTimer(): void {
  if (elapsedTimer !== null) return;
  elapsedTimer = window.setInterval(() => {
    state.elapsed += 1;
    const el = document.getElementById('qvc-timer');
    if (el) el.textContent = fmtTime(state.elapsed);
  }, 1000);
}

function stopTimer(): void {
  if (elapsedTimer !== null) clearInterval(elapsedTimer);
  elapsedTimer = null;
}

async function leaveCall(): Promise<void> {
  const { leave } = await import('./signalling');
  const { publishSummary, stopPublishing } = await import('./bus');
  publishSummary();
  stopPublishing();
  stopTimer();
  leave();
  resetSession();
  render();
}

/**
 * A call that cannot start says why. Without this a rejected promise ends in
 * silence and the button looks dead — which is what a refused ice-servers
 * request looked like from the outside.
 */
function reportCallFailure(err: unknown): void {
  console.warn('[qvc] call setup failed:', err);
  const detail = err instanceof Error ? err.message : String(err);
  showToast(
    detail.startsWith('ice-servers:')
      ? `The gateway refused the call setup (${detail}). The pass may have expired.`
      : `The call could not be started: ${detail}`,
  );
  state.joining = false;
  render();
}

async function startCall(): Promise<void> {
  const { startCall: begin } = await import('./signalling');
  track({ app: 'qvc', event: 'run.start', tier: 'live', variant: 'create' });
  await begin(() => {
    void onCallStart();
  });
}

async function joinCall(token: string): Promise<void> {
  const { joinCall: join } = await import('./signalling');
  track({ app: 'qvc', event: 'run.start', tier: 'live', variant: 'join' });
  await join(token, () => {
    void onCallStart();
  });
}

document.addEventListener('navbar:connect', (e) => {
  const detail = (e as CustomEvent<{ service?: string; url?: string }>).detail;
  if (detail.service !== 'qvc' || !detail.url) return;
  const url = detail.url;
  void import('./signalling').then(({ connect, setHost, mediaStreams: streams }) => {
    mediaStreams = streams;
    setHost({ render, notify: showToast });
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
// The invite fragment carries the room, and may carry the pass beside it;
// parseRoomToken stops at the first character outside the token alphabet.
void loadDevicesQuietly();
pendingRoomToken = parseRoomToken(window.location.hash);
state.invited = pendingRoomToken !== '';
document.addEventListener('click', onClick);
document.addEventListener('input', onInput);
document.addEventListener('change', onChange);
document.addEventListener('submit', onSubmit);
render();
