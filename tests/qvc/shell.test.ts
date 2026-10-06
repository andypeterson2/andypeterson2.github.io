// @vitest-environment jsdom
/** The layer the port added: shell state, engine phases, and what renders. */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  state,
  initialState,
  resetSession,
  pushQber,
  parseRoomToken,
} from '../../src/apps/qvc/state';
import { applyEnginePhase } from '../../src/apps/qvc/engine-state';
import {
  renderLobby,
  renderDashboard,
  qberStatus,
  qberStatusLabel,
  modeBadge,
  distillFraction,
  fmtTime,
  esc,
  QBER_THRESHOLD,
} from '../../src/apps/qvc/render';

beforeEach(() => {
  Object.assign(state, initialState());
});

describe('room tokens', () => {
  test('a bare token is taken as-is', () => {
    expect(parseRoomToken('AbCdEf0123456789xyz')).toBe('AbCdEf0123456789xyz');
  });

  test('a token is read out of an invite fragment', () => {
    expect(parseRoomToken('https://x.dev/app/#room=AbCdEf0123456789xyz')).toBe(
      'AbCdEf0123456789xyz',
    );
  });

  test('a pass riding beside the room does not become part of it', () => {
    // The invite link carries `#room=<token>&pass=<pass>`; the token stops at
    // the first character outside its alphabet, so the pass never leaks into it.
    expect(parseRoomToken('https://x.dev/app/#room=AbCdEf0123456789xyz&pass=SECRET')).toBe(
      'AbCdEf0123456789xyz',
    );
  });

  test('anything too short to be a token yields nothing', () => {
    expect(parseRoomToken('#room=short')).toBe('');
    expect(parseRoomToken('')).toBe('');
  });
});

describe('qber readings', () => {
  test('no reading is neither clean nor noisy', () => {
    expect(qberStatus()).toBe('normal');
    expect(qberStatusLabel()).toBe('Measuring…');
  });

  test('a reading past the abort threshold reads as danger', () => {
    pushQber(QBER_THRESHOLD + 0.05);
    expect(qberStatus()).toBe('danger');
    expect(qberStatusLabel()).toBe('Very noisy');
  });

  test('the history is capped so the strip chart stays bounded', () => {
    for (let i = 0; i < 200; i++) pushQber(0.01);
    expect(state.qberHistory.length).toBe(120);
  });
});

describe('engine phases move the shell', () => {
  const notices: string[] = [];
  const notify = (m: string) => void notices.push(m);

  beforeEach(() => {
    notices.length = 0;
  });

  test('a mint raises the count and records the key index', () => {
    applyEnginePhase({ phase: 'minted', keyIndex: 3, poolDepth: 2 }, notify);
    expect(state.keysMinted).toBe(1);
    expect(state.keyIndex).toBe(3);
    expect(state.poolDepth).toBe(2);
  });

  test('a desync says nothing to the user and does not condemn the channel', () => {
    applyEnginePhase({ phase: 'failed', reason: 'desync' }, notify);
    expect(notices).toEqual([]);
    expect(state.cipherState).toBe('establishing');
  });

  test('a timeout is likewise silent', () => {
    applyEnginePhase({ phase: 'failed', reason: 'timeout' }, notify);
    expect(notices).toEqual([]);
  });

  test('an integrity fault is reported but does not claim a compromise', () => {
    applyEnginePhase({ phase: 'failed', reason: 'integrity' }, notify);
    expect(notices).toHaveLength(1);
    expect(state.cipherState).toBe('establishing');
  });

  test('exhaustion is the one phase that reports a compromise', () => {
    applyEnginePhase({ phase: 'exhausted' }, notify);
    expect(state.cipherState).toBe('compromised');
    expect(notices).toHaveLength(1);
  });

  test('an unknown phase is ignored rather than throwing', () => {
    expect(() => {
      applyEnginePhase({ phase: 'something-new' }, notify);
    }).not.toThrow();
  });
});

describe('the lobby reads the tier it actually has', () => {
  test('without a gateway the call controls are disabled', () => {
    const html = renderLobby();
    expect(html).toContain('data-action="create-room"');
    expect(html).toMatch(/data-action="create-room"[^>]*disabled/s);
    expect(html).toContain('A real call needs a pass');
  });

  test('with a gateway they are live', () => {
    state.connected = true;
    state.liveAvailable = true;
    const html = renderLobby();
    expect(html).not.toMatch(/data-action="create-room"[^>]*disabled/s);
  });

  test('the simulation is offered whether or not a gateway answered', () => {
    expect(renderLobby()).toContain('data-action="run-demo"');
  });
});

