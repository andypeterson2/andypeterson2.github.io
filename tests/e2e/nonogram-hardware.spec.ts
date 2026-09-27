import { test, expect, type Page } from '@playwright/test';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

// The IBM tier against a stub backend on localhost (the dev CSP and the URL allowlist
// admit localhost only when the page is served from localhost). A real server rather
// than page.route, so the submit and the polls are ordinary cross-origin requests and
// the credentials/header handling is the same as in production.

const APP = '/projects/quantum-nonogram-solver/app/';

/** One poll interval plus room: the page checks the queue every 5s by design. */
const POLL_GRACE_MS = 15_000;

/**
 * The origin is echoed rather than starred, and credentials are allowed, because the
 * contract client sends the session cookie: a browser rejects a wildcard origin on a
 * credentialed response. This is what the gateway returns.
 */
function cors(req: http.IncomingMessage): Record<string, string> {
  return {
    'access-control-allow-origin': req.headers.origin ?? '*',
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'Content-Type, Authorization, X-HW-Request',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    vary: 'Origin',
  };
}

interface Stub {
  url: string;
  /** Headers of every POST /api/hw/jobs, so the ask can be asserted. */
  submits: http.IncomingHttpHeaders[];
  polls: number;
  /** Flip to DONE and the next poll returns counts. */
  setDone(counts: Record<string, number>): void;
  /** Refuse the next submit with this status and envelope code. */
  refuse(status: number, code: string, message: string): void;
  /** What /gate/hardware reports: signed out, refused, spent, or allowed. */
  setEntitlement(next: Record<string, unknown>): void;
  close(): Promise<void>;
}

