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
      // Count the whole testable logic surface (src/lib/**), not just files an
      // existing test happens to import — otherwise an untested new module is
      // invisible to the gate. Vitest v4's coverage.include defaults to
      // "files imported during the test run", so this glob is what makes the
      // thresholds meaningful. .astro/pages/components stay out (v8 can't parse
      // .astro, and they're covered by e2e, not unit tests).
      include: ['src/lib/**/*.{ts,js}'],
      // .astro files are excluded — v8 cannot parse them as runtime JS.
      exclude: [
        'src/env.d.ts',
        '**/*.astro',
        '**/*.config.*',
        'tests/**',
        'dist/**',
        'coverage/**',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
  },
});
