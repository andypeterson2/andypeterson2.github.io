import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,astro}'],
      exclude: ['src/env.d.ts'],
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
    },
  },
});
