// Loads the production pages in headless Chromium and fails on any console error.
//
//   node scripts/check-live-console.mjs https://andypeterson.dev

import { chromium } from '@playwright/test';

const base = (process.argv[2] || 'https://andypeterson.dev').replace(/\/$/, '');
const paths = [
  '/',
  '/projects/ai-ml/app/',
  '/projects/quantum-nonogram-solver/app/',
  '/projects/latex-resume-editor/app/',
];
const ALLOWED = [/The Content Security Policy directive 'frame-ancestors' is ignored/];
// The editor asks the gateway "who am I?" on load; a signed-out visitor gets a 401 by
// design, which Chromium logs as a resource error.
const ALLOWED_URLS = [/\/auth\/me$/];
// The edge's bot-detection script, injected into the HTML and blocked by the CSP. Its
// inline body carries a per-request id, so no hash can ever allow it.
const EDGE_INJECTION = /__CF\$cv\$params/;
const INLINE_CSP_ERROR = /Executing inline script violates/;

const browser = await chromium.launch();
let failures = 0;
for (const path of paths) {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (ALLOWED.some((re) => re.test(m.text()))) return;
    if (ALLOWED_URLS.some((re) => re.test(m.location().url))) return;
    errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(base + path, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  if (EDGE_INJECTION.test(await page.content())) {
    const i = errors.findIndex((e) => INLINE_CSP_ERROR.test(e));
    if (i >= 0) {
      errors.splice(i, 1);
      console.log(`  (tolerated on ${path}: the edge injects one inline script the CSP blocks)`);
    }
  }
  if (errors.length) {
    failures += errors.length;
    console.log(`✗ ${path}`);
    for (const e of errors) console.log(`    ${e.slice(0, 300)}`);
  } else {
    console.log(`✓ ${path}`);
  }
  await page.close();
}
await browser.close();
if (failures) {
  console.log(`\n${String(failures)} console error(s) on production.`);
  process.exit(1);
}
