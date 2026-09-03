/**
 * SSE (Server-Sent Events) stream consumer utility.
 *
 * POSTs to an SSE endpoint and dispatches parsed events to typed callbacks,
 * decoupling the streaming transport from any specific business logic
 * (training, evaluation, ablation). When a `syncUrl` is given, a failed or
 * mid-flight-dead stream falls back to the synchronous REST route, whose
 * response shape matches the SSE "done" payload.
 *
 * @example
 *   await consumeSSE(`${base()}/train`, body, {
 *     onStatus: (msg) => log(msg),
 *     onDone: (event) => handleDone(event),
 *     onError: (err) => showError(err),
 *     syncUrl: `${base()}/train/sync`,
 *   });
 */

import { SiteContract } from '../shared/contract-client';

/** Per-chunk read timeout (ms). If no data arrives within this window the
 *  stream is considered dead and an error is raised. */
const SSE_READ_TIMEOUT = 300000; // 5 minutes — training batches can be slow

/** A structured event passed through to onStatus (history / ablation_result). */
export type SseStructuredEvent = Record<string, unknown>;

export interface SseHandlers {
  /** Called for each "status" message or structured (history/ablation) event. */
  onStatus(msg: string | SseStructuredEvent): void;
  /** Called once when a "done" event arrives (or the sync fallback returns). */
  onDone(event: unknown): void;
  /** Called once when an "error" event arrives or the transport fails. */
  onError(msg: string): void;
  /** Synchronous REST fallback route (e.g. `${base}/train/sync`). */
  syncUrl?: string;
  /** Fetch implementation — the app passes its connection-aware apiFetch. */
  fetchImpl?: typeof fetch;
}

/** Race a reader.read() against a timeout. */
function readWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  ms: number,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      void reader.cancel();
      reject(new Error('SSE read timed out after ' + String(ms) + ' ms'));
    }, ms);
    reader.read().then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** "code: message" from the contract error envelope, or the best fallback. */
async function errorMessage(res: Response): Promise<string> {
  const errBody: unknown = await res.json().catch(() => null);
  const env = isRecord(errBody) ? errBody.error : undefined;
  if (isRecord(env)) {
    const code = typeof env.code === 'string' && env.code ? env.code + ': ' : '';
    const message = typeof env.message === 'string' && env.message ? env.message : 'request failed';
    return code + message;
  }
  if (typeof env === 'string' && env) return env;
  return res.statusText || 'HTTP ' + String(res.status);
}

/** Route one parsed SSE event to the handlers. */
function dispatchEvent(event: SseStructuredEvent, handlers: SseHandlers): void {
  switch (event.type) {
    case 'status':
      handlers.onStatus(typeof event.msg === 'string' ? event.msg : '');
      break;
    case 'done':
      handlers.onDone(event);
      break;
    case 'error':
      handlers.onError(typeof event.msg === 'string' ? event.msg : 'error');
      break;
    case 'history':
    case 'ablation_result':
      handlers.onStatus(event);
      break;
    default:
      break;
  }
}

/** Read the stream to completion, dispatching each event. */
async function pumpStream(res: Response, handlers: SseHandlers): Promise<void> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await readWithTimeout(reader, SSE_READ_TIMEOUT);
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop() ?? '';
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data:')) continue;
      const json = line.slice(5).trim();
      if (!json) continue;
      dispatchEvent(JSON.parse(json) as SseStructuredEvent, handlers);
    }
  }
}

/**
 * Fallback for {@link consumeSSE}: run the operation via its synchronous REST
 * route and deliver the result to onDone.
 *
 * @param reason - Why the stream was unavailable (shown to the user).
 */
async function consumeSync(
  syncUrl: string,
  body: unknown,
  handlers: SseHandlers,
  reason?: string,
): Promise<void> {
  handlers.onStatus(
    'Live updates unavailable' + (reason ? ' (' + reason + ')' : '') + ' — running synchronously…',
  );
  const r = await SiteContract.request(syncUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: 0,
  });
  if (r.ok) handlers.onDone(r.data);
  else if (r.error) handlers.onError((r.error.code ? r.error.code + ': ' : '') + r.error.message);
  else handlers.onError('request failed');
}

/** POST to an SSE endpoint and dispatch parsed events. */
export async function consumeSSE(url: string, body: unknown, handlers: SseHandlers): Promise<void> {
  const fetchImpl = handlers.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    handlers.onError(e instanceof Error && e.message ? e.message : 'Failed to connect');
    return;
  }
  if (!res.ok) {
    // Surface the contract error envelope { error: { code, message } }, or fall
    // back to the synchronous REST route when one is provided.
    const msg = await errorMessage(res);
    if (handlers.syncUrl) return consumeSync(handlers.syncUrl, body, handlers, msg);
    handlers.onError(msg);
    return;
  }
  // Track whether 'done' arrived so a stream that dies AFTER completing does
  // not re-run the operation through the sync fallback (a double onDone).
  // Boxed so the assignment inside onDone survives TS's control-flow narrowing.
  const done = { seen: false };
  const tracked: SseHandlers = {
    ...handlers,
    onDone(event) {
      done.seen = true;
      handlers.onDone(event);
    },
  };
  try {
    await pumpStream(res, tracked);
  } catch (e) {
    // Stream died mid-flight: if no 'done' arrived and a sync route exists,
    // finish synchronously.
    const reason = e instanceof Error ? e.message : String(e);
    if (handlers.syncUrl && !done.seen)
      return consumeSync(handlers.syncUrl, body, handlers, reason);
    handlers.onError(reason || 'Stream error');
  }
}
