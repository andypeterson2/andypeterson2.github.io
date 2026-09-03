/**
 * UI-KIT — Reusable UI behaviours.
 *
 * Exposes `window.UIKit` with opt-in initialisers for common interactive
 * patterns: theme toggle, drawer, dropdown, resize handle, and log terminal.
 * Nothing auto-initialises — the consumer calls what they need.
 *
 * Requires icons.js to be loaded first (provides UIKit.ICONS).
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

    // eslint-disable-next-line sonarjs/cognitive-complexity -- grandfathered at 16: a flat key-dispatch for dropdown a11y
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

  root.UIKit = UIKit;

})(window);
