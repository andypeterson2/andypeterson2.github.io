/**
 * Shell state for the video call.
 *
 * One object, mutated by the engine's phase events and the user's clicks, read
 * by the render functions. The page's own theme handling is gone: the portal
 * boots the theme, and a second writer would fight it.
 */

/** What the crypto worker says about the media, which is not what BB84 says. */
export type CipherState =
  'establishing' | 'encrypted' | 'unencrypted' | 'compromised' | 'unsupported';

/** Where the key bits came from. Never claim photons that were not measured. */
export type KeyMode = 'sim' | 'optical' | null;

/** The key budget, itemised, straight from the functions that gate the mint. */
export interface BudgetTerms {
  pooled: number;
  samples: number;
  observed: number;
  penalty: number;
  bounded: number;
  privacy: number;
  expectedLeak: number;
  paBits: number;
  verifyBits: number;
  target: number;
  remaining: number;
}

/** What one mint actually cost. */
export interface Receipt {
  keyIndex: number;
  disclosed: number;
  allowance: number;
  expectedLeak: number;
  pooled: number;
  verified: boolean;
  digest: string | null;
  peerDigest: string | null;
}

/** The fingerprint-bound short authentication string both sides compare. */
export interface Sas {
  digits: string;
  emoji: string[];
}

export interface QvcState {
  /** The gateway answered and the socket is up. */
  connected: boolean;
  /** A pass is present, so the live tier is reachable at all. */
  liveAvailable: boolean;
  peerConnected: boolean;
  roomId: string;
  isInitiator: boolean;
  waitingForPeer: boolean;
  joining: boolean;
  invited: boolean;
  reconnecting: boolean;
  cameraOn: boolean;
  muted: boolean;
  elapsed: number;
  bb84Active: boolean;
  qber: number | null;
  /** Per-frame QBER, most recent last, capped for the strip chart. */
  qberHistory: number[];
  keyIndex: number | null;
  mode: KeyMode;
  /** Accepted sifted bits pooled toward the next key. */
  reservoirBits: number;
  /** Bits needed before a mint can run. */
  mintBudget: number | null;
  keysMinted: number;
  rotations: number;
  /** Keys waiting in the reservoir to rotate in. */
  poolDepth: number;
  /** Null where there is no crypto worker to report on, as in the simulation. */
  cipherState: CipherState | null;
  joinLink: string;
  sas: Sas | null;
  sasVerified: boolean;
  eavesdropper: boolean;
  peerEavesdropping: boolean;
  mediaError: string;
  dashboardExpanded: boolean;
  /** The simulation is running in this tab, with no media and no peer. */
  demoRunning: boolean;
  /** The simulation got real certificates, so its channel is MAC'd and bound. */
  demoAuthenticated: boolean;
  /** Bob's SAS digits, which must match alice's for the binding to mean anything. */
  peerSas: string | null;
  /** Share of slots the eavesdropper intercepts, 0 to 1. */
  eveFraction: number;
  /** The key budget's own terms, as the engine computed them. */
  budget: BudgetTerms | null;
  /** One row per mint: what reconciliation cost against what it was allowed. */
  receipts: Receipt[];
  /** Bench settings, in the builds that may reach one. */
  optical: { enabled: boolean; url: string; token: string };
  /** Pairing feedback shown beside the bench controls. */
  opticalStatus: string;
  /** Cameras and microphones this browser will admit to. */
  devices: {
    cameras: { id: string; label: string }[];
    microphones: { id: string; label: string }[];
  };
  /** Whether the device labels are real, which needs permission once. */
  devicesLabelled: boolean;
  /** Which devices to use, remembered between visits. */
  deviceChoice: { cameraId: string | null; microphoneId: string | null };
  /** What the last device check found, shown beside the picker. */
  deviceStatus: string;
  /** Whether a call takes the whole viewport. A control switches it back. */
  stageFullBleed: boolean;
  /** Whether the peer's media has arrived, which decides the video placeholder. */
  peerStreaming: boolean;
}

/** Per-frame QBER points kept for the strip chart. */
export const QBER_HISTORY_CAP = 120;

export function initialState(): QvcState {
  return {
    connected: false,
    liveAvailable: false,
    peerConnected: false,
    roomId: '',
    isInitiator: false,
    waitingForPeer: false,
    joining: false,
    invited: false,
    reconnecting: false,
    cameraOn: true,
    muted: false,
    elapsed: 0,
    bb84Active: false,
    qber: null,
    qberHistory: [],
    keyIndex: null,
    mode: null,
    reservoirBits: 0,
    mintBudget: null,
    keysMinted: 0,
    rotations: 0,
    poolDepth: 0,
    cipherState: 'establishing',
    joinLink: '',
    sas: null,
    sasVerified: false,
    eavesdropper: false,
    peerEavesdropping: false,
    mediaError: '',
    dashboardExpanded: false,
    demoRunning: false,
    demoAuthenticated: false,
    peerSas: null,
    eveFraction: 0,
    budget: null,
    receipts: [],
    optical: { enabled: false, url: 'ws://127.0.0.1:8781', token: '' },
    opticalStatus: '',
    devices: { cameras: [], microphones: [] },
    devicesLabelled: false,
    deviceChoice: { cameraId: null, microphoneId: null },
    deviceStatus: '',
    stageFullBleed: true,
    peerStreaming: false,
  };
}

export const state: QvcState = initialState();

/** Reset to a fresh lobby, keeping what the page learned about the tier. */
export function resetSession(): void {
  const {
    connected,
    liveAvailable,
    invited,
    optical,
    devices,
    devicesLabelled,
    deviceChoice,
    stageFullBleed,
  } = state;
  Object.assign(state, initialState(), {
    connected,
    liveAvailable,
    invited,
    optical,
    devices,
    devicesLabelled,
    deviceChoice,
    stageFullBleed,
  });
}

/** Record a QBER sample, holding the strip chart to its cap. */
export function pushQber(qber: number): void {
  state.qber = qber;
  state.qberHistory.push(qber);
  if (state.qberHistory.length > QBER_HISTORY_CAP) state.qberHistory.shift();
}

/**
 * A room token, from a pasted invite link or a URL fragment. Stops at the first
 * character outside the token alphabet, so a link carrying anything after the
 * token still yields the token alone.
 */
export function parseRoomToken(text: string): string {
  let candidate = text;
  const marker = candidate.indexOf('#room=');
  if (marker !== -1) {
    try {
      candidate = decodeURIComponent(candidate.slice(marker + '#room='.length));
    } catch {
      return '';
    }
  }
  const token = /^[A-Za-z0-9_-]{16,}/.exec(candidate.trim());
  return token ? token[0] : '';
}
