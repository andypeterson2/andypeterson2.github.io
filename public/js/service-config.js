/**
 * Service configuration for the portal's app frontends.
 *
 * The portal talks to ONE fixed API origin — the gateway, a single front door
 * that proxies to the private app backends. Each app's base URL is
 * `<apiOrigin>/<app>`, where `apiOrigin` comes from `<meta name="site-api-origin">`
 * (the trusted default — the local gateway in dev, https://api.andypeterson.dev
 * in prod), overridable in dev only.
 *
 * Resolution for a service's base URL — `ServiceConfig.serviceBase(name)`:
 *   1. ?<name>=<url> or localStorage[name]  — a DIRECT backend (dev escape hatch)
 *   2. <apiOrigin>/<name>                    — the gateway (default)
 * `apiOrigin` = ?api=<origin> > localStorage['__api_origin'] > the <meta> default.
 *
 * SECURITY: every override is checked against an allowlist — only the trusted
 * meta origin, or a localhost origin WHEN the page itself is on localhost, is
 * accepted. A crafted `?api=https://evil` / `?<name>=https://evil` is rejected and
 * the trusted default is used instead. This closes the redirection surface where a
 * crafted link could repoint a trusted-domain frontend at an attacker backend.
 *
 * Usage:
 *   <script src="/js/service-config.js"></script>
 *   const base = ServiceConfig.serviceBase("nonogram");   // e.g. .../nonogram
 *
 * Exposes `window.ServiceConfig`.
 */
(function (root) {
  'use strict';

  var STORAGE_KEY = 'service-config';
  var _params = new URLSearchParams(root.location.search);
  var _stored = {};
  try {
    _stored = JSON.parse((root.localStorage && root.localStorage.getItem(STORAGE_KEY)) || '{}');
  } catch (_) {}

  function _save() {
    try { root.localStorage.setItem(STORAGE_KEY, JSON.stringify(_stored)); } catch (_) {}
  }

  function _normalise(url) {
    if (!url) return '';
    url = String(url).trim();
    if (!url) return '';
    if (url.endsWith('/')) url = url.slice(0, -1);
    if (!/^https?:\/\//.test(url)) url = 'https://' + url;
    return url;
  }

  function _originOf(url) {
    try { return new URL(url).origin; } catch (_) { return ''; }
  }

  // The trusted fixed API origin, from <meta name="site-api-origin">.
  function _metaApiOrigin() {
    if (typeof document === 'undefined') return '';
    var el = document.querySelector('meta[name="site-api-origin"]');
    return el ? _originOf(_normalise(el.getAttribute('content'))) : '';
  }

  var _hostname = (root.location && root.location.hostname) || '';
  var _isLocalhost = _hostname === 'localhost' || _hostname === '127.0.0.1';
  var LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

  // Allowlist: the trusted meta origin always; a localhost origin only when the
  // page itself is on localhost (dev). Everything else is rejected.
  function _allowed(url) {
    var origin = _originOf(_normalise(url));
    if (!origin) return false;
    if (origin === _metaApiOrigin()) return true;
    if (_isLocalhost && LOCALHOST_ORIGIN.test(origin)) return true;
    return false;
  }

  // Resolve the gateway API origin: ?api= > localStorage > the trusted meta default.
  function _apiOrigin() {
    var fromParam = _params.get('api');
    if (fromParam && _allowed(fromParam)) return _originOf(_normalise(fromParam));
    var stored = _stored.__api_origin;
    if (stored && _allowed(stored)) return _originOf(_normalise(stored));
    return _metaApiOrigin();
  }

  var ServiceConfig = {
    /**
     * The base URL an app should call for a named service.
     * Priority: an allowlisted per-service direct override (dev), else <apiOrigin>/<name>.
     */
    serviceBase: function (name) {
      var direct = _params.get(name) || _stored[name];
      if (direct && _allowed(direct)) return _normalise(direct);
      var origin = _apiOrigin();
      return origin ? origin + '/' + name : '';
    },

    /** The resolved gateway origin, with no service suffix. */
    apiOrigin: function () { return _apiOrigin(); },

    /** Back-compat: callers that passed a default now get the gateway resolution. */
    resolveBackend: function (name) { return this.serviceBase(name); },
    get: function (name) { return this.serviceBase(name); },

    /** Persist an allowlisted per-service direct override (dev). No-op if rejected. */
    set: function (name, url) {
      var n = _normalise(url);
      if (n && _allowed(n)) { _stored[name] = n; _save(); }
    },

    /** Persist an allowlisted gateway-origin override (dev). No-op if rejected. */
    setApiOrigin: function (url) {
      var n = _normalise(url);
      if (n && _allowed(n)) { _stored.__api_origin = _originOf(n); _save(); }
    },

    remove: function (name) { delete _stored[name]; _save(); },

    isConfigured: function (name) { return !!this.serviceBase(name); },

    getAll: function () {
      var out = {};
      for (var key in _stored) { if (key !== '__api_origin') out[key] = this.serviceBase(key); }
      return out;
    },
  };

  root.ServiceConfig = ServiceConfig;
})(typeof window !== 'undefined' ? window : this);
