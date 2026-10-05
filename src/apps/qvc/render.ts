/**
 * Rendering for the video call.
 *
 * Three views share one root: the lobby, the call, and the dashboard inside it.
 * They are separate functions because one `render` carrying all of it exceeds
 * the complexity budget, and because the lobby is what Lighthouse measures.
 *
 * Markup goes in through `innerHTML`, so every value interpolated into it is
 * either a number this module produced or passes through `esc`. Tokens and
 * links are written through `value`/`textContent` sinks afterwards instead.
 */
import { MAX_QBER, HALF_RATE_QBER } from './engine/bench/distill.js';
import { state } from './state';

/** BB84 stops minting above this QBER; intercept-resend lands near 25%. */
export const QBER_THRESHOLD: number = MAX_QBER;
/** Above this the link still mints, but at under half the clean key rate. */
export const QBER_WARNING: number = HALF_RATE_QBER;

/** Escape a string for interpolation into markup. */
export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function fmtTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

/** Channel noise, as a class suffix. Not the encryption status. */
export function qberStatus(): 'normal' | 'warning' | 'danger' {
  if (state.qber === null) return 'normal';
  if (state.qber > QBER_THRESHOLD) return 'danger';
  if (state.qber > QBER_WARNING) return 'warning';
  return 'normal';
}

export function qberStatusLabel(): string {
  if (state.qber === null) return 'Measuring…';
  if (state.qber > QBER_THRESHOLD) return 'Very noisy';
  if (state.qber > QBER_WARNING) return 'Noisy';
  return 'Clean';
}

export function modeBadge(): string {
  return state.mode === 'optical' ? 'OPTICAL' : 'SIMULATED';
}

/** Reservoir fill fraction toward the key currently being distilled. */
export function distillFraction(): number {
  if (!state.mintBudget || state.mintBudget <= 0) return 0;
  return Math.min(1, state.reservoirBits / state.mintBudget);
}

/** The cipher pill, which reports the crypto worker and nothing else. */
function cipherPill(): string {
  const views: Record<string, { mod: string; label: string }> = {
    establishing: { mod: 'establishing', label: 'Establishing encryption…' },
    encrypted: {
      mod: 'encrypted',
      label: `Encrypted · AES-GCM${state.keyIndex !== null ? ` #${state.keyIndex}` : ''}`,
    },
    unencrypted: { mod: 'unencrypted', label: 'Not encrypted — media blocked' },
    compromised: { mod: 'compromised', label: 'Channel integrity lost' },
    unsupported: {
      mod: 'unsupported',
      label: 'Encryption unsupported — try Chrome, Firefox, or Safari 17+',
    },
  };
  const v = views[state.cipherState] ?? views.establishing;
  return `<span class="qvc-pill qvc-pill--${v.mod}" role="status">${esc(v.label)}</span>`;
}

function sasBlock(): string {
  if (!state.sas) return '';
  const emoji = esc(state.sas.emoji.join(' '));
  const hint = state.sasVerified
    ? 'Verified on camera — no one is between you.'
    : 'Compare on camera. If the emoji or digits differ, someone is between you — hang up.';
  const actions = state.sasVerified
    ? ''
    : `<div class="qvc-sas-actions">
        <button class="s6-btn s6-btn--sm" data-action="sas-verify">Matches — verify</button>
        <button class="s6-btn s6-btn--sm" data-action="sas-mismatch">Doesn't match</button>
      </div>`;
  return `<div class="qvc-sas${state.sasVerified ? ' qvc-sas--verified' : ''}">
      <span class="qvc-sas-emoji" aria-hidden="true">${emoji}</span>
      <strong class="qvc-sas-digits" id="qvc-sas-digits"></strong>
      <span class="qvc-sas-hint">${hint}</span>
      ${actions}
    </div>`;
}

