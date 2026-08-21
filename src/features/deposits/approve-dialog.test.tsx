import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DEPOSIT_IDS, mockDeposits } from '@/mocks/fixtures';
import { renderPlain } from '@/test/utils';
import type { AdminDeposit } from '@/types';

import { ApproveDialog } from './approve-dialog';

const deposit = (id: string): AdminDeposit => {
  const found = mockDeposits.find((row) => row.id === id);
  if (found === undefined) throw new Error(`fixture ${id} is missing`);
  return found;
};

const renderDialog = (row: AdminDeposit = deposit(DEPOSIT_IDS.awaitingReview)) => {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  const result = renderPlain(
    <ApproveDialog
      deposit={row}
      open
      onOpenChange={onOpenChange}
      loading={false}
      onConfirm={onConfirm}
    />,
  );
  return { ...result, onConfirm, onOpenChange };
};

describe('ApproveDialog', () => {
  it('restates the deposit, the player and the amount before anything is confirmed', async () => {
    renderDialog();

    expect(await screen.findByText('Approve deposit K7QP42')).toBeInTheDocument();
    expect(screen.getByText(/@karim_play is credited/)).toBeInTheDocument();
    expect(screen.getByLabelText('Verified amount (NSP)')).toHaveValue('15000.00');
    expect(screen.getByRole('button', { name: 'Approve 15,000.00 NSP' })).toBeInTheDocument();
  });

  it('sends no verified amount when the reviewer did not change it', async () => {
    const { user, onConfirm } = renderDialog();

    await user.click(await screen.findByRole('button', { name: 'Approve 15,000.00 NSP' }));

    expect(onConfirm).toHaveBeenCalledWith({});
  });

  it('makes a changed amount impossible to miss and sends it as a money body', async () => {
    const { user, onConfirm } = renderDialog();

    const amount = await screen.findByLabelText('Verified amount (NSP)');
    await user.clear(amount);
    await user.type(amount, '14500.00');

    expect(screen.getByText('This is not the amount the player claimed')).toBeInTheDocument();
    expect(screen.getByText('-500.00 NSP')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Approve 14,500.00 NSP' }));

    expect(onConfirm).toHaveBeenCalledWith({
      verifiedAmount: { amount: '14500.00', currencyCode: 'NSP' },
    });
  });

  it('passes a note along when one is written', async () => {
    const { user, onConfirm } = renderDialog();

    await user.type(
      await screen.findByLabelText('Note (optional)'),
      'Receipt matches the bank feed',
    );
    await user.click(screen.getByRole('button', { name: 'Approve 15,000.00 NSP' }));

    expect(onConfirm).toHaveBeenCalledWith({ note: 'Receipt matches the bank feed' });
  });

  it('refuses an amount it cannot read rather than sending a guess', async () => {
    const { user, onConfirm } = renderDialog();

    const amount = await screen.findByLabelText('Verified amount (NSP)');
    await user.clear(amount);
    await user.type(amount, '15,000');
    await user.click(screen.getByRole('button', { name: /^approve$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Use a plain amount, like 1500.00');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('refuses to approve nothing', async () => {
    const { user, onConfirm } = renderDialog();

    const amount = await screen.findByLabelText('Verified amount (NSP)');
    await user.clear(amount);
    await user.type(amount, '0.00');
    await user.click(screen.getByRole('button', { name: 'Approve 0.00 NSP' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Approve an amount greater than zero.',
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('warns that a dual-approval deposit will not move money on this click', async () => {
    renderDialog(deposit(DEPOSIT_IDS.largeUnclaimed));

    expect(await screen.findByText('A second approver is needed for this one')).toBeInTheDocument();
  });

  it('closes without deciding when cancelled', async () => {
    const { user, onOpenChange, onConfirm } = renderDialog();

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
