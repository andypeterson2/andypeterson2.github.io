// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  integrations: [mdx(), sitemap()],
  image: {
    service: { entrypoint: 'astro/assets/services/sharp' },
  },
  site: process.env.SITE_URL || 'https://andypeterson.dev',
  redirects: {
    '/nonograms.html': '/projects',
    '/nonograms': '/projects',
    '/quantumvideo.html': '/projects',
    '/quantumvideo': '/projects',
    '/underconstruction.html': '/',
    '/underconstruction': '/',
    '/me': '/',
    '/me/': '/',
    '/skills': '/',
    '/uses': '/',
    '/blog': '/',
    '/Current-Resume.pdf': '/',
    '/resume': '/',
    '/cover-letter': '/',
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
