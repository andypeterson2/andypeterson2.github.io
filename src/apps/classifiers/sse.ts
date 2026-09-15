/**
 * SSE (Server-Sent Events) stream consumer utility.
 *
 * POSTs to an SSE endpoint and dispatches parsed events to typed callbacks,
 * decoupling the streaming transport from any specific business logic
 * (training, evaluation, ablation). When a `syncUrl` is given and the server has
 * no streaming route (404/405/501), the synchronous REST route runs instead; its
 * response shape matches the SSE "done" payload. Any other failure is reported,
 * never retried: a second POST starts a second training job and spends pass quota.
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

/** Statuses meaning the streaming route doesn't exist, so nothing has started. */
const NO_STREAM_ROUTE = new Set([404, 405, 501]);

/**
 * Split buffered SSE text into the JSON payloads of its complete frames, returning
 * the unfinished tail to keep buffering. Comment lines (`: keepalive`) are skipped.
 */
export function parseSseFrames(buffer: string): { events: unknown[]; rest: string } {
  const frames = buffer.split('\n\n');
  const rest = frames.pop() ?? '';
  const events: unknown[] = [];
  for (const frame of frames) {
    const data = frame
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n');
    if (data) events.push(JSON.parse(data));
  }
  return { events, rest };
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
    const { events, rest } = parseSseFrames(buf + decoder.decode(value, { stream: true }));
    buf = rest;
    for (const event of events) if (isRecord(event)) dispatchEvent(event, handlers);
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
    const msg = await errorMessage(res);
    if (handlers.syncUrl && NO_STREAM_ROUTE.has(res.status))
      return consumeSync(handlers.syncUrl, body, handlers, msg);
    handlers.onError(msg);
    return;
  }
  try {
    await pumpStream(res, handlers);
  } catch (e) {
    // The job may still be running server-side, so say so instead of posting it again.
    const reason = e instanceof Error ? e.message : String(e);
    handlers.onError((reason || 'Stream error') + ' (the server may still finish the job)');
  }
}
