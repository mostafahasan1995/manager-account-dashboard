import { Link } from '@tanstack/react-router';
import { ArrowRight, Clock } from 'lucide-react';

import {
  DepositStatusBadge,
  EmptyState,
  ErrorState,
  MoneyAmount,
  RiskIndicator,
  TableSkeleton,
  TimeAgo,
} from '@/components/common';
import {
  Badge,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { minutesSince } from '@/lib/format';
import { flattenPages, useDepositQueue } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import { cn, truncateId } from '@/lib/utils';
import type { AdminDeposit } from '@/types';

import { overviewMessages } from './messages';
import { LATE_WAIT_MINUTES, OLDEST_WAITING_QUERY, waitingSince } from './overview-data';

/**
 * The front of the queue, on the screen a shift starts on.
 *
 * Ordering by age rather than by amount is the point: the money a player is waiting on is the same
 * size whatever it is, and the deposit that has been sitting longest is the one costing trust. The
 * wait is called out in words as well as in colour once it passes the late mark, because a reviewer
 * scanning five rows should not have to tell amber from grey to know which one is overdue.
 */

/**
 * Falls back to the TELEGRAM id, not our internal one. A player without a username is identified to
 * everybody — the bot, the support call, the agent panel — by their Telegram number; a truncated
 * `bbbbbbbb…` of a UUID names them to nobody, and cannot be searched for.
 */
function playerLabel(deposit: AdminDeposit): string {
  if (deposit.playerTelegramUsername !== null) return `@${deposit.playerTelegramUsername}`;
  return deposit.playerTelegramUserId ?? truncateId(deposit.playerId);
}

function WaitCell({ deposit }: { deposit: AdminDeposit }) {
  const t = useT(overviewMessages);
  const since = waitingSince(deposit);
  const waited = minutesSince(since);
  const late = waited !== null && waited >= LATE_WAIT_MINUTES;

  return (
    <span className="flex items-center justify-end gap-2">
      <TimeAgo
        value={since}
        className={cn('text-sm', late && 'font-medium text-[var(--warning)]')}
      />
      {late ? <Badge tone="warning">{t('overview.waiting.late')}</Badge> : null}
    </span>
  );
}

export function OldestWaiting() {
  const t = useT(overviewMessages);
  const { data, isLoading, error, refetch } = useDepositQueue(OLDEST_WAITING_QUERY);
  const rows = flattenPages(data?.pages);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <CardTitle className="flex items-center gap-2">
            {/* A clock reads the same either way round; only the arrow below it points. */}
            <Clock className="size-4 text-[var(--muted-foreground)]" />
            {t('overview.waiting.title')}
          </CardTitle>
          <CardDescription>{t('overview.waiting.description')}</CardDescription>
        </div>
        <Link
          to="/deposits"
          search={{ sort: 'oldest' }}
          className="inline-flex shrink-0 items-center gap-1 rounded text-sm font-medium text-[var(--primary)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        >
          {t('overview.waiting.openQueue')}
          <ArrowRight className="size-3.5 rtl:rotate-180" />
        </Link>
      </CardHeader>

      {isLoading ? <TableSkeleton rows={5} columns={5} /> : null}

      {!isLoading && error !== null ? (
        <ErrorState
          error={error}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : null}

      {!isLoading && error === null && rows.length === 0 ? (
        <EmptyState
          title={t('overview.waiting.emptyTitle')}
          description={t('overview.waiting.emptyBody')}
        />
      ) : null}

      {!isLoading && error === null && rows.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('overview.waiting.columnDeposit')}</TableHead>
              <TableHead>{t('field.player')}</TableHead>
              <TableHead className="text-end">{t('field.amount')}</TableHead>
              <TableHead>{t('field.status')}</TableHead>
              <TableHead className="text-end">{t('overview.waiting.columnWaiting')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((deposit) => (
              <TableRow key={deposit.id}>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <Link
                      to="/deposits"
                      search={{ selected: deposit.id }}
                      aria-label={t('overview.waiting.openDeposit', { shortId: deposit.shortId })}
                      className="rounded font-mono text-sm font-medium text-[var(--primary)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                    >
                      {deposit.shortId}
                    </Link>
                    <RiskIndicator flags={deposit.riskFlags} />
                  </span>
                </TableCell>
                <TableCell className="text-sm text-[var(--muted-foreground)]">
                  {playerLabel(deposit)}
                </TableCell>
                <TableCell className="text-end">
                  <MoneyAmount money={deposit.claimed} />
                </TableCell>
                <TableCell>
                  <DepositStatusBadge status={deposit.status} />
                </TableCell>
                <TableCell className="text-end">
                  <WaitCell deposit={deposit} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </Card>
  );
}
