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
 *
 * ── THE ONE LEGITIMATE PRODUCTION BUILD WITH MOCKS ────────────────────────────────────────────
 * The Playwright suite. Its entire design is to drive the REAL bundle — same minification, same
 * router, same money formatting — with no backend, database or Telegram bot behind it, which is a
 * production build with `VITE_ENABLE_MOCKS=true` and nothing else it could be.
 *
 * So the refusal takes a second key. `VITE_ALLOW_MOCKS_IN_BUILD` is set by `playwright.config.ts`
 * and by nothing else, and it exists as a SEPARATE variable rather than as a mode check because the
 * failure being guarded against is a stale `.env` line — and one stale line can no longer do it.
 * Its name is the whole safety property: nobody sets a variable called "allow mocks in build" while
 * believing they are configuring production.
 *
 * This is strictly stronger than a single flag and strictly weaker than no escape hatch at all. The
 * alternative considered and rejected was building the e2e bundle in development mode, which would
 * have left this file untouched and quietly stopped testing the bundle that actually ships.
 */
async function enableMocksIfRequested(): Promise<void> {
  if (!config.enableMocks) return;

  if (import.meta.env.PROD && !config.allowMocksInBuild) {
    throw new Error(
      'VITE_ENABLE_MOCKS is set in a production build. The mock backend accepts fixed sign-in ' +
        'codes (123456 signs in as SUPER_ADMIN) and would let anyone into this console. Rebuild ' +
        'with VITE_ENABLE_MOCKS=false. (The Playwright suite is the one exception and sets ' +
        'VITE_ALLOW_MOCKS_IN_BUILD=true; never set that anywhere a person can reach the result.)',
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
