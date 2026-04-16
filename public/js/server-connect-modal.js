(function () {
  // ── Collect backend service definitions ──────────────────────────
  var backends = [];

  // New-style: <meta name="site-backend" content="svc" data-port="..." data-label="...">
  var newMetas = document.querySelectorAll('meta[name="site-backend"]');
  for (var i = 0; i < newMetas.length; i++) {
    var m = newMetas[i];
    var svc = m.getAttribute('content') || '';
    if (!svc) continue;
    backends.push({
      service: svc,
      port: parseInt(m.getAttribute('data-port') || '8080') || 8080,
      label: m.getAttribute('data-label') || 'Server',
    });
  }

  if (backends.length === 0) return;

  // ── Create one nav item + modal per backend ─────────────────────
  function createBackendUI(cfg) {
    var service = cfg.service;
    var defaultPort = cfg.port;
    var navLabel = cfg.label;

    var connState = { connected: false };
    var serverLi = null;
    var serverSubUl = null;
    var modalOverlay = null;
    var hostInput = null;
    var portInput = null;
    var widget = null;

    // Unique IDs to avoid collisions when multiple backends exist
    var uid = 'sn-' + service.replace(/[^a-z0-9]/gi, '-');

    function init() {
      var ul = document.querySelector('.site-menubar ul[role="menubar"]');
      if (!ul) return;

      serverLi = document.createElement('li');
      serverLi.setAttribute('role', 'menuitem');
      serverLi.setAttribute('aria-haspopup', 'false');
      serverLi.style.cursor = 'pointer';
      serverLi.className = 'server-nav-item';

      var label = document.createElement('span');
      label.textContent = navLabel;
      label.style.pointerEvents = 'none';
      serverLi.appendChild(label);

      var dot = document.createElement('span');
      dot.className = 'sn-dot';
      serverLi.appendChild(dot);

      serverSubUl = document.createElement('ul');
      serverSubUl.setAttribute('role', 'menu');
      serverSubUl.style.display = 'none';

      var reconnLi = document.createElement('li');
      reconnLi.setAttribute('role', 'menuitem');
      var reconnA = document.createElement('a');
      reconnA.href = '#';
      reconnA.textContent = 'Re-connect';
      reconnA.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        openModal();
      });
      reconnLi.appendChild(reconnA);
      serverSubUl.appendChild(reconnLi);

      var disconnLi = document.createElement('li');
      disconnLi.setAttribute('role', 'menuitem');
      var disconnA = document.createElement('a');
      disconnA.href = '#';
      disconnA.textContent = 'Disconnect';
      disconnA.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        doDisconnect();
      });
      disconnLi.appendChild(disconnA);
      serverSubUl.appendChild(disconnLi);

      serverLi.appendChild(serverSubUl);

      serverLi.addEventListener('click', function (e) {
        if (!connState.connected) {
          e.preventDefault();
          e.stopPropagation();
          openModal();
        }
      });

      ul.appendChild(serverLi);

      var mobileSelect = document.querySelector('.mobile-nav-select');
      if (mobileSelect) {
        var opt = document.createElement('option');
        opt.value = '__' + uid + '__';
        opt.textContent = navLabel + '...';
        mobileSelect.appendChild(opt);
        mobileSelect.addEventListener('change', function () {
          if (mobileSelect.value === '__' + uid + '__') {
            mobileSelect.value = '';
            openModal();
          }
        });
      }

      buildModal();
      dispatchReady();
    }

    function buildModal() {
      modalOverlay = document.createElement('div');
      modalOverlay.className = 'sn-modal-overlay';
      modalOverlay.style.display = 'none';

      var dialog = document.createElement('div');
      dialog.className = 'sn-modal';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-label', 'Connect to ' + navLabel.toLowerCase());

      var header = document.createElement('div');
      header.className = 'sn-modal-header';
      header.textContent = 'Connect to ' + navLabel;
      dialog.appendChild(header);

      var form = document.createElement('form');
      form.className = 'sn-connect-form';

      var hostRow = document.createElement('div');
      hostRow.className = 'sn-form-row';
      var hostLbl = document.createElement('label');
      hostLbl.setAttribute('for', uid + '-host');
      hostLbl.textContent = 'Host';
      var hostInp = document.createElement('input');
      hostInp.id = uid + '-host';
      hostInp.type = 'text';
      hostInp.placeholder = 'localhost';
      hostInp.value = 'localhost';
      hostInp.spellcheck = false;
      hostInp.autocomplete = 'off';
      hostRow.appendChild(hostLbl);
      hostRow.appendChild(hostInp);
      form.appendChild(hostRow);

      var portRow = document.createElement('div');
      portRow.className = 'sn-form-row';
      var portLbl = document.createElement('label');
      portLbl.setAttribute('for', uid + '-port');
      portLbl.textContent = 'Port';
      var portInp = document.createElement('input');
      portInp.id = uid + '-port';
      portInp.type = 'number';
      portInp.placeholder = String(defaultPort);
      portInp.value = String(defaultPort);
      portInp.min = '1';
      portInp.max = '65535';
      portRow.appendChild(portLbl);
      portRow.appendChild(portInp);
      form.appendChild(portRow);

      dialog.appendChild(form);

      var footer = document.createElement('div');
      footer.className = 'sn-modal-footer';
      var cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'sn-btn';
      cancelBtn.setAttribute('data-action', 'cancel');
      cancelBtn.textContent = 'Cancel';
      var connectBtn = document.createElement('button');
      connectBtn.type = 'button';
      connectBtn.className = 'sn-btn sn-btn-primary';
      connectBtn.setAttribute('data-action', 'connect');
      connectBtn.textContent = 'Connect';
      footer.appendChild(cancelBtn);
      footer.appendChild(connectBtn);
      dialog.appendChild(footer);

      modalOverlay.appendChild(dialog);
      document.body.appendChild(modalOverlay);

      hostInput = dialog.querySelector('#' + uid + '-host');
      portInput = dialog.querySelector('#' + uid + '-port');

      dialog.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);
      dialog.querySelector('[data-action="connect"]').addEventListener('click', doConnect);
      dialog.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault();
        doConnect();
      });
      modalOverlay.addEventListener('click', function (e) {
        if (e.target === modalOverlay) closeModal();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modalOverlay.style.display !== 'none') closeModal();
      });
    }

    function openModal() {
      if (!modalOverlay) return;
      modalOverlay.style.display = '';
      if (hostInput)
        setTimeout(function () {
          hostInput.focus();
          hostInput.select();
        }, 50);
    }

    function closeModal() {
      if (modalOverlay) modalOverlay.style.display = 'none';
      if (!connState.connected) {
        document.dispatchEvent(
          new CustomEvent('navbar:dismiss', { detail: { service: service } }),
        );
      }
    }

    function doConnect() {
      var host = hostInput ? hostInput.value.trim() || 'localhost' : 'localhost';
      var port = portInput ? parseInt(portInput.value) || defaultPort : defaultPort;
      var proto = location.protocol === 'https:' ? 'https://' : 'http://';
      var url = proto + host + ':' + port;
      connState.connected = true;
      updateNav();
      closeModal();
      document.dispatchEvent(
        new CustomEvent('navbar:connect', {
          detail: { service: service, host: host, port: port, url: url },
        }),
      );
    }

    function doDisconnect() {
      connState.connected = false;
      updateNav();
      document.dispatchEvent(
        new CustomEvent('navbar:disconnect', { detail: { service: service } }),
      );
      openModal();
    }

    function updateNav() {
      if (!serverLi) return;
      var dot = serverLi.querySelector('.sn-dot');
      var s = connState.status || 'idle';
      if (dot) {
        dot.className = 'sn-dot';
        if (s === 'connected') dot.classList.add('sn-green');
        else if (s === 'connecting' || s === 'degraded') dot.classList.add('sn-yellow');
        else if (s === 'disconnected' || s === 'error') dot.classList.add('sn-red');
        var statusLabels = { connected: 'Connected', connecting: 'Connecting', degraded: 'Degraded', disconnected: 'Disconnected', error: 'Error', idle: 'Idle' };
        dot.setAttribute('aria-label', (statusLabels[s] || 'Idle') + ' \u2014 ' + navLabel);
        dot.setAttribute('role', 'status');
      }
      if (connState.connected) {
        serverLi.setAttribute('aria-haspopup', 'true');
        if (serverSubUl) serverSubUl.style.display = '';
      } else {
        serverLi.setAttribute('aria-haspopup', 'false');
        if (serverSubUl) serverSubUl.style.display = 'none';
      }
    }

    function dispatchReady() {
      widget = {
        getUrl: function () {
          var h = hostInput ? hostInput.value.trim() || 'localhost' : 'localhost';
          var p = portInput ? parseInt(portInput.value) || defaultPort : defaultPort;
          var proto = location.protocol === 'https:' ? 'https://' : 'http://';
          return proto + h + ':' + p;
        },
        setStatus: function (status) {
          connState.status = status;
          if (status === 'connected' || status === 'degraded') connState.connected = true;
          else connState.connected = false;
          updateNav();
        },
      };
      document.dispatchEvent(
        new CustomEvent('navbar:connect-ready', { detail: { service: service, widget: widget } }),
      );
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  for (var i = 0; i < backends.length; i++) {
    createBackendUI(backends[i]);
  }
})();
