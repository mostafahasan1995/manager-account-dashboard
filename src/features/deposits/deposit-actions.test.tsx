import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { DEPOSIT_IDS, mockDeposits } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderPlain, type AuthOverrides } from '@/test/utils';
import type { AdminDeposit } from '@/types';

import { DepositActions } from './deposit-actions';

// No <Toaster> lives in the test provider tree, so the toasts are asserted at the call instead of
// in the DOM. What matters is which one fired and what it said.
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
  Toaster: () => null,
}));

/** The id `createTestSession` signs in as, which is also the mock API's current admin. */
const ME = 'aaaaaaaa-0000-4000-8000-000000000001';

const deposit = (id: string): AdminDeposit => {
  const found = mockDeposits.find((row) => row.id === id);
  if (found === undefined) throw new Error(`fixture ${id} is missing`);
  return structuredClone(found);
};

const claimedByMe = (id: string): AdminDeposit => ({
  ...deposit(id),
  status: 'UNDER_REVIEW',
  reviewStartedAt: new Date().toISOString(),
  decidedByAdminId: ME,
});

const renderActions = (row: AdminDeposit, auth: AuthOverrides = {}) =>
  renderPlain(<DepositActions deposit={row} />, { auth });

const depositUrl = (id: string, action: string) =>
  `${config.apiBaseUrl}/v1/admin/deposits/${id}/${action}`;

