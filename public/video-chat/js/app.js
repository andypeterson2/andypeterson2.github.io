/**
 * QKD Video Chat — WebRTC-based frontend.
 *
 * Connects directly to the signaling server via Socket.IO.
 * Media captured by the browser, peer-to-peer via WebRTC.
 * Encryption handled by Insertable Streams (crypto-worker.js).
 * Key exchange via BB84 over RTCDataChannel.
 */

/* ── SVG Icons ──────────────────────────────────────────────────────────── */
const ICONS = {
  cameraOn: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"><rect x="2" y="5" width="14" height="14"/><path d="M16 10l6-3v10l-6-3"/><circle cx="7" cy="9" r="1" fill="currentColor" stroke="none"/></svg>`,
  cameraOff: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"><rect x="2" y="5" width="14" height="14"/><path d="M16 10l6-3v10l-6-3"/><line x1="2" y1="3" x2="22" y2="21" stroke-width="2"/></svg>`,
  micOn: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"><rect x="8" y="2" width="8" height="12" rx="0"/><path d="M4 10v1a8 8 0 0016 0v-1"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`,
  micOff: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"><rect x="8" y="2" width="8" height="12" rx="0"/><path d="M4 10v1a8 8 0 0016 0v-1"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/><line x1="2" y1="3" x2="22" y2="21" stroke-width="2"/></svg>`,
  phoneOff: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"><path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 004.05.7 2 2 0 011.98 2v3.5a2 2 0 01-2.18 2A19.79 19.79 0 013.07 4.18 2 2 0 015.07 2H8.6a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L9.58 9.91"/><line x1="2" y1="2" x2="22" y2="22" stroke-width="2"/></svg>`,
  sun: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
  moon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"/></svg>`,
  image: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"><rect x="3" y="3" width="18" height="18"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
};

/* ── ICE Configuration ──────────────────────────────────────────────────── */
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/* ── State ──────────────────────────────────────────────────────────────── */
const state = {
  connected: false,
  roomId: '',
  waitingForPeer: false,
  cameraOn: true,
  muted: false,
  elapsed: 0,
  errorMessage: '',
  isInitiator: false,
  peerConnected: false,
  // Quantum metrics
  qber: null,
  qberEvent: null,
  qberHistory: [],
  bb84Active: false,
  eavesdropperEnabled: false,
  // Server connection info (from navbar)
  signalingUrl: '',
  // Media source & output
  mediaSource: 'camera',           // 'camera' | 'test-a' | 'test-b'
  audioOutputDevices: [],
  selectedAudioOutput: 'default',
  sinkIdSupported: false,
};

let socket = null;
let pc = null;
let localStream = null;
let dataChannel = null;
let elapsedInterval = null;
let noiseRaf = null;
let testVideoCanvas = null;
let testVideoRaf = null;
let testAudioCtx = null;

/* ── Signaling ──────────────────────────────────────────────────────────── */

function connectToSignaling(url) {
  if (socket) socket.disconnect();

  socket = io(url, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });

  socket.on('connect', () => {
    state.connected = true;
    render();
  });

  socket.on('welcome', () => {
    state.connected = true;
    render();
  });

  socket.on('disconnect', () => {
    state.connected = false;
    if (state.roomId) leaveSession();
    render();
  });

  socket.on('room-created', (data) => {
    state.roomId = data.room_id;
    state.waitingForPeer = true;
    render();
  });

  socket.on('room-joined', async (data) => {
    state.roomId = data.room_id;
    state.isInitiator = data.initiator;
    state.waitingForPeer = false;
    state.peerConnected = true;
    state.elapsed = 0;
    startElapsedTimer();

    await createPeerConnection();

    if (state.isInitiator) {
      createDataChannel();
      addLocalTracks();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('offer', { sdp: pc.localDescription });
    }

    render();
  });

  socket.on('offer', async (data) => {
    if (!pc) await createPeerConnection();
    addLocalTracks();
    await pc.setRemoteDescription(data.sdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('answer', { sdp: pc.localDescription });
  });

  socket.on('answer', async (data) => {
    if (pc) await pc.setRemoteDescription(data.sdp);
  });

  socket.on('ice-candidate', async (data) => {
    if (pc && data.candidate) {
      try { await pc.addIceCandidate(data.candidate); }
      catch (e) { console.warn('ICE candidate failed:', e); }
    }
  });

  socket.on('peer-disconnected', () => {
    showToast('Peer disconnected.');
    cleanupPeerConnection();
    state.peerConnected = false;
    state.waitingForPeer = false;
    state.roomId = '';
    state.elapsed = 0;
    if (elapsedInterval) { clearInterval(elapsedInterval); elapsedInterval = null; }
    render();
  });

  socket.on('error', (data) => {
    showToast(data.message || 'An error occurred.');
  });
}

