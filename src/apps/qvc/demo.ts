/**
 * The lone-visitor tier: both ends of the key exchange in this tab.
 *
 * Two orchestrators are wired to each other over an in-memory ordered channel
 * with no media, no peer and no pass, so the key engine runs exactly as it does
 * in a real call. The cipher state is left out rather than faked: there is no
 * media worker here to report on.
 */
import type { EnginePhase } from './engine-state';

/** Both ends of a simulated exchange, already streaming. */
export interface DemoRun {
  /** Keys installed by each side so far. */
  minted(): { alice: number; bob: number };
  /** Turn the intercept-resend eavesdropper on or off. */
  setEavesdropper(on: boolean): void;
  stop(): void;
}

let current: DemoRun | null = null;

/** The simulation now running in this tab, if any. */
export function currentDemo(): DemoRun | null {
  return current;
}

export async function runDemo(): Promise<DemoRun> {
  current?.stop();
  const { BB84Orchestrator } = await import('./engine/bb84/orchestrator.js');
  const run = start(BB84Orchestrator as DemoOrchestratorCtor);
  current = run;
  return run;
}

interface DemoOrchestrator {
  init(opts: { roomToken: string | null; isInitiator: boolean }): Promise<void>;
  handleMessage(wire: string): void;
  setEavesdropper(on: boolean): void;
  destroy(): void;
}

type DemoOrchestratorCtor = new (opts: {
  webrtcManager: unknown;
  onStateChange: (s: unknown) => void;
  slotsPerFrame?: number;
}) => DemoOrchestrator;

/** How the shell is told about a phase; set once, by the module that renders. */
let onPhase: (s: EnginePhase) => void = () => undefined;

export function setPhaseSink(sink: (s: EnginePhase) => void): void {
  onPhase = sink;
}

/** Mirror-image DTLS fingerprint views, as two honest peers would report. */
const MIRROR_FPS = {
  alice: { local: 'AA:11:AA', remote: 'BB:22:BB' },
  bob: { local: 'BB:22:BB', remote: 'AA:11:AA' },
} as const;

function start(Orchestrator: DemoOrchestratorCtor): DemoRun {
  const installed = { alice: 0, bob: 0 };
  const peers: Partial<Record<'alice' | 'bob', DemoOrchestrator>> = {};

  const transport = (self: 'alice' | 'bob', other: 'alice' | 'bob') => ({
    sendData: (data: string) => {
      // The peer is absent for the first message of the pair, which alice sends
      // before bob has been constructed.
      void Promise.resolve().then(() => peers[other]?.handleMessage(data));
    },
    setEncryptionKey: () => {
      installed[self] += 1;
    },
    getDtlsFingerprints: () => MIRROR_FPS[self],
  });

  // One side drives the dashboard. Both run the same protocol, so taking both
  // would double every counter.
  const alice = new Orchestrator({
    webrtcManager: transport('alice', 'bob'),
    onStateChange: (s: unknown) => {
      onPhase(s as EnginePhase);
    },
  });
  const bob = new Orchestrator({
    webrtcManager: transport('bob', 'alice'),
    onStateChange: () => undefined,
  });
  peers.alice = alice;
  peers.bob = bob;

  void alice.init({ roomToken: null, isInitiator: true });
  void bob.init({ roomToken: null, isInitiator: false });

  const run: DemoRun = {
    minted: () => ({ ...installed }),
    setEavesdropper: (on: boolean) => {
      alice.setEavesdropper(on);
    },
    stop: () => {
      alice.destroy();
      bob.destroy();
      if (current === run) current = null;
    },
  };
  return run;
}