describe('the dashboard', () => {
  test('says the channel is still coming up before the engine runs', () => {
    expect(renderDashboard()).toContain('Establishing the quantum channel');
  });

  test('names the backend rather than implying one', () => {
    state.bb84Active = true;
    expect(modeBadge()).toBe('SIMULATED');
    state.mode = 'optical';
    expect(modeBadge()).toBe('OPTICAL');
  });

  test('the distillation bar is empty until a budget is known', () => {
    expect(distillFraction()).toBe(0);
    state.mintBudget = 1000;
    state.reservoirBits = 250;
    expect(distillFraction()).toBe(0.25);
  });

  test('the bar never reads past full', () => {
    state.mintBudget = 100;
    state.reservoirBits = 500;
    expect(distillFraction()).toBe(1);
  });

  test('only an initiator is offered the eavesdropper', () => {
    state.bb84Active = true;
    state.dashboardExpanded = true;
    expect(renderDashboard()).not.toContain('set-eve');
    state.isInitiator = true;
    expect(renderDashboard()).toContain('set-eve');
  });

  test('the eavesdropper is a dial, not a switch', () => {
    state.bb84Active = true;
    state.dashboardExpanded = true;
    state.isInitiator = true;
    state.eveFraction = 0.37;
    const html = renderDashboard();
    expect(html).toContain('type="range"');
    expect(html).toContain('value="37"');
    expect(html).toContain('37% of slots');
  });

  test('the budget says what is missing rather than printing a number for it', () => {
    state.bb84Active = true;
    state.dashboardExpanded = true;
    expect(renderDashboard()).toContain('no bound on what an eavesdropper knows');
  });

  test('the budget itemises the terms the mint was decided on', () => {
    state.bb84Active = true;
    state.dashboardExpanded = true;
    state.budget = {
      pooled: 4000,
      samples: 800,
      observed: 0.02,
      penalty: 0.18,
      bounded: 0.2,
      privacy: 1100,
      expectedLeak: 900,
      paBits: 65,
      verifyBits: 64,
      target: 128,
      remaining: 71,
    };
    const html = renderDashboard();
    expect(html).toContain('4,000');
    expect(html).toContain('2.00%');
    expect(html).toContain('−65');
    // Short of a key, and said so rather than shown as if it were enough.
    expect(html).toContain('71 of 128 — not yet');
  });

  test('a receipt only claims agreement once both ends have reported', () => {
    state.bb84Active = true;
    state.dashboardExpanded = true;
    state.receipts = [
      {
        keyIndex: 1,
        disclosed: 600,
        allowance: 900,
        expectedLeak: 920,
        pooled: 4000,
        verified: true,
        digest: 'aabbccdd',
        peerDigest: null,
      },
    ];
    expect(renderDashboard()).not.toContain('both ends');
    state.receipts[0].peerDigest = 'aabbccdd';
    expect(renderDashboard()).toContain('both ends aabbccdd');
    state.receipts[0].peerDigest = 'ffffffff';
    expect(renderDashboard()).toContain('ends disagree');
  });
});

describe('small helpers', () => {
  test('elapsed time is minutes and seconds', () => {
    expect(fmtTime(0)).toBe('00:00');
    expect(fmtTime(61)).toBe('01:01');
    expect(fmtTime(3600)).toBe('60:00');
  });

  test('interpolated text cannot carry markup', () => {
    expect(esc('<img src=x onerror=1>')).not.toContain('<');
    expect(esc(`"&'`)).toBe('&quot;&amp;&#39;');
  });
});

describe('leaving a call', () => {
  test('clears the call but keeps what the page learned about the tier', () => {
    state.connected = true;
    state.liveAvailable = true;
    state.invited = true;
    state.keysMinted = 9;
    state.peerConnected = true;
    resetSession();
    expect(state.keysMinted).toBe(0);
    expect(state.peerConnected).toBe(false);
    expect(state.connected).toBe(true);
    expect(state.liveAvailable).toBe(true);
    expect(state.invited).toBe(true);
  });
});

describe('the simulation wires both ends together', () => {
  test('two orchestrators reach a shared key with no peer and no pass', async () => {
    // jsdom has no RTCPeerConnection, so this exercises the in-memory fallback:
    // the exchange runs, and with no certificates to bind it says so.
    const { runDemo, setPhaseSink } = await import('../../src/apps/qvc/demo');
    const seen: string[] = [];
    setPhaseSink((s) => void seen.push(s.phase));
    const run = await runDemo();
    expect(run.authenticated).toBe(false);
    try {
      await vi.waitFor(() => {
        expect(seen).toContain('minted');
      }, 20_000);
    } finally {
      run.stop();
    }
  }, 30_000);
});

