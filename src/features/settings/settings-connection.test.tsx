import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { config } from '@/config';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';

import { SettingsConnection } from './settings-connection';

const unreachable = () => {
  server.use(
    http.get(`${config.apiBaseUrl}/health/live`, () => HttpResponse.error()),
    http.get(`${config.apiBaseUrl}/health/ready`, () => HttpResponse.error()),
  );
};

const readinessDown = () => {
  server.use(
    http.get(`${config.apiBaseUrl}/health/ready`, () =>
      HttpResponse.json(
        {
          success: true,
          data: {
            status: 'error',
            info: { database: { status: 'up' } },
            error: { redis: { status: 'down' } },
            details: { database: { status: 'up' }, redis: { status: 'down' } },
          },
          error: null,
          meta: { correlationId: 'test', timestamp: new Date().toISOString() },
        },
        { status: 503 },
      ),
    ),
  );
};

const liveIs = (live: { status: string; role: string; uptimeSeconds: number }) => {
  server.use(
    http.get(`${config.apiBaseUrl}/health/live`, () =>
      HttpResponse.json({
        success: true,
        data: { ...live, timestamp: new Date().toISOString() },
        error: null,
        meta: { correlationId: 'test', timestamp: new Date().toISOString() },
      }),
    ),
  );
};

describe('SettingsConnection', () => {
  it('shows which backend this console is pointed at', async () => {
    renderPlain(<SettingsConnection />);

    expect(screen.getByText(config.apiBaseUrl)).toBeInTheDocument();
    expect(await screen.findByText('Ready')).toBeInTheDocument();
  });

  it('says whether the mock API is on and what that means', () => {
    renderPlain(<SettingsConnection />);

    expect(screen.getByText('Mock API')).toBeInTheDocument();
    expect(screen.getByText(config.enableMocks ? 'On' : 'Off')).toBeInTheDocument();
    expect(
      screen.getByText(
        config.enableMocks
          ? /answered in the browser by the built-in mock API/i
          : /every request goes to the url above/i,
      ),
    ).toBeInTheDocument();
  });

  it('points at the tenant gap next to the tenant header flag', () => {
    renderPlain(<SettingsConnection />);

    expect(screen.getByText('Tenant header')).toBeInTheDocument();
    expect(screen.getByText(config.tenantHeaderEnabled ? 'Sent' : 'Not sent')).toBeInTheDocument();
    expect(screen.getByText(/docs\/API-CONTRACT\.md/)).toBeInTheDocument();
  });

  it('reports liveness and every readiness indicator when the backend is healthy', async () => {
    renderPlain(<SettingsConnection />);

    expect(await screen.findByText('api')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();

    const table = screen.getByRole('table');
    expect(within(table).getByText('Database')).toBeInTheDocument();
    expect(within(table).getByText('Redis')).toBeInTheDocument();
    expect(within(table).getAllByText('Up')).toHaveLength(2);
  });

  it('names the failing dependency in words, not just a colour', async () => {
    readinessDown();
    renderPlain(<SettingsConnection />);

    expect(await screen.findByText('Not ready')).toBeInTheDocument();

    const table = screen.getByRole('table');
    const redisRow = within(table).getByText('Redis').closest('tr');
    expect(redisRow).not.toBeNull();
    expect(within(redisRow as HTMLElement).getByText('Down')).toBeInTheDocument();
  });

  it('does not pretend a probe answered when only one of the two did', async () => {
    server.use(http.get(`${config.apiBaseUrl}/health/live`, () => HttpResponse.error()));
    renderPlain(<SettingsConnection />);

    expect(await screen.findByText('No answer')).toBeInTheDocument();
    expect(screen.queryByText('Process role')).not.toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('says when readiness answered nothing, rather than showing an empty table', async () => {
    liveIs({ status: 'degraded', role: 'worker', uptimeSeconds: 12 });
    server.use(http.get(`${config.apiBaseUrl}/health/ready`, () => HttpResponse.error()));
    renderPlain(<SettingsConnection />);

    expect(await screen.findByText('Degraded')).toBeInTheDocument();
    expect(screen.getByText('worker')).toBeInTheDocument();
    expect(screen.getByText('No answer')).toBeInTheDocument();
    expect(
      screen.getByText('The backend reported no readiness indicators.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('says the API is unreachable and what to check', async () => {
    unreachable();
    renderPlain(<SettingsConnection />);

    expect(
      await screen.findByText(new RegExp(`Could not reach the API at ${config.apiBaseUrl}`)),
    ).toBeInTheDocument();
    expect(screen.getByText(/CORS allow-list/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('retries the probes on request', async () => {
    unreachable();
    const { user } = renderPlain(<SettingsConnection />);

    await user.click(await screen.findByRole('button', { name: /try again/i }));

    // The override is still installed, so the honest answer stays on screen rather than flickering.
    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
