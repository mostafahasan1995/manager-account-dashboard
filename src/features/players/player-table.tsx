import { Link } from '@tanstack/react-router';
import { UserPlus } from 'lucide-react';

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
} from '@/components/ui';
import { useT } from '@/lib/i18n/use-translation';
import { cn } from '@/lib/utils';
import { playerDisplayName, type AdminPlayer } from '@/types/player';

import { playerMessages } from './messages';

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
}: {
  players: readonly AdminPlayer[];
  onLink: (player: AdminPlayer) => void;
}) {
  const t = useT(playerMessages);

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

              <TableCell className="tabular">{player.currencyCode}</TableCell>

              <TableCell>
                <TimeAgo value={player.createdAt} className="text-[var(--muted-foreground)]" />
              </TableCell>

              <TableCell>
                <TimeAgo value={player.lastSeenAt} className="text-[var(--muted-foreground)]" />
              </TableCell>

              <TableCell className="text-end">
                {player.ichancyLinked ? null : (
                  <Can capability="players.link">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        onLink(player);
                      }}
                      aria-label={t('players.link.forPlayer', { name })}
                    >
                      <UserPlus aria-hidden="true" />
                      {t('players.link.action')}
                    </Button>
                  </Can>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
