/**
 * Optical bench mode: keys from a real photon bench instead of the simulator.
 *
 * The bench is a daemon on the loopback interface, so this exists only where
 * the page is allowed to reach one. In production `connect-src` admits no
 * `ws://127.0.0.1`, and widening it site-wide for a control almost nobody can
 * use would be the wrong trade — so the controls are not rendered there at all,
 * rather than rendered and refused.
 *
 * Both peers need a bench. With one, negotiation falls back to the simulator on
 * both sides and says so.
 */
import { state } from './state';

/** Settings persist per-origin; the pairing token does not outlive the tab. */
const SETTINGS_KEY = 'qvc.optical';
const TOKEN_KEY = 'qvc.optical.token';

export interface OpticalSettings {
  enabled: boolean;
  url: string;
  token: string;
}

/**
 * Whether this build may reach a bench at all. Vite replaces this at build
 * time, so production ships without the branch rather than hiding it at runtime.
 */
export function benchAvailable(): boolean {
  return import.meta.env.DEV;
}

export function loadSettings(): OpticalSettings {
  const fallback: OpticalSettings = { enabled: false, url: 'ws://127.0.0.1:8781', token: '' };
  if (!benchAvailable()) return fallback;
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
    const s = saved as Partial<OpticalSettings>;
    return {
      enabled: s.enabled === true,
      url: typeof s.url === 'string' && s.url ? s.url : fallback.url,
      token: sessionStorage.getItem(TOKEN_KEY) ?? '',
    };
  } catch {
    return fallback;
  }
}

export function saveSettings(s: OpticalSettings): void {
  if (!benchAvailable()) return;
  try {
    // The token is a live credential, so it stays out of the persisted blob.
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ enabled: s.enabled, url: s.url }));
    if (s.token) sessionStorage.setItem(TOKEN_KEY, s.token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable: the settings last for this page view.
  }
}

/** A live daemon connection, while bench mode is armed. */
let connection: { close: () => void; role: string } | null = null;

export function closeBench(): void {
  connection?.close();
  connection = null;
}

/**
 * Pair with the daemon and hand the orchestrator a bench backend, so
 * negotiation can offer optical. Any failure leaves the call on the simulator
 * with a visible notice: the call is never broken by the bench being absent.
 */
export async function armBench(
  orchestrator: { configureBench: (b: unknown) => void },
  notify: (message: string) => void,
): Promise<void> {
  closeBench();
  if (!benchAvailable() || !state.optical.enabled || !state.optical.token) return;
  try {
    const { DaemonConnection, DaemonFrameSource } = await import('./engine/bench/daemon-source.js');
    const Conn = DaemonConnection as new (o: { url: string; token: string }) => {
      connect: () => Promise<void>;
      close: () => void;
      role: string;
    };
    const conn = new Conn({ url: state.optical.url, token: state.optical.token });
    await conn.connect();
    connection = conn;
    const Source = DaemonFrameSource as new (c: unknown) => unknown;
    orchestrator.configureBench({
      backend: 'bench',
      role: conn.role,
      // The connection is already up; the orchestrator calls this before use.
      connect: () => Promise.resolve(),
      makeFrameSource: () => new Source(conn),
    });
    state.opticalStatus = `paired (${conn.role})`;
  } catch (err) {
    connection = null;
    state.opticalStatus = 'unavailable';
    notify(
      `Optical bench unavailable (${err instanceof Error ? err.message : 'refused'}) — using the simulator.`,
    );
  }
}
