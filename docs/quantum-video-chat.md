## Quantum Video Chat (QVC)

**Source repo:** [`Quantum-Interns-at-Qualcomm-Institiute/Quantum-Video-Chat`](https://github.com/Quantum-Interns-at-Qualcomm-Institiute/Quantum-Video-Chat) — a standalone full-stack app (client + signaling). Not embedded in the portal; linked out as a project card.

<a id="qvc-overview"></a>
### Overview

Browser-native P2P video chat implementing BB84 quantum key distribution over WebRTC DataChannels. Simulated quantum optical channel models real hardware parameters (Poisson photon statistics, fiber attenuation, single-photon APD detectors, eavesdropping detection). AES-128-GCM frame encryption via Insertable Streams Web Worker.

Architecture:
- **Signaling Server** (Python/Flask + Socket.IO): Room management, SDP/ICE relay only — media never touches server
- **WebRTC P2P**: Direct browser-to-browser media transport
- **Insertable Streams**: AES-128-GCM frame encryption in Web Worker (RTCRtpScriptTransform)
- **BB84 Protocol** (JavaScript): Sifting, QBER estimation, Cascade error correction, Toeplitz privacy amplification

<a id="qvc-signaling-server"></a>
### Signaling Server

**`signaling/server.py`** (~193 lines) — Flask + Socket.IO:

**REST Endpoints:**

| Endpoint | Purpose |
|----------|---------|
| `GET /admin/status` | Health + metrics (rooms, peers, uptime, peak counts, avg session duration) |
| `GET /admin/events` | Recent events with optional `limit` param |
| `GET /admin/rooms` | Active room summaries (room_id, peers, is_full) |
| `GET /admin/peers` | Connected peers (sid, room_id, peer) |

**CORS:** Accepts `http://localhost:*`, `https://localhost:*`, `https://andypeterson.dev`.

**Socket.IO Signaling Events:**

| Event | Direction | Purpose |
|-------|-----------|---------|
| `connect` | client->server | Register peer, emit `welcome` with sid |
| `disconnect` | client->server | Unregister, notify room partner (`peer-disconnected`) |
| `create_room` | client->server | Generate 5-digit room ID, make peer room creator |
| `join_room` | client->server | Join room, notify both peers with initiator flag |
| `leave_room` | client->server | Leave room, notify partner, clean up if empty |
| `offer` | client->server->client | Relay SDP offer to other peer |
| `answer` | client->server->client | Relay SDP answer to other peer |
| `ice_candidate` | client->server->client | Relay ICE candidate to other peer |

**`signaling/main.py`:** Port discovery via OS-assigned socket, eventlet WSGI server, graceful shutdown (SIGINT/SIGTERM).

<a id="qvc-room-management"></a>
### Room Management

**`signaling/rooms.py`** (~295 lines):

**Data structures:**
- `Peer`: `sid`, `room_id` (None if not in room)
- `Room`: `room_id`, `peers` list (max 2), properties: `is_full`, `is_empty`, `other_peer(sid)`

**RoomManager:**

| Feature | Detail |
|---------|--------|
| Room ID | 5-digit numeric (10000-99999), cryptographically random |
| Metrics | `uptime_seconds`, `total_connections`, `total_sessions`, `peak_rooms`, `peak_peers` |
| Session tracking | Rolling list (max 200) of session durations for avg calculation |
| Event log | Max 100 entries: peer_connected, room_created, peer_joined, peer_left, peer_disconnected |

Methods: `register_peer`, `unregister_peer`, `create_room`, `join_room`, `leave_room`, `get_room`, `get_peer`, `log_event`, `get_events`, `get_rooms_summary`, `get_peers_summary`.

<a id="qvc-frontend-application"></a>
### Frontend Application

**`website/client/static/app.js`** (~192 lines):

**Global state:**

```
signalingConnected, peerConnected, roomId, isInitiator, waitingForPeer,
cameraOn, muted, elapsed, bb84Active, qber, qberHistory, keyBudget,
encryptionEnabled, errorMessage
```

**Functions:** `connectToSignaling(url)`, `handleCreateRoom()`, `handleJoinRoom(e)`, `handleLeave()`, `toggleCamera()`, `toggleMute()`, `startTimer()`, `stopTimer()`, `showToast(msg)`, `render()` (lobby vs in-call UI).

**Theme:** localStorage `qvc-theme` (dark/light).

**Styling (`style.css`, ~668 lines):** Dark theme default with light overrides. Color scheme: warm brown/gold/teal palette. Components: `.main-screen`, `.header`, `.lobby`, `.incall`, `.quantum-panel`, `.toast`, `.noise-canvas-wrapper`.

<a id="qvc-webrtc-management"></a>
### WebRTC Management

**`website/client/static/js/webrtc.js`** (~269 lines) — `WebRTCManager`:

| Feature | Detail |
|---------|--------|
| ICE servers | `stun:stun.l.google.com:19302`, `stun:stun1.l.google.com:19302` |
| Data channel | Named `qkd`, ordered |
| Encryption | Optional Insertable Streams via `RTCRtpScriptTransform` |
| Worker | `/js/crypto-worker.js` (module type) |

**Lifecycle:**
1. `getLocalMedia(constraints)` -> `MediaStream`
2. `createRoom()` / `joinRoom(roomId)` -> Socket.IO signaling
3. If initiator: create `RTCPeerConnection`, data channel, add local tracks, send SDP offer
4. If joiner: create `RTCPeerConnection`, add local tracks, wait for offer, send answer
5. ICE candidates relayed through signaling server
6. `ontrack` -> emit `remote-stream`; if encryption enabled, apply decrypt transform
7. `leave()` -> cleanup peer connection

**Event emitter:** `on(event, callback)` pub/sub with `_listeners` map.

<a id="qvc-cryptography"></a>
### Cryptography

**`website/client/static/js/crypto.js`** (~80 lines) — Frame-level AES-128-GCM:

**Frame format:** `[keyIndex:2LE][iv:12][ciphertext+tag]`

| Function | Purpose |
|----------|---------|
| `importKey(rawKey)` | Import 16-byte raw key for AES-GCM |
| `encryptFrame(plaintext, key, keyIndex)` | Random 12-byte IV, AES-GCM encrypt, pack frame |
| `decryptFrame(encrypted, key)` | Parse keyIndex + IV + ciphertext, decrypt, return `{plaintext, keyIndex}` |
| `parseKeyIndex(encrypted)` | Fast key index extraction (first 2 bytes) |

**`website/client/static/js/crypto-worker.js`** (~124 lines) — Web Worker for `RTCRtpScriptTransform`:

- State: `currentKey`, `currentKeyIndex`
- Encrypt/decrypt frame processing with latency measurement
- Messages: `set-key`, metrics reporting (`encryptLatencyUs`, `decryptLatencyUs`, `decrypt-error`)
- Registers `rtctransform` event handler for Insertable Streams pipeline

<a id="qvc-bb84-quantum-key-distribution"></a>
### BB84 Quantum Key Distribution

**`website/client/static/js/bb84/protocol.js`** (~296 lines) — `BB84Protocol`:

**Constructor options:**

| Option | Default | Purpose |
|--------|---------|---------|
| `numRawBits` | 4096 | Qubits to transmit |
| `qberThreshold` | 0.11 | 11% security threshold |
| `targetKeyLength` | 128 | Bits in final key |

**Alice's Protocol (`runAsAlice()`):**
1. **Preparation:** Generate random bits + bases, create qubit objects
2. **Transmission:** Send qubits via quantum channel
3. **Basis reconciliation:** Exchange bases with Bob
4. **Sifting:** Keep only bits where bases matched (~50% survival)
5. **QBER Estimation:** Exchange sample bits, calculate error rate, abort if > threshold
6. **Error Correction:** Simplified binary Cascade (8-bit block parity exchange, bit flipping)
7. **Privacy Amplification:** Toeplitz hashing (random seed, XOR-based reduction to target length)
8. **Output:** `{key: Uint8Array | null, qber: number, metrics: BB84Metrics}`

**Bob's Protocol (`runAsBob()`):** Mirror of Alice's with measurement in random bases (correct if bases match, random 50/50 if mismatch).

**Helpers:** `_sift`, `_estimateQber`, `_errorCorrectAlice`, `_errorCorrectBob`, `_privacyAmplify`, `_randomBits`, `_bitsToBytes`.

**Channel interfaces (`channel.js`):**
- `IdealQuantumChannel` — Zero-noise in-memory channel with async backpressure
- `LoopbackClassicalChannel` — In-memory message passing with deep clone

<a id="qvc-simulated-quantum-channel"></a>
### Simulated Quantum Channel

**`website/client/static/js/bb84/simulated.js`** (~128 lines) — `SimulatedQuantumChannel`:

| Parameter | Default | Model |
|-----------|---------|-------|
| `fiberLengthKm` | 1.0 | Distance (affects attenuation) |
| `sourceIntensity` | 0.1 | Mean photons per pulse (Poisson) |
| `detectorEfficiency` | 0.10 | APD quantum efficiency |
| `eavesdropperEnabled` | false | Intercept-resend attack |

**Physics modeling stages per qubit:**
1. **Poisson photon source:** P(>=1 photon) = 1 - exp(-mu)
2. **Fiber attenuation:** loss = 0.2 dB/km (standard telecom), transmittance = 10^(-dB/10)
3. **Eavesdropper (if enabled):** Eve measures in random basis; wrong basis -> 50% bit flip; re-sends in her basis
4. **Detector:** P(detect | photon) = efficiency

Eavesdropper detection: intercept-resend causes QBER rise above 11% threshold.

<a id="qvc-metrics-collection"></a>
### Metrics Collection

**`website/client/static/js/metrics.js`** (~121 lines) — `MetricsCollector`:

| Option | Default | Purpose |
|--------|---------|---------|
| `windowSize` | 60 | Rolling window size |
| `keyBudgetLowWatermark` | 1024 | Bytes threshold |
| `qberThreshold` | 0.11 | 11% security threshold |

Methods: `record(name, value)`, `get(name)`, `getHistory(name, n)`, `evaluate()`.

Edge-triggered events: `qber-exceeded`, `qber-normal`, `key-budget-low`. Subscription via `subscribe(event, callback)`.

**BB84 Metrics (`bb84/metrics.js`):**
Fields: `rawBits`, `siftedBits`, `qber`, `keyLength`, `roundDurationMs`, `siftingEfficiency`, `isSecure`.

<a id="qvc-testing"></a>
### Testing

**Python signaling tests (`tests/signaling/`):**

| File | Tests | Coverage |
|------|-------|----------|
| `test_rooms.py` | ~20 | Room dataclass, RoomManager lifecycle, unique IDs (50-room stress test), session durations, event logging, admin summaries |
| `test_signaling_server.py` | ~21 | Full signaling flow (offer/answer/ICE relay), connection loss scenarios (initiator/joiner/both crash, disconnect during SDP), clean session teardown (leave+rejoin, 3x cycles), dashboard endpoints (status/events/rooms/peers) |

Uses `FakePeer` to simulate Socket.IO peers.

**JavaScript tests (`tests/js/`):**

| File | Tests | Coverage |
|------|-------|----------|
| `bb84/test_protocol.js` | ~6 | Full BB84 over ideal channel (matching 128-bit keys), sifting survival rate, QBER estimation, privacy amplification, high-QBER rejection, eavesdropper detection |
| `bb84/test_simulated.js` | ~4 | QBER < 5% without eavesdropper, QBER > 11% with eavesdropper, detection rate calculations, fiber attenuation |
| `test_crypto.js` | ~5 | Encrypt/decrypt round-trip, key index parsing, random IV, wrong-key failure, GCM tamper detection, large frame (50KB) |
| `test_metrics.js` | ~5 | Record/retrieve, rolling window, QBER threshold events, key budget watermark, subscription |
| `test_app_dom.js` | — | App UI rendering |
| `test_signaling.js` | — | SignalingClient event relay |

<a id="qvc-cicd"></a>
### CI/CD

**`.github/workflows/test.yml`** — 4 jobs:

| Job | Runtime | Timeout | Action |
|-----|---------|---------|--------|
| Python Lint | Python 3.11 | 5m | `ruff check signaling/ tests/signaling/` |
| Python Tests | Python 3.11 | 10m | `pytest tests/signaling/ -v --tb=short --timeout=60` |
| JS Tests | Node 20 | 10m | `npm install && npx vitest run` |
| Docker Build | — | 10m | Build `Dockerfile.server`, start container, `curl /admin/status` health check |

**`.github/workflows/deploy-pages.yml`:** Uploads `website/client` to GitHub Pages on push to main.

**`.github/workflows/render-diagrams.yml`:** Renders PlantUML diagrams from `docs/diagrams/*.puml` to SVG/PNG, commits with `[skip ci]`.

<a id="qvc-docker"></a>
### Docker

**Dockerfile.server:**
- Base: `python:3.12-slim`
- Installs curl for health checks
- Sets `SIO_ASYNC_MODE=eventlet`
- Entry: `python -m signaling.main`

**docker-compose.yml:**
- Service: `signaling`
- Port: `127.0.0.1:${QVC_SERVER_PORT}:${QVC_SERVER_PORT}`
- Health check: `curl -f http://localhost:${QVC_SERVER_PORT}/admin/status`

**Environment variables:**

| Variable | Default | Purpose |
|----------|---------|---------|
| `QVC_SERVER_REST_PORT` | 5050 | Signaling server port |
| `QVC_HOST` | `0.0.0.0` | Bind address |
| `QVC_DEBUG` | — | Enable DEBUG logging |

<a id="qvc-dependencies"></a>
### Dependencies

| Purpose | Package | Version |
|---------|---------|---------|
| Web framework | Flask | 3.0.3 |
| CORS | Flask-CORS | 5.0.1 |
| Socket.IO (Flask) | Flask-SocketIO | 5.3.6 |
| Socket.IO (core) | python-socketio | 5.11.2 |
| Async server | eventlet | 0.36.1 |
| Dev: tests | pytest | latest |
| Dev: mocks | pytest-mock | latest |
| Dev: coverage | pytest-cov | latest |
| JS: test runner | vitest | ^3.1.1 |
| JS: DOM | jsdom | ^26.1.0 |

**Ruff config (`ruff.toml`):** Line length 120, Python 3.11 target, ALL rules enabled with ~20 relaxations, Google docstring convention.
