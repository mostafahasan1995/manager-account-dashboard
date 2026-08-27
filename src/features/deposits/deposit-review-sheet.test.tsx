import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { DEPOSIT_IDS, mockDeposits, money } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/utils';
import type { AdminDeposit } from '@/types';

import { DepositReviewSheet } from './deposit-review-sheet';

const deposit = (id: string): AdminDeposit => {
  const found = mockDeposits.find((row) => row.id === id);
  if (found === undefined) throw new Error(`fixture ${id} is missing`);
  return structuredClone(found);
};

const renderSheet = (depositId: string, onClose = vi.fn()) => ({
  onClose,
  ...renderWithProviders(<DepositReviewSheet depositId={depositId} onClose={onClose} />, {
    route: `/deposits?selected=${depositId}`,
    routePath: '/deposits',
  }),
});

const serveDeposit = (row: AdminDeposit) => {
  server.use(
    http.get(`${config.apiBaseUrl}/v1/admin/deposits/${row.id}`, () =>
      HttpResponse.json({
        success: true,
        data: row,
        error: null,
        meta: { correlationId: 'test', timestamp: new Date().toISOString() },
      }),
    ),
  );
};

describe('DepositReviewSheet', () => {
  it('shows everything a reviewer has to check before deciding', async () => {
    renderSheet(DEPOSIT_IDS.duplicateProof);

    expect(await screen.findByText('Deposit M2WX88')).toBeInTheDocument();

    const panel = screen.getByRole('dialog');
    expect(within(panel).getByText('75,000.00 NSP')).toBeInTheDocument();
    expect(within(panel).getByText('Bank transfer')).toBeInTheDocument();
    expect(within(panel).getByText('Main branch account')).toBeInTheDocument();
    expect(within(panel).getByText('Ziad Mansour')).toBeInTheDocument();
    expect(within(panel).getByText('884512309')).toBeInTheDocument();
    expect(within(panel).getByText('Identical proof already seen')).toBeInTheDocument();
    expect(within(panel).getByText('Reference used before')).toBeInTheDocument();
    expect(within(panel).getByText('New player')).toBeInTheDocument();
    expect(await within(panel).findAllByRole('img', { name: /proof \d of 2/i })).toHaveLength(2);
  });

  it('flags a verified amount that does not match what the player claimed', async () => {
    const row = deposit(DEPOSIT_IDS.underReviewByMe);
    row.verified = money(110_000_00n);
    serveDeposit(row);

    renderSheet(row.id);

    expect(await screen.findByText('Verified is not what the player claimed')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveTextContent('110,000.00 NSP');
  });

  it('shows the rejection reason and note on a rejected deposit', async () => {
    renderSheet(DEPOSIT_IDS.rejected);

    expect(await screen.findByText('Deposit J6NO09')).toBeInTheDocument();
    expect(screen.getByText('Proof unreadable')).toBeInTheDocument();
    expect(screen.getByText('Screenshot was cropped; amount not visible.')).toBeInTheDocument();
  });

  it('explains a failed credit with its attempts and key epoch', async () => {
    renderSheet(DEPOSIT_IDS.creditFailed);

    expect(await screen.findByText('Deposit C1FF77')).toBeInTheDocument();
    const panel = screen.getByRole('dialog');
    expect(within(panel).getByText('Attempts')).toBeInTheDocument();
    expect(within(panel).getByText('Not yet confirmed')).toBeInTheDocument();
    expect(within(panel).getByText(/Retrying bumps the epoch/)).toBeInTheDocument();
  });

  it('names how a credit was proved once it lands', async () => {
    renderSheet(DEPOSIT_IDS.credited);

    expect(await screen.findByText('Deposit D3OK55')).toBeInTheDocument();
    expect(screen.getByText('Ichancy confirmed')).toBeInTheDocument();
  });

  it('says who decided a deposit and whether a second approver is still owed', async () => {
    renderSheet(DEPOSIT_IDS.secondApproval);

    expect(await screen.findByText('Deposit X8ZZ01')).toBeInTheDocument();
    const heading = screen.getByRole('heading', { name: 'Decision' });
    const decision = heading.closest('section');
    if (decision === null) throw new Error('the decision section is missing');

    expect(within(decision).getByText('Needs a second approver')).toBeInTheDocument();
    expect(within(decision).getByText('Yes')).toBeInTheDocument();
    // The first approver is on the record; nobody has confirmed it yet.
    expect(within(decision).getAllByText('Nobody yet')).toHaveLength(1);
  });

  it('reports a deposit it could not load', async () => {
    renderSheet('eeeeeeee-0000-4000-8000-000000009999');

    expect(await screen.findByText('Deposit not found.')).toBeInTheDocument();
  });

  it('hands the open panel back to the queue when it is closed', async () => {
    const onClose = vi.fn();
    const { user } = renderSheet(DEPOSIT_IDS.awaitingReview, onClose);

    await screen.findByText('Deposit K7QP42');
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing at all when no deposit is selected', () => {
    renderWithProviders(<DepositReviewSheet depositId={undefined} onClose={vi.fn()} />, {
      route: '/deposits',
      routePath: '/deposits',
    });

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

/**
 * That the verdict is actually MOUNTED here, and not merely built.
 *
 * Worth its own case: this console has form for shipping a finished component nobody wired into a
 * screen, and the failure is invisible — every test of the component itself stays green while the
 * reviewer who needs it sees nothing.
 */
describe('the on-chain verdict inside the review panel', () => {
  it('puts what the chain says in front of the reviewer, with both figures', async () => {
    const row = deposit(DEPOSIT_IDS.underReviewByMe);
    serveDeposit(row);
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/deposits/${row.id}/chain-check`, () =>
        HttpResponse.json({
          success: true,
          data: {
            outcome: 'mismatch',
            network: 'TRC20',
            summary: 'Less arrived than was claimed.',
            arrived: { asset: 'USDT', scale: 6, minor: '99500000', amount: '99.500000' },
            creditable: { minor: '131340000', amount: '1313400.00', currency: 'NSP' },
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

    renderSheet(row.id);

    const verdict = await screen.findByTestId('chain-verdict');
    expect(await within(verdict).findByText('99.500000 USDT')).toBeInTheDocument();
    expect(within(verdict).getByText('1,313,400.00 NSP')).toBeInTheDocument();
  });

  it('shows nothing for a bank transfer, which has no chain to ask', async () => {
    // The default mock answers `skipped` for every seeded deposit — all of them are cash or bank —
    // and a section reading "not applicable" on every one of those is how a reviewer learns to skip
    // past the deposit where it does matter.
    renderSheet(DEPOSIT_IDS.duplicateProof);

    await screen.findByText('Deposit M2WX88');
    await expect.poll(() => screen.queryByTestId('chain-verdict')).toBeNull();
  });
});
