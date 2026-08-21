import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PLAYER_IDS, mockPlayers } from '@/mocks/fixtures';
import { renderWithProviders } from '@/test/utils';
import type { AdminPlayer } from '@/types/player';

import { PlayerTable } from './player-table';

const fixture = (id: string): AdminPlayer => {
  const found = mockPlayers.find((player) => player.id === id);
  if (found === undefined) throw new Error(`No player fixture for ${id}`);
  return found;
};

const linked = fixture(PLAYER_IDS.linkedActive);
const pending = fixture(PLAYER_IDS.pendingLink);
const closed = fixture(PLAYER_IDS.closed);

const renderTable = (players: AdminPlayer[], role: 'SUPER_ADMIN' | 'SUPPORT' = 'SUPER_ADMIN') => {
  const onLink = vi.fn();
  const rendered = renderWithProviders(<PlayerTable players={players} onLink={onLink} />, {
    route: '/players',
    routePath: '/players',
    auth: { role },
  });
  return { ...rendered, onLink };
};

describe('PlayerTable', () => {
  it('shows a linked player with their Ichancy login and id', async () => {
    renderTable([linked]);

    expect(await screen.findByRole('link', { name: 'Karim Nasser' })).toHaveAttribute(
      'href',
      `/players/${linked.id}`,
    );
    expect(screen.getByText('@karim_play')).toBeInTheDocument();
    expect(screen.getByText('tg512340001')).toBeInTheDocument();
    expect(screen.getByText('id 99001')).toBeInTheDocument();
    expect(screen.queryByText('Not linked')).not.toBeInTheDocument();
  });

  it('says a pending player cannot be credited, and a closed one only that it is not linked', async () => {
    renderTable([pending, closed]);

    expect(await screen.findAllByText('Not linked')).toHaveLength(2);
    // The warning belongs to the player who is waiting for an account, not to the closed one.
    expect(screen.getAllByText('Cannot be credited')).toHaveLength(1);
    expect(screen.getByText('Pending Ichancy')).toBeInTheDocument();
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });

  it('offers the link action for an unlinked player and hands the row back', async () => {
    const { onLink, user } = renderTable([linked, pending]);

    const button = await screen.findByRole('button', {
      name: /create ichancy account for maya/i,
    });
    await user.click(button);

    expect(onLink).toHaveBeenCalledWith(pending);
    // A linked player has nothing to create, so only one row offers it.
    expect(screen.getAllByRole('button', { name: /create ichancy account/i })).toHaveLength(1);
  });

  it('hides the link action from a role without players.link', async () => {
    renderTable([pending], 'SUPPORT');

    expect(await screen.findByText('Not linked')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /create ichancy account/i }),
    ).not.toBeInTheDocument();
  });

  it('gives every Telegram id a copy button', async () => {
    renderTable([linked]);

    expect(await screen.findByRole('button', { name: 'Copy' })).toBeInTheDocument();
    expect(screen.getByText('512340001')).toBeInTheDocument();
  });
});
