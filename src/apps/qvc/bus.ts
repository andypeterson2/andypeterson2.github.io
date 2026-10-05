/**
 * The analytics bus: the call window publishes, the analytics window listens.
 *
 * A same-origin `BroadcastChannel`, which CSP does not gate and which never
 * leaves the browser. Only real readings travel: absent data is null, so the
 * analytics window can show an empty state rather than a plausible number.
 */
import { state } from './state';
import { QBER_THRESHOLD, QBER_WARNING } from './render';
import { track } from '../../telemetry';

/** Coalescing period while a call is up. Events publish on their own. */
const PUBLISH_MS = 250;

let channel: BroadcastChannel | null = null;
let timer: number | null = null;
let log: { log: (kind: string, detail?: unknown) => void; tail: () => unknown[] } | null = null;
let build: ((s: unknown, extras: unknown) => Record<string, unknown>) | null = null;
let fingerprints: (() => unknown) | null = null;

/** Commands the analytics window may send back, applied by the caller. */
export type Command = 'toggle-eve' | 'force-rotate' | 'reset';

export async function openBus(onCommand: (cmd: Command) => void): Promise<void> {
  if (typeof BroadcastChannel === 'undefined' || channel) return;
  const { TELEMETRY_CHANNEL, isValidCommand, EventLog, buildTelemetrySnapshot } =
    await import('./engine/analytics/telemetry.js');
  const Log = EventLog as new () => {
    log: (kind: string, detail?: unknown) => void;
    tail: () => unknown[];
  };
  log = new Log();
  build = buildTelemetrySnapshot as (s: unknown, extras: unknown) => Record<string, unknown>;
  channel = new BroadcastChannel(TELEMETRY_CHANNEL);
  channel.onmessage = (e: MessageEvent) => {
    const valid = isValidCommand as (m: unknown) => boolean;
    if (valid(e.data)) onCommand((e.data as { cmd: Command }).cmd);
  };
}

/** Where the DTLS fingerprints come from, once a call has an engine. */
export function setFingerprintSource(source: (() => unknown) | null): void {
  fingerprints = source;
}

function snapshot(): Record<string, unknown> | null {
  if (!build) return null;
  return build(state, {
    fingerprints: fingerprints ? fingerprints() : null,
    events: log ? log.tail() : [],
    qberThreshold: QBER_THRESHOLD,
    qberWarning: QBER_WARNING,
  });
}

export function publish(): void {
  const snap = snapshot();
  if (!channel || !snap) return;
  try {
    channel.postMessage(snap);
  } catch {
    // A structured-clone failure costs this tick and nothing else.
  }
}

/** Record a timeline event and publish at once, so the timeline stays prompt. */
export function logEvent(kind: string, detail?: unknown): void {
  log?.log(kind, detail);
  publish();
}

export function startPublishing(): void {
  if (timer !== null || !channel) return;
  publish();
  timer = window.setInterval(publish, PUBLISH_MS);
}

export function stopPublishing(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  // One final snapshot: the call is over, so the live panels clear.
  publish();
}

/**
 * Publish a post-call summary from the still-populated state, flagged so the
 * analytics window latches it as its live panels reset. Runs before the
 * counters are zeroed.
 */
export function publishSummary(): void {
  const snap = snapshot();
  if (!channel || !snap) return;
  snap.inCall = false;
  snap.summary = true;
  try {
    channel.postMessage(snap);
  } catch {
    // Skip.
  }
}

/** Open the analytics screen in its own window, fed live over the bus. */
export function openAnalyticsWindow(): void {
  track({ app: 'qvc', event: 'run.start', tier: 'browser', variant: 'analytics' });
  window.open('./analytics/', 'qvc-analytics', 'width=1280,height=860');
}
