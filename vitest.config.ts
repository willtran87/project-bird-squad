import { defineConfig } from 'vitest/config';

// Unit tests for pure game logic. Kept apart from Playwright, whose specs live in
// tests/*.spec.ts and tools/tests/*.spec.ts: Vitest only collects co-located
// src/**/*.test.ts files, and Playwright's testDir ('./tests') never sees src/.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'tests/**', 'tools/**'],
    environment: 'node',
    restoreMocks: true,
    unstubGlobals: true,
  },
});
