/**
 * Engine telemetry into shell state.
 *
 * Both tiers drive the same dashboard through this, so the simulation shows the
 * numbers a real call shows. The cipher pill is not set here: it reports the
 * crypto worker's own state, and the simulation has no worker to report on.
 */
import { state, pushQber, type KeyMode, type Sas } from './state';
import { QBER_THRESHOLD } from './render';

/** A phase event from the reservoir engine. */
export interface EnginePhase {
  phase: string;
  sas?: Sas;
  mode?: KeyMode;
  qber?: number;
  pooledBits?: number;
  mintBudget?: number;
  keyIndex?: number;
  poolDepth?: number;
  reason?: string;
}

type Notify = (message: string) => void;

/** A failed frame or session is transient; only 'exhausted' is terminal. */
function onFailure(s: EnginePhase, notify: Notify): void {
  if (s.reason === 'qber-exceeded') {
    if (typeof s.qber === 'number') pushQber(s.qber);
    notify(`QBER above the ${(QBER_THRESHOLD * 100).toFixed(1)}% threshold — frame rejected.`);
    return;
  }
  if (s.reason === 'setup') {
    state.cipherState = 'compromised';
    notify('Secure-channel setup failed — no key will be established.');
    return;
  }
  // A deadline, or two sides briefly out of step: the session restarts on its
  // own and neither says anything about the channel.
  if (s.reason === 'timeout' || s.reason === 'desync') return;
  notify('Channel integrity check failed — tampering or a connection fault. Recovering.');
}

const HANDLERS = new Map<string, (s: EnginePhase, notify: Notify) => void>(
  Object.entries({
    sas: (s) => {
      if (s.sas) state.sas = s.sas;
    },
    mode: (s) => {
      state.mode = s.mode ?? state.mode;
    },
    reservoir: (s) => {
      if (typeof s.qber === 'number') pushQber(s.qber);
      state.reservoirBits = s.pooledBits ?? state.reservoirBits;
      state.mintBudget = s.mintBudget ?? state.mintBudget;
    },
    minted: (s) => {
      state.keysMinted += 1;
      state.keyIndex = s.keyIndex ?? state.keyIndex;
      state.poolDepth = s.poolDepth ?? state.poolDepth;
    },
    rotated: (s) => {
      state.rotations += 1;
      state.poolDepth = s.poolDepth ?? state.poolDepth;
    },
    failed: onFailure,
    exhausted: (_s: EnginePhase, notify: Notify) => {
      // Frames still ride the last good key — the worker never downgrades — but no
      // fresh key is obtainable, so this says so and leaves the choice to the user.
      state.cipherState = 'compromised';
      notify('Channel integrity lost — tampering or a persistent fault. Leave and retry.');
    },
  }),
);

export function applyEnginePhase(s: EnginePhase, notify: Notify): void {
  HANDLERS.get(s.phase)?.(s, notify);
}
