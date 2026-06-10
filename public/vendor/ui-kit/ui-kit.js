/**
 * UI-KIT — Reusable UI behaviours.
 *
 * Exposes `window.UIKit` with opt-in initialisers for common interactive
 * patterns: theme toggle, drawer, dropdown, resize handle, and log terminal.
 * Nothing auto-initialises — the consumer calls what they need.
 *
 * Requires icons.js to be loaded first (provides UIKit.ICONS and UIKit.icon).
 *
 * Usage:
 *   <script src="ui-kit/icons.js"></script>
 *   <script src="ui-kit/ui-kit.js"></script>
 *   <script>
 *     UIKit.initThemeToggle(document.getElementById("theme-toggle"));
 *     UIKit.initDrawer(drawerEl, handleEl);
 *   </script>
 */
(function (root) {
  "use strict";

  var UIKit = root.UIKit || {};

  /** Shared theme storage key — must match theme-bootstrap.js. */
  UIKit.THEME_KEY = "sm-theme";

  // ═══════════════════════════════════════════════════════════════════════════
  // THEME TOGGLE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initialise a dark/light theme toggle button.
   *
   * @param {HTMLElement} el         - The toggle button element.
   * @param {Object}      [opts]
   * @param {string}      [opts.key]       - localStorage key (default: UIKit.THEME_KEY).
   * @param {string}      [opts.darkIcon]  - HTML for "switch to dark" icon.
   * @param {string}      [opts.lightIcon] - HTML for "switch to light" icon.
   * @returns {{ setTheme(t: string): void, destroy(): void }}
   */
  UIKit.initThemeToggle = function (el, opts) {
    opts = opts || {};
    // Backwards compat: accept string as second arg (legacy key param)
    if (typeof opts === "string") { opts = { key: opts }; }
    var key = opts.key || UIKit.THEME_KEY;
    var darkIcon  = opts.darkIcon  || (UIKit.ICONS && UIKit.ICONS.moon) || "";
    var lightIcon = opts.lightIcon || (UIKit.ICONS && UIKit.ICONS.sun)  || "";

    function apply(theme) {
      document.documentElement.dataset.theme = theme;
      el.innerHTML = theme === "light" ? darkIcon : lightIcon;
      el.setAttribute("aria-label",
        theme === "light" ? "Switch to dark mode" : "Switch to light mode");
    }

    function onClick() {
      var next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      apply(next);
      localStorage.setItem(key, next);
    }

    apply(localStorage.getItem(key) || document.documentElement.dataset.theme || "light");
    el.addEventListener("click", onClick);

    return {
      setTheme: apply,
      destroy: function () { el.removeEventListener("click", onClick); }
    };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // DRAWER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initialise a collapsible drawer (adds/removes `.open` class).
   *
   * @param {HTMLElement} drawerEl - The `.drawer` container.
   * @param {HTMLElement} handleEl - The `.side-handle` toggle button.
   * @returns {{ open(): void, close(): void, toggle(): void }}
   */
  UIKit.initDrawer = function (drawerEl, handleEl) {
    function open() {
      drawerEl.classList.add("open");
      handleEl.setAttribute("aria-expanded", "true");
    }
    function close() {
      drawerEl.classList.remove("open");
      handleEl.setAttribute("aria-expanded", "false");
    }
    function toggle() {
      drawerEl.classList.contains("open") ? close() : open();
    }

    handleEl.addEventListener("click", toggle);

    return {
      open: open,
      close: close,
      toggle: toggle,
      destroy: function () { handleEl.removeEventListener("click", toggle); }
    };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // DROPDOWN
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initialise a dropdown (toggle + click-outside-to-close).
   *
   * @param {HTMLElement} triggerEl - The button that toggles the menu.
   * @param {HTMLElement} menuEl   - The `.ui-dropdown` container.
   * @returns {{ open(): void, close(): void }}
   */
  UIKit.initDropdown = function (triggerEl, menuEl) {
    function open() {
      menuEl.classList.remove("hidden");
      triggerEl.setAttribute("aria-expanded", "true");
    }
    function close() {
      menuEl.classList.add("hidden");
      triggerEl.setAttribute("aria-expanded", "false");
    }

    function onTrigger(e) {
      e.stopPropagation();
      menuEl.classList.contains("hidden") ? open() : close();
    }
    function onOutside(e) {
      if (!menuEl.contains(e.target) && e.target !== triggerEl) {
        close();
      }
    }

    function onKeydown(e) {
      var isOpen = !menuEl.classList.contains("hidden");
      if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        open();
        var first = menuEl.querySelector(".ui-dropdown-item");
        if (first) first.focus();
        return;
      }
      if (!isOpen) return;

      var items = Array.prototype.slice.call(menuEl.querySelectorAll(".ui-dropdown-item"));
      if (items.length === 0) return;
      var idx = items.indexOf(document.activeElement);

      if (e.key === "Escape") {
        e.preventDefault();
        close();
        triggerEl.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        var next = idx < items.length - 1 ? idx + 1 : 0;
        items[next].focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        var prev = idx > 0 ? idx - 1 : items.length - 1;
        items[prev].focus();
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (idx !== -1) items[idx].click();
        close();
        triggerEl.focus();
      }
    }

    // Set ARIA roles for accessibility
    menuEl.setAttribute("role", "listbox");
    var items = Array.prototype.slice.call(menuEl.querySelectorAll(".ui-dropdown-item"));
    items.forEach(function (item) { item.setAttribute("role", "option"); });

    triggerEl.addEventListener("click", onTrigger);
    triggerEl.addEventListener("keydown", onKeydown);
    menuEl.addEventListener("keydown", onKeydown);
    document.addEventListener("click", onOutside);

    return {
      open: open,
      close: close,
      destroy: function () {
        triggerEl.removeEventListener("click", onTrigger);
        triggerEl.removeEventListener("keydown", onKeydown);
        menuEl.removeEventListener("keydown", onKeydown);
        document.removeEventListener("click", onOutside);
      }
    };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // MODAL (focus trap)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initialise a modal with a focus trap so Tab/Shift+Tab cycle within it.
   *
   * @param {HTMLElement} el - The modal container element.
   */
  UIKit.initModal = function (el) {
    var focusable = el.querySelectorAll('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ESCAPE KEY
  // ═══════════════════════════════════════════════════════════════════════════

  var _escapeCallbacks = [];
  var _escapeListenerAttached = false;

  /**
   * Register a callback that fires when the Escape key is pressed.
   *
   * @param {function(): void} callback
   * @returns {function(): void} Unsubscribe function.
   */
  UIKit.onEscape = function (callback) {
    if (!_escapeListenerAttached) {
      document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;
        for (var i = 0; i < _escapeCallbacks.length; i++) {
          _escapeCallbacks[i]();
        }
      });
      _escapeListenerAttached = true;
    }
    _escapeCallbacks.push(callback);
    return function () {
      var idx = _escapeCallbacks.indexOf(callback);
      if (idx !== -1) _escapeCallbacks.splice(idx, 1);
    };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RESIZE HANDLE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initialise a drag-to-resize handle for a split layout.
   *
   * @param {HTMLElement} handleEl    - The `.resize-handle` element.
   * @param {HTMLElement} targetEl    - The element whose width is adjusted.
   * @param {HTMLElement} containerEl - The parent flex container.
   * @param {Object}      [opts]
   * @param {number}      [opts.min=180]     - Minimum width in px.
   * @param {number}      [opts.max]         - Maximum width (defaults to container - min).
   * @param {number}      [opts.default=300] - Default width if nothing persisted.
   * @param {string}      [opts.key]         - localStorage key for persistence.
   */
  UIKit.initResize = function (handleEl, targetEl, containerEl, opts) {
    opts = opts || {};
    var min = opts.min || 180;
    var def = opts["default"] || 300;
    var storageKey = opts.key || null;

    // Restore persisted width
    if (storageKey) {
      var saved = parseInt(localStorage.getItem(storageKey));
      targetEl.style.width = (!isNaN(saved) ? saved : def) + "px";
    } else {
      targetEl.style.width = def + "px";
    }

    handleEl.addEventListener("mousedown", function (e) {
      e.preventDefault();
      document.body.classList.add("resize-dragging");
      handleEl.classList.add("dragging");
      var startX = e.clientX;
      var startW = targetEl.getBoundingClientRect().width;

      function onMove(e) {
        var bounds = containerEl.getBoundingClientRect();
        var maxW = opts.max || (bounds.width - min);
        var newW = Math.max(min, Math.min(maxW, startW + (e.clientX - startX)));
        targetEl.style.width = newW + "px";
        if (storageKey) localStorage.setItem(storageKey, Math.round(newW));
      }
      function onUp() {
        handleEl.classList.remove("dragging");
        document.body.classList.remove("resize-dragging");
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // LOG TERMINAL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a log appender for a `.log-terminal` element.
   *
   * @param {HTMLElement} terminalEl   - The `.log-terminal` container.
   * @param {number}      [max=200]    - Maximum retained entries.
   * @returns {function(msg: string, level?: string): void}
   */
  UIKit.createLogger = function (terminalEl, max) {
    max = max || 200;

    return function addLog(msg, level) {
      var time  = new Date().toTimeString().slice(0, 8);
      var entry = document.createElement("div");
      entry.className = "log-entry";
      var t = document.createElement("span");
      t.className   = "log-time";
      t.textContent = time;
      var m = document.createElement("span");
      m.className   = "log-msg" + (level ? " log-" + level : "");
      m.textContent = msg;
      entry.appendChild(t);
      entry.appendChild(m);
      terminalEl.appendChild(entry);
      while (terminalEl.children.length > max) terminalEl.removeChild(terminalEl.firstChild);
      terminalEl.scrollTop = terminalEl.scrollHeight;
    };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // TOAST
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Show a toast notification.
   *
   * @param {string}  message          - Text to display.
   * @param {Object}  [opts]
   * @param {string}  [opts.type]      - "success", "warn", or "error".
   * @param {number}  [opts.duration=3000] - Auto-dismiss in ms (0 = manual).
   * @param {string}  [opts.container] - Selector for the container (default: auto-created).
   * @returns {HTMLElement} The toast element.
   */
  UIKit.toast = function (message, opts) {
    opts = opts || {};
    var duration = opts.duration !== undefined ? opts.duration : 3000;

    // Find or create container
    var container = document.querySelector(".ui-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "ui-toast-container";
      container.setAttribute("role", "status");
      container.setAttribute("aria-live", "polite");
      document.body.appendChild(container);
    }

    var toast = document.createElement("div");
    toast.className = "ui-toast" + (opts.type ? " ui-toast-" + opts.type : "");
    toast.textContent = message;
    container.appendChild(toast);

    // Trigger reflow then add visible class for animation
    toast.offsetHeight; // force reflow
    toast.classList.add("visible");

    if (duration > 0) {
      setTimeout(function () { UIKit.dismissToast(toast); }, duration);
    }
    return toast;
  };

  /**
   * Dismiss a toast element.
   * @param {HTMLElement} toast
   */
  UIKit.dismissToast = function (toast) {
    toast.classList.remove("visible");
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // FADE-IN (Intersection Observer)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Observe `.ui-fade-in` elements and add `.visible` when they scroll into view.
   *
   * @param {string|HTMLElement} [scope=document] - Scope selector or element.
   * @param {Object} [opts]
   * @param {number} [opts.threshold=0.15] - Intersection threshold.
   */
  UIKit.initFadeIn = function (scope, opts) {
    opts = opts || {};
    var root = typeof scope === "string" ? document.querySelector(scope) : (scope || document);
    var threshold = opts.threshold || 0.15;

    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          entries[i].target.classList.add("visible");
          observer.unobserve(entries[i].target);
        }
      }
    }, { threshold: threshold });

    var els = root.querySelectorAll(".ui-fade-in");
    for (var i = 0; i < els.length; i++) {
      observer.observe(els[i]);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CONNECT WIDGET
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initialise a server-connect widget (host:port form with status dot).
   *
   * Reads/writes the URL via ServiceConfig (if available) and calls
   * `opts.onConnect(url)` when the user clicks Connect.
   *
   * @param {HTMLElement} el     - Container element (gets `.ui-connect` class).
   * @param {Object}      opts
   * @param {string}      opts.service       - ServiceConfig key (e.g. "nonogram").
   * @param {string}      [opts.defaultHost] - Default host (e.g. "localhost").
   * @param {number}      [opts.defaultPort] - Default port (e.g. 5055).
   * @param {string}      [opts.label]       - Label text (default: "Server").
   * @param {Function}    [opts.onConnect]   - Called with { host, port, url } on connect.
   * @returns {{ getUrl(): string, setStatus(s: string, msg?: string): void, destroy(): void }}
   */
  UIKit.initConnect = function (el, opts) {
    opts = opts || {};
    var service     = opts.service || "";
    var label       = opts.label || "Server";
    var defaultHost = opts.defaultHost || "localhost";
    var defaultPort = opts.defaultPort || 8080;

    // Parse existing ServiceConfig value if available
    var stored = "";
    if (root.ServiceConfig && service) {
      stored = root.ServiceConfig.get(service, "");
    }
    var initHost = defaultHost;
    var initPort = defaultPort;
    if (stored) {
      try {
        var u = new URL(stored);
        initHost = u.hostname || defaultHost;
        initPort = parseInt(u.port) || defaultPort;
      } catch (_) {}
    }

    el.classList.add("ui-connect");
    el.innerHTML =
      '<div class="ui-connect-row">' +
        '<span class="ui-connect-label">' + label + '</span>' +
        '<div class="ui-connect-inputs">' +
          '<input type="text" class="ui-connect-host" placeholder="' + defaultHost + '" value="' + initHost + '" spellcheck="false" autocomplete="off">' +
          '<span class="ui-connect-colon">:</span>' +
          '<input type="number" class="ui-connect-port" placeholder="' + defaultPort + '" value="' + initPort + '" min="1" max="65535">' +
        '</div>' +
        '<button type="button" class="ui-connect-btn">Connect</button>' +
      '</div>' +
      '<div class="ui-connect-row ui-connect-status">' +
        '<span class="ui-connect-dot" data-state="idle"></span>' +
        '<span class="ui-connect-state">Not connected</span>' +
      '</div>';

    var hostInput = el.querySelector(".ui-connect-host");
    var portInput = el.querySelector(".ui-connect-port");
    var btn       = el.querySelector(".ui-connect-btn");
    var dot       = el.querySelector(".ui-connect-dot");
    var stateEl   = el.querySelector(".ui-connect-state");

    function buildUrl() {
      var h = hostInput.value.trim() || defaultHost;
      var p = parseInt(portInput.value) || defaultPort;
      var protocol = (opts.protocol || "http") + "://";
      return protocol + h + ":" + p;
    }

    function onClick() {
      var url = buildUrl();
      if (root.ServiceConfig && service) {
        root.ServiceConfig.set(service, url);
      }
      if (opts.onConnect) {
        opts.onConnect({
          host: hostInput.value.trim() || defaultHost,
          port: parseInt(portInput.value) || defaultPort,
          url: url
        });
      }
    }

    btn.addEventListener("click", onClick);

    function onKey(e) { if (e.key === "Enter") { e.preventDefault(); onClick(); } }
    hostInput.addEventListener("keydown", onKey);
    portInput.addEventListener("keydown", onKey);

    var STATUS_MAP = {
      connected:    { dot: "connected",    text: "Connected",     btnCls: true  },
      connecting:   { dot: "connecting",   text: "Connecting\u2026", btnCls: false },
      disconnected: { dot: "disconnected", text: "Disconnected",  btnCls: false },
      error:        { dot: "disconnected", text: "Error",         btnCls: false },
      idle:         { dot: "idle",         text: "Not connected", btnCls: false },
    };

    return {
      getUrl: buildUrl,
      setStatus: function (status, message) {
        var s = STATUS_MAP[status] || STATUS_MAP.idle;
        dot.dataset.state = s.dot;
        stateEl.textContent = message || s.text;
        btn.classList.toggle("connected", s.btnCls);
        btn.textContent = s.btnCls ? "Connected" : "Connect";
      },
      destroy: function () {
        btn.removeEventListener("click", onClick);
        hostInput.removeEventListener("keydown", onKey);
        portInput.removeEventListener("keydown", onKey);
      }
    };
  };

  // ═══════════════════════════════════════════════════════════════════════════

  root.UIKit = UIKit;

})(window);
