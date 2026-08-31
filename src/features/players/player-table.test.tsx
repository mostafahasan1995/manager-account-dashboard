import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  const onDeposit = vi.fn();
  const onWithdraw = vi.fn();
  const rendered = renderWithProviders(
    <PlayerTable players={players} onLink={onLink} onDeposit={onDeposit} onWithdraw={onWithdraw} />,
    {
      route: '/players',
      routePath: '/players',
      auth: { role },
    },
  );
  return { ...rendered, onLink, onDeposit, onWithdraw };
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

/**
 * The balance column.
 *
 * There is no bulk balance endpoint — Ichancy's player list carries no balance at all — so each
 * cell is its own upstream call. That makes the failure of ONE cell an ordinary event rather than
 * an exceptional one, and the rule below is the one this column lives or dies by.
 */
describe('PlayerTable — balances', () => {
  it('shows a balance for each linked player on the page', async () => {
    renderTable([linked]);

    // 100001 minor = 1,000.01 in a 2-scale currency.
    expect(await screen.findByText(/1,000\.01/)).toBeInTheDocument();
  });

  it('renders a REAL zero as zero — an empty account is a fact', async () => {
    const newcomer = fixture(PLAYER_IDS.newcomer);
    renderTable([newcomer]);

    expect(await screen.findByText(/0\.00/)).toBeInTheDocument();
  });

  /**
   * THE ASSERTION THIS FILE EXISTS FOR. `0` and "we could not find out" look identical in a table
   * cell and lead to opposite decisions — one says the account is empty, the other says nothing is
   * known — and this column sits beside buttons that move real money. So a failed read shows a word
   * and offers a retry, and must never show a figure.
   */
  it('shows a failed balance as unknown, NEVER as a number', async () => {
    const unreadable = fixture(PLAYER_IDS.suspended);
    renderTable([unreadable]);

    expect(await screen.findByText('Unknown')).toBeInTheDocument();
    expect(screen.queryByText(/^0\.00$/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry the balance/i })).toBeInTheDocument();
  });

  it('does not ask for a balance a player cannot have', async () => {
    renderTable([pending]);

    // No Ichancy account: the backend refuses this rather than answering, so asking would spend a
    // request to be told what the row already says.
    expect(await screen.findByText('No account')).toBeInTheDocument();
  });
});

describe('the money actions on every row', () => {
  it('offers Deposit and Withdrawal for every player, linked or not', async () => {
    // Deposit is offered even to an unlinked player on purpose: a manual credit rides the deposit
    // spine, which links a missing Ichancy account on the way to crediting it. The debit dialog is
    // the thing that says "there is no account to take from", not a hidden button.
    const { onDeposit, onWithdraw } = renderTable([linked, pending]);

    expect(await screen.findAllByRole('button', { name: /^Deposit to/ })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /^Withdraw from/ })).toHaveLength(2);
    expect(onDeposit).not.toHaveBeenCalled();
    expect(onWithdraw).not.toHaveBeenCalled();
  });

  it('names the player in each action, so a table of buttons is not ambiguous', async () => {
    renderTable([linked]);

    expect(
      await screen.findByRole('button', { name: 'Deposit to Karim Nasser' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Withdraw from Karim Nasser' })).toBeInTheDocument();
  });

  it('raises the row’s own player when Deposit is pressed', async () => {
    const user = userEvent.setup();
    const { onDeposit } = renderTable([linked, pending]);

    await user.click(await screen.findByRole('button', { name: `Deposit to Karim Nasser` }));

    expect(onDeposit).toHaveBeenCalledTimes(1);
    expect(onDeposit).toHaveBeenCalledWith(linked);
  });

  it('raises the row’s own player when Withdrawal is pressed', async () => {
    const user = userEvent.setup();
    const { onWithdraw } = renderTable([linked, pending]);

    await user.click(await screen.findByRole('button', { name: 'Withdraw from Karim Nasser' }));

    expect(onWithdraw).toHaveBeenCalledTimes(1);
    expect(onWithdraw).toHaveBeenCalledWith(linked);
  });

  it('hides both from a role that may not decide money', async () => {
    // SUPPORT can read players and nothing else. Hiding is a courtesy — the server refuses either
    // way — but a button that always 403s is a lie about what this person can do.
    renderTable([linked], 'SUPPORT');

    await screen.findByText('Karim Nasser');
    expect(screen.queryByRole('button', { name: /^Deposit to/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Withdraw from/ })).not.toBeInTheDocument();
  });
});
