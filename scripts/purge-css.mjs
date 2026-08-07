// Post-build CSS purge for the INLINED stylesheets.
//
// astro.config sets `build.inlineStylesheets: 'always'`, so every page ships its CSS
// in a single <style> in <head> (no render-blocking stylesheet request) — but that
// inlined block is the full, UNPURGED vendored @sakun/system.css + bootstrap-icons
// (~121KB, of which the site uses a fraction and 5 of ~2050 icons). This step shrinks
// each page's inline <style> in place, then re-computes the CSP style hashes that the
// edit invalidates.
//
// Two things make the inline case different from purging an external file:
//   1. Content scan must EXCLUDE the <style> blocks. With the CSS sitting in the HTML,
//      a naive scan would read the selectors inside <style> as "usage" and keep
//      everything. We strip every <style> out of the scanned markup first, then scan
//      the remaining markup (class="…", including Astro's scoped .astro-* hashes and the
//      SSR'd island) plus all bundled JS (runtime classes appear as string literals:
//      classList.add("visible"), toggle("connected"), add('sn-green'), …).
//   2. Astro hashed the inline <style> into `style-src` at build. Editing the bytes
//      invalidates that hash, so after purging we recompute the SHA-256 of every
//      surviving <style> and rewrite the meta CSP's style-src to 'self' + those hashes.
//      (scripts/check-security-headers.sh + the browser both enforce this.)
//
// Each page is purged against the WHOLE site's markup + JS (union), so a class used on
// any page is retained on every page — identical class set to the previous external
// purge, just delivered inline. @font-face / @keyframes / :root variables are pinned.
import { PurgeCSS } from 'purgecss';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const DIST = 'dist';
const STYLE_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;

function walk(dir, ext, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, out);
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

const htmlFiles = walk(DIST, '.html');
const jsFiles = walk(DIST, '.js');

// Content PurgeCSS scans for "used" tokens: every page's markup with <style> stripped
// out, plus every bundled JS file. Built once and reused for all pages.
const strippedMarkup = htmlFiles.map((f) => readFileSync(f, 'utf8').replace(STYLE_RE, ' '));
const content = [
  ...strippedMarkup.map((raw) => ({ raw, extension: 'html' })),
  ...jsFiles.map((f) => ({ raw: readFileSync(f, 'utf8'), extension: 'js' })),
];

const purger = new PurgeCSS();
const purgeOpts = {
  content,
  defaultExtractor: (c) => c.match(/[A-Za-z0-9_/:%.-]+/g) || [],
  fontFace: false,
  keyframes: false,
  variables: false,
  safelist: { standard: [/^:root$/, 'html', 'body'], greedy: [/data-theme/] },
};

const sha256 = (s) => "'sha256-" + createHash('sha256').update(s, 'utf8').digest('base64') + "'";

let beforeTotal = 0;
let afterTotal = 0;
let pagesTouched = 0;

for (const file of htmlFiles) {
  let html = readFileSync(file, 'utf8');
  const blocks = [...html.matchAll(STYLE_RE)];
  if (blocks.length === 0) continue;

  // Purge each <style> block's CSS against the site-wide content.
  const purged = [];
  for (const m of blocks) {
    const css = m[1];
    beforeTotal += Buffer.byteLength(css);
    const [res] = await purger.purge({ ...purgeOpts, css: [{ raw: css, extension: 'css' }] });
    purged.push(res.css);
    afterTotal += Buffer.byteLength(res.css);
  }

  // Splice the purged CSS back into the same <style> tags (attributes preserved).
  let i = 0;
  html = html.replace(STYLE_RE, (full, _body) => full.replace(_body, purged[i++]));

  // Recompute the CSP style hashes the edit invalidated. Rewrite style-src to
  // 'self' + the SHA-256 of every surviving <style>. Skip pages with no CSP meta
  // (the meta-refresh redirect stubs).
  const styleHashes = purged.map(sha256);
  html = html.replace(
    /(<meta http-equiv="content-security-policy" content=")([^"]*)(">)/i,
    (full, pre, csp, post) => {
      const next = csp.replace(/style-src\s+'self'[^;]*/i, `style-src 'self' ${styleHashes.join(' ')}`);
      return pre + next + post;
    },
  );

  writeFileSync(file, html);
  pagesTouched++;
}

const pct = beforeTotal ? (100 * (1 - afterTotal / beforeTotal)).toFixed(1) : '0';
console.log(
  `purge-css: ${pagesTouched} page(s), inline CSS ${(beforeTotal / 1024).toFixed(1)}KB → ${(afterTotal / 1024).toFixed(1)}KB (−${pct}%)`,
);

// Guardrails: a near-zero cut means the content scan silently failed (kept everything);
// a near-empty result means we stripped live styles. Fail the build rather than ship
// either — an unpurged 121KB inline block or a page with no styles.
if (pagesTouched === 0) {
  console.error('purge-css: no inline <style> found — is build.inlineStylesheets set to "always"?');
  process.exit(1);
}
if (afterTotal > beforeTotal * 0.85) {
  console.error('purge-css: <15% removed — content scan likely failed; not shipping an unpurged inline block.');
  process.exit(1);
}
if (afterTotal / pagesTouched < 2048) {
  console.error('purge-css: average page CSS <2KB — suspiciously small; aborting to avoid stripped styles.');
  process.exit(1);
}
