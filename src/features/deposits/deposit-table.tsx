import { Link } from '@tanstack/react-router';
import type { MouseEvent, ReactNode } from 'react';

import { CopyButton } from '@/components/common/copy-button';
import { MoneyAmount } from '@/components/common/money-amount';
import { LoadMore } from '@/components/common/pagination';
import { RiskIndicator } from '@/components/common/risk-flags';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/states';
import { DepositStatusBadge } from '@/components/common/status-badge';
import { Countdown, TimeAgo } from '@/components/common/time';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useT } from '@/lib/i18n/use-translation';
import { isZeroDecimal } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { AdminDeposit } from '@/types';

import { claimStateOf, type ClaimState } from './deposit-model';
import { depositMessages, type DepositMessageKey } from './messages';

/**
 * The queue itself: a real table, because this is tabular money that gets scanned down a column,
 * compared row to row, and read aloud over the phone.
 *
 * The row is a shortcut to the review panel, not the only way in — every row also carries a real
 * button on its short id, so the queue is workable from the keyboard and by a screen reader without
 * anybody having to guess that a table row is clickable.
 */
export interface DepositTableProps {
  rows: readonly AdminDeposit[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  /** The deposit open in the review panel. */
  selectedId: string | undefined;
  /** The row the j/k keys are sitting on, which is not yet a decision to open it. */
  focusedId: string | undefined;
  onOpen: (depositId: string) => void;
  currentAdminId: string | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  emptyAction?: ReactNode;
}

const CLAIM_STATE_CLASSES: Record<ClaimState, string> = {
  unclaimed: 'text-[var(--muted-foreground)]',
  you: 'text-[var(--success)] font-medium',
  other: 'text-[var(--warning)]',
};

const CLAIM_STATE_KEYS: Record<ClaimState, DepositMessageKey> = {
  unclaimed: 'deposits.claim.unclaimed',
  you: 'deposits.claim.you',
  other: 'deposits.claim.other',
};

export function DepositTable({
  rows,
  isLoading,
  error,
  onRetry,
  selectedId,
  focusedId,
  onOpen,
  currentAdminId,
  hasMore,
  isLoadingMore,
  onLoadMore,
  emptyAction,
}: DepositTableProps) {
  const t = useT(depositMessages);

  if (isLoading) return <TableSkeleton rows={8} columns={7} />;

  if (error !== null && error !== undefined) {
    return <ErrorState error={error} onRetry={onRetry} />;
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title={t('state.empty')}
        description={t('deposits.table.emptyBody')}
        action={emptyAction}
      />
    );
  }

  return (
    <>
      <Table>
        <TableCaption className="sr-only">{t('deposits.table.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{t('deposits.field.shortId')}</TableHead>
            <TableHead>{t('field.player')}</TableHead>
            {/* `text-end`, not `text-right`: the money column hugs whichever edge the language ends on. */}
            <TableHead className="text-end">{t('field.amount')}</TableHead>
            <TableHead>{t('deposits.field.destination')}</TableHead>
            <TableHead>{t('deposits.field.risk')}</TableHead>
            <TableHead>{t('field.status')}</TableHead>
            <TableHead>{t('deposits.field.claim')}</TableHead>
            <TableHead>{t('deposits.field.age')}</TableHead>
            <TableHead>{t('deposits.field.expires')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((deposit) => (
            <DepositRow
              key={deposit.id}
              deposit={deposit}
              isSelected={deposit.id === selectedId}
              isFocused={deposit.id === focusedId}
              claimState={claimStateOf(deposit, currentAdminId)}
              onOpen={onOpen}
            />
          ))}
        </TableBody>
      </Table>

      <LoadMore
        hasMore={hasMore}
        loading={isLoadingMore}
        loadedCount={rows.length}
        onLoadMore={onLoadMore}
        noun={t('deposits.noun')}
      />
    </>
  );
}

function DepositRow({
  deposit,
  isSelected,
  isFocused,
  claimState,
  onOpen,
}: {
  deposit: AdminDeposit;
  isSelected: boolean;
  isFocused: boolean;
  claimState: ClaimState;
  onOpen: (depositId: string) => void;
}) {
  const t = useT(depositMessages);

  const handleRowClick = (event: MouseEvent<HTMLTableRowElement>) => {
    // A click that landed on the player link or the copy button has already done something; the
    // row must not also open the panel on top of it.
    if (event.target instanceof HTMLElement && event.target.closest('a,button') !== null) return;
    onOpen(deposit.id);
  };

  const username = deposit.playerTelegramUsername;
  const telegramId = deposit.playerTelegramUserId;

  return (
    <TableRow
      id={`deposit-row-${deposit.id}`}
      onClick={handleRowClick}
      className={cn(
        'cursor-pointer',
        isSelected && 'bg-[var(--primary-muted)]',
        isFocused && 'outline-2 -outline-offset-2 outline-[var(--ring)]',
      )}
      {...(isSelected ? { 'aria-current': true } : {})}
    >
      <TableCell>
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              onOpen(deposit.id);
            }}
            className="rounded font-mono text-xs font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          >
            {deposit.shortId}
          </button>
          <CopyButton
            value={deposit.shortId}
            label={t('deposits.copyShortId', { shortId: deposit.shortId })}
          />
        </span>
      </TableCell>

      <TableCell>
        <Link
          to="/players/$playerId"
          params={{ playerId: deposit.playerId }}
          className="block rounded underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        >
          <span className="block text-sm">
            {username === null ? t('deposits.player.noUsername') : `@${username}`}
          </span>
          <span className="tabular block text-xs text-[var(--muted-foreground)]">
            {telegramId ?? t('deposits.player.noTelegramId')}
          </span>
        </Link>
      </TableCell>

      <TableCell className="text-end">
        <MoneyAmount money={deposit.claimed} emphasis />
        {isZeroDecimal(deposit.fee.amount) ? null : (
          <span className="block text-xs text-[var(--muted-foreground)]">
            {t('deposits.feePrefix')} <MoneyAmount money={deposit.fee} withCurrency={false} />
          </span>
        )}
      </TableCell>

      <TableCell>
        <span className="block text-sm">
          {deposit.destination?.methodName ?? t('deposits.rail.unknown')}
        </span>
        <span className="block text-xs text-[var(--muted-foreground)]">
          {deposit.destination?.label ?? '—'}
        </span>
      </TableCell>

      <TableCell>
        {deposit.riskFlags.length === 0 ? (
          <span className="text-xs text-[var(--muted-foreground)]">{t('common.none')}</span>
        ) : (
          <RiskIndicator flags={deposit.riskFlags} />
        )}
      </TableCell>

      <TableCell>
        <DepositStatusBadge status={deposit.status} />
      </TableCell>

      <TableCell>
        <span className={cn('text-sm', CLAIM_STATE_CLASSES[claimState])}>
          {t(CLAIM_STATE_KEYS[claimState])}
        </span>
      </TableCell>

      <TableCell className="text-sm">
        <TimeAgo value={deposit.createdAt} />
      </TableCell>

      <TableCell className="text-sm">
        {deposit.expiresAt === null ? (
          <span className="text-[var(--muted-foreground)]">—</span>
        ) : (
          <Countdown target={deposit.expiresAt} />
        )}
      </TableCell>
    </TableRow>
  );
}