function metric(label: string, value: string, extra = ''): string {
  return `<div class="qvc-metric">
      <span class="qvc-metric-value${extra}">${value}</span>
      <span class="qvc-metric-label">${label}</span>
    </div>`;
}

/** The expanded telemetry body: distillation, the four counters, the chart. */
function dashboardBody(): string {
  const stalled = state.qber !== null && state.qber > QBER_THRESHOLD;
  const budget = state.mintBudget ? ` / ${state.mintBudget.toLocaleString()}` : '';
  const qberText = state.qber !== null ? `${(state.qber * 100).toFixed(1)}%` : '--';
  const qberClass =
    qberStatus() === 'danger'
      ? ' qvc-metric-value--danger'
      : qberStatus() === 'warning'
        ? ' qvc-metric-value--warning'
        : '';
  const eve = state.isInitiator
    ? `<button class="s6-btn s6-btn--sm" data-action="toggle-eve" aria-pressed="${String(state.eavesdropper)}">
         ${state.eavesdropper ? 'Eavesdropper active — click to remove' : 'Simulate eavesdropper'}
       </button>`
    : '';
  return `<div class="qvc-qd-body" id="qvc-qd-body">
      <div class="qvc-distill">
        <div class="qvc-distill-bar">
          <span
            class="qvc-distill-fill${stalled ? ' qvc-distill-fill--stalled' : ''}"
            id="qvc-distill-fill"
          ></span>
        </div>
        <span class="qvc-distill-label"
          >Distilling next key — ${state.reservoirBits.toLocaleString()}${budget} sifted bits</span
        >
      </div>
      <div class="qvc-metrics">
        ${metric('QBER', qberText, qberClass)}
        ${metric('Keys', String(state.keysMinted))}
        ${metric('Rotations', String(state.rotations))}
        ${metric('Pool', String(state.poolDepth))}
      </div>
      <canvas id="qvc-chart" class="qvc-chart" aria-label="Quantum bit error rate over time"
      ></canvas>
      ${eve}
    </div>`;
}

/** The dashboard toggle and, when open, its body. */
export function renderDashboard(): string {
  if (!state.bb84Active) {
    return '<p class="qvc-qd-inactive">Establishing the quantum channel…</p>';
  }
  const keys = `${state.keysMinted} ${state.keysMinted === 1 ? 'key' : 'keys'}`;
  return `<button
      class="qvc-qd-toggle"
      data-action="toggle-dashboard"
      aria-expanded="${String(state.dashboardExpanded)}"
      ${state.dashboardExpanded ? 'aria-controls="qvc-qd-body"' : ''}
    >
      <span class="qvc-qd-title">BB84 key reservoir</span>
      <span class="qvc-qd-mode qvc-qd-mode--${state.mode ?? 'pending'}">${modeBadge()}</span>
      <span class="qvc-qd-badge qvc-qd-badge--${qberStatus()}">${qberStatusLabel()}</span>
      <span class="qvc-qd-summary">${keys}</span>
    </button>
    ${state.dashboardExpanded ? dashboardBody() : ''}`;
}

/** The simulation tier, which needs nothing from anyone. */
function demoTier(): string {
  return `<div class="qvc-tier">
      <button
        class="s6-btn s6-btn--primary"
        data-action="run-demo"
        ${state.demoRunning ? 'disabled' : ''}
      >${state.demoRunning ? 'Simulation running' : 'Run the simulation'}</button>
      <p class="qvc-note">
        Both ends of the key exchange in this tab. No camera, no microphone, no second person.
      </p>
      ${state.demoRunning ? renderDashboard() : ''}
    </div>`;
}

/** Waiting for the other person, with the link that invites them. */
function waitingForPeer(): string {
  return `<div class="qvc-waiting" role="status">Waiting for your partner to join…</div>
    <div class="qvc-invite">
      <label class="qvc-label" for="qvc-invite-link">Invite link</label>
      <input id="qvc-invite-link" class="qvc-input" type="text" readonly />
      <button class="s6-btn s6-btn--sm" data-action="copy-link">Copy link</button>
    </div>
    <p class="qvc-note">Send this link to the person you want to call.</p>`;
}

