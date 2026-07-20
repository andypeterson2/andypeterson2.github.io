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
      // would only relocate the blind spot). The slice controllers, the core store
      // (demo + connected paths), the api client, and the pure utils are unit-tested
      // (tests/editor-*.test.ts); the remaining gap is glue exercised only by the
      // Playwright e2e suite, which v8 unit coverage can't see — so the honest number
      // is ~66%, not a faked 100%. Thresholds are a regression RATCHET just below that
      // floor; raise them as coverage grows — never loosen to hide a gap.
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
      // Honest floor (current ~66% stmts/lines, ~60% branch, ~57% func).
      thresholds: {
        lines: 65,
        functions: 54,
        branches: 56,
        statements: 63,
      },
    },
  },
});
