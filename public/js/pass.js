/**
 * SitePass — client-side handling of a recruiter pass (?pass=<token>).
 *
 * A pass (minted by the owner — see the gateway's POST /gate/pass) unlocks the
 * LIVE tier of a demo-first app: it routes the app's backend calls through the
 * gateway (api.andypeterson.dev/<service>) and attaches the pass as a Bearer
 * token. Without a pass the app stays on its free, in-browser tier. On ANY
 * live-call failure (expired / invalid / over-quota / backend asleep-and-down)
 * the app falls back to that free tier — a pass only ever ADDS capability, it
 * never breaks the page.
 *
 * On load: read ?pass=, keep it in sessionStorage (so it survives in-app
 * navigation), and strip it from the visible URL so the token is not shown or
 * bookmarked. Exposes window.SitePass. Loaded same-origin, before the apps.
 */
(function () {
  'use strict';

  var GATEWAY = 'https://api.andypeterson.dev'; // the single API front door
  var KEY = 'site-pass';

  // ── Read + persist the pass, then scrub it from the URL ──
  try {
    var params = new URLSearchParams(location.search);
    var fromUrl = params.get('pass');
    if (fromUrl) {
      sessionStorage.setItem(KEY, fromUrl);
      params.delete('pass');
      var qs = params.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
    }
  } catch (_e) {
    /* private-mode storage / history quirks — degrade to no pass */
  }

  function token() {
    try {
      return sessionStorage.getItem(KEY) || null;
    } catch (_e) {
      return null;
    }
  }
  function active() {
    return !!token();
  }

  // ── Attach the Bearer to cross-origin backend calls while a pass is held ──
  // One interception point covers every transport that goes through fetch
  // (SiteContract, the apps' raw fetch, Socket.IO's polling handshake). Same-
  // origin fetches (model weights, page assets) are left untouched.
  var _fetch = window.fetch;
  if (typeof _fetch === 'function') {
    window.fetch = function (input, init) {
      if (active()) {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        var cross = false;
        try {
          cross = new URL(url, location.href).origin !== location.origin;
        } catch (_e) {
          /* opaque input — treat as same-origin, no header */
        }
        if (cross) {
          init = init ? Object.assign({}, init) : {};
          var h = new Headers(
            init.headers || (typeof input !== 'string' && input && input.headers) || {},
          );
          if (!h.has('Authorization')) h.set('Authorization', 'Bearer ' + token());
          init.headers = h;
        }
      }
      return _fetch.call(this, input, init);
    };
  }

  // ── With a pass, activate the live tier: point the app at the gateway ──
  // Dispatches the same navbar:connect the connect modal uses, so the app's
  // existing connected path runs — now through the gateway, with the Bearer.
  function activateLive() {
    if (!active()) return;
    var meta = document.querySelector('meta[name="site-backend"]');
    var service = meta && meta.getAttribute('content');
    if (!service) return;
    document.dispatchEvent(
      new CustomEvent('navbar:connect', {
        detail: { service: service, url: GATEWAY + '/' + service },
      }),
    );
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(activateLive, 0); // after the apps have registered their listeners
    });
  } else {
    setTimeout(activateLive, 0);
  }

  window.SitePass = {
    token: token,
    active: active,
    gatewayBase: function (service) {
      return GATEWAY + '/' + service;
    },
    clear: function () {
      try {
        sessionStorage.removeItem(KEY);
      } catch (_e) {
        /* ignore */
      }
    },
  };
})();
