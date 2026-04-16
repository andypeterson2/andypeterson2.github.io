import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      // Coverage reflects files actually imported by tests. As logic moves
      // from .astro frontmatter into src/lib/ modules (see tests/lib/),
      // the covered surface expands naturally.
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
