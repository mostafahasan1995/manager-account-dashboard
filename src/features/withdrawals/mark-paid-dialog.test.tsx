import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WITHDRAWAL_IDS, mockWithdrawals } from '@/mocks/fixtures';
import { renderPlain } from '@/test/utils';
import type { AdminWithdrawal } from '@/types';

import { MarkPaidDialog } from './mark-paid-dialog';

const fixture = (id: string): AdminWithdrawal => {
  const found = mockWithdrawals.find((row) => row.id === id);
  if (found === undefined) throw new Error(`fixture ${id} is missing`);
  return structuredClone(found);
};

const renderDialog = (row: AdminWithdrawal = fixture(WITHDRAWAL_IDS.debited), locale?: 'ar') => {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  const result = renderPlain(
    <MarkPaidDialog
      withdrawal={row}
      open
      onOpenChange={onOpenChange}
      loading={false}
      onConfirm={onConfirm}
    />,
    locale === undefined ? {} : { locale },
  );
  return { ...result, onConfirm, onOpenChange };
};

describe('MarkPaidDialog', () => {
  it('shows what to send, where, and what the payout wallet held', async () => {
    renderDialog();

    expect(await screen.findByText('Mark withdrawal WD9TT1 paid')).toBeInTheDocument();
    expect(screen.getByText('12,000.00 NSP')).toBeInTheDocument();
    expect(screen.getByText('TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7')).toBeInTheDocument();
    expect(screen.getByText('TRC20')).toBeInTheDocument();
    // USDT at six decimals — not 125,000,000.00.
    expect(screen.getByText('12,500.000000 USDT')).toBeInTheDocument();
    expect(screen.getByText('Wallet covers it')).toBeInTheDocument();
  });

  it('will not continue without a reference', async () => {
    const { user, onConfirm } = renderDialog();

    await user.click(await screen.findByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Type the reference of the transfer you made.',
    );
    expect(screen.queryByText('Post the payout to the ledger?')).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('refuses a reference over 128 characters', async () => {
    const { user, onConfirm } = renderDialog();

    const field = await screen.findByLabelText('Payout reference');
    await user.click(field);
    await user.paste('h'.repeat(129));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Keep the reference under 128 characters.',
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('asks a second time, restating amount, address and reference, before posting', async () => {
    const { user, onConfirm } = renderDialog();

    await user.type(await screen.findByLabelText('Payout reference'), ' TRX-99001 ');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Post the payout to the ledger?')).toBeInTheDocument();
    expect(
      screen.getByText(
        /12,000.00 NSP was sent to TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7 under reference TRX-99001/,
      ),
    ).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Yes, it was paid' }));
    expect(onConfirm).toHaveBeenCalledWith({ payoutReference: 'TRX-99001' });
  });

  it('goes back to the form with the reference still typed', async () => {
    const { user } = renderDialog();

    await user.type(await screen.findByLabelText('Payout reference'), 'TRX-1');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Back' }));

    expect(await screen.findByLabelText('Payout reference')).toHaveValue('TRX-1');
  });

  it('warns on both steps when the wallet was short', async () => {
    const row = fixture(WITHDRAWAL_IDS.debited);
    row.walletCheck = {
      status: 'insufficient',
      availableMinor: '1000000',
      currency: 'USDT',
      checkedAt: row.debitedAt ?? row.requestedAt,
    };
    const { user } = renderDialog(row);

    expect(await screen.findByText('Wallet short')).toBeInTheDocument();
    expect(screen.getByText(/The wallet held less than this payout/)).toBeInTheDocument();
    expect(screen.getByText('1.000000 USDT')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Payout reference'), 'TRX-2');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(
      await screen.findByText(/Only confirm if you paid from somewhere that had the money/),
    ).toBeInTheDocument();
  });

  it('says so when the wallet gave no figure', async () => {
    const row = fixture(WITHDRAWAL_IDS.paid);
    row.status = 'DEBITED';
    renderDialog(row);

    expect(await screen.findByText('No wallet to check')).toBeInTheDocument();
    expect(screen.queryByText(/USDT/)).toBeNull();
  });

  it('cancels from the first step', async () => {
    const { user, onOpenChange } = renderDialog();

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('reads in Arabic', async () => {
    renderDialog(fixture(WITHDRAWAL_IDS.debited), 'ar');

    expect(await screen.findByText('تعليم السحب WD9TT1 كمدفوع')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'متابعة' })).toBeInTheDocument();
  });
});
