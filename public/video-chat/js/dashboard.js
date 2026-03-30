/* QVC Server Dashboard — logic only (HTML lives in server.astro) */
(function () {
  'use strict';

  var _baseUrl = '';
  var _connected = false;
  var _navWidget = null;

  // ── Navbar integration ──
  document.addEventListener('navbar:connect-ready', function(e) {
    if (e.detail.service !== 'qvc-server') return;
    _navWidget = e.detail.widget;
  });

  document.addEventListener('navbar:connect', function(e) {
    if (e.detail.service !== 'qvc-server') return;
    _baseUrl = e.detail.url.replace(/\/+$/, '');
    _connected = true;
    if (_navWidget) _navWidget.setStatus('connecting');
    refreshStatus().then(function() {
      if (_navWidget) _navWidget.setStatus('connected');
      refreshEvents(); refreshRooms(); refreshPeers();
      startPolling();
    }).catch(function() {
      if (_navWidget) _navWidget.setStatus('error');
    });
  });

  document.addEventListener('navbar:disconnect', function(e) {
    if (e.detail.service !== 'qvc-server') return;
    _connected = false;
    _baseUrl = '';
    stopPolling();
    if (_navWidget) _navWidget.setStatus('idle');
    showError('topbar-error', 'Disconnected from server.');
  });

  // ── Helpers ──
  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function formatUptime(s) {
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm ' + sec + 's';
    return sec + 's';
  }
  function showError(id, msg) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = msg ? '<div class="error-msg">' + esc(msg) + '</div>' : '';
  }
  function badgeClass(val) { return 'badge badge-' + val.toLowerCase().replace(/\s/g, '_'); }

  // ── API ──
  function apiFetch(path) {
    if (!_baseUrl) return Promise.reject(new Error('Not connected'));
    return fetch(_baseUrl + path).then(function (r) {
      if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
      return r.json();
    });
  }

  // ── Status ──
  function refreshStatus() {
    return apiFetch('/admin/status').then(function (d) {
      showError('topbar-error', '');
      document.getElementById('c-uptime').textContent = formatUptime(d.uptime_seconds || 0);
      document.getElementById('c-state').textContent  = d.status;
      document.getElementById('c-rooms').textContent  = d.rooms;
      document.getElementById('c-peers').textContent  = d.peers;
    }).catch(function (e) {
      showError('topbar-error', 'Server unreachable: ' + e.message);
    });
  }

  // ── Events ──
  function refreshEvents() {
    apiFetch('/admin/events?limit=20').then(function (d) {
      showError('events-error', '');
      var events = d.events.slice().reverse();
      if (!events.length) {
        document.getElementById('events-container').innerHTML = '<p class="empty">No events yet.</p>';
        return;
      }
      var rows = events.map(function (ev) {
        var details = Object.keys(ev)
          .filter(function (k) { return k !== 'timestamp' && k !== 'event'; })
          .map(function (k) { return esc(k) + '=' + esc(String(ev[k])); })
          .join(', ');
        return '<tr>'
          + '<td class="mono">' + esc(new Date(ev.timestamp * 1000).toLocaleTimeString()) + '</td>'
          + '<td><span class="' + badgeClass(ev.event) + '">' + esc(ev.event) + '</span></td>'
          + '<td class="mono">' + details + '</td>'
          + '</tr>';
      }).join('');
      document.getElementById('events-container').innerHTML =
        '<table aria-label="Recent server events"><thead><tr>'
        + '<th scope="col">Time</th><th scope="col">Event</th><th scope="col">Details</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table>';
    }).catch(function (e) { showError('events-error', e.message); });
  }

  // ── Rooms ──
  function refreshRooms() {
    apiFetch('/admin/rooms').then(function (d) {
      showError('rooms-error', '');
      if (!d.rooms.length) {
        document.getElementById('rooms-container').innerHTML = '<p class="empty">No active rooms.</p>';
        return;
      }
      var rows = d.rooms.map(function (room) {
        return '<tr>'
          + '<td class="mono">' + esc(room.room_id) + '</td>'
          + '<td>' + room.peers.length + '/2</td>'
          + '<td><span class="' + (room.is_full ? 'badge badge-connected' : 'badge badge-idle') + '">'
            + (room.is_full ? 'Full' : 'Waiting') + '</span></td>'
          + '<td class="mono">' + room.peers.map(esc).join(', ') + '</td>'
          + '</tr>';
      }).join('');
      document.getElementById('rooms-container').innerHTML =
        '<table aria-label="Active rooms"><thead><tr>'
        + '<th>Room</th><th>Peers</th><th>Status</th><th>SIDs</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table>';
    }).catch(function (e) { showError('rooms-error', e.message); });
  }

  // ── Peers ──
  function refreshPeers() {
    apiFetch('/admin/peers').then(function (d) {
      showError('peers-error', '');
      if (!d.peers.length) {
        document.getElementById('peers-container').innerHTML = '<p class="empty">No connected peers.</p>';
        return;
      }
      var rows = d.peers.map(function (p) {
        return '<tr>'
          + '<td class="mono">' + esc(p.sid).slice(0, 12) + '</td>'
          + '<td class="mono">' + (p.room_id || '\u2014') + '</td>'
          + '<td class="mono">' + (p.peer ? esc(p.peer).slice(0, 12) : '\u2014') + '</td>'
          + '</tr>';
      }).join('');
      document.getElementById('peers-container').innerHTML =
        '<table aria-label="Connected peers"><thead><tr>'
        + '<th>SID</th><th>Room</th><th>Peer</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table>';
    }).catch(function (e) { showError('peers-error', e.message); });
  }

  // ── Polling ──
  var statusId, eventsId, roomsId, peersId;

  function startPolling() {
    stopPolling();
    statusId = setInterval(refreshStatus, 5000);
    eventsId = setInterval(refreshEvents, 5000);
    roomsId  = setInterval(refreshRooms,  5000);
    peersId  = setInterval(refreshPeers,  5000);
  }

  function stopPolling() {
    clearInterval(statusId); clearInterval(eventsId);
    clearInterval(roomsId);  clearInterval(peersId);
  }

  document.addEventListener('visibilitychange', function () {
    if (!_connected) return;
    if (document.hidden) {
      stopPolling();
    } else {
      refreshStatus(); refreshEvents(); refreshRooms(); refreshPeers();
      startPolling();
    }
  });
})();
