// Post-build purge of the render-blocking BaseLayout stylesheet: ~37KB of global System-6
// CSS on every page, of which the site uses a fraction. Only that file is purged, against
// the built HTML (scoped classes and the SSR'd island included) and JS (runtime class-name
// literals); a selector used on any page keeps its rule everywhere. It is rewritten in place
// under the same hashed name, and inline <style> blocks (and their CSP hashes) are untouched.

import { PurgeCSS } from 'purgecss';
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ASTRO_DIR = 'dist/_astro';

const target = readdirSync(ASTRO_DIR).find((f) => /^BaseLayout\..+\.css$/.test(f));
if (!target) {
  console.error('purge-css: no BaseLayout.*.css found in dist/_astro — run `astro build` first.');
  process.exit(1);
}
const cssPath = join(ASTRO_DIR, target);
const before = statSync(cssPath).size;

const [result] = await new PurgeCSS().purge({
  content: ['dist/**/*.html', 'dist/**/*.js'],
  css: [cssPath],
  // Keep hyphen, colon, slash, dot, and % inside tokens so names like "sn-green" and
  // "data-theme" are extracted whole.
  defaultExtractor: (content) => content.match(/[A-Za-z0-9_/:%.-]+/g) || [],
  // All three default to false ("keep"), pinned because they are load-bearing: every
  // @font-face and @keyframes is used, and the design tokens are :root custom properties.
  fontFace: false,
  keyframes: false,
  variables: false,
  safelist: {
    // :root holds the design tokens; html/body carry base styles; [data-theme] is set by
    // the no-FOUC bootstrap script, so it never appears in the markup PurgeCSS scans.
    standard: [/^:root$/, 'html', 'body'],
    greedy: [/data-theme/],
  },
});

// Rules a purge has silently dropped before, which the dev server (and so e2e)
// never sees: fail the build if one goes missing.
const MUST_KEEP = ['a:focus-visible,button:focus-visible,select:focus-visible'];
const flat = result.css.replace(/\s+/g, '');
const lost = MUST_KEEP.filter((sel) => !flat.includes(sel));
if (lost.length) {
  console.error(`purge-css: dropped required rules: ${lost.join(', ')}`);
  process.exit(1);
}

writeFileSync(cssPath, result.css);
const after = Buffer.byteLength(result.css);
const pct = (100 * (1 - after / before)).toFixed(1);
console.log(
  `purge-css: ${target}  ${(before / 1024).toFixed(1)}KB → ${(after / 1024).toFixed(1)}KB  (−${pct}%)`,
);

// Fail the build if the purge clearly went wrong in either direction: near-zero
// savings means the scan missed (nothing removed), while a near-empty result
// means the content globs matched nothing and we stripped live styles.
if (after > before * 0.98) {
  console.error(
    'purge-css: <2% removed — content scan likely failed; not shipping an unpurged file silently.',
  );
  process.exit(1);
}
if (after < 4096) {
  console.error(
    'purge-css: result suspiciously small (<4KB) — aborting to avoid shipping stripped styles.',
  );
  process.exit(1);
}
