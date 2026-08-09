// Post-build purge of the render-blocking BaseLayout stylesheet.
//
// BaseLayout.astro globally imports the vendored @sakun/system.css (a full
// System-6 framework) — ~37KB of CSS that ships in one BaseLayout.<hash>.css on
// EVERY page and is a real FCP drag. The site uses only a fraction of system.css,
// so the majority of that file is dead weight. (Icons are inline SVGs now — the
// bootstrap-icons font that used to bloat this bundle is gone.)
//
// We purge ONLY that one file, scanning the REAL built output:
//   • dist/**/*.html — every static class that lands in the markup, including
//     Astro's scoped `.astro-*` hashes and the SSR'd Svelte island, so nothing
//     scoped or server-rendered is wrongly stripped;
//   • dist/**/*.js  — classes added at runtime, which appear verbatim as string
//     literals in the bundled JS: classList.add("visible"), toggle("connected"),
//     add('sn-green'), className = "ui-toast", etc. (verified: every runtime
//     class defined in BaseLayout.css shows up as such a literal).
//
// system.css here is global (unscoped), so a used selector on
// ANY page keeps the rule for every page — exactly what we want for a shared
// stylesheet. The per-page component CSS and the classifier/nonogram app CSS are
// deliberately left untouched: small, authored by us, and dense with
// runtime-constructed class names (`sol-table sz-${n}`) — real risk, and no FCP
// win on the recruiter-facing pages, which don't load them.
//
// The file is rewritten in place (same hashed name → every <link href> stays
// valid; there is no SRI/integrity attribute to invalidate). Inline <style>
// blocks are never touched, so the CSP style-hashes (tests/integration/csp.test.ts)
// are unaffected.
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
  // Match word-ish tokens plus the characters that appear inside class/attribute
  // names we rely on (hyphen, colon, slash, dot, %) so e.g. "sn-green" and
  // "data-theme" are extracted whole rather than split.
  defaultExtractor: (content) => content.match(/[A-Za-z0-9_/:%.-]+/g) || [],
  // All three default to false ("keep"); pinned explicitly because they are the
  // load-bearing safety guarantees: never drop @font-face (all 5 faces are used),
  // never drop @keyframes, and NEVER prune CSS custom properties — the entire
  // design-token system lives in :root variables.
  fontFace: false,
  keyframes: false,
  variables: false,
  safelist: {
    // Dropping :root would nuke every design token; html/body carry base styles;
    // the theme is applied via a [data-theme] attribute set by the no-FOUC
    // bootstrap script (attribute values live in JS, not the markup PurgeCSS sees).
    standard: [/^:root$/, 'html', 'body'],
    greedy: [/data-theme/],
  },
});

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
  console.error('purge-css: <2% removed — content scan likely failed; not shipping an unpurged file silently.');
  process.exit(1);
}
if (after < 4096) {
  console.error('purge-css: result suspiciously small (<4KB) — aborting to avoid shipping stripped styles.');
  process.exit(1);
}
