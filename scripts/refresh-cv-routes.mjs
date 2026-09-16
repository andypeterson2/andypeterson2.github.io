// Regenerates the vendored list of cv backend routes, which the editor client is
// checked against. The list is vendored because CI has no cv checkout.
//
//   node scripts/refresh-cv-routes.mjs ../cv

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const cvRoot = resolve(process.argv[2] ?? '../cv');
const serverSrc = readFileSync(join(cvRoot, 'editor/server.js'), 'utf-8');

// The mount table pairs each router file with its prefix.
const mounts = new Map();
for (const [, prefix, factory] of serverSrc.matchAll(/\[\s*'([^']+)'\s*,\s*create(\w+)Router\(/g)) {
  mounts.set(factory.toLowerCase(), prefix);
}

const routes = new Set();
for (const file of readdirSync(join(cvRoot, 'editor/routes'))) {
  const key = file.replace(/\.js$/, '').toLowerCase();
  const prefix = mounts.get(key) ?? (key === 'auth' ? '/api/auth' : null);
  if (!prefix) continue;
  const src = readFileSync(join(cvRoot, 'editor/routes', file), 'utf-8');
  for (const [, method, path] of src.matchAll(
    /router\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g,
  )) {
    const full = `${prefix}${path === '/' ? '' : path}`.replace(/\/{2,}/g, '/');
    routes.add(`${method.toUpperCase()} ${full.replace(/:[A-Za-z_]+/g, ':p')}`);
  }
}

const out = {
  source: 'cv editor/routes/*.js, mounted per editor/server.js',
  generatedBy: 'scripts/refresh-cv-routes.mjs',
  routes: [...routes].sort(),
};
writeFileSync('docs/api-contract/cv-routes.json', `${JSON.stringify(out, null, 2)}\n`);
console.log(`wrote ${String(out.routes.length)} routes`);
