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
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
  },
});
