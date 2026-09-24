/**
 * Walking the source tree for a file extension, for the tests that audit every
 * page or component rather than one named file.
 */
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname!, '..');

/** Every file under `dir` (recursively) whose name ends with `ext`. */
export function filesWithExt(dir: string, ext: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...filesWithExt(full, ext));
    else if (entry.name.endsWith(ext)) files.push(full);
  }
  return files;
}

/** Every .astro file under a path relative to the repo root. */
export function astroFiles(relativeDir: string): string[] {
  return filesWithExt(resolve(ROOT, relativeDir), '.astro');
}
