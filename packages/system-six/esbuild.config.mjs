// Bundles the custom elements two ways:
//   dist/system-six.esm.js    — ESM, for the Astro site and modern imports
//   dist/system-six.global.js — IIFE exposing window.SystemSix, for claude.ai/design
import { build } from 'esbuild';

const common = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  sourcemap: true,
  target: 'es2022',
  logLevel: 'info',
};

await build({ ...common, format: 'esm', outfile: 'dist/system-six.esm.js' });
await build({ ...common, format: 'iife', globalName: 'SystemSix', outfile: 'dist/system-six.global.js' });
console.log('system-six: built esm + global');