describe('DepositActions', () => {
  it('gives a VIEWER nothing to press', async () => {
    renderActions(deposit(DEPOSIT_IDS.awaitingReview), { role: 'VIEWER' });

    expect(
      await screen.findByText('Your role can read this deposit but not decide it.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /claim/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /approve/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /reject/i })).toBeNull();
  });

  it('makes a reviewer claim a deposit before it can be decided', async () => {
    renderActions(deposit(DEPOSIT_IDS.awaitingReview), { role: 'REVIEWER' });

    expect(await screen.findByRole('button', { name: /claim to review/i })).toBeInTheDocument();
    expect(screen.getByText('Claim it before you decide')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /reject/i })).toBeNull();
  });

  it('claims a deposit and says who holds it now', async () => {
    const { user } = renderActions(deposit(DEPOSIT_IDS.awaitingReview), { role: 'REVIEWER' });

    await user.click(await screen.findByRole('button', { name: /claim to review/i }));

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      'You have K7QP42',
      expect.objectContaining({
        description: 'Nobody else can decide it while you hold the claim.',
      }),
    );
  });

  it('treats a colleague getting there first as an answer, not a failure', async () => {
    const { user } = renderActions(deposit(DEPOSIT_IDS.claimedByOther), { role: 'REVIEWER' });

    expect(await screen.findByText('Another reviewer has this one')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /claim anyway/i }));

    expect(vi.mocked(toast.info)).toHaveBeenCalledWith(
      'Someone else already handled this',
      expect.objectContaining({
        description: 'B4LM63 is now Under review. The queue has been refreshed.',
      }),
    );
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
  });

  it('releases a deposit it holds', async () => {
    const { user } = renderActions(claimedByMe(DEPOSIT_IDS.awaitingReview), { role: 'REVIEWER' });

    await user.click(await screen.findByRole('button', { name: /release/i }));

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      'Released K7QP42',
      expect.objectContaining({
        description: 'It is back in the queue for whoever picks it up next.',
      }),
    );
  });

  it('approves a claimed deposit and reports the ledger transaction', async () => {
    const { user } = renderActions(claimedByMe(DEPOSIT_IDS.awaitingReview), { role: 'REVIEWER' });

    await user.click(await screen.findByRole('button', { name: /approve…/i }));
    await user.click(await screen.findByRole('button', { name: 'Approve 15,000.00 NSP' }));

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      'Approved K7QP42',
      expect.objectContaining({ description: expect.stringContaining('Ledger transaction') }),
    );
  });

  it('says plainly that a dual-approval deposit has not moved any money yet', async () => {
    const { user } = renderActions(claimedByMe(DEPOSIT_IDS.largeUnclaimed), { role: 'REVIEWER' });

    await user.click(await screen.findByRole('button', { name: /approve…/i }));
    await user.click(await screen.findByRole('button', { name: 'Approve 1,400,000.00 NSP' }));

    expect(vi.mocked(toast.warning)).toHaveBeenCalledWith(
      'A second approver is needed',
      expect.objectContaining({
        description: 'The money has NOT moved. P0BB31 stays put until another admin confirms it.',
      }),
    );
  });

  it('lets a second approver decide a deposit they never claimed', async () => {
    renderActions(deposit(DEPOSIT_IDS.secondApproval), { role: 'FINANCE_ADMIN' });

    expect(await screen.findByText('Waiting for a second approver')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approve…/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /claim anyway/i })).toBeNull();
  });

  it('reports an approval that lost the race without pretending it failed', async () => {
    server.use(
      http.post(depositUrl(DEPOSIT_IDS.awaitingReview, 'approve'), () =>
        HttpResponse.json({
          success: true,
          data: { kind: 'alreadyHandled', status: 'CREDITED' },
          error: null,
          meta: { correlationId: 'test', timestamp: new Date().toISOString() },
        }),
      ),
    );

    const { user } = renderActions(claimedByMe(DEPOSIT_IDS.awaitingReview), { role: 'REVIEWER' });

    await user.click(await screen.findByRole('button', { name: /approve…/i }));
    await user.click(await screen.findByRole('button', { name: 'Approve 15,000.00 NSP' }));

    expect(vi.mocked(toast.info)).toHaveBeenCalledWith(
      'Someone else already handled this',
      expect.objectContaining({
        description: 'K7QP42 is now Credited. The queue has been refreshed.',
      }),
    );
  });

  it('rejects with the reason the reviewer picked', async () => {
    const { user } = renderActions(claimedByMe(DEPOSIT_IDS.awaitingReview), { role: 'REVIEWER' });

    await user.click(await screen.findByRole('button', { name: /reject…/i }));
    await user.click(await screen.findByLabelText('Reason'));
    await user.click(await screen.findByRole('option', { name: 'Proof unreadable' }));
    await user.click(screen.getByRole('button', { name: 'Reject deposit' }));

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      'Rejected K7QP42',
      expect.objectContaining({
        description: 'Nothing was credited and the reason is on the record.',
      }),
    );
  });

  it('turns a failed decision into a toast that names the reason', async () => {
    server.use(
      http.post(depositUrl(DEPOSIT_IDS.awaitingReview, 'claim'), () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'DEPOSIT_NOT_REVIEWABLE', message: 'That deposit is no longer open.' },
            meta: { correlationId: 'test', timestamp: new Date().toISOString() },
          },
          { status: 409 },
        ),
      ),
    );

    const { user } = renderActions(deposit(DEPOSIT_IDS.awaitingReview), { role: 'REVIEWER' });

    await user.click(await screen.findByRole('button', { name: /claim to review/i }));

    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      'Could not claim this deposit',
      expect.objectContaining({ description: 'That deposit is no longer open.' }),
    );
  });

  it('says nothing is left to decide on a deposit that is already answered', async () => {
    renderActions(deposit(DEPOSIT_IDS.credited), { role: 'REVIEWER' });

    expect(await screen.findByText(/This deposit has already been answered/)).toBeInTheDocument();
  });

  it('keeps the credit retry away from a reviewer', async () => {
    renderActions(deposit(DEPOSIT_IDS.creditFailed), { role: 'REVIEWER' });

    await screen.findByText(/This deposit has already been answered/);
    expect(screen.queryByRole('button', { name: /retry credit/i })).toBeNull();
  });

  it('retries a failed credit and reports the new key epoch', async () => {
    const { user } = renderActions(deposit(DEPOSIT_IDS.creditFailed), { role: 'FINANCE_ADMIN' });

    await user.click(await screen.findByRole('button', { name: /retry credit/i }));
    await user.type(await screen.findByLabelText('Reason (optional)'), 'Ichancy was down');
    await user.click(screen.getByRole('button', { name: 'Retry credit' }));

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      'Credit for C1FF77 is queued again',
      expect.objectContaining({ description: 'The credit key epoch is now 2.' }),
    );
  });
});
