/**
 * ConnectionManager — client-side connection lifecycle for the classifier
 * backend.
 *
 * State machine:
 *   idle ──► connecting ──► connected ──► degraded ──► disconnected
 *                │              │                          │
 *                └──────────────┴──────── reconnect ◄──────┘
 *
 * States and their intended dot colors:
 *   - idle         → grey  (no connection attempted)
 *   - connecting   → yellow (actively trying)
 *   - connected    → green
 *   - degraded     → yellow (missed pings / health-check retries)
 *   - disconnected → red
 *
 * Emits `connection:statechange` CustomEvent on every transition.
 */

import type { ConnectWidget } from '../shared/server-connect-modal';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'degraded' | 'disconnected';

export interface ConnectionManager {
  readonly state: ConnectionState;
  connect(baseUrl: string): void;
  disconnect(): void;
}

export interface ConnectionStateChangeDetail {
  state: ConnectionState;
  previous: ConnectionState;
  clientId: string | null;
}

interface HeartbeatEvent {
  type?: string;
  client_id?: string;
  heartbeat_interval?: number;
}

let _state: ConnectionState = 'idle';
let _baseUrl = '';
let _clientId: string | null = null;

// SSE reader / abort
let _abortCtrl: AbortController | null = null;

// Reconnect backoff
let _reconnectDelay = 1000;
const _maxReconnectDelay = 30000;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _wantConnected = false;

// Ping timeout
let _heartbeatInterval = 25; // seconds, updated by welcome
let _pingTimer: ReturnType<typeof setTimeout> | null = null;

// Health-check retry tracking
let _healthFailures = 0;
const _maxHealthRetries = 2; // go degraded after this many consecutive failures

// ── Observer — single dispatch point ──────────────────────────

function _setState(s: ConnectionState): void {
  const prev = _state;
  _state = s;
  if (s !== prev) {
    document.dispatchEvent(
      new CustomEvent<ConnectionStateChangeDetail>('connection:statechange', {
        detail: { state: s, previous: prev, clientId: _clientId },
      }),
    );
  }
}

// ── Helpers ─────────────────────────────────────────────────────

function _clearTimers(): void {
  if (_reconnectTimer) {
    clearTimeout(_reconnectTimer);
    _reconnectTimer = null;
  }
  if (_pingTimer) {
    clearTimeout(_pingTimer);
    _pingTimer = null;
  }
}

function _resetBackoff(): void {
  _reconnectDelay = 1000;
  _healthFailures = 0;
}

function _jitter(ms: number): number {
  return ms + Math.random() * ms * 0.3;
}

// ── Ping timeout ────────────────────────────────────────────────

function _startPingTimeout(): void {
  if (_pingTimer) clearTimeout(_pingTimer);
  // First missed ping → degraded; second → disconnected.
  const degradedTimeout = _heartbeatInterval * 2 * 1000;
  const deadTimeout = _heartbeatInterval * 3.5 * 1000;

  _pingTimer = setTimeout(() => {
    if (_state === 'connected') {
      _setState('degraded');
      // Give it one more interval before declaring dead.
      _pingTimer = setTimeout(() => {
        _handleDisconnect();
      }, deadTimeout - degradedTimeout);
    } else {
      _handleDisconnect();
    }
  }, degradedTimeout);
}

// ── SSE heartbeat channel ──────────────────────────────────────

function _openHeartbeat(): void {
  _abortCtrl = new AbortController();
  fetch(_baseUrl + '/connect', { signal: _abortCtrl.signal })
    .then((res) => {
      if (!res.ok || !res.body) throw new Error('connect HTTP ' + String(res.status));
      return _readSSE(res.body.getReader());
    })
    .catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return; // intentional close
      _handleDisconnect();
    });
}

function _readSSE(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
  const decoder = new TextDecoder();
  let buf = '';

  function pump(): Promise<void> {
    return reader
      .read()
      .then((result): Promise<void> | undefined => {
        if (result.done) {
          _handleDisconnect();
          return;
        }
        buf += decoder.decode(result.value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          const json = line.slice(5).trim();
          if (!json) continue;
          _handleEvent(JSON.parse(json) as HeartbeatEvent);
        }
        return pump();
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        _handleDisconnect();
      });
  }
  return pump();
}

