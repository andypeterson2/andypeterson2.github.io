/**
 * The lone-visitor tier: both ends of the key exchange in this tab.
 *
 * Two orchestrators run against each other with no pass and no second person.
 * They are joined by a real pair of RTCPeerConnections carrying a DataChannel —
 * no camera, no microphone, no ICE servers, and nothing CSP gates, since
 * connect-src does not cover RTCPeerConnection. That buys real DTLS
 * certificates, so the fingerprint commit-then-reveal and the SAS run here
 * exactly as they do in a call, over a room token this tab mints for itself.
 *
 * Where a browser will not give us a peer connection, the two ends fall back to
 * an in-memory channel. The exchange still runs, but with no certificates there
 * is nothing to bind, so authentication is switched off rather than faked, and
 * `authenticated` says which of the two happened.
 */
import type { EnginePhase } from './engine-state';

/** Both ends of a simulated exchange, already streaming. */
export interface DemoRun {
  /** Whether the classical channel is MAC'd and the SAS is real. */
  authenticated: boolean;
  /** Fraction of slots the eavesdropper intercepts, 0 to 1. */
  setEavesdropper(fraction: number): void;
  stop(): void;
}

let current: DemoRun | null = null;

/** The simulation now running in this tab, if any. */
export function currentDemo(): DemoRun | null {
  return current;
}

/** How the shell is told about a phase; set once, by the module that renders. */
let onPhase: (s: EnginePhase, side: 'alice' | 'bob') => void = () => undefined;

export function setPhaseSink(sink: (s: EnginePhase, side: 'alice' | 'bob') => void): void {
  onPhase = sink;
}

interface DemoOrchestrator {
  init(opts: { roomToken: string | null; isInitiator: boolean }): Promise<void>;
  handleMessage(wire: string): void;
  setEavesdropper(on: boolean | number): void;
  destroy(): void;
}

type DemoOrchestratorCtor = new (opts: {
  webrtcManager: unknown;
  onStateChange: (s: EnginePhase) => void;
  slotsPerFrame?: number;
}) => DemoOrchestrator;

type Side = 'alice' | 'bob';

/** A transport joining the two ends, and what it can honestly report. */
interface Link {
  send: (side: Side, data: string) => void;
  fingerprints: (side: Side) => { local: string; remote: string } | null;
  authenticated: boolean;
  close: () => void;
}

/** Both sides of one tab's own call, over real DTLS. */
async function peerLink(deliver: (side: Side, data: string) => void): Promise<Link | null> {
  if (typeof RTCPeerConnection === 'undefined') return null;
  try {
    const a = new RTCPeerConnection();
    const b = new RTCPeerConnection();
    const channels: Partial<Record<Side, RTCDataChannel>> = {};
    const open = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('peer connection did not open'));
      }, 5000);
      let ready = 0;
      const done = () => {
        ready += 1;
        if (ready === 2) {
          clearTimeout(timer);
          resolve();
        }
      };
      const ch = a.createDataChannel('qvc');
      ch.onopen = () => {
        channels.alice = ch;
        done();
      };
      // `deliver` takes the side that RECEIVES: this channel is alice's end.
      ch.onmessage = (e: MessageEvent<string>) => {
        deliver('alice', e.data);
      };
      b.ondatachannel = (e) => {
        const peer = e.channel;
        peer.onopen = () => {
          channels.bob = peer;
          done();
        };
        peer.onmessage = (m: MessageEvent<string>) => {
          deliver('bob', m.data);
        };
        if (peer.readyState === 'open') {
          channels.bob = peer;
          done();
        }
      };
    });
    a.onicecandidate = (e) => {
      if (e.candidate) void b.addIceCandidate(e.candidate);
    };
    b.onicecandidate = (e) => {
      if (e.candidate) void a.addIceCandidate(e.candidate);
    };
    const offer = await a.createOffer();
    await a.setLocalDescription(offer);
    await b.setRemoteDescription(offer);
    const answer = await b.createAnswer();
    await b.setLocalDescription(answer);
    await a.setRemoteDescription(answer);
    await open;

    const fp = (sdp: string | undefined): string =>
      /a=fingerprint:\S+ (\S+)/.exec(sdp ?? '')?.[1] ?? '';
    const aLocal = fp(a.localDescription?.sdp);
    const bLocal = fp(b.localDescription?.sdp);
    if (!aLocal || !bLocal) {
      a.close();
      b.close();
      return null;
    }
    return {
      send: (side, data) => channels[side]?.send(data),
      // Each side reports its own certificate and the one it was offered, which
      // is what the commit-then-reveal cross-checks.
      fingerprints: (side) =>
        side === 'alice' ? { local: aLocal, remote: bLocal } : { local: bLocal, remote: aLocal },
      authenticated: true,
      close: () => {
        a.close();
        b.close();
      },
    };
  } catch {
    return null;
  }
}

/** The fallback: an ordered channel in memory, with nothing to bind. */
function memoryLink(deliver: (side: Side, data: string) => void): Link {
  return {
    send: (side, data) => {
      void Promise.resolve().then(() => {
        deliver(side === 'alice' ? 'bob' : 'alice', data);
      });
    },
    fingerprints: () => null,
    authenticated: false,
    close: () => undefined,
  };
}

/** A token for this tab's own call. Real, and never leaves the tab. */
function selfToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function runDemo(): Promise<DemoRun> {
  current?.stop();
  const { BB84Orchestrator } = await import('./engine/bb84/orchestrator.js');
  const run = await start(BB84Orchestrator as unknown as DemoOrchestratorCtor);
  current = run;
  return run;
}

async function start(Orchestrator: DemoOrchestratorCtor): Promise<DemoRun> {
  const peers: Partial<Record<Side, DemoOrchestrator>> = {};
  const deliver = (side: Side, data: string) => peers[side]?.handleMessage(data);
  const link = (await peerLink(deliver)) ?? memoryLink(deliver);

  const transport = (self: Side) => ({
    sendData: (data: string) => {
      link.send(self, data);
    },
    setEncryptionKey: () => undefined,
    getDtlsFingerprints: () => link.fingerprints(self),
  });

  const make = (self: Side) =>
    new Orchestrator({
      webrtcManager: transport(self),
      onStateChange: (s: EnginePhase) => {
        onPhase(s, self);
      },
    });

  const alice = make('alice');
  const bob = make('bob');
  peers.alice = alice;
  peers.bob = bob;

  // One token, both roles, as a join link carries. With no certificates to bind
  // the channel runs unauthenticated rather than binding invented ones.
  const token = link.authenticated ? selfToken() : null;
  void alice.init({ roomToken: token, isInitiator: true });
  void bob.init({ roomToken: token, isInitiator: false });

  const run: DemoRun = {
    authenticated: link.authenticated,
    setEavesdropper: (fraction: number) => {
      alice.setEavesdropper(fraction);
    },
    stop: () => {
      alice.destroy();
      bob.destroy();
      link.close();
      if (current === run) current = null;
    },
  };
  return run;
}
