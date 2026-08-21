import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { config } from '@/config';
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

    await user.click(
      await screen.findByRole('button', { name: /^create ichancy account$/i }),
    );
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
