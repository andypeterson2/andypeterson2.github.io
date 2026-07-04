/**
 * Centralized API client for the CV editor frontend.
 * All methods return a Response object so callers can check .ok/.status.
 */

/* exported cvApi */
var cvApi = {
  _base: function () {
    return (typeof API_BASE !== 'undefined' ? API_BASE : '') + '/api';
  },

  get: function (path) {
    return fetch(this._base() + path, { credentials: 'include' });
  },

  post: function (path, body) {
    return fetch(this._base() + path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  put: function (path, body) {
    return fetch(this._base() + path, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  patch: function (path, body) {
    return fetch(this._base() + path, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  del: function (path) {
    return fetch(this._base() + path, { method: 'DELETE', credentials: 'include' });
  },

  /**
   * Check response and log error if not ok. Returns true if error occurred.
   * @param {Response} res
   * @param {string} context - Description for error log
   * @returns {boolean}
   */
  failed: function (res, context) {
    if (!res.ok) {
      console.error('API error: ' + context + ' (' + res.status + ')');
      return true;
    }
    return false;
  },
};
