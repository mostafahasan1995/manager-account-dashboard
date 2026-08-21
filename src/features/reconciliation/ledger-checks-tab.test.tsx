import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { Toaster } from 'sonner';
import { describe, expect, it } from 'vitest';

import { config } from '@/config';
import { server } from '@/test/msw-server';
import { renderPlain, type AuthOverrides } from '@/test/utils';

import { LedgerChecksTab } from './ledger-checks-tab';

const render = (auth?: AuthOverrides) =>
  renderPlain(
    <>
      <Toaster />
      <LedgerChecksTab />
    </>,
    auth === undefined ? {} : { auth },
  );

const invariantsReturn = (body: Record<string, unknown>) => {
  server.use(
    http.post(`${config.apiBaseUrl}/v1/admin/reconciliation/invariants/run`, () =>
      HttpResponse.json({
        success: true,
        data: body,
        error: null,
        meta: { correlationId: 'test-inv', timestamp: new Date().toISOString() },
      }),
    ),
  );
};

describe('LedgerChecksTab', () => {
  it('explains what the checks do before anyone runs them', () => {
    render();

    expect(screen.getByText(/every transaction must balance to zero/i)).toBeInTheDocument();
  });

  it('reports a clean ledger as clean', async () => {
    const { user } = render();

    await user.click(screen.getByRole('button', { name: /run ledger invariant checks/i }));

    expect(await screen.findByText('Ledger consistent')).toBeInTheDocument();
    expect(screen.getByText('No violations to list.')).toBeInTheDocument();
  });

  it('names each broken invariant and the money behind it', async () => {
    invariantsReturn({
      ok: false,
      checkedAt: new Date().toISOString(),
      truncated: false,
      violations: [
        {
          invariant: 'I1_TRANSACTION_BALANCES',
          subject: 'tx-9001',
          currencyCode: 'NSP',
          expectedMinor: '0',
          actualMinor: '250000',
          deltaMinor: '250000',
          detail: 'Credit leg missing.',
        },
      ],
    });

    const { user } = render();

    await user.click(screen.getByRole('button', { name: /run ledger invariant checks/i }));

    expect(await screen.findByText('Ledger not consistent')).toBeInTheDocument();
    expect(screen.getByText('Every transaction balances to zero')).toBeInTheDocument();
    expect(screen.getByText('tx-9001')).toBeInTheDocument();
    expect(screen.getByText('+2,500.00 NSP')).toBeInTheDocument();
    expect(screen.getByText('Credit leg missing.')).toBeInTheDocument();
  });

  it('shows an invariant it has no label for as the backend named it', async () => {
    invariantsReturn({
      ok: false,
      checkedAt: new Date().toISOString(),
      truncated: false,
      violations: [
        {
          invariant: 'I9_SOMETHING_NEW',
          subject: 'account-3',
          currencyCode: 'NSP',
          expectedMinor: 100,
          actualMinor: 'not-a-number',
          deltaMinor: -100,
          detail: 'Added by the backend after this build.',
        },
      ],
    });

    const { user } = render();

    await user.click(screen.getByRole('button', { name: /run ledger invariant checks/i }));

    expect(await screen.findByText('I9_SOMETHING_NEW')).toBeInTheDocument();
    expect(screen.getByText('not-a-number')).toBeInTheDocument();
    expect(screen.getByText('-1.00 NSP')).toBeInTheDocument();
  });

  it('states plainly that a capped check may be hiding more', async () => {
    invariantsReturn({
      ok: false,
      checkedAt: new Date().toISOString(),
      truncated: true,
      violations: [
        {
          invariant: 'I2_GLOBAL_BALANCE',
          subject: 'NSP',
          currencyCode: 'NSP',
          expectedMinor: '0',
          actualMinor: '-500',
          deltaMinor: '-500',
          detail: 'Currency does not balance.',
        },
      ],
    });

    const { user } = render();

    await user.click(screen.getByRole('button', { name: /run ledger invariant checks/i }));

    expect(
      await screen.findByText(/a check hit its row cap — there may be more/i),
    ).toBeInTheDocument();
  });

  it('reports a failed run instead of an empty report', async () => {
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/reconciliation/invariants/run`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'INTERNAL_ERROR', message: 'The invariant run failed.' },
            meta: { correlationId: 'test-7', timestamp: new Date().toISOString() },
          },
          { status: 500 },
        ),
      ),
    );

    const { user } = render();

    await user.click(screen.getByRole('button', { name: /run ledger invariant checks/i }));

    expect(await screen.findByText('The checks did not run')).toBeInTheDocument();
    expect(screen.getByText('Could not run the invariant checks')).toBeInTheDocument();
  });

  it('lets a viewer read what the checks are for without offering to run them', () => {
    render({ role: 'VIEWER' });

    expect(screen.getByText(/every transaction must balance to zero/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /run ledger invariant checks/i }),
    ).not.toBeInTheDocument();
  });
});
