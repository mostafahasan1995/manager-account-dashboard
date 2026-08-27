import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { DEPOSIT_IDS, mockDeposits } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
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

/**
 * The chain's own figure, offered in the one place it changes a decision.
 *
 * A mismatch used to leave the reviewer holding a calculator and the USDT rate. What matters here
 * is not only that the figure is reachable — it is HOW: as a button, never as a value this dialog
 * types into the box on somebody's behalf.
 */
describe('ApproveDialog with an on-chain verdict', () => {
  const CHAIN_DEPOSIT = deposit(DEPOSIT_IDS.awaitingReview);

  /** 14,500.00 NSP: what a short USDT transfer is worth, against the 15,000.00 claimed. */
  const serveMismatch = (
    creditable = { minor: '1450000', amount: '14500.00', currency: 'NSP' },
  ) => {
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/deposits/${CHAIN_DEPOSIT.id}/chain-check`, () =>
        HttpResponse.json({
          success: true,
          data: {
            outcome: 'mismatch',
            network: 'TRC20',
            summary: 'Less arrived than was claimed.',
            arrived: { asset: 'USDT', scale: 6, minor: '99500000', amount: '99.500000' },
            creditable,
            txHash: 'b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2',
            fromAddress: 'TKrsHFVLvQ2vX1t7iGbPtPHY4Yz9xB8dqA',
            confirmations: 19,
            requiredConfirmations: 19,
            checkedAt: new Date().toISOString(),
          },
          error: null,
          meta: { correlationId: 'test', timestamp: new Date().toISOString() },
        }),
      ),
    );
  };

  it('offers the chain amount without typing it into the field', async () => {
    // Read the comment beside `verifiedAmount` in approve-dialog.tsx: the amount is sent only when
    // a human changed it. A field this dialog filled in by itself would be indistinguishable from
    // one the reviewer typed, and every such approval would be filed as a correction nobody made.
    serveMismatch();
    renderDialog(CHAIN_DEPOSIT);

    expect(await screen.findByRole('button', { name: 'Use 14,500.00 NSP' })).toBeInTheDocument();
    expect(screen.getByLabelText('Verified amount (NSP)')).toHaveValue('15000.00');
    expect(screen.getByText(/99.500000 USDT arrived/)).toBeInTheDocument();
  });

  it('fills the field in one click, and then sends that amount', async () => {
    serveMismatch();
    const { user, onConfirm } = renderDialog(CHAIN_DEPOSIT);

    await user.click(await screen.findByRole('button', { name: 'Use 14,500.00 NSP' }));

    expect(screen.getByLabelText('Verified amount (NSP)')).toHaveValue('14500.00');
    await user.click(screen.getByRole('button', { name: 'Approve 14,500.00 NSP' }));

    expect(onConfirm).toHaveBeenCalledWith({
      verifiedAmount: { amount: '14500.00', currencyCode: 'NSP' },
    });
  });

  it('offers nothing when the chain agrees with the claim', async () => {
    // A button that sets a field to what it already holds is a control that does nothing — and
    // beside a money input, a control that does nothing is worse than no control.
    serveMismatch({ minor: '1500000', amount: '15000.00', currency: 'NSP' });
    renderDialog(CHAIN_DEPOSIT);

    expect(await screen.findByLabelText('Verified amount (NSP)')).toHaveValue('15000.00');
    expect(screen.queryByRole('button', { name: /^Use / })).toBeNull();
  });

  it('offers nothing when the verdict is priced in another currency', async () => {
    // Pasted into this box it would be approved as if it were NSP.
    serveMismatch({ minor: '9950000', amount: '99.50', currency: 'USD' });
    renderDialog(CHAIN_DEPOSIT);

    expect(await screen.findByLabelText('Verified amount (NSP)')).toHaveValue('15000.00');
    expect(screen.queryByRole('button', { name: /^Use / })).toBeNull();
  });
});
