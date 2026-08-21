import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { config } from '@/config';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';

import { RailAgeingTab } from './rail-ageing-tab';

const ageingReturns = (body: Record<string, unknown>) => {
  server.use(
    http.get(`${config.apiBaseUrl}/v1/admin/reconciliation/rail-ageing`, () =>
      HttpResponse.json({
        success: true,
        data: body,
        error: null,
        meta: { correlationId: 'test-ageing', timestamp: new Date().toISOString() },
      }),
    ),
  );
};

const cardFor = (accountCode: string) =>
  screen.getByText(accountCode).closest<HTMLElement>('div[class*="rounded-lg"]')!;

describe('RailAgeingTab', () => {
  it('lists every clearing account with its balance', async () => {
    renderPlain(<RailAgeingTab />);

    expect(await screen.findByText('RAIL_CLEARING:BANK_SYR')).toBeInTheDocument();
    expect(screen.getByText('RAIL_CLEARING:MOBILE_WALLET')).toBeInTheDocument();
    expect(screen.getByText('185,000.00 NSP')).toBeInTheDocument();
    expect(screen.getByText('2,500.00 NSP')).toBeInTheDocument();
  });

  it('marks the stale account and says why it matters', async () => {
    renderPlain(<RailAgeingTab />);

    await screen.findByText('RAIL_CLEARING:BANK_SYR');

    expect(
      screen.getByText(/never been matched to a bank statement/i),
    ).toHaveTextContent('RAIL_CLEARING:BANK_SYR');
    expect(within(cardFor('RAIL_CLEARING:BANK_SYR')).getByText(/stale/i)).toBeInTheDocument();
    expect(
      within(cardFor('RAIL_CLEARING:MOBILE_WALLET')).queryByText(/stale/i),
    ).not.toBeInTheDocument();
  });

  it('breaks each account down by age with the net and the entry count', async () => {
    renderPlain(<RailAgeingTab />);

    await screen.findByText('RAIL_CLEARING:BANK_SYR');
    const rows = within(cardFor('RAIL_CLEARING:BANK_SYR')).getAllByRole('row');
    const oldest = rows[rows.length - 1]!;

    expect(within(oldest).getByText('30d+')).toBeInTheDocument();
    expect(within(oldest).getByText('+14,500.00 NSP')).toBeInTheDocument();
    expect(within(oldest).getByText('2')).toBeInTheDocument();
  });

  it('says nothing is stale when nothing is', async () => {
    ageingReturns({
      generatedAt: new Date().toISOString(),
      rows: [
        {
          accountId: 'acc-1',
          accountCode: 'RAIL_CLEARING:CLEAN',
          currencyCode: 'NSP',
          paymentMethodId: null,
          balanceMinor: '0',
          oldestUnsettledAt: null,
          buckets: [
            {
              label: '0-1d',
              fromDays: 0,
              toDays: 1,
              debitMinor: '0',
              creditMinor: '0',
              netMinor: '0',
              entryCount: 0,
            },
          ],
        },
      ],
      staleAccountCodes: [],
    });

    renderPlain(<RailAgeingTab />);

    expect(await screen.findByText('RAIL_CLEARING:CLEAN')).toBeInTheDocument();
    expect(screen.queryByText(/never been matched to a bank statement/i)).not.toBeInTheDocument();
  });

  it('says so when there are no clearing accounts at all', async () => {
    ageingReturns({
      generatedAt: new Date().toISOString(),
      rows: [],
      staleAccountCodes: [],
    });

    renderPlain(<RailAgeingTab />);

    expect(await screen.findByText('No rail clearing accounts')).toBeInTheDocument();
  });

  it('shows the failure rather than an empty report', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/reconciliation/rail-ageing`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'INTERNAL_ERROR', message: 'The ageing report failed.' },
            meta: { correlationId: 'test-6', timestamp: new Date().toISOString() },
          },
          { status: 500 },
        ),
      ),
    );

    renderPlain(<RailAgeingTab />);

    expect(await screen.findByRole('alert')).toHaveTextContent('The ageing report failed.');
  });
});
