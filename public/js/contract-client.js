/**
 * SiteContract — a tiny, dependency-free client for the shared backend API contract.
 *
 * Every backend (cv, nonogram, classifiers, qvc) implements the same conventions
 * (see docs/api-contract/CONTRACT.md):
 *   - GET /health            → { status, service, version, uptime_s, ... }
 *   - GET /api               → { service, version, endpoints[], streaming[] }  (discovery)
 *   - error envelope on 4xx/5xx → { error: { code, message, details? } }
 *
 * This module is the single chokepoint the portal uses to talk to backends: it parses
 * the error envelope, normalises /health for the status dots, probes /api for sync-route
 * capability, and polls /health on an interval. It mirrors the parsing done by the
 * live-HTTP contract tests each backend runs in its own repo.
 *
 * Loaded same-origin from /js/contract-client.js (no CDN), so it is available in local
 * dev and the static build immediately. Exposes `window.SiteContract`.
 */
(function (root) {
  'use strict';

  var DEFAULT_TIMEOUT = 5000;

  function _join(baseUrl, path) {
    if (!baseUrl) return path;
    if (baseUrl.charAt(baseUrl.length - 1) === '/') baseUrl = baseUrl.slice(0, -1);
    return baseUrl + path;
  }

  /**
   * fetch() wrapper that NEVER throws on HTTP status and always resolves to a
   * normalised result: { ok, status, data, error }.
   *   - 2xx           → { ok:true,  status, data:<parsed body>, error:null }
   *   - 4xx/5xx       → { ok:false, status, data:<parsed body>, error:{code,message,details?} }
   *                     (error is the contract envelope when present, else a synthesised one)
   *   - network/abort → { ok:false, status:0, data:null, error:{code:'network_error'|'timeout'} }
   *
   * @param {string} url
   * @param {object} [opts] - fetch options plus optional { timeoutMs }.
   * @returns {Promise<{ok:boolean,status:number,data:any,error:?{code:string,message:string,details?:any}}>}
   */
  function request(url, opts) {
    opts = opts || {};
    var timeoutMs = opts.timeoutMs == null ? DEFAULT_TIMEOUT : opts.timeoutMs;
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = null;

    var fetchOpts = {};
    for (var k in opts) {
      if (Object.prototype.hasOwnProperty.call(opts, k) && k !== 'timeoutMs') fetchOpts[k] = opts[k];
    }
    if (controller) {
      fetchOpts.signal = controller.signal;
      if (timeoutMs > 0) {
        timer = setTimeout(function () {
          controller.abort();
        }, timeoutMs);
      }
    }

    return fetch(url, fetchOpts).then(
      function (res) {
        if (timer) clearTimeout(timer);
        return res.text().then(function (text) {
          var body = null;
          if (text) {
            try {
              body = JSON.parse(text);
            } catch (_e) {
              body = text;
            }
          }
          if (res.ok) {
            return { ok: true, status: res.status, data: body, error: null };
          }
          var envelope =
            body && typeof body === 'object' && body.error && typeof body.error === 'object'
              ? body.error
              : {
                  code: 'http_' + res.status,
                  message: (body && body.message) || res.statusText || 'HTTP ' + res.status,
                };
          return { ok: false, status: res.status, data: body, error: envelope };
        });
      },
      function (e) {
        if (timer) clearTimeout(timer);
        var aborted = e && e.name === 'AbortError';
        return {
          ok: false,
          status: 0,
          data: null,
          error: {
            code: aborted ? 'timeout' : 'network_error',
            message: e && e.message ? e.message : String(e),
          },
        };
      },
    );
  }

  function _normaliseHealth(r) {
    if (r.ok && r.data && typeof r.data === 'object') {
      return {
        reachable: true,
        status: r.data.status || 'ok',
        service: r.data.service || null,
        version: r.data.version || null,
        uptime_s: typeof r.data.uptime_s === 'number' ? r.data.uptime_s : null,
        raw: r.data,
      };
    }
    return {
      reachable: false,
      status: r.error ? r.error.code : 'error',
      service: null,
      version: null,
      uptime_s: null,
      raw: r.data || null,
    };
  }

  /**
   * GET <baseUrl>/health, normalised. Falls back to /api/health on 404 (cv exposes both).
   * @returns {Promise<{reachable:boolean,status:string,service:?string,version:?string,uptime_s:?number,raw:any}>}
   */
  function health(baseUrl, opts) {
    opts = opts || {};
    var timeoutMs = opts.timeoutMs == null ? 4000 : opts.timeoutMs;
    return request(_join(baseUrl, '/health'), { timeoutMs: timeoutMs }).then(function (r) {
      if (!r.ok && r.status === 404) {
        return request(_join(baseUrl, '/api/health'), { timeoutMs: timeoutMs }).then(_normaliseHealth);
      }
      return _normaliseHealth(r);
    });
  }

  /**
   * Map a normalised health result to a connect-modal dot status string
   * ('connected' | 'degraded' | 'error').
   */
  function dotStatus(h) {
    if (!h || !h.reachable) return 'error';
    if (h.status === 'degraded') return 'degraded';
    if (h.status === 'error') return 'error';
    return 'connected';
  }

  /**
   * GET <baseUrl>/api discovery manifest, or null if unavailable.
   * @returns {Promise<?{service:string,version:string,endpoints:Array,streaming:Array}>}
   */
  function discover(baseUrl, opts) {
    opts = opts || {};
    var timeoutMs = opts.timeoutMs == null ? 5000 : opts.timeoutMs;
    return request(_join(baseUrl, '/api'), { timeoutMs: timeoutMs }).then(function (r) {
      return r.ok && r.data && typeof r.data === 'object' ? r.data : null;
    });
  }

  /**
   * Does the discovery manifest advertise a sync REST endpoint? With no pathSuffix,
   * matches any path ending in '/sync'.
   */
  function hasSyncEndpoint(manifest, pathSuffix) {
    if (!manifest || !Array.isArray(manifest.endpoints)) return false;
    return manifest.endpoints.some(function (e) {
      if (!e || typeof e.path !== 'string') return false;
      return pathSuffix ? e.path.indexOf(pathSuffix) !== -1 : /\/sync$/.test(e.path);
    });
  }

  /**
   * Poll <baseUrl>/health on an interval, invoking onStatus(dotStatusString, healthObj)
   * immediately ('connecting') and after each probe. Returns a stop() function.
   */
  function pollHealth(baseUrl, onStatus, opts) {
    opts = opts || {};
    var intervalMs = opts.intervalMs || 15000;
    var stopped = false;
    var timer = null;

    function emit(status, h) {
      try {
        onStatus(status, h);
      } catch (_e) {
        /* listener errors must not break the poll loop */
      }
    }

    function tick() {
      if (stopped) return;
      health(baseUrl, { timeoutMs: opts.timeoutMs }).then(function (h) {
        if (stopped) return;
        emit(dotStatus(h), h);
        timer = setTimeout(tick, intervalMs);
      });
    }

    emit('connecting', null);
    tick();

    return function stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }

  root.SiteContract = {
    request: request,
    health: health,
    dotStatus: dotStatus,
    discover: discover,
    hasSyncEndpoint: hasSyncEndpoint,
    pollHealth: pollHealth,
    joinUrl: _join,
  };
})(window);
