/**
 * SiteContract — a tiny, dependency-free client for the shared backend API contract.
 *
 * Every backend (cv, nonogram, classifiers, qvc) implements the same conventions
 * (see docs/api-contract/CONTRACT.md):
 *   - GET /health            → { status, service, version, uptime_s, ... }
 *   - GET /api               → { service, version, endpoints[], streaming[] }  (discovery)
 *   - error envelope on 4xx/5xx → { error: { code, message, details? } }
 *
 * This module is the single chokepoint the portal uses to talk to backends: it
 * parses the error envelope, normalises /health for the status dots, probes /api
 * for sync-route capability, and polls /health on an interval. It mirrors the
 * parsing done by the live-HTTP contract tests each backend runs in its own repo.
 */

const DEFAULT_TIMEOUT = 5000;

export interface ContractError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ContractResult {
  ok: boolean;
  status: number;
  data: unknown;
  error: ContractError | null;
}

export interface HealthInfo {
  reachable: boolean;
  status: string;
  service: string | null;
  version: string | null;
  uptime_s: number | null;
  raw: unknown;
}

export type DotStatus = 'connected' | 'degraded' | 'error';

export interface DiscoveryManifest {
  service?: string;
  version?: string;
  endpoints?: unknown[];
  streaming?: unknown[];
}

export interface RequestOpts extends RequestInit {
  timeoutMs?: number;
}

export interface SiteContractApi {
  request(url: string, opts?: RequestOpts): Promise<ContractResult>;
  health(baseUrl: string, opts?: { timeoutMs?: number }): Promise<HealthInfo>;
  dotStatus(h: HealthInfo | null | undefined): DotStatus;
  discover(baseUrl: string, opts?: { timeoutMs?: number }): Promise<DiscoveryManifest | null>;
  hasSyncEndpoint(manifest: DiscoveryManifest | null, pathSuffix?: string): boolean;
  pollHealth(
    baseUrl: string,
    onStatus: (status: DotStatus | 'connecting', h: HealthInfo | null) => void,
    opts?: { intervalMs?: number; timeoutMs?: number },
  ): () => void;
  joinUrl(baseUrl: string, path: string): string;
}

function join(baseUrl: string, path: string): string {
  if (!baseUrl) return path;
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return base + path;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/**
 * fetch() wrapper that NEVER throws on HTTP status and always resolves to a
 * normalised result: { ok, status, data, error }.
 *   - 2xx           → { ok:true,  status, data:<parsed body>, error:null }
 *   - 4xx/5xx       → { ok:false, status, data, error:<envelope or synthesised> }
 *   - network/abort → { ok:false, status:0, data:null, error:{code:'network_error'|'timeout'} }
 */
function parseBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text; // non-JSON bodies are kept verbatim for callers to inspect
  }
}

/** The contract envelope when present, else one synthesised from the HTTP status. */
function errorEnvelope(res: Response, body: unknown): ContractError {
  if (isRecord(body) && isRecord(body.error)) {
    return body.error as unknown as ContractError;
  }
  return {
    code: 'http_' + String(res.status),
    message:
      (isRecord(body) && typeof body.message === 'string' && body.message) ||
      res.statusText ||
      'HTTP ' + String(res.status),
  };
}

async function request(url: string, opts: RequestOpts = {}): Promise<ContractResult> {
  const { timeoutMs = DEFAULT_TIMEOUT, ...fetchOpts } = opts;
  const controller = new AbortController();
  fetchOpts.signal = controller.signal;
  let timer: ReturnType<typeof setTimeout> | null = null;
  if (timeoutMs > 0) {
    timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
  }

  try {
    const res = await fetch(url, fetchOpts);
    if (timer) clearTimeout(timer);
    const body = parseBody(await res.text());
    if (res.ok) return { ok: true, status: res.status, data: body, error: null };
    return { ok: false, status: res.status, data: body, error: errorEnvelope(res, body) };
  } catch (e) {
    if (timer) clearTimeout(timer);
    const aborted = e instanceof DOMException && e.name === 'AbortError';
    return {
      ok: false,
      status: 0,
      data: null,
      error: {
        code: aborted ? 'timeout' : 'network_error',
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }
}

function normaliseHealth(r: ContractResult): HealthInfo {
  if (r.ok && isRecord(r.data)) {
    const d = r.data;
    return {
      reachable: true,
      status: typeof d.status === 'string' && d.status ? d.status : 'ok',
      service: typeof d.service === 'string' ? d.service : null,
      version: typeof d.version === 'string' ? d.version : null,
      uptime_s: typeof d.uptime_s === 'number' ? d.uptime_s : null,
      raw: d,
    };
  }
  return {
    reachable: false,
    status: r.error ? r.error.code : 'error',
    service: null,
    version: null,
    uptime_s: null,
    raw: r.data ?? null,
  };
}

/** GET <baseUrl>/health, normalised. Falls back to /api/health on 404 (cv exposes both). */
async function health(baseUrl: string, opts: { timeoutMs?: number } = {}): Promise<HealthInfo> {
  const timeoutMs = opts.timeoutMs ?? 4000;
  const r = await request(join(baseUrl, '/health'), { timeoutMs });
  if (!r.ok && r.status === 404) {
    return normaliseHealth(await request(join(baseUrl, '/api/health'), { timeoutMs }));
  }
  return normaliseHealth(r);
}

/** Map a normalised health result to a connect-modal dot status string. */
function dotStatus(h: HealthInfo | null | undefined): DotStatus {
  if (!h?.reachable) return 'error';
  if (h.status === 'degraded') return 'degraded';
  if (h.status === 'error') return 'error';
  return 'connected';
}

/** GET <baseUrl>/api discovery manifest, or null if unavailable. */
async function discover(
  baseUrl: string,
  opts: { timeoutMs?: number } = {},
): Promise<DiscoveryManifest | null> {
  const timeoutMs = opts.timeoutMs ?? 5000;
  const r = await request(join(baseUrl, '/api'), { timeoutMs });
  return r.ok && isRecord(r.data) ? r.data : null;
}

/**
 * Does the discovery manifest advertise a sync REST endpoint? With no pathSuffix,
 * matches any path ending in '/sync'.
 */
function hasSyncEndpoint(manifest: DiscoveryManifest | null, pathSuffix?: string): boolean {
  if (!manifest || !Array.isArray(manifest.endpoints)) return false;
  return manifest.endpoints.some((e) => {
    if (!isRecord(e) || typeof e.path !== 'string') return false;
    return pathSuffix ? e.path.includes(pathSuffix) : e.path.endsWith('/sync');
  });
}

/**
 * Poll <baseUrl>/health on an interval, invoking onStatus(dotStatusString, healthObj)
 * immediately ('connecting') and after each probe. Returns a stop() function.
 */
function pollHealth(
  baseUrl: string,
  onStatus: (status: DotStatus | 'connecting', h: HealthInfo | null) => void,
  opts: { intervalMs?: number; timeoutMs?: number } = {},
): () => void {
  const intervalMs = opts.intervalMs ?? 15000;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function emit(status: DotStatus | 'connecting', h: HealthInfo | null): void {
    try {
      onStatus(status, h);
    } catch {
      /* listener errors must not break the poll loop */
    }
  }

  function tick(): void {
    if (stopped) return;
    void health(baseUrl, { timeoutMs: opts.timeoutMs }).then((h) => {
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

export const SiteContract: SiteContractApi = {
  request,
  health,
  dotStatus,
  discover,
  hasSyncEndpoint,
  pollHealth,
  joinUrl: join,
};

window.SiteContract = SiteContract;
