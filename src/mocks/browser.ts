import { setupWorker } from 'msw/browser';

import { handlers } from './handlers';

/**
 * The in-browser mock API. Started from `main.tsx` only when `VITE_ENABLE_MOCKS=true`, which is how
 * the console runs in demo mode and how the Playwright suite runs with no backend at all.
 */
export const worker = setupWorker(...handlers);

export async function startMockWorker(): Promise<void> {
  await worker.start({
    // A request the mocks do not implement should reach the network, not fail silently.
    onUnhandledRequest: 'bypass',
    quiet: true,
    serviceWorker: { url: '/mockServiceWorker.js' },
  });
}
