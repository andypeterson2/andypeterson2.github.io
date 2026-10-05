/**
 * Engine telemetry into shell state.
 *
 * Both tiers drive the same dashboard through this, so the simulation shows the
 * numbers a real call shows. The cipher pill is not set here: it reports the
 * crypto worker's own state, and the simulation has no worker to report on.
 */
import { state, pushQber, type KeyMode, type Sas, type BudgetTerms } from './state';
import { QBER_THRESHOLD } from './render';
import type { Receipt } from './state';

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
  budget?: BudgetTerms | null;
  /** mint-ledger */
  disclosed?: number;
  allowance?: number;
  expectedLeak?: number;
  pooled?: number;
  verified?: boolean;
  digest?: string | null;
}

type Notify = (message: string) => void;

/** Receipts kept on screen; older mints scroll off rather than growing forever. */
const RECEIPT_CAP = 8;

/** The ledger arrives just before the mint that it describes. */
let pendingLedger: Omit<Receipt, 'keyIndex' | 'digest' | 'peerDigest'> | null = null;

/** The detector's own digest for a mint, recorded so the two can be compared. */
export function recordPeerDigest(keyIndex: number, digest: string | null): void {
  const row = state.receipts.find((r) => r.keyIndex === keyIndex);
  if (row) row.peerDigest = digest;
}

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
      if (s.budget !== undefined) state.budget = s.budget;
    },
    'mint-ledger': (s) => {
      // Held until the key index arrives with the mint itself.
      pendingLedger = {
        disclosed: s.disclosed ?? 0,
        allowance: s.allowance ?? 0,
        expectedLeak: s.expectedLeak ?? 0,
        pooled: s.pooled ?? 0,
        verified: s.verified === true,
      };
    },
    minted: (s) => {
      if (pendingLedger) {
        state.receipts.unshift({
          keyIndex: s.keyIndex ?? state.keysMinted,
          ...pendingLedger,
          digest: s.digest ?? null,
          peerDigest: null,
        });
        state.receipts.length = Math.min(state.receipts.length, RECEIPT_CAP);
        pendingLedger = null;
      }
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