/* ── Test media generators ──────────────────────────────────────────────── */
const TEST_PRESETS = {
  'test-a': { label: 'TEST SOURCE A', bg: '#1a3a5c', hz: 440 },
  'test-b': { label: 'TEST SOURCE B', bg: '#5c1a3a', hz: 660 },
};

function createTestVideoStream(label, bg) {
  const W = 640, H = 360;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  testVideoCanvas = canvas;

  function draw() {
    const t = Date.now() / 1000;

    // Background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Pulsing concentric rectangles
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const pulse = Math.sin(t * 2 + i * 0.8) * 15;
      const inset = 40 + i * 25 + pulse;
      ctx.strokeRect(inset, inset * (H / W), W - inset * 2, H - inset * (H / W) * 2);
    }

    // Label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, W / 2, H / 2);

    // Timestamp
    const now = new Date();
    const ts = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map(n => String(n).padStart(2, '0')).join(':');
    ctx.font = '14px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(ts, W - 12, H - 10);

    testVideoRaf = requestAnimationFrame(draw);
  }
  draw();
  return canvas.captureStream(30);
}

function createTestAudioStream(hz) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const dest = ctx.createMediaStreamDestination();
  osc.type = 'sine';
  osc.frequency.value = hz;
  gain.gain.value = 0.05;
  osc.connect(gain);
  gain.connect(dest);
  osc.start();
  testAudioCtx = ctx;
  return dest.stream;
}

function createTestStream(sourceId) {
  const preset = TEST_PRESETS[sourceId];
  const videoStream = createTestVideoStream(preset.label, preset.bg);
  const audioStream = createTestAudioStream(preset.hz);
  return new MediaStream([
    ...videoStream.getVideoTracks(),
    ...audioStream.getAudioTracks(),
  ]);
}

function cleanupTestMedia() {
  if (testVideoRaf) { cancelAnimationFrame(testVideoRaf); testVideoRaf = null; }
  testVideoCanvas = null;
  if (testAudioCtx) {
    testAudioCtx.close().catch(() => {});
    testAudioCtx = null;
  }
}

function stopLocalMedia() {
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  cleanupTestMedia();
}

/* ── Audio output device selection ─────────────────────────────────────── */

async function enumerateAudioOutputDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    state.audioOutputDevices = devices.filter(d => d.kind === 'audiooutput');
    if (state.audioOutputDevices.length && !state.audioOutputDevices.find(d => d.deviceId === state.selectedAudioOutput)) {
      state.selectedAudioOutput = 'default';
    }
  } catch (_) { /* ignore */ }
}

function applyAudioOutput() {
  if (!state.sinkIdSupported) return;
  const el = document.getElementById('peer-video');
  if (el && typeof el.setSinkId === 'function') {
    el.setSinkId(state.selectedAudioOutput).catch(() => {});
  }
}

function handleMediaSourceChange(value) {
  if (value === state.mediaSource) return;
  stopLocalMedia();
  state.mediaSource = value;
  getLocalMedia().then(() => render());
}

function handleAudioOutputChange(deviceId) {
  state.selectedAudioOutput = deviceId;
  applyAudioOutput();
}

/* ── WebRTC ─────────────────────────────────────────────────────────────── */

async function getLocalMedia() {
  if (localStream) return localStream;
  try {
    if (state.mediaSource.startsWith('test-')) {
      localStream = createTestStream(state.mediaSource);
    } else {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    }
    const selfVideo = document.getElementById('self-video');
    if (selfVideo) {
      selfVideo.srcObject = localStream;
      selfVideo.muted = true;
    }
    await enumerateAudioOutputDevices();
    return localStream;
  } catch (e) {
    showToast('Camera/microphone access denied.');
    return null;
  }
}

