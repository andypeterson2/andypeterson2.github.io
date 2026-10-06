/**
 * Live tier: the signalling socket, the peer connection and the key engine.
 *
 * Reached only from the `navbar:connect` handler, so the page opens no network
 * connection on load. Socket.IO reads a URL path as a NAMESPACE, so the gateway
 * prefix goes in engine.io's `path`; XHR and WebSocket upgrades bypass the pass
 * fetch-wrapper, so the pass rides as `?pass=`, which the gateway reads and
 * strips before forwarding.
 *
 * The engine is imported here rather than at module scope: the lobby costs a few
 * kilobytes until someone actually places a call.
 */
import { ServiceConfig } from '../shared/service-config';
import { state, resetSession } from './state';
import { applyEnginePhase, type EnginePhase } from './engine-state';

/** What this module needs from the page: a repaint and a message. */
export interface Host {
  render: () => void;
  notify: (message: string) => void;
}

let socket: QvcSocket | null = null;
let apiBase: string | null = null;
let host: Host = { render: () => undefined, notify: () => undefined };
let manager: EngineManager | null = null;
let orchestrator: Orchestrator | null = null;
let localStream: MediaStream | null = null;

/** The WebRTCManager surface the shell drives. */
interface EngineManager {
  on: (event: string, cb: (detail: never) => void) => void;
  getLocalMedia: () => Promise<MediaStream>;
  useLocalMedia: (stream: MediaStream) => void;
  getDtlsFingerprints: () => unknown;
  createRoom: () => void;
  joinRoom: (id: string) => void;
  leave?: () => void;
}

interface Orchestrator {
  init: (o: { roomToken: string; isInitiator: boolean }) => Promise<void>;
  handleMessage: (data: unknown) => void;
  configureBench: (b: unknown) => void;
  setEavesdropper: (fraction: number) => void;
  destroy: () => void;
}

export function setHost(next: Host): void {
  host = next;
}

/**
 * The vendored Socket.IO classic script, fetched when a call needs it.
 *
 * It is 50KB and no visitor without a pass can use it, so the lobby does not
 * carry it. Same-origin, so the strict script-src admits it; the page's own
 * CSP needs no third-party source.
 */
const IO_SRC = '/vendor/socket.io-4.7.5.min.js';
let ioLoading: Promise<void> | null = null;

function loadSocketIo(): Promise<void> {
  if (typeof io !== 'undefined') return Promise.resolve();
  ioLoading ??= new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = IO_SRC;
    el.onload = () => {
      resolve();
    };
    el.onerror = () => {
      ioLoading = null;
      reject(new Error('socket.io failed to load'));
    };
    document.head.append(el);
  });
  return ioLoading;
}

export function connect(url: string): void {
  // Allowlist the origin before opening a socket to it — anything on the page
  // can dispatch a CustomEvent, and this URL carries call setup.
  if (!ServiceConfig.isAllowedUrl(url)) {
    console.warn('[qvc] Ignoring navbar:connect URL outside the allowlist:', url);
    return;
  }
  if (socket) socket.disconnect();
  apiBase = url;
  void loadSocketIo().then(() => {
    openSocket(url);
  }, onLoadFailure);
}

function onLoadFailure(): void {
  host.notify('The call components failed to load. Reload the page to try again.');
}

function openSocket(url: string): void {
  const target = new URL(url);
  const prefix = target.pathname.replace(/\/$/, '');
  const opts: QvcSocketOptions = {
    path: `${prefix}/socket.io`,
    transports: ['websocket'],
  };
  const pass = window.SitePass.token();
  if (pass) opts.query = { pass };
  socket = io(target.origin, opts);

  socket.on('connect', () => {
    state.connected = true;
    host.render();
  });
  socket.on('disconnect', () => {
    state.connected = false;
    state.peerConnected = false;
    host.render();
  });
  // The other peer toggled the eavesdropper demo, so the joiner — who has no
  // toggle — can read the QBER climb as the demo rather than an attack.
  socket.on('eve-demo', (d) => {
    state.peerEavesdropping = (d as { active?: boolean } | undefined)?.active === true;
    host.render();
  });
}