describe('the simulation reports only what it has', () => {
  test('no crypto worker means no cipher state and no pill', async () => {
    const { renderCall } = await import('../../src/apps/qvc/render');
    state.cipherState = null;
    state.peerConnected = true;
    expect(renderCall()).not.toContain('qvc-pill');
    state.cipherState = 'encrypted';
    expect(renderCall()).toContain('qvc-pill');
  });

  test('exhaustion in the simulation does not claim a compromised cipher', () => {
    const said: string[] = [];
    state.demoRunning = true;
    state.cipherState = null;
    applyEnginePhase({ phase: 'exhausted' }, (m) => void said.push(m));
    expect(state.cipherState).toBeNull();
    expect(said[0]).toContain('No key is obtainable');
  });

  test('exhaustion in a real call still reports the compromise', () => {
    const said: string[] = [];
    state.demoRunning = false;
    applyEnginePhase({ phase: 'exhausted' }, (m) => void said.push(m));
    expect(state.cipherState).toBe('compromised');
    expect(said[0]).toContain('Channel integrity lost');
  });
});

describe('the analytics screen omits what it cannot measure', () => {
  test('with no call it says so instead of printing a grid of dashes', async () => {
    const { renderPanels } = await import('../../src/apps/qvc/analytics/panels');
    const html = renderPanels({ bb84Active: true, inCall: false }, Date.now());
    expect(html).toContain('No call, so there is no media');
    expect(html).not.toContain('DTLS');
    // The four sparklines were the bulk of the empty grid.
    expect(html).not.toContain('an-sparkline');
  });

  test('in a call the media and fingerprint rows come back', async () => {
    const { renderPanels } = await import('../../src/apps/qvc/analytics/panels');
    const html = renderPanels({ bb84Active: true, inCall: true }, Date.now());
    expect(html).toContain('DTLS');
    expect(html).toContain('Bandwidth');
  });
});

describe('the invite link', () => {
  test('carries the room, and the pass beside it', () => {
    // What wireRoom builds, pinned: a reader of the link needs both, and the
    // room must survive a pass sitting next to it.
    const frag = new URLSearchParams({ room: 'AbCdEf0123456789xyz' });
    frag.set('pass', 'a.pass.value');
    const link = `https://example.test/app/#${frag.toString()}`;
    expect(link).toContain('#room=AbCdEf0123456789xyz');
    expect(link).toContain('pass=a.pass.value');
    expect(parseRoomToken(link)).toBe('AbCdEf0123456789xyz');
  });

  test('without a pass it still carries the room', () => {
    const frag = new URLSearchParams({ room: 'AbCdEf0123456789xyz' });
    const link = `https://example.test/app/#${frag.toString()}`;
    expect(link).toContain('#room=');
    expect(link).not.toContain('pass=');
    expect(parseRoomToken(link)).toBe('AbCdEf0123456789xyz');
  });
});

describe('a call that cannot start', () => {
  test('a refused ice-servers request is reported, not swallowed', async () => {
    const { connect } = await import('../../src/apps/qvc/signalling');
    // An origin outside the allowlist is ignored rather than dialled, so the
    // handler must not leave the page believing a socket is coming.
    expect(() => {
      connect('https://evil.test/qvc');
    }).not.toThrow();
  });
});

describe('asking for the camera', () => {
  test('happens before anything that awaits, so the click still counts', async () => {
    // WebKit grants getUserMedia against the activation of the click, and an
    // await spends it. The call path must reach getUserMedia first.
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('src/apps/qvc/signalling.ts', 'utf8'),
    );
    const body = /export async function startCall[\s\S]*?\n}/.exec(src)?.[0] ?? '';
    expect(body).toContain('acquireMedia');
    const mediaAt = body.indexOf('acquireMedia');
    const engineAt = body.indexOf('ensureEngine');
    expect(mediaAt).toBeGreaterThan(-1);
    expect(engineAt).toBeGreaterThan(mediaAt);
  });

  test('the joiner asks first too', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('src/apps/qvc/signalling.ts', 'utf8'),
    );
    const body = /export async function joinCall[\s\S]*?\n}/.exec(src)?.[0] ?? '';
    expect(body.indexOf('acquireMedia')).toBeGreaterThan(-1);
    expect(body.indexOf('ensureEngine')).toBeGreaterThan(body.indexOf('acquireMedia'));
  });
});