async function createPeerConnection() {
  pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  pc.onicecandidate = (event) => {
    if (event.candidate && socket) {
      socket.emit('ice_candidate', { candidate: event.candidate });
    }
  };

  pc.oniceconnectionstatechange = () => {
    const s = pc.iceConnectionState;
    if (s === 'disconnected' || s === 'failed' || s === 'closed') {
      state.peerConnected = false;
      render();
    }
  };

  pc.ontrack = (event) => {
    const peerVideo = document.getElementById('peer-video');
    if (peerVideo && event.streams[0]) {
      peerVideo.srcObject = event.streams[0];
      applyAudioOutput();
    }
  };

  pc.ondatachannel = (event) => {
    setupDataChannel(event.channel);
  };
}

function addLocalTracks() {
  if (!localStream || !pc) return;
  for (const track of localStream.getTracks()) {
    pc.addTrack(track, localStream);
  }
}

function createDataChannel() {
  if (!pc) return;
  const channel = pc.createDataChannel('qkd', { ordered: true });
  setupDataChannel(channel);
}

function setupDataChannel(channel) {
  dataChannel = channel;
  channel.onopen = () => { /* DataChannel ready for BB84 key exchange */ };
  channel.onmessage = (event) => { /* BB84 messages handled here */ };
  channel.onclose = () => { dataChannel = null; };
}

function cleanupPeerConnection() {
  if (pc) { pc.close(); pc = null; }
  if (dataChannel) { dataChannel.close(); dataChannel = null; }
}

/* ── Actions ────────────────────────────────────────────────────────────── */

function toggleCamera() {
  state.cameraOn = !state.cameraOn;
  if (localStream) {
    localStream.getVideoTracks().forEach(t => { t.enabled = state.cameraOn; });
  }
  render();
}

function toggleMute() {
  state.muted = !state.muted;
  if (localStream) {
    localStream.getAudioTracks().forEach(t => { t.enabled = !state.muted; });
  }
  render();
}

function createRoom() {
  if (socket) socket.emit('create_room');
}

function joinRoom(roomId) {
  if (socket) socket.emit('join_room', { room_id: roomId });
}

function leaveSession() {
  if (socket) socket.emit('leave_room');
  cleanupPeerConnection();
  cleanupTestMedia();
  state.roomId = '';
  state.waitingForPeer = false;
  state.peerConnected = false;
  state.elapsed = 0;
  state.bb84Active = false;
  state.qber = null;
  state.qberHistory = [];
  if (elapsedInterval) { clearInterval(elapsedInterval); elapsedInterval = null; }
  render();
}

function startElapsedTimer() {
  if (elapsedInterval) clearInterval(elapsedInterval);
  elapsedInterval = setInterval(() => {
    state.elapsed++;
    const el = document.getElementById('elapsed-timer');
    if (el) el.textContent = formatTime(state.elapsed);
  }, 1000);
}

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/* ── Toast ──────────────────────────────────────────────────────────────── */
let toastTimer = null;

function showToast(msg) {
  state.errorMessage = msg;
  const el = document.getElementById('toast');
  const msgEl = document.getElementById('toast-msg');
  if (!el || !msgEl) return;
  msgEl.textContent = msg;
  el.className = 'toast toast--visible';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.className = 'toast toast--hidden';
    setTimeout(() => { state.errorMessage = ''; }, 300);
  }, 5000);
}

function dismissToast() {
  const el = document.getElementById('toast');
  if (el) el.className = 'toast toast--hidden';
  if (toastTimer) clearTimeout(toastTimer);
  setTimeout(() => { state.errorMessage = ''; }, 300);
}

/* ── Theme ──────────────────────────────────────────────────────────────── */
function getTheme() { return localStorage.getItem('qvc-theme') || 'dark'; }
function setTheme(theme) {
  localStorage.setItem('qvc-theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
}
function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
  render();
}

function getLogoVisible() {
  const v = localStorage.getItem('qvc-logo-visible');
  return v === null ? true : v === 'true';
}
function toggleLogo() {
  localStorage.setItem('qvc-logo-visible', String(!getLogoVisible()));
  render();
}

