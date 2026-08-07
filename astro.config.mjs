// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';

// Inline PostCSS plugin — add `font-display: optional` to any @font-face missing it. The
// System-6 text faces paint within a ~100ms block in the fallback stack and are NEVER
// swapped in mid-page, so there's no FOIT (invisible text, the old ~2.6s LCP wait) AND no
// reflow: `swap` was measured to spike CLS to ~0.13 here because these pixel fonts have
// very different metrics from the fallback, and that layout shift cost more than the LCP
// gain. The small same-origin woff2 files usually load inside the block window, so the real
// font still renders; on a slow first load the fallback shows and the font is cached for
// next time. Skips the bootstrap-icons face (already font-display:block; icons must not
// flash). Runs over the vendored system.css via Vite — no node_modules patch, matches on
// @font-face structure so it survives version bumps.
const fontDisplayOptional = {
  postcssPlugin: 'font-display-optional',
  AtRule: {
    'font-face': (rule) => {
      let family = '';
      let hasDisplay = false;
      rule.walkDecls((decl) => {
        if (decl.prop === 'font-family') family = decl.value.replace(/['"]/g, '').trim();
        if (decl.prop === 'font-display') hasDisplay = true;
      });
      if (hasDisplay || family.toLowerCase() === 'bootstrap-icons') return;
      rule.append({ prop: 'font-display', value: 'optional' });
    },
  },
};

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
        // Fonts ship as same-origin files (vite.build.assetsInlineLimit below never
        // inlines them), so 'self' suffices — no data: or external font origins.
        "font-src 'self'",
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
    css: {
      // Run the font-display:optional plugin (defined above) over the bundled CSS.
      postcss: { plugins: [fontDisplayOptional] },
    },
    build: {
      // Never inline fonts. Vite's default inlines assets < 4KB as base64, which
      // for the small System-6 woff2 faces bloats the render-blocking CSS by ~20KB
      // (base64 is +33% and lands in the critical bundle) — the main FCP drag on
      // throttled connections. As files they load in parallel and stay cacheable.
      // Small SVGs/PNGs still inline (returning undefined = default), which keeps
      // the ~22 system.css UI SVGs out of the request waterfall.
      assetsInlineLimit: (filePath) =>
        /\.(woff2?|ttf|otf|eot)$/i.test(filePath) ? false : undefined,
    },
  },
});
