/**
 * @file ConnectionManager — client-side connection lifecycle for the
 *       QVC middleware.
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
 *
 * Exposes a global `connectionManager` singleton.
 * Exposes `connectionSocket` — the raw Socket.IO instance for app.js to use.
 */
"use strict";

var connectionManager = (function () {

  // ── States ──────────────────────────────────────────────────────
  var IDLE         = "idle";
  var CONNECTING   = "connecting";
  var CONNECTED    = "connected";
  var DEGRADED     = "degraded";
  var DISCONNECTED = "disconnected";

  var _state       = IDLE;
  var _baseUrl     = "";
  var _clientId    = null;
  var _socket      = null;

  // Reconnect backoff
  var _reconnectDelay    = 1000;
  var _maxReconnectDelay = 30000;
  var _reconnectTimer    = null;
  var _wantConnected     = false;

  // Ping timeout
  var _heartbeatInterval = 25;        // seconds, updated by welcome
  var _pingTimer         = null;

  // Health-check retry tracking
  var _healthFailures    = 0;
  var _maxHealthRetries  = 2;

  // ── Observer — single dispatch point ──────────────────────────

  function _setState(s) {
    var prev = _state;
    _state = s;
    if (s !== prev) {
      document.dispatchEvent(new CustomEvent("connection:statechange", {
        detail: { state: s, previous: prev, clientId: _clientId },
      }));
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────

  function _clearTimers() {
    if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
    if (_pingTimer)      { clearTimeout(_pingTimer); _pingTimer = null; }
  }

  function _resetBackoff() {
    _reconnectDelay = 1000;
    _healthFailures = 0;
  }

  function _jitter(ms) {
    return ms + Math.random() * ms * 0.3;
  }

  // ── Ping timeout ────────────────────────────────────────────────

  function _startPingTimeout() {
    if (_pingTimer) clearTimeout(_pingTimer);
    var degradedTimeout = _heartbeatInterval * 2 * 1000;
    var deadTimeout     = _heartbeatInterval * 3.5 * 1000;

    _pingTimer = setTimeout(function () {
      if (_state === CONNECTED) {
        _setState(DEGRADED);
        _pingTimer = setTimeout(function () {
          _handleDisconnect();
        }, deadTimeout - degradedTimeout);
      } else {
        _handleDisconnect();
      }
    }, degradedTimeout);
  }

  // ── Socket.IO connection ────────────────────────────────────────

  function _openSocket() {
    if (_socket) {
      _socket.removeAllListeners();
      if (_socket.connected) _socket.disconnect();
    }

    _socket = io(_baseUrl, {
      autoConnect: false,
      reconnection: false,  // We handle reconnection ourselves
    });

    // Expose for app.js
    window.connectionSocket = _socket;

    _socket.on("connect", function () {
      // Socket connected, wait for welcome event for full handshake
    });

    _socket.on("welcome", function (data) {
      _clientId = data.client_id;
      _heartbeatInterval = data.heartbeat_interval || 25;
      _setState(CONNECTED);
      _resetBackoff();
      _startPingTimeout();
      // Re-dispatch welcome so app.js can handle server config
      document.dispatchEvent(new CustomEvent("connection:welcome", {
        detail: data,
      }));
    });

    _socket.on("server-ping", function (data) {
      if (_state === DEGRADED) _setState(CONNECTED);
      _startPingTimeout();
      // Respond with pong
      _socket.emit("pong", { client_id: _clientId });
    });

    _socket.on("disconnect", function () {
      _handleDisconnect();
    });

    _socket.on("connect_error", function () {
      _handleDisconnect();
    });

    _socket.connect();
  }

  // ── Disconnect / reconnect ─────────────────────────────────────

  function _handleDisconnect() {
    if (_state === DISCONNECTED || _state === IDLE) return;
    _closeChannel();
    _setState(DISCONNECTED);
    if (_wantConnected) _scheduleReconnect();
  }

  function _closeChannel() {
    _clearTimers();
    if (_socket && _socket.connected) {
      _socket.disconnect();
    }
  }

  function _scheduleReconnect() {
    if (_reconnectTimer) return;
    var delay = _jitter(_reconnectDelay);
    _reconnectDelay = Math.min(_reconnectDelay * 2, _maxReconnectDelay);
    _reconnectTimer = setTimeout(function () {
      _reconnectTimer = null;
      if (_wantConnected) _doConnect();
    }, delay);
  }

  // ── Connect flow ───────────────────────────────────────────────

  function _doConnect() {
    _setState(CONNECTING);
    // Health check first
    fetch(_baseUrl + "/health")
      .then(function (res) {
        if (!res.ok) throw new Error("health HTTP " + res.status);
        _healthFailures = 0;
        _openSocket();
      })
      .catch(function () {
        _healthFailures++;
        if (_healthFailures <= _maxHealthRetries) {
          _setState(DEGRADED);
          if (_wantConnected) _scheduleReconnect();
        } else {
          _setState(DISCONNECTED);
          if (_wantConnected) _scheduleReconnect();
        }
      });
  }

  // ── Graceful unload ────────────────────────────────────────────

  window.addEventListener("beforeunload", function () {
    if (_clientId && _baseUrl) {
      navigator.sendBeacon(
        _baseUrl + "/disconnect",
        new Blob([JSON.stringify({ client_id: _clientId })], { type: "application/json" })
      );
    }
  });

  // ── Navbar integration (observer pattern) ──────────────────────

  document.addEventListener("navbar:connect", function (e) {
    if (e.detail.service !== "qvc") return;
    api.disconnect();
    api.connect(e.detail.url);
  });

  document.addEventListener("navbar:disconnect", function (e) {
    if (e.detail.service !== "qvc") return;
    api.disconnect();
  });

  // Bridge: navbar widget subscribes to connection:statechange
  (function () {
    var _navWidget = null;

    document.addEventListener("navbar:connect-ready", function (e) {
      if (e.detail.service !== "qvc") return;
      _navWidget = e.detail.widget;
      _navWidget.setStatus(_state);
    });

    document.addEventListener("connection:statechange", function (e) {
      if (_navWidget) _navWidget.setStatus(e.detail.state);
    });
  })();

  // ── Public API ─────────────────────────────────────────────────

  var api = {
    get state() { return _state; },
    get clientId() { return _clientId; },
    get socket() { return _socket; },

    connect: function (baseUrl) {
      _closeChannel();
      _healthFailures = 0;
      _baseUrl = baseUrl.replace(/\/+$/, "");
      _wantConnected = true;
      _doConnect();
    },

    disconnect: function () {
      _wantConnected = false;
      _closeChannel();
      if (_clientId && _baseUrl) {
        fetch(_baseUrl + "/disconnect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: _clientId }),
        }).catch(function () { /* best effort */ });
      }
      _clientId = null;
      if (_socket) {
        _socket.removeAllListeners();
        _socket = null;
        window.connectionSocket = null;
      }
      _setState(DISCONNECTED);
    },
  };

  return api;
})();
