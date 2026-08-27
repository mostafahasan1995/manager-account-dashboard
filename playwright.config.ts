import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // E2E runs against the production bundle with the MSW mock API enabled, so the suite needs no
    // backend, no database and no Telegram bot to prove the flows end to end.
    command: `npm run build && npm run preview -- --port ${String(PORT)} --strictPort`,
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    /*
     * BOTH variables, and this is the only place in the repository that sets the second one.
     * `src/main.tsx` refuses to boot a production build with mocks — correctly, because such a
     * bundle signs anyone in from a table of six fixed codes — and takes `VITE_ALLOW_MOCKS_IN_BUILD`
     * as the one deliberate exception. This suite is that exception: it exists to drive the bundle
     * that actually ships. See the comment on `enableMocksIfRequested`.
     */
    env: { VITE_ENABLE_MOCKS: 'true', VITE_ALLOW_MOCKS_IN_BUILD: 'true' },
  },
});
