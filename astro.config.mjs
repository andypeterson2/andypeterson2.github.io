// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  devToolbar: { enabled: false },
  integrations: [sitemap()],
  security: {
    csp: {
      algorithm: 'SHA-256',
      scriptDirective: {
        resources: [
          "'self'",
          'https://cdn.socket.io',
          'https://unpkg.com',
          'https://plausible.io',
          'https://cdn.jsdelivr.net',
        ],
      },
      styleDirective: {
        resources: [
          "'self'",
          "'unsafe-inline'",
          'https://unpkg.com',
        ],
      },
      directives: [
        "default-src 'self'",
        "font-src 'self' https://unpkg.com",
        "img-src 'self' data:",
        "connect-src 'self' ws: wss: http://localhost:* https://plausible.io",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self' mailto:",
        "frame-ancestors 'none'",
      ],
    },
  },
  site: process.env.SITE_URL || 'https://andypeterson.dev',
  redirects: {
    '/underconstruction.html': '/',
    '/underconstruction': '/',
    '/resume': '/',
  },
  vite: {
    server: {
      fs: {
        // Allow serving files from the repo root (submodule directories)
        allow: [root],
      },
    },
    plugins: [
      {
        name: 'serve-subprojects',
        configureServer(server) {
          // Serve sub-project static directories that live outside src/pages
          server.middlewares.use((req, res, next) => {
            const subPaths = [
              '/nonogram/',
              '/classifiers/',
              '/cv/',
              '/qvc/',
              '/packages/',
              '/lib/',
              '/site-manifest.json',
            ];
            // Rewrite legacy root-level paths to packages/
            const pathRewrites = {
              '/cv/': '/packages/cv/',
              '/qvc/': '/packages/qvc/',
              // Flask serves static/ contents at the URL root, so
              // /classifiers/js/… and /classifiers/css/… map into static/.
              '/classifiers/js/': '/packages/quantum-protein-kernel/classifiers/static/js/',
              '/classifiers/css/': '/packages/quantum-protein-kernel/classifiers/static/css/',
              '/classifiers/': '/packages/quantum-protein-kernel/classifiers/',
              '/nonogram/': '/packages/nonogram/',
            };
            let url = req.url || '';
            if (subPaths.some(p => url.startsWith(p))) {
              // Apply path rewrites for moved directories
              for (const [from, to] of Object.entries(pathRewrites)) {
                if (url.startsWith(from)) {
                  url = to + url.slice(from.length);
                  break;
                }
              }
              const filePath = path.join(root, url);
              import('fs').then(fs => {
                // Check if it's a directory request, try index.html
                let target = filePath;
                if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
                  target = path.join(target, 'index.html');
                }
                if (fs.existsSync(target)) {
                  const ext = path.extname(target).toLowerCase();
                  const mimeTypes = {
                    '.html': 'text/html',
                    '.css': 'text/css',
                    '.js': 'application/javascript',
                    '.mjs': 'application/javascript',
                    '.json': 'application/json',
                    '.png': 'image/png',
                    '.jpg': 'image/jpeg',
                    '.svg': 'image/svg+xml',
                    '.ico': 'image/x-icon',
                    '.woff': 'font/woff',
                    '.woff2': 'font/woff2',
                    '.ttf': 'font/ttf',
                  };
                  res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
                  fs.createReadStream(target).pipe(res);
                } else {
                  next();
                }
              });
            } else {
              next();
            }
          });
        },
      },
    ],
  },
});
