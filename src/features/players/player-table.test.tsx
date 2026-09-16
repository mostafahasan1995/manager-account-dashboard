import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Locale } from '@/lib/i18n/locales';
import { PLAYER_IDS, mockPlayers } from '@/mocks/fixtures';
import { renderWithProviders } from '@/test/utils';
import type { AdminRole } from '@/types/enums';
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

const renderTable = (
  players: AdminPlayer[],
  role: AdminRole = 'SUPER_ADMIN',
  locale: Locale = 'en',
) => {
  const onLink = vi.fn();
  const onDeposit = vi.fn();
  const onWithdraw = vi.fn();
  const onBlock = vi.fn();
  const onUnblock = vi.fn();
  const onAttachTelegram = vi.fn();
  const rendered = renderWithProviders(
    <PlayerTable
      players={players}
      onLink={onLink}
      onDeposit={onDeposit}
      onWithdraw={onWithdraw}
      onBlock={onBlock}
      onUnblock={onUnblock}
      onAttachTelegram={onAttachTelegram}
    />,
    {
      route: '/players',
      routePath: '/players',
      auth: { role },
      locale,
    },
  );
  return { ...rendered, onLink, onDeposit, onWithdraw, onBlock, onUnblock, onAttachTelegram };
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
/**
 * The pinned actions column.
 *
 * Nine columns put this table into horizontal scroll on a laptop, and the column an operator came
 * here to press is the last of them — unpinned, it is the first thing they lose. Nothing else in
 * this file would notice it scrolling away again: every other assertion here finds its button by
 * name, whether or not the button is anywhere on screen.
 */
describe('the pinned actions column', () => {
  /** The header and the first row's cell — the two elements that carry the pinning. */
  const pinnedElements = () => {
    const header = screen.getByRole('columnheader', { name: 'Action' });
    const cell = screen.getByRole('button', { name: 'Deposit to Karim Nasser' }).closest('td');
    const found = [header, cell].filter((element): element is HTMLElement => element !== null);
    expect(found).toHaveLength(2);
    return found;
  };

  /**
   * The inline offset, in px, of the inset shadow the pinned cell draws its own edge with — read
   * back for one writing direction at a time, `''` for the document's and `'rtl:'` for the mirror.
   *
   * Reading the offset out rather than matching the whole class means the assertion is about which
   * SIDE the edge lands on, which is the part that can silently be wrong.
   */
  const edgeOffset = (element: HTMLElement, variant: '' | 'rtl:'): number | null => {
    const pattern = new RegExp(`^${variant}shadow-\\[inset_(-?\\d+)px_0_0_var\\(--border\\)\\]$`);
    for (const name of [...element.classList]) {
      const match = pattern.exec(name);
      if (match !== null) return Number(match[1]);
    }
    return null;
  };

  it('pins the actions header and cell to the end edge, over an opaque row', async () => {
    renderTable([linked, pending]);
    await screen.findByRole('columnheader', { name: 'Action' });

    for (const element of pinnedElements()) {
      // `end-0` is inset-inline-end: in Arabic the whole table flips, and the column has to follow
      // the other edge on its own. `bg-inherit` is what stops the scrolling columns showing through
      // the pinned cell, and what carries the row's hover and selected states into it.
      expect(element).toHaveClass('sticky', 'end-0', 'z-10', 'bg-inherit');
    }

    const cell = screen.getByRole('button', { name: 'Deposit to Karim Nasser' }).closest('td');
    // Inheriting a background is only worth anything if the row has an opaque one. That is why the
    // waiting tint is mixed into the surface rather than laid over it at half opacity.
    expect(cell?.closest('tr')).toHaveClass('bg-[var(--surface)]');
    expect(screen.getByText('Cannot be credited').closest('tr')).toHaveClass(
      'bg-[color-mix(in_oklab,var(--warning-muted)_50%,var(--surface))]',
    );
  });

  /**
   * THE ASSERTION THIS BLOCK EXISTS FOR, and the one the column shipped without: it pinned
   * correctly while drawing NO EDGE AT ALL. The edge was a `border-s`, and Tailwind's preflight
   * collapses table borders — under collapse the browser resolves each shared edge to one border
   * and drops the other, so the pinned cell's was never painted and the column read as broken.
   *
   * So this checks the edge is drawn by something a collapsed table cannot swallow — an inset
   * shadow, which belongs to this cell alone — and that no border has crept back in to take its
   * job. The suite runs with `css: false`, so there is no computed pixel here to measure; what it
   * can still prove, and what matching a literal class string could not, is that the two offsets
   * are MIRRORED. A shadow offset has no logical form, so an unmirrored pair puts the separator
   * down the wrong side of the column in Arabic while looking perfectly correct in English.
   */
  it('draws its own edge with a mirrored inset shadow, never a border', async () => {
    renderTable([linked]);
    await screen.findByRole('columnheader', { name: 'Action' });

    for (const element of pinnedElements()) {
      const ltr = edgeOffset(element, '');
      expect(ltr).toBe(1);
      expect(edgeOffset(element, 'rtl:')).toBe(ltr === null ? null : -ltr);
      expect([...element.classList].filter((name) => name.startsWith('border-'))).toEqual([]);
    }
  });
});

/**
 * The operator's own lock, and the rows that have no Telegram account.
 *
 * A BLOCKED row is tinted the way a waiting row is — mixed into the opaque surface, for the same
 * pinned-column reason — but the tint is never the only signal: the badge says "Blocked" in words.
 * A row with no Telegram id shows a dash and no copy button, because copying "—" is a bug waiting
 * to be pasted into a chat.
 */
describe('blocked rows and rows without Telegram', () => {
  const blocked = fixture(PLAYER_IDS.blocked);
  const imported = fixture(PLAYER_IDS.imported);

  it('tints a blocked row with the danger surface and says so in words', async () => {
    renderTable([linked, blocked]);

    const row = (await screen.findByRole('link', { name: 'Bassel Khoury' })).closest('tr');
    expect(row).toHaveClass('bg-[color-mix(in_oklab,var(--danger-muted)_50%,var(--surface))]');
    expect(within(row as HTMLElement).getByText('Blocked')).toBeInTheDocument();
    // The ordinary row keeps the plain surface.
    expect(screen.getByRole('link', { name: 'Karim Nasser' }).closest('tr')).toHaveClass(
      'bg-[var(--surface)]',
    );
  });

  it('renders a missing Telegram id as a dash with no copy button', async () => {
    renderTable([imported]);

    const row = (await screen.findByRole('link', { name: 'samer1987' })).closest('tr');
    expect(within(row as HTMLElement).getByLabelText('No Telegram account')).toHaveTextContent('—');
    expect(
      within(row as HTMLElement).queryByRole('button', { name: 'Copy' }),
    ).not.toBeInTheDocument();
  });

  it('offers Attach Telegram only for a row with no id, and hands the row back', async () => {
    const { onAttachTelegram, user } = renderTable([linked, imported]);

    const buttons = await screen.findAllByRole('button', { name: /^Attach Telegram to/ });
    expect(buttons).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Attach Telegram to samer1987' }));

    expect(onAttachTelegram).toHaveBeenCalledWith(imported);
  });

  it('offers Block for an ordinary row, Unblock for a blocked one, and neither for a closed one', async () => {
    const { onBlock, onUnblock, user } = renderTable([linked, blocked, closed]);

    await user.click(await screen.findByRole('button', { name: 'Block Karim Nasser' }));
    expect(onBlock).toHaveBeenCalledWith(linked);

    await user.click(screen.getByRole('button', { name: 'Unblock Bassel Khoury' }));
    expect(onUnblock).toHaveBeenCalledWith(blocked);

    expect(screen.queryByRole('button', { name: 'Block Bassel Khoury' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^(Block|Unblock) Old Account$/ }),
    ).not.toBeInTheDocument();
  });

  it('hides block, unblock and attach from a role that cannot hold them', async () => {
    renderTable([linked, blocked, imported], 'SUPPORT');

    await screen.findByRole('link', { name: 'Bassel Khoury' });
    expect(screen.queryByRole('button', { name: /^Block / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Unblock / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Attach Telegram/ })).not.toBeInTheDocument();
  });

  it('names the actions in Arabic', async () => {
    renderTable([linked, blocked, imported], 'SUPER_ADMIN', 'ar');

    expect(await screen.findByRole('button', { name: 'حظر Karim Nasser' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'رفع الحظر عن Bassel Khoury' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ربط تلغرام بـ samer1987' })).toBeInTheDocument();
    expect(screen.getByText('محظور')).toBeInTheDocument();
  });
});
