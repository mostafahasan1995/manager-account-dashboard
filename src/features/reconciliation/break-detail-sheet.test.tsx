import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { Toaster } from 'sonner';
import { describe, expect, it } from 'vitest';

import { reconciliationSearchSchema } from '@/app/search-schemas';
import { config } from '@/config';
import { BREAK_IDS } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderWithProviders, type AuthOverrides } from '@/test/utils';

import { BreakDetailSheet } from './break-detail-sheet';

const validateSearch = (search: Record<string, unknown>) =>
  reconciliationSearchSchema.parse(search);

const render = (breakId: string, auth?: AuthOverrides) =>
  renderWithProviders(
    <>
      <Toaster />
      <BreakDetailSheet />
    </>,
    {
      route: `/reconciliation?selected=${breakId}`,
      routePath: '/reconciliation',
      validateSearch,
      ...(auth === undefined ? {} : { auth }),
    },
  );

const breakReturns = (overrides: Record<string, unknown>) => {
  server.use(
    http.get(`${config.apiBaseUrl}/v1/admin/reconciliation/breaks/:id`, () =>
      HttpResponse.json({
        success: true,
        data: {
          id: BREAK_IDS.floatMismatch,
          category: 'MISSING_CREDIT',
          status: 'OPEN',
          severity: 3,
          currencyCode: 'NSP',
          expected: null,
          actual: null,
          delta: null,
          depositRequestId: null,
          playerId: null,
          ledgerAccountId: null,
          ichancyCallId: null,
          detail: null,
          dedupeKey: null,
          detectedAt: new Date().toISOString(),
          assignedToAdminId: null,
          resolvedAt: null,
          resolvedByAdminId: null,
          resolutionNote: null,
          resolutionTxId: null,
          ...overrides,
        },
        error: null,
        meta: { correlationId: 'test-break', timestamp: new Date().toISOString() },
      }),
    ),
  );
};