function _handleEvent(event: HeartbeatEvent): void {
  if (event.type === 'welcome') {
    _clientId = event.client_id ?? null;
    _heartbeatInterval = event.heartbeat_interval ?? 25;
    _setState('connected');
    _resetBackoff();
    _startPingTimeout();
  } else if (event.type === 'ping') {
    // Any successful ping restores full connection.
    if (_state === 'degraded') _setState('connected');
    _startPingTimeout();
    // Respond with pong
    fetch(_baseUrl + '/pong', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: _clientId }),
    }).catch(() => {
      /* best effort */
    });
  }
}

// ── Disconnect / reconnect ─────────────────────────────────────

function _handleDisconnect(): void {
  if (_state === 'disconnected' || _state === 'idle') return;
  _closeChannel();
  _setState('disconnected');
  if (_wantConnected) _scheduleReconnect();
}

function _closeChannel(): void {
  _clearTimers();
  if (_abortCtrl) {
    _abortCtrl.abort();
    _abortCtrl = null;
  }
}

function _scheduleReconnect(): void {
  if (_reconnectTimer) return;
  const delay = _jitter(_reconnectDelay);
  _reconnectDelay = Math.min(_reconnectDelay * 2, _maxReconnectDelay);
  _reconnectTimer = setTimeout(() => {
    _reconnectTimer = null;
    if (_wantConnected) _doConnect();
  }, delay);
}

// ── Connect flow ───────────────────────────────────────────────

function _doConnect(): void {
  _setState('connecting');
  // Health check first
  fetch(_baseUrl + '/health')
    .then((res) => {
      if (!res.ok) throw new Error('health HTTP ' + String(res.status));
      _healthFailures = 0;
      _openHeartbeat();
    })
    .catch(() => {
      _healthFailures++;
      // Below the retry cap the backend might still come up — show
      // degraded/yellow; past it, red. Either way keep retrying while wanted.
      _setState(_healthFailures <= _maxHealthRetries ? 'degraded' : 'disconnected');
      if (_wantConnected) _scheduleReconnect();
    });
}

// ── Graceful unload ────────────────────────────────────────────

window.addEventListener('beforeunload', () => {
  if (_clientId && _baseUrl) {
    navigator.sendBeacon(
      _baseUrl + '/disconnect',
      new Blob([JSON.stringify({ client_id: _clientId })], { type: 'application/json' }),
    );
  }
});

// ── Navbar integration (observer of its own events) ────────────

document.addEventListener('navbar:connect', (e) => {
  const detail = (e as CustomEvent<{ service?: string; url?: string }>).detail;
  if (detail.service !== 'classifiers' || !detail.url) return;
  connectionManager.disconnect();
  connectionManager.connect(detail.url);
});

document.addEventListener('navbar:disconnect', (e) => {
  const detail = (e as CustomEvent<{ service?: string }>).detail;
  if (detail.service !== 'classifiers') return;
  connectionManager.disconnect();
});

// Bridge: navbar widget subscribes to connection:statechange
let _navWidget: ConnectWidget | null = null;

document.addEventListener('navbar:connect-ready', (e) => {
  const detail = (e as CustomEvent<{ service?: string; widget?: ConnectWidget }>).detail;
  if (detail.service !== 'classifiers' || !detail.widget) return;
  _navWidget = detail.widget;
  _navWidget.setStatus(_state);
});

document.addEventListener('connection:statechange', (e) => {
  if (_navWidget)
    _navWidget.setStatus((e as CustomEvent<ConnectionStateChangeDetail>).detail.state);
});

// ── Public API ─────────────────────────────────────────────────

export const connectionManager: ConnectionManager = {
  get state() {
    return _state;
  },

  connect(baseUrl) {
    _closeChannel();
    _healthFailures = 0;
    _baseUrl = baseUrl.replace(/\/+$/, '');
    _wantConnected = true;
    _doConnect();
  },

  disconnect() {
    _wantConnected = false;
    _closeChannel();
    if (_clientId && _baseUrl) {
      fetch(_baseUrl + '/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: _clientId }),
      }).catch(() => {
        /* best effort */
      });
    }
    _clientId = null;
    _setState('disconnected');
  },
};

window.connectionManager = connectionManager;
