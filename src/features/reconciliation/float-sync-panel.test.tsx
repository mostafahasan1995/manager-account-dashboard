import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { Toaster } from 'sonner';
import { describe, expect, it } from 'vitest';

import { reconciliationSearchSchema } from '@/app/search-schemas';
import { config } from '@/config';
import { server } from '@/test/msw-server';
import { renderWithProviders, type AuthOverrides } from '@/test/utils';

import { FloatSyncPanel } from './float-sync-panel';

const validateSearch = (search: Record<string, unknown>) =>
  reconciliationSearchSchema.parse(search);

const render = (auth?: AuthOverrides) =>
  renderWithProviders(
    <>
      <Toaster />
      <FloatSyncPanel />
    </>,
    {
      route: '/reconciliation',
      routePath: '/reconciliation',
      validateSearch,
      ...(auth === undefined ? {} : { auth }),
    },
  );

const syncReturns = (body: Record<string, unknown>) => {
  server.use(
    http.post(`${config.apiBaseUrl}/v1/admin/reconciliation/agent-float/sync`, () =>
      HttpResponse.json({
        success: true,
        data: body,
        error: null,
        meta: { correlationId: 'test-sync', timestamp: new Date().toISOString() },
      }),
    ),
  );
};

describe('FloatSyncPanel', () => {
  it('puts the two sides and the difference between them on screen', async () => {
    const { user } = render();

    await user.click(await screen.findByRole('button', { name: /sync agent float/i }));

    expect(await screen.findByText('4,500,000.00 NSP')).toBeInTheDocument();
    expect(screen.getByText('4,437,500.00 NSP')).toBeInTheDocument();
    expect(screen.getByText('-62,500.00 NSP')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open the break this raised/i })).toBeInTheDocument();
  });

  it('treats an unreadable Ichancy wallet as the finding, not as a missing value', async () => {
    syncReturns({
      currencyCode: 'NSP',
      ledgerMinor: '450000000',
      ichancyMinor: null,
      deltaMinor: null,
      breakId: null,
      belowWatermark: false,
      ichancyFake: false,
    });

    const { user } = render();

    await user.click(await screen.findByRole('button', { name: /sync agent float/i }));

    expect(await screen.findByText('Ichancy could not be read')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText('Not comparable')).toBeInTheDocument();
    expect(screen.getByText('No break was raised by this sync.')).toBeInTheDocument();
    expect(screen.getByText(/Ichancy did not answer/i)).toBeInTheDocument();
  });

  it('says Ichancy is in fake mode instead of calling a skipped read unreadable', async () => {
    syncReturns({
      currencyCode: 'NSP',
      ledgerMinor: '450000000',
      ichancyMinor: null,
      deltaMinor: null,
      breakId: null,
      belowWatermark: false,
      ichancyFake: true,
    });

    const { user } = render();

    await user.click(await screen.findByRole('button', { name: /sync agent float/i }));

    expect(await screen.findByText('Ichancy is in fake mode')).toBeInTheDocument();
    expect(
      screen.getByText(/ICHANCY_FAKE=true, so the agent wallet was not read/),
    ).toBeInTheDocument();
    expect(screen.getByText('Not read (fake mode)')).toBeInTheDocument();
    expect(screen.getByText('Not compared (fake mode)')).toBeInTheDocument();
    // Neither of the real-mode "something is broken" readings.
    expect(screen.queryByText('Ichancy could not be read')).not.toBeInTheDocument();
    expect(screen.queryByText('Unavailable')).not.toBeInTheDocument();
  });

  it('raises the low watermark as an alert rather than as a footnote', async () => {
    syncReturns({
      currencyCode: 'NSP',
      ledgerMinor: '9000000',
      ichancyMinor: '8000000',
      deltaMinor: '-1000000',
      breakId: null,
      belowWatermark: true,
      ichancyFake: false,
    });

    const { user } = render();

    await user.click(await screen.findByRole('button', { name: /sync agent float/i }));

    expect(
      await screen.findByText('The agent float is below the low watermark'),
    ).toBeInTheDocument();
    expect(screen.getByText('Below')).toBeInTheDocument();
  });

  it('opens the break the sync raised on the breaks tab', async () => {
    const { user, location } = render();

    await user.click(await screen.findByRole('button', { name: /sync agent float/i }));
    await user.click(await screen.findByRole('button', { name: /open the break this raised/i }));

    expect(location()).toContain('selected=ffffffff-0000-4000-8000-000000000001');
    expect(location()).toContain('tab=breaks');
  });

  it('reports a failed sync instead of leaving the last numbers up', async () => {
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/reconciliation/agent-float/sync`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'ICHANCY_UNAVAILABLE', message: 'The agent wallet did not answer.' },
            meta: { correlationId: 'test-5', timestamp: new Date().toISOString() },
          },
          { status: 502 },
        ),
      ),
    );

    const { user } = render();

    await user.click(await screen.findByRole('button', { name: /sync agent float/i }));

    expect(await screen.findByText('The float sync failed')).toBeInTheDocument();
    expect(screen.getByText('Could not sync the agent float')).toBeInTheDocument();
  });

  it('is not offered at all to a role that cannot act on reconciliation', () => {
    render({ role: 'VIEWER' });

    expect(screen.queryByRole('button', { name: /sync agent float/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Agent float')).not.toBeInTheDocument();
  });
});