/** Start and join, disabled until the gateway has answered. */
function callControls(live: boolean): string {
  const off = live ? '' : 'disabled';
  const error = state.mediaError
    ? `<p class="qvc-error" role="alert">${esc(state.mediaError)}</p>`
    : '';
  const note = live
    ? 'Both of you need a pass; the invite link carries yours.'
    : 'A real call needs a pass and a second person. Connect above to enable it.';
  return `<button class="s6-btn s6-btn--primary" data-action="create-room" ${off}>
      Start a call
    </button>
    ${error}
    <form class="qvc-join" data-action="join-room">
      <label class="qvc-label" for="qvc-room-input">Invite link</label>
      <input
        id="qvc-room-input"
        class="qvc-input"
        type="text"
        autocomplete="off"
        placeholder="Paste invite link"
        ${off}
      />
      <button class="s6-btn" type="submit" ${off}>Join</button>
    </form>
    <p class="qvc-note">${note}</p>`;
}

/** The live tier, in whichever of its three states it is in. */
function callTier(): string {
  if (state.joining) {
    return '<div class="qvc-tier"><div class="qvc-waiting" role="status">Connecting securely…</div></div>';
  }
  const body = state.waitingForPeer
    ? waitingForPeer()
    : callControls(state.liveAvailable && state.connected);
  return `<div class="qvc-tier">${body}</div>`;
}

/** The pre-call view: both tiers, and whatever the live one is waiting on. */
export function renderLobby(): string {
  return `<section class="qvc-lobby" aria-labelledby="qvc-lobby-title">
      <h2 id="qvc-lobby-title" class="qvc-lobby-title">Quantum key distribution, end to end</h2>
      <p class="qvc-lede">
        Keys for this call come from BB84: single photons, measured in randomly chosen bases,
        reconciled and privacy-amplified into an AES-GCM key.
      </p>
      ${demoTier()}
      ${callTier()}
    </section>`;
}

/** The in-call view: video, status, the SAS, the dashboard, the toolbar. */
export function renderCall(): string {
  const reconnecting = state.reconnecting
    ? '<div class="qvc-banner" role="status">Reconnecting…</div>'
    : '';
  const eavesdropNote =
    state.peerEavesdropping && !state.isInitiator
      ? `<div class="qvc-banner">Your partner is running the eavesdropper demo — the rising
           QBER is expected, not a real attack.</div>`
      : '';
  return `<section class="qvc-call" aria-label="Call">
      <div class="qvc-video-area">
        <video id="qvc-remote-video" class="qvc-remote-video" autoplay playsinline></video>
        <video id="qvc-local-video" class="qvc-pip-video" autoplay muted playsinline></video>
      </div>
      ${reconnecting}
      <div class="qvc-call-info">
        <span>Room <strong id="qvc-room-ref"></strong></span>
        ${cipherPill()}
        ${state.sasVerified ? '<span class="qvc-verified">✓ Verified</span>' : ''}
        <span id="qvc-timer">${fmtTime(state.elapsed)}</span>
      </div>
      ${eavesdropNote}
      ${sasBlock()}
      <div class="qvc-qd">${renderDashboard()}</div>
      <div class="qvc-toolbar">
        <button
          class="s6-btn s6-btn--sm"
          data-action="toggle-camera"
          aria-pressed="${String(!state.cameraOn)}"
        >${state.cameraOn ? 'Turn camera off' : 'Turn camera on'}</button>
        <button
          class="s6-btn s6-btn--sm"
          data-action="toggle-mute"
          aria-pressed="${String(state.muted)}"
        >${state.muted ? 'Unmute' : 'Mute'}</button>
        <button class="s6-btn s6-btn--sm" data-action="leave">Leave</button>
      </div>
    </section>`;
}
