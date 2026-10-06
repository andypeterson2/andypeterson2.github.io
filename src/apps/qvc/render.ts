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
import type { BudgetTerms, Receipt } from './state';
import { benchAvailable } from './optical';

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

/**
 * The cipher pill, which reports the crypto worker and nothing else. With no
 * worker there is nothing to report, so no pill is drawn.
 */
function cipherPill(): string {
  if (state.cipherState === null) return '';
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

/**
 * Eve as a dial rather than a switch. The interesting region is between an
 * undisturbed channel and the point where no pool of any size mints; a toggle
 * jumps over all of it.
 */
function eveSlider(): string {
  const pct = Math.round(state.eveFraction * 100);
  return `<div class="qvc-eve">
      <label class="qvc-label" for="qvc-eve">Eavesdropper intercepts</label>
      <input
        id="qvc-eve"
        class="qvc-eve-range"
        type="range"
        min="0"
        max="100"
        step="1"
        value="${String(pct)}"
        data-action="set-eve"
        aria-describedby="qvc-eve-read"
      />
      <output id="qvc-eve-read" class="qvc-eve-read">${String(pct)}% of slots</output>
    </div>`;
}

/** The budget as the engine computed it, term by term. */
function budgetPanel(b: BudgetTerms | null): string {
  if (!b) {
    return '<p class="qvc-note">No sample yet, so no bound on what an eavesdropper knows.</p>';
  }
  const row = (k: string, v: string) =>
    `<div class="qvc-budget-row"><span>${k}</span><span>${v}</span></div>`;
  const pctOf = (x: number) => `${(x * 100).toFixed(2)}%`;
  const short = b.remaining < b.target;
  return `<div class="qvc-budget">
      ${row('Pooled bits (n)', b.pooled.toLocaleString())}
      ${row('Sampled (k)', b.samples.toLocaleString())}
      ${row('Observed error', pctOf(b.observed))}
      ${row('Finite-key penalty (μ)', pctOf(b.penalty))}
      ${row('Eve bounded at', pctOf(b.bounded))}
      ${row('Privacy n(1 − h)', b.privacy.toLocaleString())}
      ${row('− reconciliation', `−${b.expectedLeak.toLocaleString()}`)}
      ${row('− privacy amplification', `−${String(b.paBits)}`)}
      ${row('− verification hash', `−${String(b.verifyBits)}`)}
      ${row(
        'Left for a key',
        `${b.remaining.toLocaleString()} of ${String(b.target)}${short ? ' — not yet' : ''}`,
      )}
    </div>`;
}

/** One row per mint: what reconciliation cost against what it was allowed. */
function receipts(rows: Receipt[]): string {
  if (!rows.length) return '';
  const body = rows
    .map((r) => {
      const ratio = r.expectedLeak > 0 ? (r.disclosed / r.expectedLeak).toFixed(2) : '—';
      const agree =
        r.digest && r.peerDigest
          ? r.digest === r.peerDigest
            ? `both ends ${esc(r.digest)}`
            : 'ends disagree'
          : r.digest
            ? esc(r.digest)
            : '—';
      return `<li>
          <span class="qvc-receipt-k">#${String(r.keyIndex)}</span>
          <span>${r.disclosed.toLocaleString()} / ${r.allowance.toLocaleString()} parities</span>
          <span>${ratio}× the estimate</span>
          <span>${r.verified ? 'verified' : 'unverified'}</span>
          <span class="qvc-receipt-d">${agree}</span>
        </li>`;
    })
    .join('');
  return `<div class="qvc-receipts">
      <h3 class="qvc-receipts-title">What each key cost</h3>
      <ul class="qvc-receipt-list">${body}</ul>
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
  const eve = state.isInitiator ? eveSlider() : '';
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
      ${budgetPanel(state.budget)}
      ${receipts(state.receipts)}
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

/** What the simulation is, stated before it runs and corrected once it has. */
function demoScope(): string {
  if (!state.demoRunning) {
    return 'Both ends of the key exchange in this tab. No camera, no microphone, no second person.';
  }
  return state.demoAuthenticated
    ? `Both ends in this tab, joined by a real peer connection: the classical channel is
       authenticated and the short authentication string below is derived from the two DTLS
       certificates, as it is in a call. No camera, no microphone, no second person.`
    : `Both ends in this tab over an in-memory channel, because this browser gave no peer
       connection. There are no certificates to bind, so the channel is unauthenticated and
       no short authentication string is derived.`;
}

/** Two independent ends reaching the same string, which is the whole claim. */
function sasAgreement(): string {
  if (!state.demoAuthenticated || !state.sas) return '';
  const agree = state.peerSas !== null && state.peerSas === state.sas.digits;
  return `<div class="qvc-sas">
      <span class="qvc-sas-emoji" aria-hidden="true">${esc(state.sas.emoji.join(' '))}</span>
      <strong class="qvc-sas-digits">${esc(state.sas.digits)}</strong>
      <span class="qvc-sas-hint">${
        agree
          ? 'Both ends derived this independently and agree. In a call you would read it aloud.'
          : 'Waiting for the other end to derive its own.'
      }</span>
    </div>`;
}

/** The simulation tier, which needs nothing from anyone. */
function demoTier(): string {
  return `<div class="qvc-tier">
      <button
        class="s6-btn s6-btn--primary"
        data-action="run-demo"
        ${state.demoRunning ? 'disabled' : ''}
      >${state.demoRunning ? 'Simulation running' : 'Run the simulation'}</button>
      <p class="qvc-note">${demoScope()}</p>
      ${state.demoRunning ? sasAgreement() : ''}
      ${state.demoRunning ? renderDashboard() : ''}
      ${state.demoRunning ? '<button class="s6-btn s6-btn--sm" data-action="open-analytics">Open the analytics screen</button>' : ''}
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

/**
 * The camera and microphone picker. Shown with real names once permission
 * exists; before that it offers to ask, because an unlabelled list cannot tell
 * "none attached" from "not yet allowed".
 */
function devicePicker(): string {
  const { cameras, microphones } = state.devices;
  const status = state.deviceStatus
    ? `<p class="qvc-note" role="status">${esc(state.deviceStatus)}</p>`
    : '';
  if (!state.devicesLabelled) {
    return `<div class="qvc-devices">
        <button class="s6-btn s6-btn--sm" data-action="check-devices">
          Check camera and microphone
        </button>
        <p class="qvc-note">
          Nothing is asked for until you press this, and the simulation above needs neither.
        </p>
        ${status}
      </div>`;
  }
  const options = (list: { id: string; label: string }[], chosen: string | null) =>
    list
      .map(
        (d) =>
          `<option value="${esc(d.id)}"${d.id === chosen ? ' selected' : ''}>${esc(d.label)}</option>`,
      )
      .join('');
  const none = '<p class="qvc-error" role="alert">None found on this device.</p>';
  return `<div class="qvc-devices">
      <label class="qvc-label" for="qvc-camera">Camera</label>
      ${
        cameras.length
          ? `<select id="qvc-camera" class="qvc-input" data-action="pick-camera">${options(cameras, state.deviceChoice.cameraId)}</select>`
          : none
      }
      <label class="qvc-label" for="qvc-mic">Microphone</label>
      ${
        microphones.length
          ? `<select id="qvc-mic" class="qvc-input" data-action="pick-mic">${options(microphones, state.deviceChoice.microphoneId)}</select>`
          : none
      }
      <button class="s6-btn s6-btn--sm" data-action="check-devices">Test these</button>
      ${status}
    </div>`;
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
    <p class="qvc-note">${note}</p>
    ${devicePicker()}`;
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

/**
 * The bench controls, in the builds that may reach one. Production ships no
 * `ws://127.0.0.1` in connect-src, so there the control would only ever be
 * refused, and this returns nothing.
 */
function benchTier(): string {
  if (!benchAvailable()) return '';
  const fields = state.optical.enabled
    ? `<div class="qvc-bench-fields">
         <label class="qvc-label" for="qvc-bench-url">Daemon address</label>
         <input id="qvc-bench-url" class="qvc-input" type="text" data-action="bench-url" />
         <label class="qvc-label" for="qvc-bench-token">Pairing token</label>
         <input id="qvc-bench-token" class="qvc-input" type="password" data-action="bench-token" />
         <p class="qvc-note">
           Both peers need a bench; with one, the call uses the simulator on both sides.
           ${state.opticalStatus ? `Daemon: ${esc(state.opticalStatus)}` : ''}
         </p>
       </div>`
    : '';
  return `<div class="qvc-tier">
      <label class="qvc-bench-toggle">
        <input
          type="checkbox"
          data-action="toggle-bench"
          ${state.optical.enabled ? 'checked' : ''}
        />
        <span>Use an optical bench (hardware daemon)</span>
      </label>
      ${fields}
    </div>`;
}

/** The pre-call view: both tiers, and whatever the live one is waiting on. */
export function renderLobby(): string {
  return `<section class="qvc-lobby" aria-labelledby="qvc-lobby-title">
      <h2 id="qvc-lobby-title" class="qvc-lobby-title">Quantum key distribution, end to end</h2>
      <p class="qvc-lede">
        Keys come from BB84: photons measured in randomly chosen bases, reconciled and
        privacy-amplified into an AES-GCM key. The photons are simulated — a channel model
        with attenuation, detector efficiency, dark counts and polarization misalignment —
        and everything above that model is the real protocol.
      </p>
      ${demoTier()}
      ${callTier()}
      ${benchTier()}
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
        <button class="s6-btn s6-btn--sm" data-action="open-analytics">Analytics</button>
        <button class="s6-btn s6-btn--sm" data-action="leave">Leave</button>
      </div>
    </section>`;
}