/** ICE servers for the peer connection, through the wrapped fetch (Bearer). */
export async function fetchIceServers(url: string): Promise<RTCIceServer[]> {
  const res = await fetch(`${url}/ice-servers`);
  if (!res.ok) throw new Error(`ice-servers: ${String(res.status)}`);
  const body: unknown = await res.json();
  return (body as { iceServers?: RTCIceServer[] }).iceServers ?? [];
}

async function loadEngine(): Promise<{
  WebRTCManager: new (
    s: QvcSocket,
    o: { enableEncryption: boolean; iceServers: RTCIceServer[] },
  ) => EngineManager;
  BB84Orchestrator: new (o: {
    webrtcManager: EngineManager;
    onStateChange: (s: EnginePhase) => void;
  }) => Orchestrator;
}> {
  const [webrtc, bb84] = await Promise.all([
    import('./engine/webrtc.js'),
    import('./engine/bb84/orchestrator.js'),
  ]);
  // The engine is JSDoc-typed JavaScript, so its constructors arrive untyped
  // and are narrowed here, at the one boundary the shell crosses.
  const w = webrtc as unknown as {
    WebRTCManager: new (
      s: QvcSocket,
      o: { enableEncryption: boolean; iceServers: RTCIceServer[] },
    ) => EngineManager;
  };
  const b = bb84 as unknown as {
    BB84Orchestrator: new (o: {
      webrtcManager: EngineManager;
      onStateChange: (s: EnginePhase) => void;
    }) => Orchestrator;
  };
  return { WebRTCManager: w.WebRTCManager, BB84Orchestrator: b.BB84Orchestrator };
}

function wireRoom(m: EngineManager): void {
  m.on('room-created', (d: { room_id: string }) => {
    state.roomId = d.room_id;
    // The link is the credential: an unguessable room token, with the pass
    // beside it so the person invited can answer. A fragment reaches no log.
    const pass = window.SitePass.token();
    const base = `${window.location.origin}${window.location.pathname}`;
    const frag = new URLSearchParams({ room: d.room_id });
    if (pass) frag.set('pass', pass);
    state.joinLink = `${base}#${frag.toString()}`;
    state.waitingForPeer = true;
    host.render();
  });
  m.on('room-joined', (d: { room_id?: string }) => {
    state.roomId = d.room_id ?? state.roomId;
    state.waitingForPeer = false;
    host.render();
  });
  m.on('peer-disconnected', () => {
    resetSession();
    host.render();
    host.notify('Your partner left the call.');
  });
}

function wireMedia(m: EngineManager, onCallStart: () => void): void {
  m.on('remote-stream', (d: { stream: MediaStream }) => {
    state.peerConnected = true;
    state.joining = false;
    state.reconnecting = false;
    state.elapsed = 0;
    attachStream('qvc-remote-video', d.stream);
    onCallStart();
    host.render();
  });
  m.on('state-change', (d: { state: string }) => {
    // A transient ICE blip shows as reconnecting rather than ending the call;
    // only an explicit leave or a peer disconnect tears it down.
    if (d.state === 'connected' || d.state === 'completed') {
      state.peerConnected = true;
      state.reconnecting = false;
    } else if ((d.state === 'disconnected' || d.state === 'failed') && state.peerConnected) {
      state.reconnecting = true;
    }
    host.render();
  });
  m.on('error', (d: { message?: string }) => {
    host.notify(d.message ?? 'Something went wrong.');
  });
}

function wireCipher(m: EngineManager): void {
  let everEncrypted = false;
  m.on('cipher-state', (msg: { state: string; keyIndex?: number }) => {
    if (msg.state === 'encrypting') {
      state.cipherState = 'encrypted';
      state.keyIndex = msg.keyIndex ?? state.keyIndex;
      everEncrypted = true;
    } else if (msg.state === 'worker-error') {
      state.cipherState = 'unencrypted';
      host.notify('Encryption worker failed — media is blocked, not sent in the clear.');
    } else if (msg.state === 'unsupported') {
      // Without RTCRtpScriptTransform frames cannot be encrypted, and the page
      // must never claim otherwise.
      state.cipherState = 'unsupported';
      host.notify('This browser cannot encrypt media frames — no key will be used.');
    } else if (msg.state === 'keyless') {
      state.cipherState = everEncrypted ? 'unencrypted' : 'establishing';
    }
    host.render();
  });
  m.on('decrypt-error', (msg: { failures?: number }) => {
    console.warn(`[qvc] frame decrypt failures in the last interval: ${String(msg.failures ?? 1)}`);
  });
}

