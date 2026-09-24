/**
 * Every assertion in this suite reads `dist/`, so a run without one proves
 * nothing. Fail the whole run here rather than letting each file decide: a
 * per-test skip leaves the suite green, which reads as "the built output is
 * fine" when nothing looked at it.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export default function requireDist(): void {
  const index = resolve(import.meta.dirname!, '..', '..', 'dist', 'index.html');
  if (!existsSync(index)) {
    throw new Error(
      `the integration suite asserts against dist/, and ${index} is missing — run: npm run test:integration`,
    );
  }
}
