// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';

export default defineConfig({
  devToolbar: { enabled: false },
  integrations: [sitemap(), svelte()],
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
        // api.andypeterson.dev is the gateway the CV editor fetches (credentialed,
        // behind Cloudflare Access). Without it here the CSP would block those calls.
        `connect-src 'self' https://plausible.io https://api.andypeterson.dev${process.env.NODE_ENV !== 'production' ? ' ws://localhost:* wss://localhost:* http://localhost:*' : ''}`,
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
    // Expose the site's own env prefixes to import.meta.env. Vite only surfaces
    // VITE_-prefixed vars by default, so without this siteConfig never sees
    // SITE_* and silently renders "Portfolio" with empty contacts — the identity
    // is public by design, so exposing these is safe. PLAUSIBLE_/PREVIEW_ are the
    // other prefixes the app reads (BaseLayout).
    envPrefix: ['PUBLIC_', 'SITE_', 'PLAUSIBLE_', 'PREVIEW_'],
  },
});
