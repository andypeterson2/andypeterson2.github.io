/**
 * @file SSE (Server-Sent Events) stream consumer utility.
 *
 * Provides a reusable function for POST-ing to an SSE endpoint and dispatching
 * parsed events to typed callbacks.  This decouples the streaming transport
 * from any specific business logic (training, evaluation, ablation).
 *
 * @example
 *   await consumeSSE("/d/mnist/train", body,
 *     msg   => log(msg),
 *     event => handleDone(event),
 *     err   => showError(err),
 *   );
 */
"use strict";

/** Per-chunk read timeout (ms).  If no data arrives within this window the
 *  stream is considered dead and an error is raised. */
var _SSE_READ_TIMEOUT = 300000; // 5 minutes — training batches can be slow

/**
 * Race a reader.read() against a timeout.
 * @param {ReadableStreamDefaultReader} reader
 * @param {number} ms
 * @returns {Promise<ReadableStreamReadResult>}
 */
function _readWithTimeout(reader, ms) {
  return new Promise(function (resolve, reject) {
    var timer = setTimeout(function () {
      reader.cancel();
      reject(new Error("SSE read timed out after " + ms + " ms"));
    }, ms);
    reader.read().then(
      function (result) { clearTimeout(timer); resolve(result); },
      function (err)    { clearTimeout(timer); reject(err); }
    );
  });
}

/**
 * POST to an SSE endpoint and dispatch parsed events.
 *
 * Uses {@link apiFetch} (from connection.js) when available so that
 * requests fail fast when the backend is unreachable.
 *
 * @param {string}   url      - Endpoint URL.
 * @param {Object}   body     - JSON request body.
 * @param {Function} onStatus - Called for each "status" or structured event.
 * @param {Function} onDone   - Called once when a "done" event arrives.
 * @param {Function} onError  - Called once when an "error" event arrives.
 */
async function consumeSSE(url, body, onStatus, onDone, onError, syncUrl) {
  var _fetch = typeof apiFetch === "function" ? apiFetch : fetch;
  var res;
  try {
    res = await _fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
  } catch (e) {
    onError(e.message || "Failed to connect");
    return;
  }
  if (!res.ok) {
    // Surface the contract error envelope { error: { code, message } }, or fall back to
    // the synchronous REST route when one is provided.
    const errBody = await res.json().catch(() => null);
    const env = errBody && errBody.error;
    const msg = env && typeof env === "object"
      ? (env.code ? env.code + ": " : "") + (env.message || "request failed")
      : (errBody && errBody.error) || res.statusText || "HTTP " + res.status;
    if (syncUrl) { await _consumeSync(syncUrl, body, onStatus, onDone, onError, msg); return; }
    onError(msg);
    return;
  }
  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let doneSeen = false;
  try {
    while (true) {
      const { value, done } = await _readWithTimeout(reader, _SSE_READ_TIMEOUT);
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop();
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;
        const json = line.slice(5).trim();
        if (!json) continue;
        const event = JSON.parse(json);
        if      (event.type === "status")  onStatus(event.msg);
        else if (event.type === "done")    { doneSeen = true; onDone(event); }
        else if (event.type === "error")   onError(event.msg);
        else if (event.type === "history" || event.type === "ablation_result") onStatus(event);
      }
    }
  } catch (e) {
    // Stream died mid-flight: if no 'done' arrived and a sync route exists, finish synchronously.
    if (syncUrl && !doneSeen) { await _consumeSync(syncUrl, body, onStatus, onDone, onError, e.message); return; }
    onError(e.message || "Stream error");
  }
}

/**
 * Fallback for {@link consumeSSE}: run the operation via its synchronous REST route and
 * deliver the result to onDone. The sync response shape matches the SSE "done" payload.
 *
 * @param {string}   syncUrl - The /...sync REST endpoint.
 * @param {Object}   body    - Same JSON body the stream would have used.
 * @param {Function} onStatus
 * @param {Function} onDone
 * @param {Function} onError
 * @param {string}   [reason] - Why the stream was unavailable (shown to the user).
 */
async function _consumeSync(syncUrl, body, onStatus, onDone, onError, reason) {
  if (!(window.SiteContract && window.SiteContract.request)) {
    onError(reason || "Live stream unavailable");
    return;
  }
  onStatus("Live updates unavailable" + (reason ? " (" + reason + ")" : "") + " — running synchronously…");
  const r = await window.SiteContract.request(syncUrl, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
    timeoutMs: 0,
  });
  if (r.ok) onDone(r.data);
  else onError((r.error.code ? r.error.code + ": " : "") + r.error.message);
}