async function startStub(): Promise<Stub> {
  const submits: http.IncomingHttpHeaders[] = [];
  const stub = {
    submits,
    polls: 0,
    done: null as Record<string, number> | null,
    refusal: null as { status: number; code: string; message: string } | null,
    entitlement: {
      configured: true,
      signedIn: true,
      allowed: true,
      remaining: 3,
      reason: '3 hardware runs left this window.',
    } as Record<string, unknown>,
  };

  const server = http.createServer((req, res) => {
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { ...cors(req), 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    // The gateway mounts each app under a prefix and keeps /gate and /auth at the
    // root, so the stub strips the prefix the same way.
    const path = (req.url ?? '').split('?')[0]!.replace(/^\/nonogram/, '');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors(req));
      res.end();
      return;
    }
    if (req.method === 'GET' && path === '/gate/hardware') {
      json(200, stub.entitlement);
      return;
    }
    if (req.method === 'POST' && path === '/api/hw/jobs') {
      submits.push(req.headers);
      if (stub.refusal) {
        const { status, code, message } = stub.refusal;
        json(status, { error: { code, message } });
        return;
      }
      json(202, {
        job_id: 'job-e2e',
        backend: 'ibm_stub',
        shots: 1024,
        iterations: 1,
        transpiled_depth: 139,
        rows: 2,
        cols: 2,
      });
      return;
    }
    if (req.method === 'GET' && path.startsWith('/api/hw/jobs/')) {
      stub.polls += 1;
      json(
        200,
        stub.done
          ? { status: 'DONE', done: true, counts: stub.done, backend: 'ibm_stub' }
          : { status: 'QUEUED', done: false, counts: null, backend: 'ibm_stub' },
      );
      return;
    }
    json(404, { error: { code: 'not_found', message: path } });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${String(port)}`,
    submits,
    get polls() {
      return stub.polls;
    },
    setDone: (counts) => (stub.done = counts),
    setEntitlement: (next) => (stub.entitlement = next),
    refuse: (status, code, message) => (stub.refusal = { status, code, message }),
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  };
}

/** Load the app, then bring the live tier up against the stub. */
async function connect(page: Page, stub: Stub): Promise<void> {
  await page.goto(APP);
  await expect(page.locator('td.cell').first()).toBeVisible();
  await page.evaluate((url) => {
    // The shape the pass lane dispatches: the app's own base under the gateway.
    document.dispatchEvent(
      new CustomEvent('navbar:connect', {
        detail: { service: 'nonogram', url: `${url}/nonogram` },
      }),
    );
  }, stub.url);
  await expect(page.locator('#btn-hw')).toBeVisible();
  // The button is drawn from the gateway's answer, so wait for it to have arrived.
  await expect(page.locator('#btn-hw')).toHaveText(/Run on IBM|Sign in/);
}

/** The app opens at 3x3, which is past the hardware ceiling. Shrink to 2x2. */
async function shrinkToTwoByTwo(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Remove a row' }).click();
  await page.getByRole('button', { name: 'Remove a column' }).click();
  await expect(page.locator('#grid-size-label')).toHaveText('2 × 2');
}

test.describe('Nonogram: the IBM tier', () => {
  test('a signed-out visitor is told why, and offered the sign-in', async ({ page }) => {
    const stub = await startStub();
    stub.setEntitlement({
      configured: true,
      signedIn: false,
      allowed: false,
      remaining: null,
      reason: 'Sign in to run on real hardware.',
    });
    try {
      await connect(page, stub);
      await shrinkToTwoByTwo(page);
      const btn = page.locator('#btn-hw');
      await expect(btn).toBeDisabled();
      await expect(btn).toHaveAttribute('title', 'Please log in to use this feature.');

      // Reachable rather than inert: a natively disabled button leaves the tab order
      // and answers no hover, so the reason would be unreadable by keyboard.
      await expect(btn).toHaveAttribute('aria-disabled', 'true');
      await expect(btn).not.toHaveAttribute('disabled', /.*/);
      await btn.focus();
      await expect(btn).toBeFocused();
      expect(await btn.evaluate((el) => getComputedStyle(el).cursor)).toBe('help');

      // Pressing it does nothing; the sign-in bar is what does something.
      await btn.click({ force: true });
      expect(stub.submits).toHaveLength(0);

      const signIn = page.locator('#btn-signin');
      await expect(signIn).toBeVisible();
      await signIn.click();
      await expect(page).toHaveURL(/\/auth\/login\?redirect=/);
    } finally {
      await stub.close();
    }
  });

  test('a signed-in account that may not spend credits cannot press it', async ({ page }) => {
    const stub = await startStub();
    stub.setEntitlement({
      configured: true,
      signedIn: true,
      allowed: false,
      remaining: null,
      reason: 'This account may not spend quantum credits.',
    });
    try {
      await connect(page, stub);
      await shrinkToTwoByTwo(page);
      await expect(page.locator('#btn-hw')).toBeDisabled();
      await expect(page.locator('#btn-hw')).toHaveAttribute('title', /may not spend/);
      expect(stub.submits).toHaveLength(0);
    } finally {
      await stub.close();
    }
  });

  test('a spent budget disables the button and says so', async ({ page }) => {
    const stub = await startStub();
    stub.setEntitlement({
      configured: true,
      signedIn: true,
      allowed: false,
      remaining: 0,
      reason: 'The quantum budget for this 28-day window is spent.',
    });
    try {
      await connect(page, stub);
      await shrinkToTwoByTwo(page);
      await expect(page.locator('#btn-hw')).toBeDisabled();
      await expect(page.locator('#btn-hw')).toHaveAttribute('title', /budget/);
    } finally {
      await stub.close();
    }
  });

  test('the remaining budget is on the button an allowlisted account can press', async ({
    page,
  }) => {
    const stub = await startStub();
    try {
      await connect(page, stub);
      await shrinkToTwoByTwo(page);
      await expect(page.locator('#btn-hw')).toBeEnabled();
      await expect(page.locator('#btn-hw')).toHaveAttribute('title', /3 hardware runs left/);
      // Nothing left to sign in for.
      await expect(page.locator('#signin-bar')).toBeHidden();
    } finally {
      await stub.close();
    }
  });

  // The sign-in is on the page from the start. Whether somebody is signed in is the
  // gateway's to answer and holds whether or not an app is awake; gating it behind a
  // connection made it unreachable for every visitor who has no pass.
  test('the sign-in is offered on a plain page load', async ({ page }) => {
    await page.route('**/api/**', (r) => r.abort());
    await page.route('**/gate/hardware', (r) => r.abort());
    await page.goto(APP);
    await expect(page.locator('td.cell').first()).toBeVisible();

    // Even with the probe failing: a sign-in nobody needs is harmless, where a run
    // button that opened up on a failed check would not be.
    await expect(page.locator('#signin-bar')).toBeVisible();
    await expect(page.locator('#btn-signin')).toBeVisible();
    await expect(page.locator('#btn-hw')).toBeDisabled();
  });

  // Shown rather than hidden: a capability the site has is worth seeing, and the
  // stipple says it is out of reach without pretending it does not exist.
  test('with no live backend the button is visible and plainly inert', async ({ page }) => {
    await page.route('**/api/**', (r) => r.abort());
    await page.route('**/gate/hardware', (r) => r.abort());
    await page.goto(APP);
    await expect(page.locator('td.cell').first()).toBeVisible();

    const btn = page.locator('#btn-hw');
    await expect(btn).toBeVisible();
    await expect(btn).toBeDisabled();
    await expect(btn).toHaveAttribute('title', /not connected/);

    // The disabled treatment is a dither fill at full opacity, so the border keeps
    // its strength and the control still reads as one.
    const look = await btn.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { fill: cs.backgroundImage, opacity: cs.opacity };
    });
    expect(look.fill).toContain('data:image/svg+xml');
    expect(look.opacity).toBe('1');
  });

  test('a grid too deep for a device is refused in the UI, with the reason', async ({ page }) => {
    const stub = await startStub();
    try {
      await connect(page, stub);
      // The app opens at 3x3 — nine cells, past where a real device says anything.
      await expect(page.locator('#btn-hw')).toBeDisabled();
      await expect(page.locator('#btn-hw')).toHaveAttribute('title', /stop at 6 cells/);

      await shrinkToTwoByTwo(page);
      await expect(page.locator('#btn-hw')).toBeEnabled();

      // 3x2 is six cells: the deepest circuit still worth measuring.
      await page.getByRole('button', { name: 'Add a row' }).click();
      await expect(page.locator('#btn-hw')).toBeEnabled();
      await page.getByRole('button', { name: 'Add a column' }).click();
      await expect(page.locator('#btn-hw')).toBeDisabled();
      expect(stub.submits).toHaveLength(0);
    } finally {
      await stub.close();
    }
  });

  test('entitlement is asked at the gateway root, not under the app prefix', async ({ page }) => {
    const stub = await startStub();
    try {
      await connect(page, stub);
      // The stub strips /nonogram the way the gateway does, so a probe sent to the
      // app prefix would arrive as /gate/hardware anyway — assert the path the page
      // actually requested instead.
      const asked = await page.evaluate(() =>
        performance
          .getEntriesByType('resource')
          .map((e) => e.name)
          .filter((n) => n.includes('gate/hardware')),
      );
      expect(asked.length).toBeGreaterThan(0);
      for (const url of asked) expect(new URL(url).pathname).toBe('/gate/hardware');
    } finally {
      await stub.close();
    }
  });

  test('submitting asks for hardware, then waits on the queue', async ({ page }) => {
    const stub = await startStub();
    try {
      await connect(page, stub);
      await shrinkToTwoByTwo(page);
      await page.locator('#btn-hw').click();

      await expect(page.locator('#status-line')).toContainText('queued');
      expect(stub.submits).toHaveLength(1);
      // The ask, which the gateway turns into its own answer.
      expect(stub.submits[0]!['x-hw-request']).toBe('1');

      // Nothing is claimed while the job is still in IBM's queue.
      await expect(page.locator('#qu-sol-placeholder')).not.toContainText('%');

      // A real peak dominates: anything else stays under the display threshold.
      stub.setDone({ '1111': 950, '0000': 74 });
      await expect(page.locator('#status-line')).toContainText('ibm_stub returned 1024 shots', {
        timeout: POLL_GRACE_MS,
      });
      await expect(page.locator('#status-line')).toContainText('against 6.25% by chance');
      await expect(page.locator('#qu-list .sol-table')).toHaveCount(1);
      await expect(page.locator('#qu-list .sol-grid-label').first()).toHaveText('92.8%');
    } finally {
      await stub.close();
    }
  });

  test('a flat result is reported as decoherence, not as an answer', async ({ page }) => {
    const stub = await startStub();
    try {
      await connect(page, stub);
      await shrinkToTwoByTwo(page);
      await page.locator('#btn-hw').click();
      await expect(page.locator('#status-line')).toContainText('queued');

      // Sixteen states, near-uniform: what a circuit deeper than the device returns.
      const flat: Record<string, number> = {};
      for (let i = 0; i < 16; i++) flat[i.toString(2).padStart(4, '0')] = 64;
      stub.setDone(flat);

      await expect(page.locator('#status-line')).toContainText('flat', { timeout: POLL_GRACE_MS });
      await expect(page.locator('#status-line')).toContainText('decoherence at this depth');
    } finally {
      await stub.close();
    }
  });

  test('a refusal says which one it was', async ({ page }) => {
    const stub = await startStub();
    try {
      await connect(page, stub);
      await shrinkToTwoByTwo(page);
      stub.refuse(403, 'hardware_refused', 'This account may not spend quantum credits.');
      await page.locator('#btn-hw').click();
      await expect(page.locator('#status-line')).toContainText('may not spend quantum credits');
      expect(stub.polls).toBe(0); // nothing to wait for
    } finally {
      await stub.close();
    }
  });

  test('a reload rejoins the job instead of losing it', async ({ page }) => {
    const stub = await startStub();
    try {
      await connect(page, stub);
      await shrinkToTwoByTwo(page);
      await page.locator('#btn-hw').click();
      await expect(page.locator('#status-line')).toContainText('queued');

      await page.reload();
      await page.evaluate((url) => {
        document.dispatchEvent(
          new CustomEvent('navbar:connect', {
            detail: { service: 'nonogram', url: `${url}/nonogram` },
          }),
        );
      }, stub.url);

      // The same job, picked back up from the id the tab kept.
      await expect(page.locator('#status-line')).toContainText('queued');
      stub.setDone({ '1111': 900, '0000': 124 });
      await expect(page.locator('#status-line')).toContainText('ibm_stub returned 1024 shots', {
        timeout: POLL_GRACE_MS,
      });
      expect(stub.submits).toHaveLength(1); // the same job, rejoined
    } finally {
      await stub.close();
    }
  });
});