function attachStream(id: string, stream: MediaStream): void {
  const el = document.getElementById(id);
  if (el instanceof HTMLVideoElement) {
    el.srcObject = stream;
    void el.play().catch(() => undefined);
  }
}

/** Build the call engine once, on the first create or join. */
async function ensureEngine(onCallStart: () => void): Promise<EngineManager> {
  if (manager) return manager;
  if (!apiBase || !socket) throw new Error('no gateway: connect runs first');
  const iceServers = await fetchIceServers(apiBase);
  const { WebRTCManager, BB84Orchestrator } = await loadEngine();
  // The crypto worker is fail-closed: it drops every frame until BB84 delivers
  // a key, then encrypts with no renegotiation.
  const m = new WebRTCManager(socket, { enableEncryption: true, iceServers });
  manager = m;
  orchestrator = new BB84Orchestrator({
    webrtcManager: m,
    onStateChange: (s) => {
      applyEnginePhase(s, host.notify);
      host.render();
    },
  });
  wireRoom(m);
  wireMedia(m, onCallStart);
  wireCipher(m);
  m.on('data-channel-open', () => {
    state.bb84Active = true;
    host.render();
    // Both sides' muxes must exist before either sends, so this runs at once.
    orchestrator?.init({ roomToken: state.roomId, isInitiator: state.isInitiator }).catch(() => {
      state.cipherState = 'compromised';
      host.notify('Secure-channel setup failed — no key will be established.');
      host.render();
    });
  });
  m.on('data-channel-message', (d: unknown) => {
    orchestrator?.handleMessage(d);
  });
  return m;
}

/**
 * What a getUserMedia failure actually was. Reporting "permission denied" for
 * every one of these sends people to a settings page that is already correct —
 * the common case on a second tab is a camera another tab already holds.
 */
function mediaFailure(err: unknown): string {
  const name = err instanceof Error ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera and microphone access was refused. Allow it in your browser’s site settings, then try again.';
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return 'The camera is in use by another tab or application. Close it and try again.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No camera and microphone were found on this device.';
  }
  const detail = err instanceof Error ? err.message : String(err);
  return `The camera could not be started: ${detail}`;
}

/**
 * Ask for the camera before anything else a call needs.
 *
 * WebKit grants getUserMedia against the activation of the click that asked,
 * and that activation does not survive an await. Fetching ICE servers or
 * loading the engine first is enough to lose it, and the refusal that follows
 * is indistinguishable from the visitor having denied permission.
 */
async function acquireMedia(): Promise<MediaStream | null> {
  if (localStream) return localStream;
  try {
    localStream = await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS);
    attachStream('qvc-local-video', localStream);
    return localStream;
  } catch (err) {
    console.warn('[qvc] getUserMedia failed:', err);
    state.mediaError = mediaFailure(err);
    host.render();
    return null;
  }
}

/** What the engine asks for, kept here so the page can ask first. */
const MEDIA_CONSTRAINTS: MediaStreamConstraints = {
  video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
};

export async function startCall(onCallStart: () => void): Promise<void> {
  const stream = await acquireMedia();
  if (!stream) return;
  const m = await ensureEngine(onCallStart);
  m.useLocalMedia(stream);
  state.isInitiator = true;
  m.createRoom();
}

export async function joinCall(token: string, onCallStart: () => void): Promise<void> {
  const stream = await acquireMedia();
  if (!stream) return;
  const m = await ensureEngine(onCallStart);
  m.useLocalMedia(stream);
  state.isInitiator = false;
  state.joining = true;
  host.render();
  m.joinRoom(token);
}

/** `fraction` is the share of slots she intercepts, 0 to 1. */
export function setEavesdropper(fraction: number): void {
  orchestrator?.setEavesdropper(fraction);
  socket?.emit('eve_demo', { active: fraction > 0, fraction });
}

/** The DTLS fingerprints, for the analytics screen. Null before a call. */
export function fingerprints(): unknown {
  return manager ? manager.getDtlsFingerprints() : null;
}

export function leave(): void {
  socket?.emit('leave_room');
  orchestrator?.destroy();
  orchestrator = null;
  manager = null;
  for (const track of localStream?.getTracks() ?? []) track.stop();
  localStream = null;
}
