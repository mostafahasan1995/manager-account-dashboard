import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WITHDRAWAL_IDS, mockWithdrawals } from '@/mocks/fixtures';
import { renderPlain } from '@/test/utils';
import type { AdminWithdrawal } from '@/types';

import {
  NetworkChip,
  WalletCheckChip,
  WithdrawalModeChip,
  WithdrawalStatusBadge,
} from './withdrawal-badges';
import { WithdrawalTimeline } from './withdrawal-timeline';

const fixture = (id: string): AdminWithdrawal => {
  const found = mockWithdrawals.find((row) => row.id === id);
  if (found === undefined) throw new Error(`fixture ${id} is missing`);
  return structuredClone(found);
};

const stepStates = () =>
  within(screen.getByTestId('withdrawal-timeline'))
    .getAllByRole('listitem')
    .map((item) => item.getAttribute('data-state'));

describe('WithdrawalTimeline', () => {
  it('draws DEBITED as three done and one still owed, in words', () => {
    renderPlain(<WithdrawalTimeline withdrawal={fixture(WITHDRAWAL_IDS.debited)} />);

    expect(stepStates()).toEqual(['done', 'done', 'done', 'current']);
    expect(screen.getByText('Approved by the platform — automatic mode.')).toBeInTheDocument();
    expect(
      screen.getByText('Waiting for a person to send the money and mark it paid.'),
    ).toBeInTheDocument();
  });

  it('keeps the unreached steps on a rejected row', () => {
    renderPlain(<WithdrawalTimeline withdrawal={fixture(WITHDRAWAL_IDS.rejected)} />);

    expect(stepStates()).toEqual(['done', 'failed', 'skipped', 'skipped']);
    expect(screen.getByText('Rejected. Nothing was taken from the player.')).toBeInTheDocument();
    expect(screen.getAllByText('Not reached.')).toHaveLength(2);
  });

  it('reads in Arabic', () => {
    renderPlain(<WithdrawalTimeline withdrawal={fixture(WITHDRAWAL_IDS.paid)} />, {
      locale: 'ar',
    });

    expect(screen.getByText('الدفع')).toBeInTheDocument();
    expect(screen.getByText('أُرسل المال وقُيّد الدفع في الدفاتر.')).toBeInTheDocument();
  });
});

describe('the withdrawal chips', () => {
  it('render status, mode, wallet check and network as words with a tone', () => {
    renderPlain(
      <>
        <WithdrawalStatusBadge status="DEBITED" />
        <WithdrawalStatusBadge status="SOMETHING_NEW" />
        <WithdrawalModeChip mode="AUTO" />
        <WithdrawalModeChip mode="MANUAL" />
        <WalletCheckChip check={{ status: 'insufficient' }} />
        <WalletCheckChip check={null} />
        <NetworkChip network="BEP20" />
        <NetworkChip network={null} />
      </>,
    );

    expect(screen.getByText('Ready to pay')).toBeInTheDocument();
    // A status the backend adds tomorrow renders as itself rather than vanishing.
    expect(screen.getByText('Something new')).toBeInTheDocument();
    expect(screen.getByText('Automatic')).toBeInTheDocument();
    expect(screen.getByText('Manual')).toBeInTheDocument();
    expect(screen.getByText('Wallet short')).toBeInTheDocument();
    expect(screen.getByText('Not checked')).toBeInTheDocument();
    expect(screen.getByText('BEP20')).toBeInTheDocument();
  });
});
