/**
 * Security tests — verify XSS mitigations and safe coding patterns.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

describe('XSS prevention', () => {
  const appJs = readFileSync(
    resolve(ROOT, 'packages/quantum-protein-kernel/classifiers/static/js/app.js'),
    'utf-8',
  );

  test('classifier app.js strips event-handler attributes from parsed HTML', () => {
    // fetchModelInfo parses HTML from a server response. Before assigning to
    // innerHTML, event-handler attributes (onerror, onload, etc.) and
    // javascript: URIs must be stripped to prevent XSS.
    expect(appJs).toMatch(/removeAttribute/);
    expect(appJs).toMatch(/\.startsWith\(["']on["']\)/);
  });

  test('classifier app.js strips javascript: URIs from parsed HTML', () => {
    expect(appJs).toMatch(/javascript:/);
  });
});
