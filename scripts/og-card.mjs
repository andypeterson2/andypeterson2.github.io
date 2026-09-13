// Renders public/og-card.png — the 1200×630 link-preview image used as the default
// og:image / twitter:image. A System-6 window with the dithered headshot and the three
// things the site shows, set in the site's own faces. Deliberately carries no name:
// identity comes from env at build time (og:title), never from committed assets.
//
//   node scripts/og-card.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const b64 = (p) => readFileSync(resolve(root, p)).toString('base64');
const chicago = b64('node_modules/@sakun/system.css/dist/ChiKareGo2.woff2');
const geneva = b64('node_modules/@sakun/system.css/dist/FindersKeepers.woff2');
const headshot = b64('public/headshot.png');

const html = `<!doctype html><html><head><style>
@font-face { font-family: Chicago12; src: url(data:font/woff2;base64,${chicago}); }
@font-face { font-family: Geneva9; src: url(data:font/woff2;base64,${geneva}); }
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; display: grid; place-items: center;
  background: repeating-conic-gradient(#1c1b19 0 25%, #fff 0 50%) 0 0 / 4px 4px; }
.win { width: 1040px; background: #fff; border: 4px solid #1c1b19; box-shadow: 8px 8px 0 #1c1b19; }
.bar { height: 56px; display: flex; align-items: center; justify-content: center; border-bottom: 4px solid #1c1b19;
  background: repeating-linear-gradient(#1c1b19 0 4px, #fff 4px 8px); background-clip: content-box; padding: 8px 6px; }
.bar span { background: #fff; padding: 0 24px; font: 40px Chicago12; color: #1c1b19; }
.body { display: flex; gap: 48px; align-items: center; padding: 40px 48px 44px; }
.body img { width: 250px; height: 309px; image-rendering: pixelated; border: 4px solid #1c1b19; }
ul { list-style: none; padding: 0; display: grid; gap: 26px; }
li { font: 40px Chicago12; color: #1c1b19; }
li small { display: block; font: 26px Geneva9; margin-top: 6px; }
</style></head><body><div class="win"><div class="bar"><span>Portfolio</span></div><div class="body">
<img src="data:image/png;base64,${headshot}" alt="">
<ul>
<li>Quantum-keyed video<small>Browser video encrypted with simulated BB84 keys</small></li>
<li>Grover search on IBM hardware<small>32.3% correct against 6.25% by chance</small></li>
<li>Demos that run in your browser<small>Classifier · nonogram solver · resume editor</small></li>
</ul></div></div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: resolve(root, 'public/og-card.png') });
await browser.close();
console.log('wrote public/og-card.png');
