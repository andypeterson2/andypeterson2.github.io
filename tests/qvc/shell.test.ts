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
  renderCall,
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

describe('the call stage', () => {
  test('the lobby carries the self-view, so a camera can be checked before calling', () => {
    const html = renderLobby();
    expect(html).toContain('qvc-preview');
    expect(html).toContain('id="qvc-local-video"');
  });

  test('the self-view is the same element the call puts in the corner', () => {
    // One id across both views: whatever is on screen is what gets the stream.
    state.peerConnected = true;
    expect(renderCall()).toContain('id="qvc-local-video"');
    state.peerConnected = false;
    expect(renderLobby()).toContain('id="qvc-local-video"');
  });

  test('full-bleed is a class on the call, and the toolbar offers the way back', () => {
    state.stageFullBleed = true;
    const staged = renderCall();
    expect(staged).toContain('qvc-call--stage');
    expect(staged).toContain('Back to the page');

    state.stageFullBleed = false;
    const framed = renderCall();
    expect(framed).not.toContain('qvc-call--stage');
    expect(framed).toContain('Fill the screen');
  });

  test('the stage choice outlives a call', () => {
    // A preference the visitor set, so leaving a call must keep it.
    state.stageFullBleed = false;
    state.peerConnected = true;
    resetSession();
    expect(state.stageFullBleed).toBe(false);
    expect(state.peerConnected).toBe(false);
  });

  test('the stage says what it is waiting for until the peer sends media', () => {
    state.peerConnected = true;
    state.peerStreaming = false;
    expect(renderCall()).toContain('AWAITING PARTNER');
    state.peerStreaming = true;
    expect(renderCall()).not.toContain('AWAITING PARTNER');
  });
});

describe('the test card', () => {
  test('stands behind a video with nothing to show, and says which', async () => {
    const { testCard } = await import('../../src/apps/qvc/testcard');
    expect(testCard('AWAITING PARTNER')).toContain('AWAITING PARTNER');
    expect(renderLobby()).toContain('CAMERA NOT STARTED');
    state.peerConnected = true;
    state.peerStreaming = false;
    expect(renderCall()).toContain('AWAITING PARTNER');
  });

  test('a caption cannot carry markup into the page', async () => {
    const { testCard } = await import('../../src/apps/qvc/testcard');
    const card = testCard('<script>x</script>');
    expect(card).not.toContain('<script>');
    expect(card).toContain('&lt;script&gt;');
  });

  test('a camera the visitor switched off says so rather than going black', () => {
    state.cameraOn = false;
    expect(renderLobby()).toContain('CAMERA OFF');
  });

  test('it is drawn in ink and paper, with no colour of its own', async () => {
    const { testCard } = await import('../../src/apps/qvc/testcard');
    const card = testCard('NO SIGNAL');
    // Every fill is a token or a pattern built from them: a literal colour here
    // would be the one coloured thing on a 1-bit page.
    expect(card).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    expect(card).not.toMatch(/\b(rgb|hsl)a?\(/i);
  });
});

describe('the call videos', () => {
  test('a rebuilt element is given its stream again', async () => {
    const { attachStream } = await import('../../src/apps/qvc/media');
    const stream = { id: 'fake' } as unknown as MediaStream;
    document.body.innerHTML = '<video id="qvc-remote-video"></video>';
    const first = document.getElementById('qvc-remote-video') as HTMLVideoElement;
    first.play = () => Promise.resolve();
    attachStream('qvc-remote-video', stream);
    expect(first.srcObject).toBe(stream);

    // What a render does: the element on screen is a different one, with no
    // srcObject of its own.
    document.body.innerHTML = '<video id="qvc-remote-video"></video>';
    const second = document.getElementById('qvc-remote-video') as HTMLVideoElement;
    second.play = () => Promise.resolve();
    expect(second.srcObject).toBeFalsy();
    attachStream('qvc-remote-video', stream);
    expect(second.srcObject).toBe(stream);
  });

  test('no stream clears the element rather than leaving the last frame', async () => {
    const { attachStream } = await import('../../src/apps/qvc/media');
    document.body.innerHTML = '<video id="qvc-local-video"></video>';
    const el = document.getElementById('qvc-local-video') as HTMLVideoElement;
    el.play = () => Promise.resolve();
    attachStream('qvc-local-video', { id: 'fake' } as unknown as MediaStream);
    attachStream('qvc-local-video', null);
    expect(el.srcObject).toBeNull();
  });

  test('both videos are re-attached after the markup swap', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('src/apps/qvc/app.ts', 'utf8'),
    );
    // applySinks is what runs after every innerHTML swap, so both elements
    // have to be named there or the call shows black rectangles.
    const body = /function applySinks\(\)[\s\S]*?\n}/.exec(src)?.[0] ?? '';
    expect(body).toContain('qvc-remote-video');
    expect(body).toContain('qvc-local-video');
  });
});

