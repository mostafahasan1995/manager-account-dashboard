import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/app';
import { AppProviders } from './app/providers';
import { config } from './config';
import './styles.css';

/**
 * The mock backend, and the one thing it must never be allowed to do.
 *
 * Demo mode signs anyone in from a table of six fixed codes — `123456` is SUPER_ADMIN, `111111` is
 * PLATFORM_ADMIN — with no bot, no Telegram account and no `admin_users` row. That is correct for a
 * demo and catastrophic anywhere else: a production bundle built with `VITE_ENABLE_MOCKS=true`
 * would be a console that hands full authority to anyone who reads the README, and NOTHING on
 * screen distinguishes it from the real thing. The screens, the data and the roles all look right.
 *
 * A single stale line in a `.env` file is all it takes, so this refuses at runtime rather than
 * trusting the deployment to be careful — and it throws instead of quietly ignoring the flag,
 * because a build that asked for fake auth is misconfigured and must be seen to be, not silently
 * corrected into serving real data it was never pointed at.
 */
async function enableMocksIfRequested(): Promise<void> {
  if (!config.enableMocks) return;

  if (import.meta.env.PROD) {
    throw new Error(
      'VITE_ENABLE_MOCKS is set in a production build. The mock backend accepts fixed sign-in ' +
        'codes (123456 signs in as SUPER_ADMIN) and would let anyone into this console. Rebuild ' +
        'with VITE_ENABLE_MOCKS=false.',
    );
  }

  const { startMockWorker } = await import('./mocks/browser');
  await startMockWorker();
}

void enableMocksIfRequested().then(() => {
  const container = document.getElementById('root');
  if (container === null) throw new Error('#root is missing from index.html');

  createRoot(container).render(
    <StrictMode>
      <AppProviders>
        <App />
      </AppProviders>
    </StrictMode>,
  );
});
