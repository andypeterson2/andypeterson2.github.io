/**
 * Service Configuration for static-hosted frontends.
 *
 * When frontends are hosted on GitHub Pages (or any static host), they need
 * to know where their backend services are running.  This module provides a
 * unified way to read/write backend URLs via URL parameters and localStorage.
 *
 * Priority order:  URL parameter  >  localStorage  >  default
 *
 * Usage:
 *   <script src="shared-js/service-config.js"></script>
 *   <script>
 *     const base = ServiceConfig.get("nonogram", "http://localhost:5055");
 *     fetch(`${base}/api/grid`, ...);
 *   </script>
 *
 * URL parameter example:
 *   ?nonogram=192.168.1.10:5055
 *   ?nonogram=http://192.168.1.10:5055
 *
 * Exposes `window.ServiceConfig`.
 */
(function (root) {
  "use strict";

  var STORAGE_KEY = "service-config";
  var _params = new URLSearchParams(root.location.search);
  var _stored = {};
  try { _stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch (_) {}

  function _save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_stored));
  }

  function _normalise(url) {
    if (!url) return "";
    url = url.trim();
    if (!url) return "";
    // Strip trailing slash
    if (url.endsWith("/")) url = url.slice(0, -1);
    // Add protocol if missing
    if (!/^https?:\/\//.test(url)) url = "https://" + url;
    return url;
  }

  var ServiceConfig = {
    /**
     * Get the base URL for a named service.
     * @param {string} name         - Service key (e.g. "nonogram").
     * @param {string} defaultUrl   - Fallback if nothing is configured.
     * @returns {string} The base URL (no trailing slash).
     */
    get: function (name, defaultUrl) {
      var fromParam = _params.get(name);
      if (fromParam) {
        var url = _normalise(fromParam);
        if (url) return url;
      }
      if (_stored[name]) return _stored[name];
      return _normalise(defaultUrl) || "";
    },

    /**
     * Persist a service URL in localStorage.
     * @param {string} name - Service key.
     * @param {string} url  - Full URL (will be normalised).
     */
    set: function (name, url) {
      _stored[name] = _normalise(url);
      _save();
    },

    /**
     * Remove a persisted service URL.
     * @param {string} name - Service key.
     */
    remove: function (name) {
      delete _stored[name];
      _save();
    },

    /**
     * Check if a service URL is configured (via param or storage).
     * @param {string} name - Service key.
     * @returns {boolean}
     */
    isConfigured: function (name) {
      return !!(_params.get(name) || _stored[name]);
    },

    /**
     * Resolve a backend URL with support for the unified ?backend= param.
     * Priority: ?serviceName= > ?backend= > localStorage > default
     * @param {string} name       - Service key (e.g. "nonogram").
     * @param {string} defaultUrl - Fallback if nothing is configured.
     * @returns {string} The base URL (no trailing slash).
     */
    resolveBackend: function (name, defaultUrl) {
      // 1. Per-service URL param (?nonogram=host:port)
      var fromParam = _params.get(name);
      if (fromParam) {
        var url = _normalise(fromParam);
        if (url) return url;
      }
      // 2. Unified backend param (?backend=host:port)
      var backendParam = _params.get("backend");
      if (backendParam) {
        var url2 = _normalise(backendParam);
        if (url2) return url2;
      }
      // 3. localStorage
      if (_stored[name]) return _stored[name];
      // 4. Default
      return _normalise(defaultUrl) || "";
    },

    /**
     * Get all configured services.
     * @returns {Object<string, string>}
     */
    getAll: function () {
      var result = {};
      for (var key in _stored) result[key] = _stored[key];
      _params.forEach(function (val, key) {
        var url = _normalise(val);
        if (url) result[key] = url;
      });
      return result;
    },
  };

  root.ServiceConfig = ServiceConfig;
})(window);
