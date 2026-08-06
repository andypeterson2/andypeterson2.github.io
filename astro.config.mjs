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
          'https://plausible.io',
          // Hash of the no-FOUC theme bootstrap — an `is:inline` <script> in
          // BaseLayout.astro that Astro deliberately does NOT auto-hash. If that
          // script's bytes change, this hash must change with it, or the CSP
          // blocks it in production (silent FOUC). tests/integration/csp.test.ts
          // recomputes it from the built HTML and fails if they drift.
          "'sha256-HtnKF9Q9BqMM7MpvEnYWNeMRvr0cAXf7QDRakU++yxI='",
        ],
      },
      styleDirective: {
        resources: ["'self'"],
      },
      directives: [
        "default-src 'self'",
        // Vite inlines the small System-6 woff2 fonts as data: URIs in the bundled
        // CSS (fewer requests, no FOIT), so data: is required here — same rationale
        // as img-src's data: for the inlined SVGs. No external font origins.
        "font-src 'self' data:",
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
    // About merged into the home page (bio + skills + timeline with projects).
    '/about': '/',
    '/about/': '/',
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
