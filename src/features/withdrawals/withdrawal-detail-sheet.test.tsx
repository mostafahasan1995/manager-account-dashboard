import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { WITHDRAWAL_IDS, mockWithdrawals } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderWithProviders, type AuthOverrides } from '@/test/utils';
import type { AdminWithdrawal } from '@/types';

import { WithdrawalDetailSheet } from './withdrawal-detail-sheet';

const fixture = (id: string): AdminWithdrawal => {
  const found = mockWithdrawals.find((row) => row.id === id);
  if (found === undefined) throw new Error(`fixture ${id} is missing`);
  return structuredClone(found);
};

const renderSheet = (
  withdrawalId: string | undefined,
  auth: AuthOverrides = { role: 'REVIEWER' },
  locale?: 'ar',
) => {
  const onClose = vi.fn();
  return {
    onClose,
    ...renderWithProviders(
      <WithdrawalDetailSheet withdrawalId={withdrawalId} onClose={onClose} />,
      {
        route:
          withdrawalId === undefined ? '/withdrawals' : `/withdrawals?selected=${withdrawalId}`,
        routePath: '/withdrawals',
        auth,
        ...(locale === undefined ? {} : { locale }),
      },
    ),
  };
};

const serve = (row: AdminWithdrawal) => {
  server.use(
    http.get(`${config.apiBaseUrl}/v1/admin/withdrawals/${row.id}`, () =>
      HttpResponse.json({
        success: true,
        data: row,
        error: null,
        meta: { correlationId: 'test', timestamp: new Date().toISOString() },
      }),
    ),
  );
};

describe('WithdrawalDetailSheet', () => {
  it('renders nothing while closed', () => {
    renderSheet(undefined);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the whole story of a debited row: timeline, money, address, wallet, records', async () => {
    renderSheet(WITHDRAWAL_IDS.debited);

    expect(await screen.findByText('Withdrawal WD9TT1')).toBeInTheDocument();
    const panel = screen.getByRole('dialog');

    expect(
      within(panel).getByText('Ready to pay · Automatic mode · USDT — TRC20 (Tron)'),
    ).toBeInTheDocument();
    expect(within(panel).getByTestId('withdrawal-timeline')).toBeInTheDocument();
    expect(within(panel).getByText('12,000.00 NSP')).toBeInTheDocument();
    expect(within(panel).getByText('42,000.00 NSP')).toBeInTheDocument();
    expect(within(panel).getByText('TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7')).toBeInTheDocument();
    expect(within(panel).getAllByText('TRC20').length).toBeGreaterThan(0);
    expect(within(panel).getByText('12,500.000000 USDT')).toBeInTheDocument();
    expect(within(panel).getByText('Wallet covers it')).toBeInTheDocument();
    expect(within(panel).getAllByText('samer1987').length).toBeGreaterThan(0);
    expect(within(panel).getByText('The platform (automatic mode)')).toBeInTheDocument();
    expect(within(panel).getByText(/Automatic mode: the platform approves/)).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Mark paid' })).toBeInTheDocument();
  });

  it('shows the rejection reason and who decided', async () => {
    renderSheet(WITHDRAWAL_IDS.rejected);

    expect(await screen.findByText('Withdrawal WD1NO9')).toBeInTheDocument();
    expect(
      screen.getByText('Account under review for a duplicate-proof deposit.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Rejected — nothing more to do here.')).toBeInTheDocument();
  });

  it('shows the payout reference and ledger row on a paid one', async () => {
    renderSheet(WITHDRAWAL_IDS.paid);

    expect(await screen.findByText('Withdrawal WD4OK5')).toBeInTheDocument();
    expect(screen.getByText('TRX-88112')).toBeInTheDocument();
    expect(screen.getByText('No wallet to check')).toBeInTheDocument();
    expect(
      screen.getByText('No figure: a wallet that did not answer is not an empty wallet.'),
    ).toBeInTheDocument();
  });

  it('says the wallet has not been checked on a row nobody has debited', async () => {
    renderSheet(WITHDRAWAL_IDS.requested);

    expect(await screen.findByText('Withdrawal WD7Q42')).toBeInTheDocument();
    expect(
      screen.getByText(/Not checked yet\. The payout wallet is read once/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Manual mode: nothing moves until a person approves/),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Nobody yet').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
  });

  it('shows the failure code and message, and the short wallet, on a refused debit', async () => {
    const row = fixture(WITHDRAWAL_IDS.debited);
    row.status = 'DEBIT_FAILED';
    row.failureCode = 'WITHDRAWAL_INSUFFICIENT_BALANCE';
    row.failureMessage = 'Ichancy refused the debit.';
    row.walletCheck = {
      status: 'insufficient',
      availableMinor: '5000000',
      currency: 'USDT',
      checkedAt: row.requestedAt,
    };
    serve(row);
    renderSheet(row.id);

    expect(await screen.findByText('Why the debit did not land')).toBeInTheDocument();
    expect(screen.getByText('WITHDRAWAL_INSUFFICIENT_BALANCE')).toBeInTheDocument();
    expect(screen.getByText('Ichancy refused the debit.')).toBeInTheDocument();
    expect(screen.getByText('Wallet short')).toBeInTheDocument();
    expect(screen.getByText(/The wallet held less than this payout/)).toBeInTheDocument();
    expect(screen.getByText('A person has to look at Ichancy')).toBeInTheDocument();
  });

  it('reports a withdrawal that would not load, with a way to try again', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/withdrawals/:id`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'INTERNAL', message: 'The row could not be read.' },
            meta: { correlationId: 'test', timestamp: new Date().toISOString() },
          },
          { status: 500 },
        ),
      ),
    );
    renderSheet(WITHDRAWAL_IDS.debited);

    expect(await screen.findByText('The row could not be read.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('closes through the sheet and tells the page', async () => {
    const { user, onClose } = renderSheet(WITHDRAWAL_IDS.debited);

    await screen.findByText('Withdrawal WD9TT1');
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });

  it('hides the actions from a reader', async () => {
    renderSheet(WITHDRAWAL_IDS.debited, { role: 'SUPPORT' });

    expect(await screen.findByText('Withdrawal WD9TT1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark paid' })).toBeNull();
    expect(
      screen.getByText('Your role can read withdrawals but not decide them.'),
    ).toBeInTheDocument();
  });

  it('reads in Arabic', async () => {
    renderSheet(WITHDRAWAL_IDS.debited, { role: 'REVIEWER' }, 'ar');

    expect(await screen.findByText('السحب WD9TT1')).toBeInTheDocument();
    expect(screen.getByText('محفظة الدفع')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تعليم كمدفوع' })).toBeInTheDocument();
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });
});
