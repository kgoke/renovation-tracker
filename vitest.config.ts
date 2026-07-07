import { defineConfig } from 'vitest/config';

// Only the pure business-logic modules run under vitest (Node). Screens and
// native modules are exercised in the app itself.
export default defineConfig({
  test: {
    include: ['src/lib/__tests__/**/*.test.ts'],
  },
});
