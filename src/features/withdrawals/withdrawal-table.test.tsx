import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/errors';
import { WITHDRAWAL_IDS, mockWithdrawals } from '@/mocks/fixtures';
import { renderWithProviders } from '@/test/utils';
import type { AdminWithdrawal, PageMeta } from '@/types';

import { WithdrawalTable, type WithdrawalTableProps } from './withdrawal-table';

const fixture = (id: string): AdminWithdrawal => {
  const found = mockWithdrawals.find((row) => row.id === id);
  if (found === undefined) throw new Error(`fixture ${id} is missing`);
  return structuredClone(found);
};

const meta = (overrides: Partial<PageMeta> = {}): PageMeta => ({
  total: mockWithdrawals.length,
  limit: 20,
  offset: 0,
  hasMore: false,
  ...overrides,
});

const renderTable = (overrides: Partial<WithdrawalTableProps> = {}) => {
  const props: WithdrawalTableProps = {
    rows: mockWithdrawals,
    meta: meta(),
    isLoading: false,
    isFetching: false,
    error: null,
    onRetry: vi.fn(),
    selectedId: undefined,
    onOpen: vi.fn(),
    onOffsetChange: vi.fn(),
    ...overrides,
  };
  return { ...renderWithProviders(<WithdrawalTable {...props} />), props };
};

describe('WithdrawalTable', () => {
  it('shows a skeleton while loading, an error with retry, and an empty state', async () => {
    const { unmount } = renderTable({ isLoading: true, rows: [] });
    expect(await screen.findByTestId('table-skeleton')).toBeInTheDocument();
    unmount();

    const onRetry = vi.fn();
    const failed = renderTable({
      rows: [],
      error: new ApiError({ status: 500, code: 'INTERNAL', message: 'The queue fell over.' }),
      onRetry,
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('The queue fell over.');
    await failed.user.click(await screen.findByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    failed.unmount();

    renderTable({ rows: [], emptyAction: <button type="button">Widen</button> });
    expect(await screen.findByText('Nothing here')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Widen' })).toBeInTheDocument();
  });

  it('reads each row: id, player, amount, method, address, mode, status, wallet check', async () => {
    renderTable();

    const debited = (await screen.findByRole('button', { name: 'WD9TT1' })).closest('tr');
    if (debited === null) throw new Error('row not rendered');
    const row = within(debited);

    // An imported player with no Telegram falls back to the Ichancy login.
    expect(row.getByText('samer1987')).toBeInTheDocument();
    expect(row.getByText('Ichancy login')).toBeInTheDocument();
    expect(row.getByText('12,000.00 NSP')).toBeInTheDocument();
    expect(row.getByText('USDT — TRC20 (Tron)')).toBeInTheDocument();
    expect(row.getByText('TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7')).toBeInTheDocument();
    expect(row.getByText('TRC20')).toBeInTheDocument();
    expect(row.getByText('Automatic')).toBeInTheDocument();
    expect(row.getByText('Ready to pay')).toBeInTheDocument();
    expect(row.getByText('Wallet covers it')).toBeInTheDocument();
    expect(row.getByRole('button', { name: 'Copy payout address' })).toBeInTheDocument();
  });

  it('names a Telegram player by handle and id, and says when the wallet was never checked', async () => {
    renderTable();

    const requested = (await screen.findByRole('button', { name: 'WD7Q42' })).closest('tr');
    if (requested === null) throw new Error('row not rendered');
    const row = within(requested);

    expect(row.getByText('@karim_play')).toBeInTheDocument();
    expect(row.getByText('512340001')).toBeInTheDocument();
    expect(row.getByText('Manual')).toBeInTheDocument();
    expect(row.getByText('Not checked')).toBeInTheDocument();
    expect(row.getByRole('link', { name: /@karim_play/ })).toHaveAttribute(
      'href',
      `/players/${requested.id === '' ? '' : fixture(WITHDRAWAL_IDS.requested).playerId}`,
    );
  });

  it('opens a row from its short id and from a click anywhere else on it', async () => {
    const { user, props } = renderTable();

    await user.click(await screen.findByRole('button', { name: 'WD7Q42' }));
    expect(props.onOpen).toHaveBeenCalledWith(WITHDRAWAL_IDS.requested);

    await user.click(await screen.findByText('Bank transfer'));
    expect(props.onOpen).toHaveBeenCalledWith(WITHDRAWAL_IDS.paid);
  });

  it('does not open the row when the click was on the copy button or the player link', async () => {
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const { user, props } = renderTable();

    await user.click((await screen.findAllByRole('button', { name: 'Copy payout address' }))[0]!);
    expect(props.onOpen).not.toHaveBeenCalled();
    expect(write).toHaveBeenCalledWith('0999-123-456');
  });

  it('marks the open row as current', async () => {
    renderTable({ selectedId: WITHDRAWAL_IDS.debited });

    const row = (await screen.findByRole('button', { name: 'WD9TT1' })).closest('tr');
    expect(row).toHaveAttribute('aria-current', 'true');
  });

  it('pages with the offset the pagination asks for', async () => {
    const { user, props } = renderTable({ meta: meta({ limit: 2, hasMore: true }) });

    expect(await screen.findByText('1–2 of 5')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    expect(props.onOffsetChange).toHaveBeenCalledWith(2);
  });

  it('shows a fee only when there is one', async () => {
    const withFee = fixture(WITHDRAWAL_IDS.requested);
    withFee.fee = { minor: '5000', amount: '50.00', currency: 'NSP' };
    renderTable({ rows: [withFee] });

    expect(await screen.findByText(/^fee/)).toBeInTheDocument();
    expect(await screen.findByText('50.00')).toBeInTheDocument();
  });
});
