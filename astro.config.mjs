// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

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
          'https://unpkg.com',
          'https://cdn.jsdelivr.net',
        ],
      },
      directives: [
        "default-src 'self'",
        "font-src 'self' https://unpkg.com https://cdn.jsdelivr.net",
        "img-src 'self' data:",
        `connect-src 'self' https://plausible.io https://api.andypeterson.dev wss://api.andypeterson.dev${process.env.NODE_ENV !== 'production' ? ' ws://localhost:* wss://localhost:* http://localhost:*' : ''}`,
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
});
