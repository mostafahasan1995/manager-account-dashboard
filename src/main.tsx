import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/app';
import { AppProviders } from './app/providers';
import { config } from './config';
import './styles.css';

async function enableMocksIfRequested(): Promise<void> {
  if (!config.enableMocks) return;
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
