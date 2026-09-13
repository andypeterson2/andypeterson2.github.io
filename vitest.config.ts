import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  // Compiles Svelte runes modules so their controllers can be unit-tested; the `browser`
  // condition loads the client runtime so `$state`/`$derived` react under vitest.
  plugins: [svelte({ configFile: false })],
  resolve: { conditions: ['browser'] },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/integration/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      // json-summary + lcov: machine-readable output so coverage can be diffed
      // across runs / surfaced in CI, not just eyeballed in the HTML report.
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage',
      // The whole logic surface, not just the well-covered files; the gap is glue only e2e
      // exercises. .astro/.svelte stay out: v8 can't parse them, and e2e covers them.
      include: ['src/lib/**/*.{ts,js}', 'src/editor/lib/**/*.{ts,js}'],
      exclude: [
        'src/env.d.ts',
        '**/*.astro',
        '**/*.config.*',
        'tests/**',
        'dist/**',
        'coverage/**',
      ],
      // Regression ratchet just below the measured floor (2026-08: 72.5% stmts, 74.7% lines,
      // 65.8% branch, 64.6% func). Raise as coverage grows; never loosen to hide a gap.
      thresholds: {
        lines: 73,
        functions: 62,
        branches: 63,
        statements: 71,
      },
    },
  },
});
