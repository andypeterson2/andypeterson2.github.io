import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  // Compiles Svelte runes modules so their controllers can be unit-tested; the `browser`
  // condition loads the client runtime so `$state`/`$derived` react under vitest.
  plugins: [svelte({ configFile: false })],
  resolve: { conditions: ['browser'] },
  test: {
    // The ported engine suite stays JavaScript, as the evidence for the .js
    // engine it exercises.
    include: ['tests/**/*.test.ts', 'tests/**/*.test.js'],
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
        // whole include: 48.1% lines / 47.8% stmts / 51.0% func / 44.9% branch
        lines: 47,
        statements: 47,
        functions: 50,
        branches: 44,
        // the pure-logic half: 75.4% lines / 73.1% stmts / 66.5% func / 64.9% branch
        'src/{lib,editor/lib}/**': {
          lines: 75,
          statements: 73,
          functions: 66,
          branches: 64,
        },
        // The app shells, which are mostly DOM entry points Playwright drives.
        // Their own floor, so the logic inside them cannot slip behind the
        // global figure they hold down: 39.8% / 39.7% / 43.3% / 37.7%.
        'src/apps/**': {
          lines: 39,
          statements: 39,
          functions: 43,
          branches: 37,
        },
      },
    },
  },
});
