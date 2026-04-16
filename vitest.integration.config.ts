/**
 * Separate vitest config for integration tests.
 *
 * Integration tests require `dist/` to exist (use `npm run test:integration`
 * which chains `astro build` before running them). They're kept out of the
 * default `npm test` run so unit tests stay fast.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
  },
});
