import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
    /*
     * Raised from the 5000ms default for the reason set out beside `asyncUtilTimeout` in
     * ./src/test/setup.ts: the same suite runs a second time under v8 coverage instrumentation,
     * where a case that drives a dialog through `userEvent` — every keystroke its own act() and
     * re-render — ran past five seconds and failed on the clock rather than on an assertion.
     *
     * A ceiling, not a budget. It cannot make a wrong expectation pass; it only stops a slow
     * machine from being reported as a broken console.
     */
    testTimeout: 20_000,
    // Pinned so a developer's .env.local cannot change what the suite is testing. Tests drive the
    // mock API through MSW's node server directly, so the in-browser demo flag must be off here.
    env: {
      VITE_API_BASE_URL: 'http://localhost:3000',
      VITE_ENABLE_MOCKS: 'false',
      VITE_TENANT_HEADER_ENABLED: 'false',
    },
    // Playwright specs live in e2e/ and are run by `npm run e2e`, not by vitest.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/index.ts',
        'src/mocks/browser.ts',
      ],
      /*
       * Raised 2026-08-25 to sit just under what the suite actually holds. It was 85/80/85/85
       * against a measured 91.13 / 85.44 / 90.57 / 92.57 — roughly six points of slack in which
       * coverage could fall for months without CI noticing, which is a gate that reports the past
       * rather than guarding the present.
       *
       * About a point of headroom each, and no more: enough that a legitimate small change does not
       * turn CI red for arithmetic reasons, not enough to hide a test file being deleted. The rule
       * for this block is in README.md — raise it, do not lower it.
       */
      thresholds: {
        statements: 90,
        branches: 84,
        functions: 89,
        lines: 91,

        /*
         * PER-FILE gates, because the global one cannot do this job and it was worth measuring
         * rather than assuming: deleting `money.test.ts` — 49 tests — moves the global statement
         * number from 91.13 to 90.95. Two tenths of a point. No global threshold with survivable
         * headroom can notice a single file's tests going away, and one tuned tightly enough to try
         * would turn red every time somebody added an if.
         *
         * These three are the files where that matters most, and each is already at the number
         * below, so this pins what the suite holds rather than asking for new tests:
         *
         *   money.ts        the ONLY place amounts are parsed. A rounding bug here is a wrong
         *                   number on a deposit, and it round-trips with the backend's own helper.
         *   concurrency.ts  the gate in front of the balance column. Its failure mode is a leaked
         *                   slot, which is invisible until the column wedges in production.
         *   permissions.ts  the mirror of the backend's role table. Drift here shows an operator a
         *                   button the server will refuse, or hides one it would have allowed.
         */
        'src/lib/money.ts': { statements: 100, branches: 94, functions: 100, lines: 100 },
        'src/lib/concurrency.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        'src/lib/auth/permissions.ts': {
          statements: 96,
          branches: 90,
          functions: 100,
          lines: 100,
        },
      },
    },
  },
});
