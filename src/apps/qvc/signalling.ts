/**
 * Live tier: the signalling socket and the call engine.
 *
 * Reached only from the `navbar:connect` handler, so no network happens on load.
 * Socket.IO reads a URL path as a NAMESPACE, so the gateway prefix goes in
 * engine.io's `path`. XHR and WebSocket upgrades bypass the pass fetch-wrapper,
 * so the pass rides as `?pass=`, which the gateway reads and strips.
 */
import { ServiceConfig } from '../shared/service-config';
import { state } from './state';

let socket: ReturnType<typeof io> | null = null;

/** The gateway base this tier talks to, once a connect has been accepted. */
export function base(): string | null {
  return apiBase;
}

let apiBase: string | null = null;

export function connect(url: string): void {
  // Allowlist the origin before opening a socket to it — anything on the page
  // can dispatch a CustomEvent, and this URL carries call setup.
  if (!ServiceConfig.isAllowedUrl(url)) {
    console.warn('[qvc] Ignoring navbar:connect URL outside the allowlist:', url);
    return;
  }
  if (socket) socket.disconnect();
  const target = new URL(url);
  const prefix = target.pathname.replace(/\/$/, '');
  const opts: { path: string; transports: string[]; query?: Record<string, string> } = {
    path: `${prefix}/socket.io`,
    // The relay is WebSocket-only; polling would be refused.
    transports: ['websocket'],
  };
  const pass = window.SitePass.token();
  if (pass) opts.query = { pass };
  socket = io(target.origin, opts);
  apiBase = url;
}

/** ICE servers for the peer connection, through the wrapped fetch (Bearer). */
export async function fetchIceServers(url: string): Promise<RTCIceServer[]> {
  const res = await fetch(`${url}/ice-servers`);
  if (!res.ok) throw new Error(`ice-servers: ${String(res.status)}`);
  const body: unknown = await res.json();
  const servers = (body as { iceServers?: RTCIceServer[] }).iceServers;
  return servers ?? [];
}

/** The call engine, loaded only once a call is actually being placed. */
async function loadEngine(): Promise<{
  WebRTCManager: new (opts: { iceServers: RTCIceServer[] }) => unknown;
  BB84Orchestrator: unknown;
}> {
  const [webrtc, bb84] = await Promise.all([
    import('./engine/webrtc.js'),
    import('./engine/bb84/orchestrator.js'),
  ]);
  return {
    WebRTCManager: (
      webrtc as { WebRTCManager: new (opts: { iceServers: RTCIceServer[] }) => unknown }
    ).WebRTCManager,
    BB84Orchestrator: (bb84 as { BB84Orchestrator: unknown }).BB84Orchestrator,
  };
}

/**
 * Bring up the call engine for this tier. Separate from `connect` so the engine
 * and its crypto worker stay out of the page's initial load: the lobby costs a
 * few kilobytes until someone actually places a call.
 */
export async function startCall(): Promise<void> {
  await ensureManager();
  socket?.emit('create_room');
  state.isInitiator = true;
  state.waitingForPeer = true;
}

/** Join the room an invite link named. */
export async function joinCall(token: string): Promise<void> {
  await ensureManager();
  socket?.emit('join_room', { room_id: token });
  state.isInitiator = false;
  state.joining = true;
}

async function ensureManager(): Promise<void> {
  if (manager) return;
  if (!apiBase) throw new Error('no gateway: connect runs first');
  const iceServers = await fetchIceServers(apiBase);
  const { WebRTCManager } = await loadEngine();
  manager = new WebRTCManager({ iceServers });
}

let manager: unknown = null;

/** The live WebRTC manager, once a call has been started. */
export function callManager(): unknown {
  return manager;
}
