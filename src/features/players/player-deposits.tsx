import { Link } from '@tanstack/react-router';
import { Receipt } from 'lucide-react';

import {
  DepositStatusBadge,
  EmptyState,
  ErrorState,
  MoneyAmount,
  TableSkeleton,
  TimeAgo,
} from '@/components/common';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { flattenPages, useDepositQueue } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import { DEPOSIT_STATUSES } from '@/types/enums';

import { playerMessages } from './messages';

/**
 * The player's last few deposits, for the question support is actually asked: "where is my money?"
 *
 * Every status is requested, not the queue's reviewable default — a player ringing about a deposit
 * is usually ringing about one that was rejected, expired or failed to credit, which the default
 * filter hides. Polling is off: this is a history panel, not the live queue.
 */

const RECENT_LIMIT = 5;

export function PlayerDeposits({ playerId }: { playerId: string }) {
  const t = useT(playerMessages);
  const deposits = useDepositQueue(
    { playerId, status: [...DEPOSIT_STATUSES], limit: RECENT_LIMIT },
    { poll: false },
  );
  const rows = flattenPages(deposits.data?.pages);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('players.deposits.title')}</CardTitle>
        <CardDescription>
          {/* The count is what is on screen, not what the player has ever sent — this panel asks
              for the newest few, so promising a total here would be a number nobody can check. */}
          {rows.length === 0
            ? t('players.deposits.hint')
            : `${t('players.deposits.showing', { count: rows.length })} ${t('players.deposits.hint')}`}
        </CardDescription>
      </CardHeader>

      {deposits.isPending ? (
        <TableSkeleton rows={3} columns={4} />
      ) : deposits.isError ? (
        <ErrorState
          error={deposits.error}
          onRetry={() => {
            void deposits.refetch();
          }}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Receipt className="size-5" />}
          title={t('players.deposits.emptyTitle')}
          description={t('players.deposits.emptyDescription')}
        />
      ) : (
        <Table>
          <TableCaption className="sr-only">{t('players.deposits.caption')}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{t('players.field.deposit')}</TableHead>
              <TableHead>{t('field.amount')}</TableHead>
              <TableHead>{t('field.status')}</TableHead>
              <TableHead>{t('field.created')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((deposit) => (
              <TableRow key={deposit.id}>
                <TableCell>
                  <Link
                    to="/deposits"
                    search={{ selected: deposit.id }}
                    className="font-mono text-xs font-medium hover:underline"
                  >
                    {deposit.shortId}
                  </Link>
                </TableCell>
                <TableCell>
                  <MoneyAmount money={deposit.claimed} />
                </TableCell>
                <TableCell>
                  <DepositStatusBadge status={deposit.status} />
                </TableCell>
                <TableCell>
                  <TimeAgo value={deposit.createdAt} className="text-[var(--muted-foreground)]" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