/* ── Noise canvas (when no peer video) ──────────────────────────────────── */
function startNoise(canvas) {
  if (!canvas) return;
  const w = 160;
  const h = Math.round(160 * (9 / 16));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(w, h);
  const buf = imageData.data;

  function draw() {
    for (let i = 0; i < buf.length; i += 4) {
      const v = (Math.random() * 200 + 30) | 0;
      buf[i] = v; buf[i + 1] = v; buf[i + 2] = v; buf[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    noiseRaf = requestAnimationFrame(draw);
  }
  draw();
}
function stopNoise() {
  if (noiseRaf) { cancelAnimationFrame(noiseRaf); noiseRaf = null; }
}

/* ── Render ─────────────────────────────────────────────────────────────── */
function render() {
  const app = document.getElementById('app');
  if (!app) return;

  const inCall = !!state.roomId && !state.waitingForPeer;
  const isDark = getTheme() === 'dark';
  const logoVisible = getLogoVisible();
  const isConnected = state.connected;

  let html = '';

  // Toast
  html += `<div id="toast" class="toast toast--hidden" onclick="dismissToast()">
    <span id="toast-msg" class="toast-message"></span>
    <span class="toast-dismiss">&times;</span>
  </div>`;

  if (!inCall) {
    // ── Header + Lobby ──
    html += `<div class="header">
      <div class="header-left">
        ${logoVisible ? '<img id="logo" src="/video-chat/logo.png" alt="UCSD Logo">' : ''}
      </div>
      <div class="header-right">
        <button class="header-theme-btn" onclick="toggleLogo()" title="${logoVisible ? 'Hide logo' : 'Show logo'}">${ICONS.image}</button>
        <button class="header-theme-btn" onclick="toggleTheme()" title="${isDark ? 'Light mode' : 'Dark mode'}">${isDark ? ICONS.sun : ICONS.moon}</button>
      </div>
    </div>`;

    html += `<div class="main-body"><div class="lobby">`;

    // Self preview (video element)
    html += `<div class="lobby-preview">
      <video id="self-video" class="lobby-preview-video" autoplay playsinline muted></video>
      ${!state.cameraOn ? `<div class="noise-canvas-wrapper"><canvas id="noise-canvas" class="noise-canvas"></canvas><span class="noise-label">Camera Off</span></div>` : ''}
    </div>`;

    html += `<h2 class="lobby-title">QKD Video Chat</h2>`;

    // Source selection
    html += `<div class="lobby-device-row">
      <label class="lobby-label">Source</label>
      <select class="lobby-select" id="media-source-select" onchange="handleMediaSourceChange(this.value)">
        <option value="camera" ${state.mediaSource === 'camera' ? 'selected' : ''}>Camera &amp; Mic</option>
        <option value="test-a" ${state.mediaSource === 'test-a' ? 'selected' : ''}>Test Source A</option>
        <option value="test-b" ${state.mediaSource === 'test-b' ? 'selected' : ''}>Test Source B</option>
      </select>
    </div>`;

    // Audio output selection (only when supported)
    if (state.sinkIdSupported && state.audioOutputDevices.length) {
      html += `<div class="lobby-device-row">
        <label class="lobby-label">Speaker</label>
        <select class="lobby-select" id="audio-output-select" onchange="handleAudioOutputChange(this.value)">
          ${state.audioOutputDevices.map(d =>
            `<option value="${d.deviceId}" ${d.deviceId === state.selectedAudioOutput ? 'selected' : ''}>${d.label || 'Speaker ' + d.deviceId.slice(0, 8)}</option>`
          ).join('')}
        </select>
      </div>`;
    }

    // Room join form — empty = create room, number = join room
    html += `<form class="lobby-form" onsubmit="handleJoin(event)">
      <label for="join-room-id" class="lobby-label">Room ID</label>
      <input id="join-room-id" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="5" class="lobby-input lobby-input--room" placeholder="Leave blank to create" ${!isConnected ? 'disabled' : ''} spellcheck="false" autocomplete="off" value="${document.getElementById('join-room-id')?.value || ''}">
      <button type="submit" class="lobby-btn" ${!isConnected || state.waitingForPeer ? 'disabled' : ''}>${state.waitingForPeer ? 'Waiting...' : 'Join'}</button>
    </form>`;

    // Waiting indicator
    if (state.waitingForPeer) {
      html += `<div class="lobby-waiting">
        <span class="lobby-waiting-spinner"></span>
        <span>Waiting for peer to join...</span>
        ${state.roomId ? `<span class="lobby-user-id">Room: <strong>${state.roomId}</strong></span>` : ''}
      </div>`;
    }

    // Media toggles
    html += `<div class="lobby-media">
      <button class="lobby-media-btn ${state.cameraOn ? '' : 'lobby-media-btn--off'}" type="button" onclick="toggleCamera()" title="${state.cameraOn ? 'Turn camera off' : 'Turn camera on'}">
        ${state.cameraOn ? ICONS.cameraOn : ICONS.cameraOff}
      </button>
      <button class="lobby-media-btn ${state.muted ? 'lobby-media-btn--off' : ''}" type="button" onclick="toggleMute()" title="${state.muted ? 'Unmute microphone' : 'Mute microphone'}">
        ${state.muted ? ICONS.micOff : ICONS.micOn}
      </button>
    </div>`;

    html += `</div></div>`;

  } else {
    // ── InCall ──
    html += `<div class="incall">
      <div class="incall-video-area">
        <video id="peer-video" class="incall-peer-video" autoplay playsinline></video>
        <div class="incall-pip">
          <video id="self-video" class="incall-pip-video" autoplay playsinline muted></video>
          ${!state.cameraOn ? `<div class="incall-pip-off">${ICONS.cameraOff}</div>` : ''}
        </div>
      </div>
      <div class="incall-info">
        <span class="incall-room">Room: <strong>${state.roomId}</strong></span>
        <span class="incall-timer" id="elapsed-timer">${formatTime(state.elapsed)}</span>
        ${state.sinkIdSupported && state.audioOutputDevices.length > 1 ? `
          <select class="incall-output-select" onchange="handleAudioOutputChange(this.value)">
            ${state.audioOutputDevices.map(d =>
              `<option value="${d.deviceId}" ${d.deviceId === state.selectedAudioOutput ? 'selected' : ''}>${d.label || 'Speaker ' + d.deviceId.slice(0, 8)}</option>`
            ).join('')}
          </select>` : ''}
      </div>
      <div id="quantum-panel" class="quantum-panel"></div>
      <div class="incall-toolbar">
        <div class="incall-toolbar-center">
          <button class="incall-tool-btn ${state.cameraOn ? '' : 'incall-tool-btn--off'}" onclick="toggleCamera()" title="${state.cameraOn ? 'Turn camera off' : 'Turn camera on'}">
            ${state.cameraOn ? ICONS.cameraOn : ICONS.cameraOff}
            <span class="incall-tool-label">${state.cameraOn ? 'Camera' : 'Camera Off'}</span>
          </button>
          <button class="incall-tool-btn ${state.muted ? 'incall-tool-btn--off' : ''}" onclick="toggleMute()" title="${state.muted ? 'Unmute microphone' : 'Mute microphone'}">
            ${state.muted ? ICONS.micOff : ICONS.micOn}
            <span class="incall-tool-label">${state.muted ? 'Muted' : 'Mic'}</span>
          </button>
        </div>
        <button class="incall-leave-btn" onclick="leaveSession()" title="Leave session">
          ${ICONS.phoneOff}
          <span class="incall-tool-label">Leave</span>
        </button>
      </div>
    </div>`;
  }

  // Preserve input values before re-render
  const joinVal = document.getElementById('join-room-id')?.value;

  app.innerHTML = html;

  // Restore input values
  if (!inCall) {
    const j = document.getElementById('join-room-id');
    if (j && joinVal) j.value = joinVal;
  }

  // Re-attach local stream to self-video element after re-render
  if (localStream) {
    const selfVideo = document.getElementById('self-video');
    if (selfVideo) {
      selfVideo.srcObject = localStream;
      selfVideo.muted = true;
    }
  }

  // Start noise canvases
  stopNoise();
  if (!inCall && !state.cameraOn) {
    startNoise(document.getElementById('noise-canvas'));
  }

  // Render quantum panel and apply audio output if in call
  if (inCall) {
    renderQuantumPanel();
    applyAudioOutput();
  }
}

/* ── Quantum Dashboard Panel ───────────────────────────────────────────── */
function renderQuantumPanel() {
  const panel = document.getElementById('quantum-panel');
  if (!panel) return;

  if (!state.bb84Active) {
    panel.innerHTML = '<div class="qd-inactive">Encryption pending key exchange</div>';
    return;
  }

  const qber = state.qber;
  const qberPct = qber !== null ? (qber * 100).toFixed(2) : '--';
  const event = state.qberEvent || 'unknown';

  let statusClass = 'qd-status--normal';
  let statusLabel = 'Secure';
  if (event === 'intrusion_detected') { statusClass = 'qd-status--danger'; statusLabel = 'INTRUSION'; }
  else if (event === 'warning') { statusClass = 'qd-status--warning'; statusLabel = 'Warning'; }

  panel.innerHTML = `
    <div class="qd-header">
      <span class="qd-title">BB84 Quantum Channel</span>
      <span class="qd-badge ${statusClass}">${statusLabel}</span>
    </div>
    <div class="qd-metrics">
      <div class="qd-metric">
        <span class="qd-metric-value ${qber > 0.11 ? 'qd-metric--danger' : qber > 0.05 ? 'qd-metric--warning' : ''}">${qberPct}%</span>
        <span class="qd-metric-label">QBER</span>
      </div>
      <div class="qd-metric">
        <span class="qd-metric-value">${state.qberHistory.length}</span>
        <span class="qd-metric-label">Rounds</span>
      </div>
      <div class="qd-metric">
        <span class="qd-metric-value">11%</span>
        <span class="qd-metric-label">Threshold</span>
      </div>
    </div>
    <canvas id="qber-chart" class="qd-chart" width="280" height="80"></canvas>
    <button class="qd-eve-btn ${state.eavesdropperEnabled ? 'qd-eve-btn--active' : ''}"
            onclick="toggleEavesdropper()">
      ${state.eavesdropperEnabled ? 'Disable Eve' : 'Simulate Eve'}
    </button>`;

  drawQBERChart();
}

function drawQBERChart() {
  const canvas = document.getElementById('qber-chart');
  if (!canvas || state.qberHistory.length < 2) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(0, 0, w, h);

  // Threshold line at 11%
  const thresholdY = h - (0.11 / 0.35) * h;
  ctx.strokeStyle = 'rgba(255,80,80,0.5)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, thresholdY);
  ctx.lineTo(w, thresholdY);
  ctx.stroke();
  ctx.setLineDash([]);

  // QBER line
  const points = state.qberHistory;
  const step = w / Math.max(points.length - 1, 1);
  ctx.strokeStyle = '#4fc3f7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const x = i * step;
    const y = h - (points[i].qber / 0.35) * h;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function toggleEavesdropper() {
  state.eavesdropperEnabled = !state.eavesdropperEnabled;
  // Placeholder: eavesdropper toggle will be wired to BB84 simulated channel
  showToast(`Eavesdropper ${state.eavesdropperEnabled ? 'enabled' : 'disabled'}`);
  renderQuantumPanel();
}

/* ── Form handlers ──────────────────────────────────────────────────────── */
function handleJoin(e) {
  e.preventDefault();
  const id = document.getElementById('join-room-id').value.trim();
  if (id && !/^\d{5}$/.test(id)) {
    showToast('Room ID must be exactly 5 digits.');
    return;
  }
  if (id) {
    joinRoom(id);
  } else {
    createRoom();
  }
}

/* ── Navbar integration ─────────────────────────────────────────────────── */
(function() {
  let _widget = null;

  document.addEventListener('navbar:connect-ready', function(e) {
    if (e.detail.service !== 'qvc-server') return;
    _widget = e.detail.widget;
    _widget.setStatus(state.connected ? 'connected' : 'idle');
  });

  document.addEventListener('navbar:connect', function(e) {
    if (e.detail.service !== 'qvc-server') return;
    const url = e.detail.url || `http://${e.detail.host}:${e.detail.port}`;
    state.signalingUrl = url;
    if (_widget) _widget.setStatus('connecting');

    // Get local media first, then connect to signaling
    getLocalMedia().then(() => {
      connectToSignaling(url);
      // Watch for connection state changes to update widget
      const checkConn = setInterval(() => {
        if (state.connected) {
          if (_widget) _widget.setStatus('connected');
          clearInterval(checkConn);
        }
      }, 200);
      // Timeout after 10s
      setTimeout(() => {
        clearInterval(checkConn);
        if (!state.connected && _widget) _widget.setStatus('error');
      }, 10000);
    });
  });

  document.addEventListener('navbar:disconnect', function(e) {
    if (e.detail.service !== 'qvc-server') return;
    if (socket) socket.disconnect();
    state.connected = false;
    state.signalingUrl = '';
    if (state.roomId) leaveSession();
    if (_widget) _widget.setStatus('disconnected');
    render();
  });
})();

/* ── Init ───────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  state.sinkIdSupported = typeof HTMLMediaElement.prototype.setSinkId === 'function';
  if (navigator.mediaDevices) {
    navigator.mediaDevices.addEventListener('devicechange', () => {
      enumerateAudioOutputDevices().then(() => render());
    });
  }
  setTheme(getTheme());
  render();
});

window.addEventListener('beforeunload', () => { cleanupTestMedia(); });