describe('BreakDetailSheet', () => {
  it('stays shut until a break is selected', async () => {
    renderWithProviders(<BreakDetailSheet />, {
      route: '/reconciliation',
      routePath: '/reconciliation',
      validateSearch,
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('shows the three figures and what the check recorded', async () => {
    render(BREAK_IDS.floatMismatch);

    expect(
      await screen.findByRole('heading', { name: 'Agent float mismatch' }),
    ).toBeInTheDocument();
    expect(screen.getByText('+4,500,000.00 NSP')).toBeInTheDocument();
    expect(screen.getByText('+4,437,500.00 NSP')).toBeInTheDocument();
    expect(screen.getByText('-62,500.00 NSP')).toBeInTheDocument();
    expect(screen.getByText('source')).toBeInTheDocument();
    expect(screen.getByText('getAgentAllWallets')).toBeInTheDocument();
  });

  it('offers the raw JSON as well as the readable form', async () => {
    render(BREAK_IDS.stuckDeposit);

    expect(await screen.findByText('Raw JSON')).toBeInTheDocument();
    expect(screen.getByText(/"lastError": "REJECTED"/)).toBeInTheDocument();
  });

  it('assigns the break to the signed-in admin', async () => {
    const { user } = render(BREAK_IDS.floatMismatch);

    await user.click(await screen.findByRole('button', { name: /assign to me/i }));

    expect(await screen.findByText('Break assigned to you')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /assign to me/i })).not.toBeInTheDocument();
    });
  });

  it('reports a failed assignment instead of pretending it worked', async () => {
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/reconciliation/breaks/:id/assign`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'BREAK_NOT_FOUND', message: 'Break not found.' },
            meta: { correlationId: 'test-3', timestamp: new Date().toISOString() },
          },
          { status: 404 },
        ),
      ),
    );

    const { user } = render(BREAK_IDS.floatMismatch);

    await user.click(await screen.findByRole('button', { name: /assign to me/i }));

    expect(await screen.findByText('Could not assign the break')).toBeInTheDocument();
  });

  it('restates the delta, demands a reason, and shows the transaction it posted', async () => {
    const { user } = render(BREAK_IDS.floatMismatch);

    await user.click(await screen.findByRole('button', { name: /correct float/i }));

    const confirmation = await screen.findByText('The ledger will be restated');
    expect(confirmation).toBeInTheDocument();
    expect(screen.getAllByText('-62,500.00 NSP').length).toBeGreaterThan(1);

    await user.click(screen.getByRole('button', { name: /post the correction/i }));
    expect(await screen.findByText('Say why the ledger is being restated.')).toBeInTheDocument();

    await user.type(
      screen.getByLabelText('Reason'),
      'Ichancy re-read twice; the ledger is behind.',
    );
    await user.click(screen.getByRole('button', { name: /post the correction/i }));

    expect((await screen.findAllByText('Ledger correction posted')).length).toBeGreaterThan(0);
    expect(
      (await screen.findAllByText(/66666666-0000-4000-8000-\d{12}/, { selector: 'code' })).length,
    ).toBeGreaterThan(0);
  });

  it('only offers a float correction on a float mismatch', async () => {
    render(BREAK_IDS.missingCredit);

    expect(await screen.findByRole('button', { name: /resolve/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /correct float/i })).not.toBeInTheDocument();
  });

  it('gives a viewer the whole break and none of the actions', async () => {
    render(BREAK_IDS.floatMismatch, { role: 'VIEWER' });

    expect(
      await screen.findByRole('heading', { name: 'Agent float mismatch' }),
    ).toBeInTheDocument();
    expect(screen.getByText('-62,500.00 NSP')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /assign to me/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /correct float/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^resolve$/i })).not.toBeInTheDocument();
  });

  it('offers nothing to act on once the break is already closed', async () => {
    render(BREAK_IDS.resolved);

    expect(
      await screen.findByRole('heading', { name: 'Unidentified receipt' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /assign to me/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^resolve$/i })).not.toBeInTheDocument();
  });

  it('renders every kind of value the detail blob can hold', async () => {
    breakReturns({
      detail: {
        attempts: 3,
        recovered: false,
        lastError: null,
        checkedAt: new Date(Date.now() - 60_000).toISOString(),
        response: { code: 'AMBIGUOUS' },
      },
    });

    render(BREAK_IDS.floatMismatch);

    expect(await screen.findByText('attempts')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
    expect(screen.getByText('1 minute ago')).toBeInTheDocument();
    expect(screen.getByText('{"code":"AMBIGUOUS"}')).toBeInTheDocument();
  });

  it('falls back to the raw JSON when the detail is not an object', async () => {
    breakReturns({ detail: ['first', 'second'] });

    render(BREAK_IDS.floatMismatch);

    expect(await screen.findAllByText(/"first"/)).toHaveLength(2);
  });

  it('says the check recorded nothing rather than showing an empty block', async () => {
    breakReturns({ detail: null });

    render(BREAK_IDS.floatMismatch);

    expect(await screen.findByText('The check recorded no detail.')).toBeInTheDocument();
  });

  /**
   * Each link is gated by its OWN capability, not by one blanket check. A VIEWER reads the deposit
   * queue but holds no `players.read`, so the deposit link is real and the player is shown as a
   * plain id — a link that lands on a redirect is worse than no link.
   */
  it('links only to the screens the role can actually open, and prints the rest as ids', async () => {
    breakReturns({
      depositRequestId: 'dddddddd-0000-4000-8000-000000000001',
      playerId: 'cccccccc-0000-4000-8000-000000000001',
    });

    render(BREAK_IDS.floatMismatch, { role: 'VIEWER' });

    await screen.findByRole('heading', { name: 'Missing credit' });

    const links = screen.getAllByRole('link');
    expect(links.every((link) => link.getAttribute('href')?.includes('/players/') !== true)).toBe(
      true,
    );
    expect(screen.getByText('cccccccc-0000-4000-8000-000000000001')).toBeInTheDocument();
  });

  it('shows the failure when the break itself cannot be read', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/reconciliation/breaks/:id`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'BREAK_NOT_FOUND', message: 'Break not found.' },
            meta: { correlationId: 'test-4', timestamp: new Date().toISOString() },
          },
          { status: 404 },
        ),
      ),
    );

    render(BREAK_IDS.floatMismatch);

    expect(await screen.findByRole('alert')).toHaveTextContent('Break not found.');
  });

  it('takes the selection out of the URL when the panel is closed', async () => {
    const { user, location } = render(BREAK_IDS.floatMismatch);

    await user.click(await screen.findByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(location()).not.toContain('selected');
    });
  });
});
