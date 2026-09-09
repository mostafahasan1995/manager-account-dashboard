import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { WITHDRAWAL_IDS, mockWithdrawals } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderWithProviders, type AuthOverrides } from '@/test/utils';
import type { AdminWithdrawal } from '@/types';

import { WithdrawalActions } from './withdrawal-actions';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
  Toaster: () => null,
}));

const fixture = (id: string): AdminWithdrawal => {
  const found = mockWithdrawals.find((row) => row.id === id);
  if (found === undefined) throw new Error(`fixture ${id} is missing`);
  return structuredClone(found);
};

const renderActions = (row: AdminWithdrawal, auth: AuthOverrides = { role: 'REVIEWER' }) =>
  renderWithProviders(<WithdrawalActions withdrawal={row} />, { auth });

const failure = (status: number, code: string, message: string) =>
  HttpResponse.json(
    {
      success: false,
      data: null,
      error: { code, message },
      meta: { correlationId: 'test', timestamp: new Date().toISOString() },
    },
    { status },
  );

describe('WithdrawalActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers approve and reject on a REQUESTED row, and nothing else', async () => {
    renderActions(fixture(WITHDRAWAL_IDS.requested));

    expect(await screen.findByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Reject' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark paid' })).toBeNull();
  });

  it('offers mark paid on a DEBITED row and says the player is still owed', async () => {
    renderActions(fixture(WITHDRAWAL_IDS.debited));

    expect(await screen.findByRole('button', { name: 'Mark paid' })).toBeInTheDocument();
    expect(
      await screen.findByText('The player has been charged. Nobody has been paid.'),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Send 12,000.00 NSP to the address above/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
  });

  it('explains the states with nothing to press', async () => {
    const { unmount } = renderActions(fixture(WITHDRAWAL_IDS.approvedAuto));
    expect(await screen.findByText('The worker has it')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    unmount();

    const failed = fixture(WITHDRAWAL_IDS.approvedAuto);
    failed.status = 'DEBIT_FAILED';
    const second = renderActions(failed);
    expect(await screen.findByText('A person has to look at Ichancy')).toBeInTheDocument();
    second.unmount();

    renderActions(fixture(WITHDRAWAL_IDS.paid));
    expect(await screen.findByText('Paid — nothing more to do here.')).toBeInTheDocument();
  });

  it('shows a reader nothing but the reason why', async () => {
    renderActions(fixture(WITHDRAWAL_IDS.requested), { role: 'SUPPORT' });

    expect(
      await screen.findByText('Your role can read withdrawals but not decide them.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('approves through the API and reports the debit as ready to pay', async () => {
    const { user } = renderActions(fixture(WITHDRAWAL_IDS.requested));

    await user.click(await screen.findByRole('button', { name: 'Approve' }));
    await user.click(await screen.findByRole('button', { name: /approve and debit/i }));

    await vi.waitFor(() => {
      expect(vi.mocked(toast.warning)).toHaveBeenCalledWith(
        'WD7Q42 debited — ready to pay',
        expect.objectContaining({ description: expect.stringContaining('1,500.00 NSP') }),
      );
    });
    // The dialog closed on success.
    await vi.waitFor(() => {
      expect(screen.queryByText('Approve withdrawal WD7Q42?')).toBeNull();
    });
  });

  it('reports a queued debit when the server answers APPROVED', async () => {
    const approved = fixture(WITHDRAWAL_IDS.requested);
    approved.status = 'APPROVED';
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/withdrawals/:id/approve`, () =>
        HttpResponse.json({
          success: true,
          data: approved,
          error: null,
          meta: { correlationId: 'test', timestamp: new Date().toISOString() },
        }),
      ),
    );
    const { user } = renderActions(fixture(WITHDRAWAL_IDS.requested));

    await user.click(await screen.findByRole('button', { name: 'Approve' }));
    await user.click(await screen.findByRole('button', { name: /approve and debit/i }));

    await vi.waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith('WD7Q42 approved', expect.anything());
    });
  });

  it('reports a refused debit with what Ichancy said', async () => {
    const refused = fixture(WITHDRAWAL_IDS.requested);
    refused.status = 'DEBIT_FAILED';
    refused.failureCode = 'WITHDRAWAL_INSUFFICIENT_BALANCE';
    refused.failureMessage = 'The account holds less than asked.';
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/withdrawals/:id/approve`, () =>
        HttpResponse.json({
          success: true,
          data: refused,
          error: null,
          meta: { correlationId: 'test', timestamp: new Date().toISOString() },
        }),
      ),
    );
    const { user } = renderActions(fixture(WITHDRAWAL_IDS.requested));

    await user.click(await screen.findByRole('button', { name: 'Approve' }));
    await user.click(await screen.findByRole('button', { name: /approve and debit/i }));

    await vi.waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        'WD7Q42: the debit was refused',
        expect.objectContaining({
          description: 'Nothing moved. The account holds less than asked.',
        }),
      );
    });
  });

  it('reports an unclear debit as needing reconciliation', async () => {
    const unclear = fixture(WITHDRAWAL_IDS.requested);
    unclear.status = 'NEEDS_RECONCILIATION';
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/withdrawals/:id/approve`, () =>
        HttpResponse.json({
          success: true,
          data: unclear,
          error: null,
          meta: { correlationId: 'test', timestamp: new Date().toISOString() },
        }),
      ),
    );
    const { user } = renderActions(fixture(WITHDRAWAL_IDS.requested));

    await user.click(await screen.findByRole('button', { name: 'Approve' }));
    await user.click(await screen.findByRole('button', { name: /approve and debit/i }));

    await vi.waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        'WD7Q42 needs reconciliation',
        expect.anything(),
      );
    });
  });

  it('rejects through the API with the reason', async () => {
    const { user } = renderActions(fixture(WITHDRAWAL_IDS.requested));

    await user.click(await screen.findByRole('button', { name: 'Reject' }));
    await user.type(await screen.findByLabelText('Reason'), 'Wrong network for this address');
    await user.click(await screen.findByRole('button', { name: 'Reject withdrawal' }));

    await vi.waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        'WD7Q42 rejected',
        expect.objectContaining({ description: 'The player keeps their balance and is told why.' }),
      );
    });
  });

  it('marks paid through the API after the second confirmation, and names the ledger row', async () => {
    const { user } = renderActions(fixture(WITHDRAWAL_IDS.debited));

    await user.click(await screen.findByRole('button', { name: 'Mark paid' }));
    await user.type(await screen.findByLabelText('Payout reference'), 'TRX-55555');
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Yes, it was paid' }));

    await vi.waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        'WD9TT1 marked paid',
        expect.objectContaining({
          description: expect.stringMatching(/^Payout posted to the ledger as [0-9a-f-]+\.$/),
        }),
      );
    });
  });

  it('treats a 409 as a colleague getting there first, not as a broken click', async () => {
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/withdrawals/:id/approve`, () =>
        failure(409, 'WITHDRAWAL_INVALID_STATE', 'Only a REQUESTED withdrawal can be approved.'),
      ),
    );
    const { user } = renderActions(fixture(WITHDRAWAL_IDS.requested));

    await user.click(await screen.findByRole('button', { name: 'Approve' }));
    await user.click(await screen.findByRole('button', { name: /approve and debit/i }));

    await vi.waitFor(() => {
      expect(vi.mocked(toast.info)).toHaveBeenCalledWith(
        'Already handled',
        expect.objectContaining({ description: expect.stringContaining('WD7Q42') }),
      );
    });
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
  });

  it('reports every other failure as one, and keeps the dialog open', async () => {
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/withdrawals/:id/mark-paid`, () =>
        failure(503, 'LEDGER_UNAVAILABLE', 'The ledger is not accepting postings.'),
      ),
    );
    const { user } = renderActions(fixture(WITHDRAWAL_IDS.debited));

    await user.click(await screen.findByRole('button', { name: 'Mark paid' }));
    await user.type(await screen.findByLabelText('Payout reference'), 'TRX-1');
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Yes, it was paid' }));

    await vi.waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        'The payout could not be recorded',
        expect.objectContaining({ description: 'The ledger is not accepting postings.' }),
      );
    });
    expect(await screen.findByText('Post the payout to the ledger?')).toBeInTheDocument();
  });

  it('reads in Arabic', async () => {
    renderWithProviders(<WithdrawalActions withdrawal={fixture(WITHDRAWAL_IDS.requested)} />, {
      auth: { role: 'REVIEWER' },
      locale: 'ar',
    });

    expect(await screen.findByRole('button', { name: 'موافقة' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'رفض' })).toBeInTheDocument();
  });
});
