import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  // The svelte plugin compiles `.svelte.ts` runes modules so their controllers
  // (undo, tags, variants, letters, …) can finally be unit-tested — the reactive
  // "shell" tier that was e2e-only before (tech-debt round-two item 17). The
  // `browser` resolve condition pulls in Svelte's client runtime, so `$state` /
  // `$derived` actually react under vitest. Only affects `npm run test`; the Astro
  // build has its own config.
  // configFile:false — there is no root svelte.config (Astro's integration owns
  // its own); this stops the plugin warning on every run and keeps its defaults.
  plugins: [svelte({ configFile: false })],
  resolve: { conditions: ['browser'] },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/integration/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      // Measure the WHOLE logic surface — the portal lib (src/lib/**) and the editor
      // lib (src/editor/lib/**) — without cherry-picking the well-covered files (that
      // would only relocate the blind spot). The slice controllers (tags/variants/
      // letters/preview/tour) and the core store are now unit-tested (tests/editor-*
      // -controller.test.ts, editor-store.test.ts); api.ts and some store branches
      // still lean on the Playwright e2e suite, which v8 unit coverage can't see — so
      // the honest number is ~54%, not a faked 100%. Thresholds are a regression
      // RATCHET just below that floor; raise them as more branches land.
      // .astro/.svelte stay out — v8 can't parse them; they're e2e-covered.
      include: ['src/lib/**/*.{ts,js}', 'src/editor/lib/**/*.{ts,js}'],
      exclude: [
        'src/env.d.ts',
        '**/*.astro',
        '**/*.config.*',
        'tests/**',
        'dist/**',
        'coverage/**',
      ],
      // Honest floor (current ~54% stmts/lines, ~46% branch, ~49% func). A drop below
      // these fails CI; ratchet UP as coverage grows — never loosen to hide a gap.
      thresholds: {
        lines: 51,
        functions: 46,
        branches: 43,
        statements: 50,
      },
    },
  },
});
