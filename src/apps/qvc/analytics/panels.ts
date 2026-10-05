/**
 * The analytics screen's panels.
 *
 * Every value here comes from a real reading on the bus. Anything absent prints
 * an em dash rather than a plausible number, so an empty panel is readable as
 * "nothing measured yet" instead of "measured zero".
 */
import { esc } from '../render';

/** One live telemetry snapshot, as the call window builds it. */
export interface Snapshot {
  inCall?: boolean;
  summary?: boolean;
  bb84Active?: boolean;
  elapsed?: number;
  mode?: string | null;
  cipherState?: string;
  keysMinted?: number;
  rotations?: number;
  poolDepth?: number;
  keyIndex?: number | null;
  reservoirBits?: number;
  mintBudget?: number | null;
  distillFraction?: number;
  qber?: number | null;
  qberHistory?: number[];
  qberThreshold?: number | null;
  qberWarning?: number | null;
  sas?: { digits?: string; emoji?: string[] } | null;
  sasVerified?: boolean;
  fingerprints?: { local?: string; remote?: string } | null;
  quality?: Record<string, unknown> | null;
  crypto?: Record<string, unknown> | null;
  events?: { t: number; kind: string }[];
}

const DASH = '—';

/** A reading that arrived over the bus, narrowed to something printable. */
function asText(v: unknown): string | number | null {
  if (typeof v === 'string' || typeof v === 'number') return v;
  return null;
}

export function fmt(v: string | number | null | undefined, unit = ''): string {
  if (v === null || v === undefined) return DASH;
  return `${esc(String(v))}${unit}`;
}

export function pct(v: unknown): string {
  return typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : DASH;
}

