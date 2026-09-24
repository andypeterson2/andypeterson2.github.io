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
      // across runs and reported in CI as well as the HTML report.
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage',
      // Every TypeScript module the browser runs, demo apps included. v8 reads
      // neither .astro/.svelte (e2e covers those) nor declaration files.
      include: ['src/lib/**/*.{ts,js}', 'src/editor/lib/**/*.{ts,js}', 'src/apps/**/*.{ts,js}'],
      exclude: ['**/*.d.ts', '**/*.astro', '**/*.config.*', 'tests/**', 'dist/**', 'coverage/**'],
      // Regression ratchets, each just under its measured floor. Raise as coverage
      // grows; never loosen to hide a gap. Two levels: the app runtime is mostly
      // DOM entry points Playwright drives, which halves the global figure, so the
      // per-directory floor holds the pure logic to the standard it already meets.
      thresholds: {
        // whole include: 39.7% lines / 39.7% stmts / 44.4% func / 39.7% branch
        lines: 39,
        statements: 39,
        functions: 44,
        branches: 39,
        // the pure-logic half: 75.5% lines / 73.2% stmts / 66.5% func / 65.5% branch
        'src/{lib,editor/lib}/**': {
          lines: 75,
          statements: 73,
          functions: 66,
          branches: 65,
        },
      },
    },
  },
});
