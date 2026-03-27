/* QVC Server Dashboard — logic only (HTML lives in server.astro) */
(function () {
  'use strict';

  var _baseUrl = '';  // Set when connected via navbar
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
    // Kick off initial fetch to verify connection
    refreshStatus().then(function() {
      if (_navWidget) _navWidget.setStatus('connected');
      refreshEvents(); refreshUsers(); refreshLogs();
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

  // ── Shutdown ──
  document.getElementById('shutdown-btn').addEventListener('click', function () {
    if (!confirm('Shut down the QVC server?')) return;
    apiPost('/admin/shutdown')
      .then(function ()  { document.getElementById('topbar-error').textContent = 'Server shutting down\u2026'; })
      .catch(function (e){ document.getElementById('topbar-error').textContent = 'Shutdown failed: ' + e.message; });
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
  function logClass(line) {
    if (/\(ERROR\)|ERROR/.test(line))     return 'log-error';
    if (/\(WARNING\)|WARNING/.test(line)) return 'log-warning';
    if (/\(DEBUG\)/.test(line))           return 'log-debug';
    return 'log-info';
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
  function apiPost(path) {
    if (!_baseUrl) return Promise.reject(new Error('Not connected'));
    return fetch(_baseUrl + path, { method: 'POST' }).then(function (r) {
      if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
      return r.json();
    });
  }

  // ── Status + config ──
  function refreshStatus() {
    return apiFetch('/admin/status').then(function (d) {
      showError('topbar-error', '');
      document.getElementById('c-uptime').textContent = formatUptime(d.uptime_seconds);
      document.getElementById('c-state').textContent  = d.api_state;
      document.getElementById('c-users').textContent  = d.user_count;
      document.getElementById('c-calls').textContent  = d.call_count != null ? d.call_count : 0;
      if (d.config) {
        document.getElementById('cfg-ip').textContent   = d.config.local_ip       || '\u2014';
        document.getElementById('cfg-rest').textContent = d.config.rest_port      || '\u2014';
        document.getElementById('cfg-ws').textContent   = d.config.websocket_port || '\u2014';
      }
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
          + '<td class="mono">' + esc(new Date(ev.timestamp).toLocaleTimeString()) + '</td>'
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

  // ── Users ──
  function refreshUsers() {
    apiFetch('/admin/users').then(function (d) {
      showError('users-error', '');
      var entries = Object.keys(d.users).map(function (id) { return [id, d.users[id]]; });
      if (!entries.length) {
        document.getElementById('users-container').innerHTML = '<p class="empty">No users connected.</p>';
        return;
      }
      var rows = entries.map(function (pair) {
        var id = pair[0], u = pair[1], safeId = esc(id);
        return '<tr>'
          + '<td class="mono">' + safeId + '</td>'
          + '<td class="mono">' + esc(u.api_endpoint) + '</td>'
          + '<td><span class="' + badgeClass(u.state) + '">' + esc(u.state) + '</span></td>'
          + '<td class="mono">' + (u.peer ? esc(u.peer) : '\u2014') + '</td>'
          + '<td>'
          + '<button type="button" class="btn btn-warn" onclick="window._qvcDashboard.disconnect(\'' + safeId + '\')"'
          + (u.peer ? '' : ' disabled') + '>Disconnect</button>'
          + '<button type="button" class="btn btn-danger" onclick="window._qvcDashboard.remove(\'' + safeId + '\')">Remove</button>'
          + '</td></tr>';
      }).join('');
      document.getElementById('users-container').innerHTML =
        '<table aria-label="Connected users"><thead><tr>'
        + '<th>ID</th><th>Endpoint</th><th>State</th><th>Peer</th><th>Actions</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table>';
    }).catch(function (e) { showError('users-error', e.message); });
  }

  // Expose action handlers for inline onclick
  window._qvcDashboard = {
    disconnect: function (id) {
      apiPost('/admin/disconnect/' + id).then(refreshUsers)
        .catch(function (e) { showError('users-error', 'Disconnect failed: ' + e.message); });
    },
    remove: function (id) {
      apiPost('/admin/remove/' + id).then(refreshUsers)
        .catch(function (e) { showError('users-error', 'Remove failed: ' + e.message); });
    }
  };

  // ── Logs ──
  var _logAutoScroll = true;
  var logEl = document.getElementById('log-viewer');

  logEl.addEventListener('scroll', function () {
    _logAutoScroll = (logEl.scrollTop + logEl.clientHeight) >= (logEl.scrollHeight - 10);
  }, { passive: true });

  function refreshLogs() {
    apiFetch('/admin/logs?lines=300').then(function (d) {
      showError('logs-error', '');
      document.getElementById('log-file').textContent = d.file ? d.file : '';
      if (!d.lines.length) {
        logEl.innerHTML = '<span class="log-debug">No log lines available.</span>';
        return;
      }
      logEl.innerHTML = d.lines.map(function (line) {
        return '<span class="' + logClass(line) + '">' + esc(line) + '\n</span>';
      }).join('');
      if (_logAutoScroll) logEl.scrollTop = logEl.scrollHeight;
    }).catch(function (e) { showError('logs-error', e.message); });
  }

  // ── Polling (started on connect, paused on tab hide) ──
  var statusId, eventsId, usersId, logsId;

  function startPolling() {
    stopPolling();
    statusId = setInterval(refreshStatus, 10000);
    eventsId = setInterval(refreshEvents, 10000);
    usersId  = setInterval(refreshUsers,  10000);
    logsId   = setInterval(refreshLogs,    5000);
  }

  function stopPolling() {
    clearInterval(statusId); clearInterval(eventsId);
    clearInterval(usersId);  clearInterval(logsId);
  }

  document.addEventListener('visibilitychange', function () {
    if (!_connected) return;
    if (document.hidden) {
      stopPolling();
    } else {
      refreshStatus(); refreshEvents(); refreshUsers(); refreshLogs();
      startPolling();
    }
  });
})();
