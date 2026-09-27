/**
 * Site-wide usage events.
 *
 * The store behind these (Cloudflare Analytics Engine) keeps ordered arrays rather
 * than named fields: a write is blobs[] and doubles[], and a query reads them back as
 * blob1..blob20 and double1..double20. So the column order below is the contract, and
 * it is append-only — moving a name silently mixes two meanings in one column for as
 * long as the dataset lives. `docs/api-contract/schemas/telemetry-event.schema.json`
 * is the written half of the same agreement.
 *
 * The gateway writes its own events for everything it proxies, where it can see the
 * tier and cannot be lied to. This module is for the other half: work that finishes
 * in the page and never reaches a server, which is the only kind the gateway misses.
 *
 * Nothing here carries a durable identifier. `visit` is drawn once per page load and
 * held in a module variable — it is not stored anywhere, does not survive a reload,
 * and exists so a visitor's events can be counted as one visit rather than four.
 */

/** Blob column order. Append only; never move or repurpose an entry. */
export const BLOB_COLUMNS = [
  'v',
  'event',
  'tier',
  'outcome',
  'variant',
  'detail',
  'release',
  'visit',
] as const;

/** Double column order. Same rule. */
export const DOUBLE_COLUMNS = ['value', 'a', 'b', 'n'] as const;

/** Bumped when a column's meaning changes, which is the only time one may. */
export const SCHEMA_VERSION = 1;

export type TelemetryApp = 'nonogram' | 'classifiers' | 'cv' | 'portal';
export type TelemetryName = 'run.start' | 'run.done' | 'tier.change';
export type TelemetryTier = 'browser' | 'live' | 'hardware';
export type TelemetryOutcome = 'ok' | 'empty' | 'error' | 'capped' | 'refused';

export interface TelemetryEvent {
  /** The store's one index, and the first thing every query groups by. */
  app: TelemetryApp;
  event: TelemetryName;
  /** Where the work ran, which is not always what was on offer. */
  tier: TelemetryTier;
  outcome?: TelemetryOutcome;
  /** The app's own sub-mode: draw or clues, a dataset name, a variant kind. */
  variant?: string;
  detail?: string;
  /** The one number this event is about: milliseconds, a score. */
  value?: number;
  a?: number;
  b?: number;
  n?: number;
}

const ENDPOINT = 'https://api.andypeterson.dev/t';

/** Set at build time when the deploy knows its own commit; absent otherwise. */
const RELEASE: string | undefined =
  typeof import.meta.env.PUBLIC_RELEASE === 'string' ? import.meta.env.PUBLIC_RELEASE : undefined;

/** Drawn once, kept in memory, never written down. */
const VISIT = newVisit();

function newVisit(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // randomUUID needs a secure context; a plain random string counts just as well.
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

/**
 * Record one event, or do nothing at all.
 *
 * Deliberately unawaitable and deliberately silent: a page must not wait on telemetry,
 * and a failed send must not become an error the visitor sees.
 */
export function track(event: TelemetryEvent): void {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return;
  try {
    const body: Record<string, unknown> = { ...event, v: SCHEMA_VERSION, visit: VISIT };
    if (RELEASE) body.release = RELEASE;
    // text/plain keeps this a simple request: an application/json body would earn a
    // CORS preflight, and a beacon has no way to answer one.
    navigator.sendBeacon(ENDPOINT, new Blob([JSON.stringify(body)], { type: 'text/plain' }));
  } catch {
    // Blocked by an extension, an origin policy, or a browser without beacons.
  }
}
