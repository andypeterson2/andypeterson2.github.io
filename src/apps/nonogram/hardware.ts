/**
 * The IBM hardware tier: ask for a job, then wait for it.
 *
 * Submitting and collecting are two calls because an IBM queue runs to minutes and
 * the backend has one solver thread — holding it through the wait would 409 everyone
 * else. The job id is the only thing that links them, so it is kept in sessionStorage:
 * a reload picks the run back up, and closing the tab lets it go.
 *
 * The header below only asks. The gateway decides whether this caller may spend
 * quantum credits and, if so, sets its own header for the backend to read.
 */
import { SiteContract, type ContractResult } from '../shared/contract-client';
import { clientId } from './state';
import { setStatus } from './ui';
import { track } from '../../telemetry';

/** The gateway reads this and replaces it with its own verdict. */
const REQUEST_HEADER = 'X-HW-Request';

/**
 * Largest grid a hardware run accepts, matching the backend's MAX_HW_CELLS.
 *
 * Transpiled depth climbs far faster than the grid: ~139 layers at 4 cells, ~907 at 6,
 * ~3,020 at 9, against the 100-200 layers an IBM Eagle or Heron device holds. Past six
 * the measurement is uniform noise, and the job still spends its share of a 10-minute
 * monthly allowance.
 */
export const MAX_HW_CELLS = 6;

const JOB_KEY = 'nonogram.hwjob';
const POLL_MS = 5000;
/** Long enough for a real queue, short enough that a dead job stops being waited on. */
const POLL_LIMIT_MS = 20 * 60 * 1000;

export interface HardwareJob {
  job_id: string;
  backend?: string;
  shots?: number;
  iterations?: number;
  transpiled_depth?: number;
  rows: number;
  cols: number;
}

export interface CollectedJob {
  status: string;
  done: boolean;
  counts: Record<string, number> | null;
  backend: string | null;
}

function remember(job: HardwareJob | null): void {
  try {
    if (job) sessionStorage.setItem(JOB_KEY, JSON.stringify(job));
    else sessionStorage.removeItem(JOB_KEY);
  } catch {
    // Private windows and blocked site data both throw. The run still completes in
    // this tab; it just will not survive a reload.
  }
}

/** The job this tab was waiting on before it reloaded, if any. */
export function pendingJob(): HardwareJob | null {
  try {
    const raw = sessionStorage.getItem(JOB_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object' && 'job_id' in parsed) return parsed as HardwareJob;
  } catch {
    /* unreadable or unparseable — treat as nothing pending */
  }
  return null;
}

function base(): string {
  return window.API_BASE ?? '';
}

/** Whether this grid is one a hardware run can say anything about. */
export function withinHardwareLimit(rows: number, cols: number): boolean {
  return rows * cols <= MAX_HW_CELLS;
}

/** Hand a puzzle to IBM. Resolves with the job, or null when it was refused. */
export async function submitJob(
  rowClues: number[][],
  colClues: number[][],
  rows: number,
  cols: number,
  shots: number,
): Promise<HardwareJob | null> {
  const result: ContractResult = await SiteContract.request(base() + '/api/hw/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [REQUEST_HEADER]: '1' },
    body: JSON.stringify({
      row_clues: rowClues,
      col_clues: colClues,
      hw: { shots },
      client_id: clientId(),
    }),
    timeoutMs: 0,
  });
  if (!result.ok) {
    // Every refusal here is one a person can act on: sign in, ask to be added, wait
    // for the window to roll over, or shrink the grid. Say which.
    setStatus(result.error?.message ?? 'The hardware run was refused.', 'err');
    track({ app: 'nonogram', event: 'run.done', tier: 'hardware', outcome: 'refused' });
    return null;
  }
  const job = result.data as HardwareJob;
  remember(job);
  return job;
}

/** Ask once what became of a job. */
export async function collectJob(jobId: string): Promise<CollectedJob | null> {
  const result = await SiteContract.request(`${base()}/api/hw/jobs/${encodeURIComponent(jobId)}`, {
    timeoutMs: 15000,
  });
  return result.ok ? (result.data as CollectedJob) : null;
}

export interface WaitHandlers {
  onWaiting: (status: string, elapsedMs: number) => void;
  onDone: (collected: CollectedJob) => void;
  onGaveUp: (reason: string) => void;
}

/**
 * Poll until the job finishes, or until waiting stops being useful.
 *
 * Polling is free at the gateway, which charges for compute and counts a watched
 * queue as none, so the only cost of waiting is the waiting.
 */
export function waitForJob(job: HardwareJob, handlers: WaitHandlers): () => void {
  const started = Date.now();
  // Held on an object rather than a local: the canceller below flips it while tick()
  // is suspended on its await, which a plain boolean would let the compiler discount.
  const watch: { stopped: boolean } = { stopped: false };
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = async (): Promise<void> => {
    const collected = await collectJob(job.job_id);
    // Cancelled while that request was in flight: the result belongs to a run the
    // page has already moved on from.
    if (watch.stopped) return;

    if (collected?.done) {
      remember(null);
      handlers.onDone(collected);
      return;
    }
    if (Date.now() - started > POLL_LIMIT_MS) {
      remember(null);
      handlers.onGaveUp('The job is still queued at IBM. Its id is in this tab until you reload.');
      return;
    }
    handlers.onWaiting(collected?.status ?? 'QUEUED', Date.now() - started);
    timer = setTimeout(() => void tick(), POLL_MS);
  };

  void tick();
  return () => {
    watch.stopped = true;
    if (timer) clearTimeout(timer);
  };
}
