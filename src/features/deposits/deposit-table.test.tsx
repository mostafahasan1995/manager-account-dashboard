import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/errors';
import { ADMIN_IDS, DEPOSIT_IDS, mockDeposits } from '@/mocks/fixtures';
import { renderWithProviders } from '@/test/utils';
import type { AdminDeposit } from '@/types';

import { DepositTable, type DepositTableProps } from './deposit-table';

const deposit = (id: string): AdminDeposit => {
  const found = mockDeposits.find((row) => row.id === id);
  if (found === undefined) throw new Error(`fixture ${id} is missing`);
  return found;
};

const baseProps: DepositTableProps = {
  rows: mockDeposits,
  isLoading: false,
  error: null,
  onRetry: () => undefined,
  selectedId: undefined,
  focusedId: undefined,
  onOpen: () => undefined,
  currentAdminId: ADMIN_IDS.reviewer,
  hasMore: false,
  isLoadingMore: false,
  onLoadMore: () => undefined,
};

const renderTable = (props: Partial<DepositTableProps> = {}) =>
  renderWithProviders(<DepositTable {...baseProps} {...props} />, {
    route: '/deposits',
    routePath: '/deposits',
  });

const rowFor = (shortId: string): HTMLElement => {
  const row = screen.getByRole('button', { name: shortId }).closest('tr');
  if (row === null) throw new Error(`no queue row for ${shortId}`);
  return row;
};

describe('DepositTable', () => {
  it('shows the claimed amount grouped, with its currency', async () => {
    renderTable({ rows: [deposit(DEPOSIT_IDS.awaitingReview)] });

    expect(await screen.findByText('15,000.00 NSP')).toBeInTheDocument();
  });

  it('shows the fee only when there is one', async () => {
    renderTable({
      rows: [deposit(DEPOSIT_IDS.underReviewByMe), deposit(DEPOSIT_IDS.awaitingReview)],
    });

    await screen.findByRole('button', { name: 'R9TT10' });
    const withFee = rowFor('R9TT10');
    const withoutFee = rowFor('K7QP42');
    expect(within(withFee).getByText(/fee/i)).toBeInTheDocument();
    expect(within(withoutFee).queryByText(/fee/i)).toBeNull();
  });

  it('says in words who holds each deposit', async () => {
    renderTable({
      rows: [
        deposit(DEPOSIT_IDS.awaitingReview),
        deposit(DEPOSIT_IDS.underReviewByMe),
        deposit(DEPOSIT_IDS.claimedByOther),
      ],
    });

    await screen.findByText('K7QP42');
    expect(within(rowFor('K7QP42')).getByText('Unclaimed')).toBeInTheDocument();
    expect(within(rowFor('R9TT10')).getByText('You')).toBeInTheDocument();
    expect(within(rowFor('B4LM63')).getByText('Someone else')).toBeInTheDocument();
  });

  it('names the status rather than only colouring it', async () => {
    renderTable({ rows: [deposit(DEPOSIT_IDS.creditFailed)] });

    expect(await screen.findByText('Credit failed')).toBeInTheDocument();
  });

  it('links the player row to their page', async () => {
    const row = deposit(DEPOSIT_IDS.awaitingReview);
    renderTable({ rows: [row] });

    const link = await screen.findByRole('link', { name: /karim_play/ });
    expect(link).toHaveAttribute('href', `/players/${row.playerId}`);
  });

  it('opens the panel from the short id button', async () => {
    const onOpen = vi.fn();
    const { user } = renderTable({ rows: [deposit(DEPOSIT_IDS.awaitingReview)], onOpen });

    await user.click(await screen.findByRole('button', { name: 'K7QP42' }));

    expect(onOpen).toHaveBeenCalledWith(DEPOSIT_IDS.awaitingReview);
  });

  it('opens the panel from anywhere else in the row, but not from the copy button', async () => {
    const onOpen = vi.fn();
    const { user } = renderTable({ rows: [deposit(DEPOSIT_IDS.awaitingReview)], onOpen });

    await user.click(await screen.findByText('15,000.00 NSP'));
    expect(onOpen).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: /copy short id/i }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('marks the open deposit for assistive technology', async () => {
    renderTable({
      rows: [deposit(DEPOSIT_IDS.awaitingReview)],
      selectedId: DEPOSIT_IDS.awaitingReview,
    });

    await screen.findByText('K7QP42');
    expect(rowFor('K7QP42')).toHaveAttribute('aria-current', 'true');
  });

  it('keeps the table shape while it loads', async () => {
    renderTable({ isLoading: true });

    expect(await screen.findByTestId('table-skeleton')).toBeInTheDocument();
  });

  it('reports a failure instead of an empty queue', async () => {
    const onRetry = vi.fn();
    renderTable({
      error: new ApiError({ status: 500, code: 'INTERNAL', message: 'The queue is down.' }),
      onRetry,
    });

    expect(await screen.findByText('The queue is down.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('offers the caller its own way out of an empty queue', async () => {
    renderTable({ rows: [], emptyAction: <button type="button">Clear filters</button> });

    expect(await screen.findByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });

  it('loads the next cursor page on request', async () => {
    const onLoadMore = vi.fn();
    const { user } = renderTable({ hasMore: true, onLoadMore });

    await user.click(await screen.findByRole('button', { name: /load more/i }));

    expect(onLoadMore).toHaveBeenCalledOnce();
  });
});