export function mmss(seconds: unknown): string {
  if (typeof seconds !== 'number') return DASH;
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

export function modeLabel(mode: unknown): string {
  if (mode === 'optical') return 'OPTICAL';
  return mode ? 'SIMULATED' : DASH;
}

/** How a QBER reading should be read, against this call's own thresholds. */
export function qberVerdict(
  qber: unknown,
  threshold: unknown,
  warning: unknown,
): { tone: 'neutral' | 'success' | 'warning' | 'danger'; label: string } {
  if (typeof qber !== 'number') return { tone: 'neutral', label: 'No reading yet' };
  if (typeof threshold === 'number' && qber > threshold) {
    return { tone: 'danger', label: 'Above the abort threshold' };
  }
  if (typeof warning === 'number' && qber > warning) {
    return { tone: 'warning', label: 'Noisy — key rate is down' };
  }
  return { tone: 'success', label: 'Clean' };
}

/** A fingerprint is long; the first and last groups identify it well enough. */
export function shortFp(fp: unknown): string {
  if (typeof fp !== 'string' || !fp) return DASH;
  const parts = fp.split(':');
  if (parts.length <= 4) return fp;
  return `${parts.slice(0, 2).join(':')}…${parts.slice(-2).join(':')}`;
}

const EVENT_LABEL = new Map<string, string>([
  ['call-start', 'Call started'],
  ['call-end', 'Call ended'],
  ['minted', 'Key minted'],
  ['rotated', 'Key rotated'],
  ['sas-verified', 'SAS verified'],
  ['eve', 'Eavesdropper on'],
  ['peer-eve', 'Peer eavesdropping'],
  ['reconnect', 'Reconnecting'],
  ['recovered', 'Recovered'],
  ['qber-abort', 'Frame rejected (QBER)'],
  ['compromised', 'Channel compromised'],
  ['mode', 'Backend chosen'],
]);

export function eventLabel(kind: string): string {
  return EVENT_LABEL.get(kind) ?? kind;
}

function tile(key: string, value: string): string {
  return `<div class="an-tile"><div class="an-k">${key}</div><div class="an-v">${value}</div></div>`;
}

function reservoirPanel(s: Snapshot): string {
  const bits = (s.reservoirBits ?? 0).toLocaleString();
  const budget = s.mintBudget ? `${bits} / ${s.mintBudget.toLocaleString()} bits` : `${bits} bits`;
  const keyIndex = s.keyIndex === null || s.keyIndex === undefined ? DASH : `#${s.keyIndex}`;
  return `<section class="an-panel">
      <h2>Key reservoir <span class="an-badge">${modeLabel(s.mode)}</span></h2>
      <div class="an-tiles">
        ${tile('Keys minted', fmt(s.keysMinted))}
        ${tile('Rotations', fmt(s.rotations))}
        ${tile('Pool', fmt(s.poolDepth))}
        ${tile('Key index', keyIndex)}
      </div>
      <div class="an-bar"><span id="an-distill-fill"></span></div>
      <div class="an-sub">Distilling next key — ${budget}</div>
    </section>`;
}

function qberPanel(s: Snapshot): string {
  const v = qberVerdict(s.qber, s.qberThreshold, s.qberWarning);
  const threshold =
    typeof s.qberThreshold === 'number' ? `${(s.qberThreshold * 100).toFixed(1)}%` : DASH;
  return `<section class="an-panel">
      <h2>Channel quality (QBER)</h2>
      <div class="an-qber an-tone-${v.tone}">
        <span class="an-qber-now">${pct(s.qber)}</span>
        <span class="an-qber-verdict">${v.label}</span>
      </div>
      <canvas class="an-chart" data-chart="qber" aria-label="Error rate over time"></canvas>
      <div class="an-sub">
        Abort threshold ${threshold} · intercept-resend lands near 25%
      </div>
    </section>`;
}

function securityPanel(s: Snapshot): string {
  const emoji = s.sas?.emoji?.length ? esc(s.sas.emoji.join(' ')) : DASH;
  const digits = s.sas?.digits ? esc(s.sas.digits) : DASH;
  const verified = s.sasVerified
    ? '<span class="an-badge an-tone-success">✓ Verified</span>'
    : '<span class="an-badge">Unverified</span>';
  return `<section class="an-panel">
      <h2>Security and authentication</h2>
      <div class="an-tiles">
        ${tile('Cipher', fmt(s.cipherState))}
        ${tile('Backend', modeLabel(s.mode))}
      </div>
      <div class="an-sas">
        <div class="an-sas-emoji" aria-hidden="true">${emoji}</div>
        <div class="an-sas-digits">${digits}</div>
        ${verified}
      </div>
      <div class="an-fp">
        <div><span class="an-k">DTLS (you)</span> <code>${shortFp(s.fingerprints?.local)}</code></div>
        <div><span class="an-k">DTLS (peer)</span> <code>${shortFp(s.fingerprints?.remote)}</code></div>
      </div>
    </section>`;
}

function spark(label: string, current: string, chart: string): string {
  return `<div class="an-spark">
      <div class="an-spark-head"><span class="an-k">${label}</span><span class="an-v-sm">${current}</span></div>
      <canvas class="an-sparkline" data-chart="${chart}" aria-label="${label} over time"></canvas>
    </div>`;
}

function mediaPanel(s: Snapshot): string {
  const q = s.quality ?? {};
  const c = s.crypto ?? {};
  const kbps =
    typeof q.bandwidthKbps === 'number' ? `${q.bandwidthKbps.toLocaleString()} kbps` : DASH;
  const rtt = typeof q.rttMs === 'number' ? `${String(q.rttMs)} ms` : DASH;
  const enc =
    typeof c.encryptLatencyUs === 'number' ? `${String(Math.round(c.encryptLatencyUs))} µs` : DASH;
  const dec =
    typeof c.decryptLatencyUs === 'number' ? `${String(Math.round(c.decryptLatencyUs))} µs` : DASH;
  const limited = q.limitedBy && q.limitedBy !== 'none' ? q.limitedBy : 'nothing';
  return `<section class="an-panel">
      <h2>Media and network</h2>
      <div class="an-tiles">
        ${tile('Tier', fmt(asText(q.tier)))}
        ${tile('Out', fmt(asText(q.actualRes)))}
        ${tile('In', fmt(asText(q.inRes)))}
        ${tile('Limited by', fmt(asText(limited)))}
      </div>
      ${spark('Bandwidth', kbps, 'bandwidth')}
      ${spark('Round-trip', rtt, 'rtt')}
      ${spark('Encrypt', enc, 'enc')}
      ${spark('Decrypt', dec, 'dec')}
    </section>`;
}

function timelinePanel(s: Snapshot, now: number): string {
  const events = [...(s.events ?? [])].reverse();
  const rel = (t: number): string => {
    const secs = Math.max(0, Math.round((now - t) / 1000));
    if (secs < 1) return 'now';
    if (secs < 60) return `${String(secs)}s ago`;
    return `${String(Math.floor(secs / 60))}m ago`;
  };
  const rows = events.length
    ? events
        .map(
          (e) =>
            `<li><span class="an-ev-t">${rel(e.t)}</span><span class="an-ev-k">${esc(eventLabel(e.kind))}</span></li>`,
        )
        .join('')
    : '<li class="an-ev-empty">No events yet</li>';
  return `<section class="an-panel an-panel-wide">
      <h2>Event timeline</h2>
      <ul class="an-timeline">${rows}</ul>
    </section>`;
}

function summaryCard(s: Snapshot): string {
  const history = s.qberHistory ?? [];
  const peak = history.length ? Math.max(...history) : null;
  return `<section class="an-summary">
      <h2>Call summary</h2>
      <div class="an-tiles">
        ${tile('Duration', mmss(s.elapsed))}
        ${tile('Keys minted', fmt(s.keysMinted))}
        ${tile('Rotations', fmt(s.rotations))}
        ${tile('Peak QBER', peak !== null ? pct(peak) : DASH)}
        ${tile('Backend', modeLabel(s.mode))}
        ${tile('Verified', s.sasVerified ? 'Yes' : 'No')}
      </div>
    </section>`;
}

/**
 * The whole screen for one snapshot.
 *
 * A running simulation has no peer, so `inCall` is false for it; what says there
 * is something to show is the key engine running. Its media and fingerprint
 * panels then read as dashes, the empty state those panels are built around.
 */
export function renderPanels(s: Snapshot, now: number): string {
  if (!s.inCall && !s.bb84Active && !s.summary) {
    return `<section class="an-panel an-panel-wide">
        <h2>Waiting for a call</h2>
        <p class="an-sub">
          This screen reads a call, or a simulation, running in the other window.
          Start one there and the panels fill.
        </p>
      </section>`;
  }
  const scope =
    !s.inCall && s.bb84Active
      ? `<p class="an-sub an-scope">Reading a simulation: the key exchange is real, the
           media and peer panels have nothing to report.</p>`
      : '';
  return `${scope}
    ${s.summary ? summaryCard(s) : ''}
    ${reservoirPanel(s)}
    ${qberPanel(s)}
    ${securityPanel(s)}
    ${mediaPanel(s)}
    ${timelinePanel(s, now)}`;
}
