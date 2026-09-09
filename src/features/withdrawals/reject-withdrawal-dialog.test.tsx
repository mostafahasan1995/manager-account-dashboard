import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WITHDRAWAL_IDS, mockWithdrawals } from '@/mocks/fixtures';
import { renderPlain } from '@/test/utils';
import type { AdminWithdrawal } from '@/types';

import { RejectWithdrawalDialog } from './reject-withdrawal-dialog';

const fixture = (id: string): AdminWithdrawal => {
  const found = mockWithdrawals.find((row) => row.id === id);
  if (found === undefined) throw new Error(`fixture ${id} is missing`);
  return structuredClone(found);
};

const renderDialog = (locale?: 'en' | 'ar') => {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  const result = renderPlain(
    <RejectWithdrawalDialog
      withdrawal={fixture(WITHDRAWAL_IDS.requested)}
      open
      onOpenChange={onOpenChange}
      loading={false}
      onConfirm={onConfirm}
    />,
    locale === undefined ? {} : { locale },
  );
  return { ...result, onConfirm, onOpenChange };
};

describe('RejectWithdrawalDialog', () => {
  it('refuses to send a rejection with no reason', async () => {
    const { user, onConfirm } = renderDialog();

    await user.click(await screen.findByRole('button', { name: 'Reject withdrawal' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Say why. A rejection without a reason cannot be sent.',
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('sends the trimmed reason', async () => {
    const { user, onConfirm } = renderDialog();

    await user.type(
      await screen.findByLabelText('Reason'),
      '  Address does not belong to the player  ',
    );
    await user.click(screen.getByRole('button', { name: 'Reject withdrawal' }));

    expect(onConfirm).toHaveBeenCalledWith({ reason: 'Address does not belong to the player' });
  });

  it('counts characters and refuses a reason over 280', async () => {
    const { user, onConfirm } = renderDialog();

    const field = await screen.findByLabelText('Reason');
    await user.click(field);
    await user.paste('x'.repeat(281));

    expect(screen.getByText('281 / 280')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reject withdrawal' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Keep the reason under 280 characters.',
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cancels without sending', async () => {
    const { user, onConfirm, onOpenChange } = renderDialog();

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('reads in Arabic', async () => {
    renderDialog('ar');

    expect(await screen.findByText('رفض السحب WD7Q42؟')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'رفض السحب' })).toBeInTheDocument();
  });
});
