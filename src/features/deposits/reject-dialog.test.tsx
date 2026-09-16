import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DEPOSIT_IDS, mockDeposits } from '@/mocks/fixtures';
import { renderPlain } from '@/test/utils';
import type { AdminDeposit } from '@/types';

import { RejectDialog } from './reject-dialog';

const deposit = (id: string): AdminDeposit => {
  const found = mockDeposits.find((row) => row.id === id);
  if (found === undefined) throw new Error(`fixture ${id} is missing`);
  return found;
};

const renderDialog = () => {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  const result = renderPlain(
    <RejectDialog
      deposit={deposit(DEPOSIT_IDS.awaitingReview)}
      open
      onOpenChange={onOpenChange}
      loading={false}
      onConfirm={onConfirm}
    />,
  );
  return { ...result, onConfirm, onOpenChange };
};

const pickReason = async (user: ReturnType<typeof renderDialog>['user'], label: string) => {
  await user.click(await screen.findByLabelText('Reason'));
  await user.click(await screen.findByRole('option', { name: label }));
};

describe('RejectDialog', () => {
  it('pre-selects nothing, so a reason has to be chosen on purpose', async () => {
    const { user, onConfirm } = renderDialog();

    await user.click(await screen.findByRole('button', { name: 'Reject deposit' }));

    expect(
      await screen.findByText('Choose why this deposit is being rejected.'),
    ).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('sends a code on its own for a reason that explains itself', async () => {
    const { user, onConfirm } = renderDialog();

    await pickReason(user, 'Proof unreadable');
    await user.click(screen.getByRole('button', { name: 'Reject deposit' }));

    expect(onConfirm).toHaveBeenCalledWith({ rejectionCode: 'PROOF_UNREADABLE' });
  });

  it('will not let suspected fraud through without a written explanation', async () => {
    const { user, onConfirm } = renderDialog();

    await pickReason(user, 'Suspected fraud');
    expect(await screen.findByText('This reason needs a note')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reject deposit' }));

    expect(
      await screen.findByText('"Suspected fraud" has to be explained in writing.'),
    ).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('accepts suspected fraud once the note is there', async () => {
    const { user, onConfirm } = renderDialog();

    await pickReason(user, 'Suspected fraud');
    await user.type(screen.getByLabelText('Note'), 'Same receipt as deposit M2WX88');
    await user.click(screen.getByRole('button', { name: 'Reject deposit' }));

    expect(onConfirm).toHaveBeenCalledWith({
      rejectionCode: 'SUSPECTED_FRAUD',
      rejectionNote: 'Same receipt as deposit M2WX88',
    });
  });

  it('demands a note for the catch-all reason too', async () => {
    const { user, onConfirm } = renderDialog();

    await pickReason(user, 'Other');
    await user.click(screen.getByRole('button', { name: 'Reject deposit' }));

    expect(await screen.findByText('"Other" has to be explained in writing.')).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('closes without rejecting when cancelled', async () => {
    const { user, onOpenChange, onConfirm } = renderDialog();

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
