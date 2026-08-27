import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { config } from '@/config';
import { db } from '@/mocks/db';
import { PLAYER_IDS } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/utils';
import type { AdminRole } from '@/types/enums';

import { PlayerDetailPage } from './player-detail-page';

const renderDetail = (playerId: string, role: AdminRole = 'SUPER_ADMIN') =>
  renderWithProviders(<PlayerDetailPage />, {
    route: `/players/${playerId}`,
    routePath: '/players/$playerId',
    auth: { role },
  });

describe('PlayerDetailPage', () => {
  it('shows who the player is, how to reach them and what they have deposited', async () => {
    renderDetail(PLAYER_IDS.linkedActive);

    expect(await screen.findByRole('heading', { name: 'Karim Nasser' })).toBeInTheDocument();
    // The status is a word beside the name, not only a colour further down the page.
    expect(within(screen.getByRole('banner')).getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('+963900000001')).toBeInTheDocument();
    expect(screen.getByText('tg512340001')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'K7QP42' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to players/i })).toHaveAttribute(
      'href',
      '/players',
    );
  });

  it('answers a player id that does not exist instead of showing a blank page', async () => {
    renderDetail('bbbbbbbb-0000-4000-8000-000000009999');

    expect(await screen.findByText('Player not found.')).toBeInTheDocument();
    expect(screen.getByText('PLAYER_NOT_FOUND')).toBeInTheDocument();
    // Asking again would get the same answer, so there is nothing to retry.
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to players/i })).toBeInTheDocument();
  });

  it('offers a retry for a failure that might not happen twice', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/players/:id`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'INTERNAL_ERROR', message: 'The player service is unavailable.' },
            meta: { correlationId: 'test-corr-6', timestamp: new Date().toISOString() },
          },
          { status: 500 },
        ),
      ),
    );
    renderDetail(PLAYER_IDS.linkedActive);

    expect(await screen.findByText('The player service is unavailable.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('hides the link action from a role that cannot create accounts', async () => {
    renderDetail(PLAYER_IDS.pendingLink, 'SUPPORT');

    expect(await screen.findByRole('heading', { name: 'Maya' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /create ichancy account/i }),
    ).not.toBeInTheDocument();
  });

  it('does not offer to create an account a player already has', async () => {
    renderDetail(PLAYER_IDS.linkedActive);

    expect(await screen.findByRole('heading', { name: 'Karim Nasser' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /create ichancy account/i }),
    ).not.toBeInTheDocument();
  });

  it('creates the account behind a confirmation and shows the login and agent it got', async () => {
    const { user } = renderDetail(PLAYER_IDS.pendingLink);

    await user.click(await screen.findByRole('button', { name: /^create ichancy account$/i }));
    expect(await screen.findByText('Create an Ichancy account?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Ichancy account created')).toBeInTheDocument();
    const result = screen.getByRole('status');
    expect(within(result).getByText('tg512340002')).toBeInTheDocument();
    expect(within(result).getByText('10045')).toBeInTheDocument();
    // The account exists now, so the action that created it is gone.
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /^create ichancy account$/i }),
      ).not.toBeInTheDocument();
    });
  });
});

describe('PlayerDetailPage: taking money back out', () => {
  const meta = () => ({ correlationId: 'test-debit', timestamp: new Date().toISOString() });

  /**
   * Serves the player detail endpoint exactly as the mock backend does, and counts the reads.
   *
   * "Refreshes the player" is not something a screenshot can show: the player row itself does not
   * change when a debit lands. What has to be true is that the console goes and asks again rather
   * than going on rendering a picture of an account it has just altered.
   */
  const countPlayerReads = (): string[] => {
    const reads: string[] = [];
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/players/:id`, ({ params }) => {
        const id = String(params.id);
        reads.push(id);
        const player = db.players.find((row) => row.id === id);
        return player === undefined
          ? HttpResponse.json(
              {
                success: false,
                data: null,
                error: { code: 'PLAYER_NOT_FOUND', message: 'Player not found.' },
                meta: meta(),
              },
              { status: 404 },
            )
          : HttpResponse.json({ success: true, data: player, error: null, meta: meta() });
      }),
    );
    return reads;
  };

  const debit = async (
    user: ReturnType<typeof renderDetail>['user'],
    amount: string,
    reason: string,
  ) => {
    await user.click(await screen.findByRole('button', { name: 'Debit player' }));
    await user.type(await screen.findByLabelText(/^Amount to take out/), amount);
    await user.type(screen.getByLabelText('Reason'), reason);
    await user.click(screen.getByRole('button', { name: 'Review this debit' }));
  };

  it('hides the debit action from a role that may not decide money', async () => {
    renderDetail(PLAYER_IDS.linkedActive, 'SUPPORT');

    expect(await screen.findByRole('heading', { name: 'Karim Nasser' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Debit player' })).not.toBeInTheDocument();
  });

  it('offers it to a reviewer, who decides money but may not create accounts', async () => {
    renderDetail(PLAYER_IDS.pendingLink, 'REVIEWER');

    expect(await screen.findByRole('button', { name: 'Debit player' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^create ichancy account$/i }),
    ).not.toBeInTheDocument();
  });

  it('takes the money only after the confirmation, then re-reads the player', async () => {
    const reads = countPlayerReads();
    const { user } = renderDetail(PLAYER_IDS.linkedActive);

    await debit(user, '1500.00', 'Chargeback on the original deposit');

    // One read for the page. The confirmation step has sent nothing yet.
    expect(reads).toHaveLength(1);
    expect(
      await screen.findByText('Take this money out of Karim Nasser’s casino account?'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Debit 1,500.00 NSP' }));

    // The outcome stays on the page after the dialog has gone, with the figures attached.
    const outcome = await screen.findByRole('status');
    expect(within(outcome).getByText('Took 1,500.00 NSP out of this account')).toBeInTheDocument();
    expect(within(outcome).getByText('3,200.00 NSP')).toBeInTheDocument();
    expect(within(outcome).getByText('1,700.00 NSP')).toBeInTheDocument();
    expect(within(outcome).getByText('Proved by balance re-read')).toBeInTheDocument();
    expect(within(outcome).getByText('Chargeback on the original deposit')).toBeInTheDocument();

    await waitFor(() => {
      expect(reads.length).toBeGreaterThan(1);
    });
  });

  it('says plainly when nobody knows whether the debit landed', async () => {
    // The fixture whose Ichancy agent does not answer: one balance re-read, still unproven.
    const { user } = renderDetail(PLAYER_IDS.selfExcluded);

    await debit(user, '100.00', 'Self-exclusion settlement');
    await user.click(await screen.findByRole('button', { name: 'Debit 100.00 NSP' }));

    const outcome = await screen.findByRole('status');
    expect(
      within(outcome).getByText('Nobody knows yet whether this debit landed'),
    ).toBeInTheDocument();
    expect(within(outcome).getByText(/Do not send it again from here/)).toBeInTheDocument();
    // Nothing proved it, so the panel does not claim anything did.
    expect(within(outcome).getByText('Not confirmed')).toBeInTheDocument();
  });

  it('explains itself instead of offering a form when there is no Ichancy account', async () => {
    const { user } = renderDetail(PLAYER_IDS.pendingLink);

    await user.click(await screen.findByRole('button', { name: 'Debit player' }));

    expect(await screen.findByText('This player has no Ichancy account')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Amount to take out/)).not.toBeInTheDocument();
  });
});

describe('PlayerDetailPage: a debit nobody can prove', () => {
  it('keeps the warning on the page after the dialog is closed', async () => {
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/players/:id/debit`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'INTERNAL_ERROR', message: 'The debit service is unavailable.' },
            meta: { correlationId: 'test-corr-9', timestamp: new Date().toISOString() },
          },
          { status: 500 },
        ),
      ),
    );
    const { user } = renderDetail(PLAYER_IDS.linkedActive);

    await user.click(await screen.findByRole('button', { name: 'Debit player' }));
    await user.type(await screen.findByLabelText(/^Amount to take out/), '1500.00');
    await user.type(screen.getByLabelText('Reason'), 'Chargeback');
    await user.click(screen.getByRole('button', { name: 'Review this debit' }));
    await user.click(await screen.findByRole('button', { name: 'Debit 1,500.00 NSP' }));

    // The dialog says it, and refuses to offer the one thing that would take the money twice. The
    // page has already been told as well, which is the second copy behind the modal.
    expect(await screen.findAllByText('This may already have gone through')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Stop here' }));

    // Closing it does not make it go away: the next person to open this player sees it too.
    const warning = await screen.findByRole('status');
    expect(within(warning).getByText('This may already have gone through')).toBeInTheDocument();
    expect(within(warning).getByText('The debit service is unavailable.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Debit 1,500/ })).not.toBeInTheDocument();
  });
});
