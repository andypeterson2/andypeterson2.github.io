/**
 * The editor client calls a backend that lives in another repo, so nothing at
 * build time catches a call to a route cv does not serve — it surfaces as a 404
 * in someone's browser. This checks every path in the client against the
 * vendored route list, which `scripts/refresh-cv-routes.mjs` regenerates.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vendored = JSON.parse(
  readFileSync(resolve(ROOT, 'docs/api-contract/cv-routes.json'), 'utf-8'),
) as { routes: string[] };
const apiSrc = readFileSync(resolve(ROOT, 'src/editor/lib/api.ts'), 'utf-8');

/** Every `this.req(...)` call in the client, as "METHOD /api/<path>" with ids as :p. */
function clientCalls(): { call: string; raw: string }[] {
  const calls: { call: string; raw: string }[] = [];
  for (const m of apiSrc.matchAll(/this\.req(?:<[^>]*>)?\(\s*([`'"])(.*?)\1([^)]*)/gs)) {
    const path = m[2].replace(/\$\{[^}]*\}/g, ':p');
    const method = /method:\s*'(\w+)'/.exec(m[3])?.[1]?.toUpperCase() ?? 'GET';
    calls.push({ call: `${method} /api${path}`, raw: m[2] });
  }
  return calls;
}

describe('editor client against the cv route list', () => {
  test('the vendored list is present and plausible', () => {
    expect(vendored.routes.length).toBeGreaterThan(50);
    expect(vendored.routes).toContain('GET /api/persons/:p');
  });

  test('every call the client makes is a route cv serves', () => {
    const known = new Set(vendored.routes);
    const calls = clientCalls();
    expect(calls.length).toBeGreaterThan(20); // the parser still finds the calls
    const missing = calls.filter((c) => !known.has(c.call)).map((c) => c.call);
    expect(
      missing,
      `client calls with no matching cv route (refresh with: node scripts/refresh-cv-routes.mjs ../cv)`,
    ).toEqual([]);
  });
});
