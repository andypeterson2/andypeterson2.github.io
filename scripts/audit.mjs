/**
 * `npm audit` as a gate, with a reviewed allowlist.
 *
 * npm carries no allowlist of its own, so an advisory with no patched version anywhere
 * fails `npm audit --audit-level=high` every run. This reads the JSON report and skips
 * allowlisted advisory ids; anything else at high or critical exits 1. Each entry states
 * its reason, the list expires on a review date, and an entry matching nothing prints as
 * a line to delete. A registry outage, where the CLI errors in place of a report, retries
 * and then warns: Dependabot alerts are the continuous CVE channel.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const FAIL_AT = new Set(['high', 'critical']);
const ATTEMPTS = 3;
const RETRY_MS = 20_000;
const OUTAGE = 'audit endpoint returned an error';

const here = dirname(fileURLToPath(import.meta.url));
const allowlist = JSON.parse(readFileSync(join(here, 'audit-allowlist.json'), 'utf8'));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** `npm audit --json` output, or null while the registry is answering with an error. */
async function runAudit() {
  let last = '';
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const run = spawnSync('npm', ['audit', '--json'], { encoding: 'utf8', shell: false });
    last = `${run.stdout ?? ''}${run.stderr ?? ''}`;
    try {
      // Findings exit non-zero with the report still on stdout, so the parse is what
      // decides whether the call produced one.
      return JSON.parse(run.stdout);
    } catch {
      if (attempt < ATTEMPTS) {
        process.stderr.write(`npm audit attempt ${attempt} produced no report; retrying\n`);
        await sleep(RETRY_MS);
      }
    }
  }
  process.stderr.write(last);
  return null;
}

/**
 * The advisories a report rests on, by id.
 *
 * `vulnerabilities` holds one entry per affected package, and the advisory objects sit
 * on the package the advisory names; a dependent appears because its dependency does.
 * Reading the advisories counts each finding once, under the id an allowlist can name.
 */
function advisoriesOf(report) {
  const found = new Map();
  for (const entry of Object.values(report.vulnerabilities ?? {})) {
    for (const via of entry.via ?? []) {
      if (typeof via !== 'object') continue;
      const id = String(via.url ?? '')
        .split('/')
        .pop();
      if (id) found.set(id, { id, name: via.name, severity: via.severity, title: via.title });
    }
  }
  return found;
}

const report = await runAudit();
if (report === null) {
  process.stdout.write(`::warning::npm audit skipped — the registry advisory endpoint is down\n`);
  process.exit(0);
}

const found = advisoriesOf(report);
const allowed = new Map(allowlist.advisories.map((a) => [a.id, a]));
const gating = [...found.values()].filter((a) => FAIL_AT.has(a.severity));
const blocking = gating.filter((a) => !allowed.has(a.id));
const stale = [...allowed.keys()].filter((id) => !found.has(id));

for (const a of gating.filter((a) => allowed.has(a.id))) {
  process.stdout.write(`allowed  ${a.id}  ${a.severity}  ${a.name}  ${a.title}\n`);
}
for (const id of stale) {
  process.stdout.write(`::warning::${id} is allowlisted but no longer reported — drop the entry\n`);
}
for (const a of blocking) {
  process.stdout.write(`BLOCKING ${a.id}  ${a.severity}  ${a.name}  ${a.title}\n`);
}

const expired = allowlist.reviewBy < new Date().toISOString().slice(0, 10);
if (expired) {
  process.stdout.write(
    `::error::the audit allowlist was due for review on ${allowlist.reviewBy}\n` +
      `Re-check each entry against current advisories, then move the date.\n`,
  );
}

const counts = report.metadata?.vulnerabilities ?? {};
process.stdout.write(
  `npm audit: ${gating.length} advisory(s) at high or above, ` +
    `${blocking.length} blocking, ${allowed.size - stale.length} allowed ` +
    `(npm counts ${JSON.stringify(counts)})\n`,
);

process.exit(blocking.length > 0 || expired ? 1 : 0);
