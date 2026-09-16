import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WITHDRAWAL_IDS, mockWithdrawals } from '@/mocks/fixtures';
import { renderPlain } from '@/test/utils';
import type { AdminWithdrawal } from '@/types';

import { ApproveWithdrawalDialog } from './approve-withdrawal-dialog';

const fixture = (id: string): AdminWithdrawal => {
  const found = mockWithdrawals.find((row) => row.id === id);
  if (found === undefined) throw new Error(`fixture ${id} is missing`);
  return structuredClone(found);
};

const renderDialog = (
  row: AdminWithdrawal = fixture(WITHDRAWAL_IDS.requested),
  loading = false,
) => {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  const result = renderPlain(
    <ApproveWithdrawalDialog
      withdrawal={row}
      open
      onOpenChange={onOpenChange}
      loading={loading}
      onConfirm={onConfirm}
    />,
  );
  return { ...result, onConfirm, onOpenChange };
};

describe('ApproveWithdrawalDialog', () => {
  it('restates the money, the player, the address and what approving does under MANUAL', async () => {
    renderDialog();

    expect(await screen.findByText('Approve withdrawal WD7Q42?')).toBeInTheDocument();
    expect(
      screen.getByText(/@karim_play asked to cash out 1,500.00 NSP to Mobile wallet/),
    ).toBeInTheDocument();
    expect(screen.getByText('0999-123-456')).toBeInTheDocument();
    expect(screen.getByText(/Manual mode: nothing has moved yet/)).toBeInTheDocument();
    expect(screen.getByText(/The player held 3,200.00 NSP when they asked/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Approve and debit 1,500.00 NSP' }),
    ).toBeInTheDocument();
  });

  it('explains AUTO mode differently, and names an imported player by login', async () => {
    const row = fixture(WITHDRAWAL_IDS.debited);
    row.status = 'REQUESTED';
    renderDialog(row);

    expect(
      await screen.findByText(/Automatic mode: the platform normally approves/),
    ).toBeInTheDocument();
    expect(screen.getByText(/samer1987 asked to cash out/)).toBeInTheDocument();
    expect(screen.getByText('TRC20')).toBeInTheDocument();
  });

  it('confirms with one click and cancels with the other', async () => {
    const { user, onConfirm, onOpenChange } = renderDialog();

    await user.click(await screen.findByRole('button', { name: /approve and debit/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('holds the buttons while the approval is in flight', async () => {
    renderDialog(fixture(WITHDRAWAL_IDS.requested), true);

    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /approve and debit/i })).toBeDisabled();
  });

  it('reads in Arabic', async () => {
    renderPlain(
      <ApproveWithdrawalDialog
        withdrawal={fixture(WITHDRAWAL_IDS.requested)}
        open
        onOpenChange={vi.fn()}
        loading={false}
        onConfirm={vi.fn()}
      />,
      { locale: 'ar' },
    );

    expect(await screen.findByText('الموافقة على السحب WD7Q42؟')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'موافقة وخصم 1,500.00 NSP' })).toBeInTheDocument();
  });
});
