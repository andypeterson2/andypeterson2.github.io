/**
 * Every redirect the Astro config declares has to produce a built page that
 * points at its target.
 */
import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';
import config from '../../astro.config.mjs';

const DIST = resolve(import.meta.dirname!, '..', '..', 'dist');
const redirects = Object.entries((config.redirects ?? {}) as Record<string, string>);

describe('Built redirects', () => {
  const hasDist = existsSync(resolve(DIST, 'index.html'));

  test('the config declares redirects to check', () => {
    expect(redirects.length).toBeGreaterThan(0);
  });

  test.runIf(hasDist)('each one is built and points at its target', () => {
    const broken: string[] = [];
    for (const [from, to] of redirects) {
      const page = [
        resolve(DIST, from.slice(1), 'index.html'),
        resolve(DIST, from.slice(1)),
      ].find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
      if (!page) {
        broken.push(`${from} produced no page`);
        continue;
      }
      const html = readFileSync(page, 'utf-8');
      if (!html.includes(`url=${to}`)) broken.push(`${from} does not redirect to ${to}`);
    }
    expect(broken).toEqual([]);
  });
});
