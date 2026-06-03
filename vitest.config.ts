import { defineConfig } from 'vitest/config';

export default defineConfig({
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
