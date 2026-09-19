// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';

// PostCSS plugin: add `font-display: optional` to any @font-face missing it. These pixel
// fonts' metrics differ so much from the fallback that `swap` spikes CLS to ~0.13; `optional`
// never swaps mid-page, so there is no reflow and no invisible text. The small same-origin
// woff2 files usually load inside the ~100ms block window; on a slow first load the fallback
// shows and the font is cached. Matching on @font-face structure survives system.css bumps.
const fontDisplayOptional = {
  postcssPlugin: 'font-display-optional',
  AtRule: {
    'font-face': (rule) => {
      let hasDisplay = false;
      rule.walkDecls((decl) => {
        if (decl.prop === 'font-display') hasDisplay = true;
      });
      if (hasDisplay) return;
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
          // Cloudflare Web Analytics beacon script.
          'https://static.cloudflareinsights.com',
          // Hash of the `is:inline` no-FOUC theme bootstrap, which Astro does not auto-hash.
          // It must change with that script's bytes; the CSP integration test fails on drift.
          "'sha256-9N93WdvhYx8jyvhhVqe+hD2/gNkNOZi3/WBWVXO3xho='",
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
        // The Web Analytics beacon POSTs RUM data to cloudflareinsights.com; the CV editor
        // fetches the credentialed api.andypeterson.dev gateway (behind Cloudflare Access).
        `connect-src 'self' https://cloudflareinsights.com https://api.andypeterson.dev${process.env.NODE_ENV !== 'production' ? ' ws://localhost:* wss://localhost:* http://localhost:*' : ''}`,
        "object-src 'none'",
        // The PDF renderer's worker is a same-origin ?url asset; blob: covers its fallback
        // worker path. isEvalSupported:false keeps it off 'unsafe-eval'.
        "worker-src 'self' blob:",
        // A downloaded blob: URL (the pv-bar download link) must remain navigable.
        "frame-src 'self' blob:",
        "base-uri 'self'",
        "form-action 'self' mailto:",
        "frame-ancestors 'none'",
      ],
    },
  },
  site: process.env.SITE_URL || 'https://andypeterson.dev',
  markdown: {
    // Shiki emits inline styles the hashed-inline CSP blocks, and no writeup uses fenced
    // code. For code blocks, use 'prism' (class-based, CSP-safe) with a Prism theme.
    syntaxHighlight: false,
  },
  redirects: {
    '/underconstruction.html': '/',
    '/underconstruction': '/',
    '/resume': '/',
    // #about opens the home page's About writeup. trailingSlash 'ignore' makes this cover
    // '/about/' too; defining both collides.
    '/about': '/#about',
    // The legacy project-detail surface is retired — the home timeline is the
    // one showcase surface. Exact paths only (the /app/ demo pages live on).
    '/projects': '/#projects',
    '/projects/latex-resume-editor': '/#latex-resume-editor',
    '/projects/quantum-video-chat': '/#quantum-video-chat',
    '/projects/quantum-nonogram-solver': '/#quantum-nonogram-solver',
    '/projects/quantum-ml-classifier': '/#quantum-ml-classifier',
    // The classifier demo lives under the AI/ML umbrella page.
    '/projects/quantum-ml-classifier/app': '/projects/ai-ml/app/',
    // /projects/ai-ml without /app/ anchors to the timeline card.
    '/projects/ai-ml': '/#quantum-ml-classifier',
  },
  vite: {
    // Vite exposes only VITE_* vars by default; without SITE_* siteConfig renders "Portfolio"
    // with no contacts. CF_BEACON_TOKEN is listed exactly, so no Cloudflare API token reaches the client.
    envPrefix: ['PUBLIC_', 'SITE_', 'CF_BEACON_TOKEN', 'PREVIEW_'],
    css: {
      // Run the font-display:optional plugin (defined above) over the bundled CSS.
      postcss: { plugins: [fontDisplayOptional] },
    },
    // Pre-bundle the lazily imported PDF library in dev so the first preview render doesn't
    // force a mid-session Vite re-optimize, which reloads the page under an in-flight compile.
    optimizeDeps: { include: ['pdfjs-dist'] },
    build: {
      // Never inline fonts: as base64 they add ~20KB to the render-blocking CSS, the main FCP
      // drag on throttled connections. Other small assets keep the default (undefined), which
      // keeps system.css's ~22 UI SVGs out of the request waterfall.
      assetsInlineLimit: (filePath) =>
        /\.(woff2?|ttf|otf|eot)$/i.test(filePath) ? false : undefined,
    },
  },
});
