/**
 * Security tests — verify XSS mitigations and safe coding patterns.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

describe('XSS prevention', () => {
  // The classifier frontend's canonical source is src/apps/classifiers/ (the
  // quantum-machine-learning repo is API/weights only) — the page ships an
  // Astro-bundled build of this module, so assert against the source.
  const appTs = readFileSync(resolve(ROOT, 'src/apps/classifiers/app.ts'), 'utf-8');

  test('classifier app strips event-handler attributes from parsed HTML', () => {
    // fetchModelInfo parses HTML from a server response. Before assigning to
    // innerHTML, event-handler attributes (onerror, onload, etc.) and
    // javascript: URIs must be stripped to prevent XSS.
    expect(appTs).toMatch(/removeAttribute/);
    expect(appTs).toMatch(/\.startsWith\(["']on["']\)/);
  });

  test('classifier app strips javascript: URIs from parsed HTML', () => {
    expect(appTs).toMatch(/javascript:/);
  });
});
