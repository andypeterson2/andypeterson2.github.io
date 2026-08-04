/**
 * Guards the no-FOUC theme bootstrap against CSP drift.
 *
 * The bootstrap is an `is:inline` <script> in BaseLayout.astro that Astro does
 * NOT auto-hash (that is what `is:inline` means). Its SHA-256 is therefore
 * pinned by hand in astro.config.mjs. If the script's bytes change and the
 * pinned hash is not updated, the production CSP silently blocks it — the theme
 * flashes light before JS re-applies dark. This recomputes the hash from the
 * built HTML and asserts the CSP allows it, so that drift fails the build.
 *
 * Requires `dist/` — run via `npm run test:integration` (it builds first).
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createHash } from 'crypto';

const ROOT = resolve(import.meta.dirname!, '..', '..');
const DIST = resolve(ROOT, 'dist');

describe('CSP: no-FOUC theme bootstrap', () => {
  const indexPath = resolve(DIST, 'index.html');
  const hasDist = existsSync(indexPath);

  test.runIf(hasDist)('the inline bootstrap hash is present in the CSP', () => {
    const html = readFileSync(indexPath, 'utf-8');

    const inlineScripts = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
      (m) => m[1],
    );
    const boot = inlineScripts.find((s) => /localStorage\.getItem\(['"]sm-theme['"]\)/.test(s));
    expect(boot, 'no-FOUC theme bootstrap not found as an inline script in dist/index.html').toBeTruthy();

    const hash = 'sha256-' + createHash('sha256').update(boot!, 'utf8').digest('base64');
    const csp = (html.match(/content-security-policy[^>]*content="([^"]*)"/i) || [])[1] || '';
    expect(
      csp,
      `bootstrap hash ${hash} is missing from the CSP — update the pinned hash in astro.config.mjs`,
    ).toContain(hash);
  });
});
