/**
 * Security tests — verify XSS mitigations and safe coding patterns.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

describe('XSS prevention', () => {
  test('classifier app.js does not assign raw parsed HTML to innerHTML', () => {
    const appJs = readFileSync(
      resolve(ROOT, 'packages/quantum-protein-kernel/classifiers/static/js/app.js'),
      'utf-8',
    );
    // fetchModelInfo parses HTML from a server response. Assigning
    // doc.body.innerHTML directly allows event-handler XSS (onerror, onload).
    expect(appJs).not.toMatch(/panel\.innerHTML\s*=\s*doc\.body\.innerHTML/);
  });
});
