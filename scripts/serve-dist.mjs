// Serves the built dist/ so e2e exercises the bytes that deploy, in the
// foreground a test runner can supervise.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve('dist');
const PORT = Number(process.argv[2] ?? 4321);
// One deviation from the deployed policy, for the specs that drive a localhost
// stub the production connect-src refuses. Everything else stays as shipped.
const ALLOW_LOCALHOST = process.argv.includes('--allow-localhost-connect');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
};

/** Resolve a request path to a file inside dist, or null; a directory serves its index. */
async function resolveFile(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const candidate = join(ROOT, clean);
  if (!candidate.startsWith(ROOT)) return null; // path traversal
  try {
    const info = await stat(candidate);
    if (info.isDirectory()) return resolveFile(join(clean, 'index.html'));
    return candidate;
  } catch {
    return clean.endsWith('.html') ? null : resolveFile(`${clean}.html`);
  }
}

createServer(async (req, res) => {
  const file = await resolveFile(req.url ?? '/');
  if (!file) {
    const notFound = await resolveFile('/404.html');
    const body = notFound ? await readFile(notFound) : 'Not found';
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    res.end(body);
    return;
  }
  const type = TYPES[extname(file)] ?? 'application/octet-stream';
  let body = await readFile(file);
  if (ALLOW_LOCALHOST && extname(file) === '.html') {
    body = Buffer.from(
      body
        .toString('utf8')
        .replace(/connect-src ([^;"']*)/, 'connect-src $1 http://localhost:* http://127.0.0.1:*'),
    );
  }
  res.writeHead(200, { 'content-type': type });
  res.end(body);
}).listen(PORT, () => console.log(`serving dist/ on http://localhost:${PORT}`));