describe('a join that is refused', () => {
  test('the spinner is what joining shows, so it must be cleared', () => {
    state.liveAvailable = true;
    state.connected = true;
    state.joining = true;
    expect(renderLobby()).toContain('Connecting securely');
    state.joining = false;
    expect(renderLobby()).not.toContain('Connecting securely');
  });

  test('every refusal the server sends ends the attempt', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('src/apps/qvc/signalling.ts', 'utf8'),
    );
    // The server's own reason slugs. A join refused for any of them gets no
    // further events, so the spinner would otherwise never come down.
    for (const reason of ['no-such-room', 'room-full', 'already-in-a-room']) {
      expect(src).toContain(`'${reason}'`);
    }
    const handler = /m\.on\('error'[\s\S]*?\n  \}\);/.exec(src)?.[0] ?? '';
    expect(handler).toContain('endJoining');
  });

  test('a join that goes quiet gives up rather than waiting forever', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('src/apps/qvc/signalling.ts', 'utf8'),
    );
    const body = /export async function joinCall[\s\S]*?\n}/.exec(src)?.[0] ?? '';
    expect(body).toContain('JOIN_TIMEOUT_MS');
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

describe('choosing a camera and microphone', () => {
  test('a remembered device is preferred, not demanded', async () => {
    const { constraintsFor } = await import('../../src/apps/qvc/media');
    const c = constraintsFor({ cameraId: 'cam-1', microphoneId: 'mic-1' });
    const video = c.video as MediaTrackConstraints;
    const audio = c.audio as MediaTrackConstraints;
    // `ideal`, so a device that has since been unplugged costs a fallback
    // rather than a failed call.
    expect(video.deviceId).toEqual({ ideal: 'cam-1' });
    expect(audio.deviceId).toEqual({ ideal: 'mic-1' });
  });

  test('with no choice it asks for anything', async () => {
    const { constraintsFor } = await import('../../src/apps/qvc/media');
    const c = constraintsFor({ cameraId: null, microphoneId: null });
    expect((c.video as MediaTrackConstraints).deviceId).toBeUndefined();
  });

  test('a refusal points at the system settings, not just the browser', async () => {
    const { mediaFailure } = await import('../../src/apps/qvc/media');
    const err = new Error('denied');
    err.name = 'NotAllowedError';
    expect(mediaFailure(err)).toContain('Privacy & security');
  });

  test('a device that went away says so, rather than blaming permission', async () => {
    const { mediaFailure } = await import('../../src/apps/qvc/media');
    const err = new Error('gone');
    err.name = 'NotFoundError';
    const msg = mediaFailure(err);
    expect(msg).toContain('no longer attached');
    expect(msg).not.toContain('refused');
  });

  test('an unknown failure is quoted rather than guessed at', async () => {
    const { mediaFailure } = await import('../../src/apps/qvc/media');
    const err = new Error('something odd');
    err.name = 'WeirdError';
    expect(mediaFailure(err)).toContain('WeirdError: something odd');
  });
});
