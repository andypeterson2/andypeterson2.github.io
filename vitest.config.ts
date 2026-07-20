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
      // Measure the WHOLE logic surface — both the portal lib (src/lib/**) and the
      // editor lib (src/editor/lib/**) — not just files a test happens to import
      // (v4's default), and without cherry-picking the well-covered files, which
      // would only relocate the blind spot. So the number is honest, and low: the
      // pure logic is thoroughly unit-tested (diff/undo/tour ~100%), but the reactive
      // controllers (store.svelte.ts, tags, …) and api.ts are exercised by the
      // Playwright e2e suite (tests/e2e), which v8 unit coverage cannot see — so they
      // read as ~0% here. The thresholds below are therefore a regression RATCHET at
      // the true current floor, not an aspiration; raising real unit coverage of the
      // controller tier is tracked as tech debt, not faked with a green 100%.
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
      // Honest floor (current: ~25% stmts/lines, ~29% branch, ~23% func). A drop
      // below these fails CI; the goal is to ratchet UP as controller unit tests land.
      thresholds: {
        lines: 22,
        functions: 20,
        branches: 26,
        statements: 22,
      },
    },
  },
});
