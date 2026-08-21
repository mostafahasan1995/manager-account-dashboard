import { screen } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { config } from '@/config';
import type { Locale } from '@/lib/i18n/locales';
import { PLAYER_IDS } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/utils';

import { PlayerDeposits } from './player-deposits';

const DEPOSITS_URL = `${config.apiBaseUrl}/v1/admin/deposits`;

const renderDeposits = (playerId: string, locale: Locale = 'en') =>
  renderWithProviders(<PlayerDeposits playerId={playerId} />, {
    route: '/players/x',
    routePath: '/players/$playerId',
    locale,
  });

describe('PlayerDeposits', () => {
  it('lists the player deposits whatever their status, and links each into the queue', async () => {
    renderDeposits(PLAYER_IDS.linkedActive);

    const submitted = await screen.findByRole('link', { name: 'K7QP42' });
    expect(submitted).toHaveAttribute('href', expect.stringContaining('/deposits?selected='));
    expect(screen.getByText('15,000.00 NSP')).toBeInTheDocument();
    expect(screen.getByText('Submitted')).toBeInTheDocument();
    // A rejected or failed deposit is exactly what the player is ringing about, so the default
    // reviewable-only filter must not be what this panel asks for.
    expect(screen.getByRole('link', { name: 'C1FF77' })).toBeInTheDocument();
    expect(screen.getByText('Credit failed')).toBeInTheDocument();
    expect(screen.getByText('Credited')).toBeInTheDocument();
  });

  it('shows a skeleton rather than an empty panel while it loads', async () => {
    server.use(
      http.get(DEPOSITS_URL, async () => {
        await delay(60);
        return undefined;
      }),
    );
    renderDeposits(PLAYER_IDS.linkedActive);

    expect(await screen.findByTestId('table-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('No deposits yet')).not.toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'K7QP42' })).toBeInTheDocument();
  });

  it('says when a player has never deposited', async () => {
    renderDeposits(PLAYER_IDS.closed);

    expect(await screen.findByText('No deposits yet')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the failure rather than an empty panel', async () => {
    server.use(
      http.get(DEPOSITS_URL, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'INTERNAL_ERROR', message: 'The deposit queue is unavailable.' },
            meta: { correlationId: 'test-corr-4', timestamp: new Date().toISOString() },
          },
          { status: 500 },
        ),
      ),
    );
    renderDeposits(PLAYER_IDS.linkedActive);

    expect(await screen.findByText('The deposit queue is unavailable.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('counts what it is showing, in English', async () => {
    // The pending-link player has exactly two deposits in the fixtures.
    renderDeposits(PLAYER_IDS.pendingLink);

    expect(
      await screen.findByText(/Showing the 2 most recent deposits\./),
    ).toBeInTheDocument();
  });

  it("uses Arabic's dual for the two deposits it found, not the plural", async () => {
    renderDeposits(PLAYER_IDS.pendingLink, 'ar');

    // إيداعين is the dual; a bundle that only copied English's one/other would say "2 إيداع" here.
    expect(await screen.findByText(/يظهر آخر إيداعين\./)).toBeInTheDocument();
    expect(screen.queryByText(/2 إيداع/)).not.toBeInTheDocument();
  });
});
