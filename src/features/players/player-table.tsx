import { useState } from 'react';
import { Link } from '@tanstack/react-router';

import { Banknote, PlusCircle, UserPlus } from 'lucide-react';

import { Can, CopyableValue, PlayerStatusBadge, TimeAgo } from '@/components/common';
import {
  Button,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
} from '@/components/ui';
import { useT } from '@/lib/i18n/use-translation';
import { cn } from '@/lib/utils';
import { playerDisplayName, type AdminPlayer } from '@/types/player';

import { playerMessages } from './messages';
import { PlayerBalanceCell } from './player-balance-cell';

/**
 * How many rows may fetch their balance without being asked.
 *
 * Each balance is one Ichancy call through Cloudflare — seconds, and rate-limited — so a page of
 * them is a real cost paid on every render of this screen, whether or not anyone was looking at the
 * column. Below this many rows the wait is short enough that asking first would be pedantic; above
 * it, the operator says when.
 *
 * Twelve is the largest page that still finishes in a few seconds at the shared concurrency of
 * four. It is a judgement, not a measurement of anything fixed: if the limiter changes, this should
 * be reconsidered with it.
 */
const BALANCE_AUTOLOAD_MAX_ROWS = 12;

/**
 * The player list itself.
 *
 * The column that earns its place is Ichancy: a player without a linked account cannot be
 * credited, so their deposits pile up in the queue costing real money. PENDING_ICHANCY is therefore
 * tinted and says so in words, and the row carries the action that fixes it for the roles that
 * hold it — nobody should have to open a detail page to unblock a payment.
 */
export function PlayerTable({
  players,
  onLink,
  onDeposit,
  onWithdraw,
}: {
  players: readonly AdminPlayer[];
  onLink: (player: AdminPlayer) => void;
  /** Opens the manual-credit form for this player. Same money decision as the detail page's. */
  onDeposit: (player: AdminPlayer) => void;
  /** Opens the debit form — what this product calls a withdrawal from a player's account. */
  onWithdraw: (player: AdminPlayer) => void;
}) {
  const t = useT(playerMessages);
  const [balancesRequested, setBalancesRequested] = useState(false);
  const showBalances = balancesRequested || players.length <= BALANCE_AUTOLOAD_MAX_ROWS;

  return (
    <Table>
      <TableCaption className="sr-only">{t('players.table.caption')}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{t('field.player')}</TableHead>
          <TableHead>{t('field.telegramId')}</TableHead>
          <TableHead>{t('field.status')}</TableHead>
          {/* The platform's own name, in either language. */}
          <TableHead>Ichancy</TableHead>
          <TableHead className="text-end">
            {showBalances ? (
              t('players.field.balance')
            ) : (
              // The column exists either way; only the fetching waits. A header that appeared on
              // click would move every column beside it and look like a different table.
              <span className="inline-flex items-center gap-2">
                {t('players.field.balance')}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setBalancesRequested(true);
                  }}
                >
                  {t('players.balance.load')}
                </Button>
              </span>
            )}
          </TableHead>
          <TableHead>{t('field.currency')}</TableHead>
          <TableHead>{t('field.created')}</TableHead>
          <TableHead>{t('players.field.lastSeen')}</TableHead>
          <TableHead className="text-end">{t('players.table.action')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {players.map((player) => {
          const name = playerDisplayName(player);
          const username = player.telegramUsername;
          const waiting = player.status === 'PENDING_ICHANCY';

          return (
            <TableRow key={player.id} className={cn(waiting && 'bg-[var(--warning-muted)]/50')}>
              <TableCell>
                <Link
                  to="/players/$playerId"
                  params={{ playerId: player.id }}
                  className="font-medium hover:underline"
                >
                  {name}
                </Link>
                {username === null || name === `@${username}` ? null : (
                  <p className="text-xs text-[var(--muted-foreground)]">@{username}</p>
                )}
              </TableCell>

              <TableCell>
                <CopyableValue value={player.telegramUserId} />
              </TableCell>

              <TableCell>
                <PlayerStatusBadge status={player.status} />
              </TableCell>

              <TableCell>
                {player.ichancyLinked ? (
                  <div>
                    <p className="font-mono text-xs">
                      {player.ichancyLogin ?? t('players.ichancy.linked')}
                    </p>
                    {player.ichancyPlayerId == null ? null : (
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {t('players.ichancy.playerId', { id: player.ichancyPlayerId })}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-[var(--muted-foreground)]">
                      {t('players.ichancy.notLinked')}
                    </p>
                    {waiting ? (
                      <p className="text-xs text-[var(--warning)]">
                        {t('players.cannotBeCredited')}
                      </p>
                    ) : null}
                  </div>
                )}
              </TableCell>

              <TableCell className="tabular text-end">
                <PlayerBalanceCell player={player} enabled={showBalances} />
              </TableCell>

              <TableCell className="tabular">{player.currencyCode}</TableCell>

              <TableCell>
                <TimeAgo value={player.createdAt} className="text-[var(--muted-foreground)]" />
              </TableCell>

              <TableCell>
                <TimeAgo value={player.lastSeenAt} className="text-[var(--muted-foreground)]" />
              </TableCell>

              <TableCell className="text-end">
                {/* THREE ACTIONS IN ONE CELL, as icons on the row rather than a kebab menu. A menu
                    would hide the two money actions behind a click and a glyph nobody has learned
                    yet; these are the actions an operator takes while a player is on the phone, and
                    the whole point of putting them on the row is that they are already in front of
                    them.

                    Icon-only because this is the ninth column of nine: labelled buttons made the
                    cell wider than the data it sits beside and pushed the table into horizontal
                    scroll, which costs an operator more than a word does. The word survives in the
                    tooltip; the player's NAME stays in the aria-label, because a column of
                    identical glyphs is otherwise unusable by anyone reading it a row at a time. The
                    labels themselves still render as text on the detail page, where one player is
                    the whole screen and there is room for them.

                    Deposit and Withdrawal are the same money decision in opposite directions, so
                    they share `deposits.decide` — exactly as they do on the detail page. Deposit is
                    offered whatever the player's state, because a manual credit rides the deposit
                    spine, which links a missing Ichancy account on the way to crediting it. */}
                <div className="flex justify-end gap-1">
                  <Can capability="deposits.decide">
                    <Tooltip content={t('players.credit.action')}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => {
                          onDeposit(player);
                        }}
                        aria-label={t('players.credit.forPlayer', { name })}
                      >
                        <PlusCircle className="size-3.5" aria-hidden="true" />
                      </Button>
                    </Tooltip>
                  </Can>

                  <Can capability="deposits.decide">
                    <Tooltip content={t('players.debit.action')}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => {
                          onWithdraw(player);
                        }}
                        aria-label={t('players.debit.forPlayer', { name })}
                      >
                        <Banknote className="size-3.5" aria-hidden="true" />
                      </Button>
                    </Tooltip>
                  </Can>

                  {player.ichancyLinked ? null : (
                    <Can capability="players.link">
                      <Tooltip content={t('players.link.action')}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => {
                            onLink(player);
                          }}
                          aria-label={t('players.link.forPlayer', { name })}
                        >
                          <UserPlus className="size-3.5" aria-hidden="true" />
                        </Button>
                      </Tooltip>
                    </Can>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
