import { Link } from '@tanstack/react-router';
import type { MouseEvent, ReactNode } from 'react';

import { CopyButton } from '@/components/common/copy-button';
import { MoneyAmount } from '@/components/common/money-amount';
import { Pagination } from '@/components/common/pagination';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/states';
import { TimeAgo } from '@/components/common/time';
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
import type { AdminWithdrawal, PageMeta } from '@/types';

import { withdrawalMessages } from './messages';
import {
  NetworkChip,
  WalletCheckChip,
  WithdrawalModeChip,
  WithdrawalStatusBadge,
} from './withdrawal-badges';
import { playerHandle } from './withdrawal-model';

/**
 * The queue itself: a real table, because this is money that gets scanned down a column and read
 * aloud to whoever is holding the wallet app.
 *
 * Every row also carries a real button on its short id, so the queue is workable from the keyboard
 * and by a screen reader without anybody guessing that a table row is clickable. The payout
 * address gets its own copy button because it is the one value on this screen that is pasted into
 * another app, character for character, with somebody's money behind it.
 */
export interface WithdrawalTableProps {
  rows: readonly AdminWithdrawal[];
  meta: PageMeta | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  onRetry: () => void;
  /** The withdrawal open in the detail panel. */
  selectedId: string | undefined;
  onOpen: (withdrawalId: string) => void;
  onOffsetChange: (offset: number) => void;
  emptyAction?: ReactNode;
}

export function WithdrawalTable({
  rows,
  meta,
  isLoading,
  isFetching,
  error,
  onRetry,
  selectedId,
  onOpen,
  onOffsetChange,
  emptyAction,
}: WithdrawalTableProps) {
  const t = useT(withdrawalMessages);

  if (isLoading) return <TableSkeleton rows={8} columns={8} />;

  if (error !== null && error !== undefined) {
    return <ErrorState error={error} onRetry={onRetry} />;
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title={t('state.empty')}
        description={t('withdrawals.table.emptyBody')}
        action={emptyAction}
      />
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableCaption className="sr-only">{t('withdrawals.table.caption')}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{t('withdrawals.field.shortId')}</TableHead>
              <TableHead>{t('field.player')}</TableHead>
              {/* `text-end`: the money column hugs whichever edge the language ends on. */}
              <TableHead className="text-end">{t('field.amount')}</TableHead>
              <TableHead>{t('withdrawals.field.method')}</TableHead>
              <TableHead>{t('withdrawals.field.payoutAddress')}</TableHead>
              <TableHead>{t('withdrawals.field.mode')}</TableHead>
              <TableHead>{t('field.status')}</TableHead>
              <TableHead>{t('withdrawals.field.walletCheck')}</TableHead>
              <TableHead>{t('withdrawals.field.requested')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((withdrawal) => (
              <WithdrawalRow
                key={withdrawal.id}
                withdrawal={withdrawal}
                isSelected={withdrawal.id === selectedId}
                onOpen={onOpen}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <Pagination meta={meta} onOffsetChange={onOffsetChange} disabled={isFetching} />
    </>
  );
}

function WithdrawalRow({
  withdrawal,
  isSelected,
  onOpen,
}: {
  withdrawal: AdminWithdrawal;
  isSelected: boolean;
  onOpen: (withdrawalId: string) => void;
}) {
  const t = useT(withdrawalMessages);

  const handleRowClick = (event: MouseEvent<HTMLTableRowElement>) => {
    // A click that landed on the player link or a copy button has already done something; the
    // row must not also open the panel on top of it.
    if (event.target instanceof HTMLElement && event.target.closest('a,button') !== null) return;
    onOpen(withdrawal.id);
  };

  const handle = playerHandle(withdrawal);

  return (
    <TableRow
      id={`withdrawal-row-${withdrawal.id}`}
      onClick={handleRowClick}
      className={cn('cursor-pointer', isSelected && 'bg-[var(--primary-muted)]')}
      {...(isSelected ? { 'aria-current': true } : {})}
    >
      <TableCell>
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              onOpen(withdrawal.id);
            }}
            className="rounded font-mono text-xs font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          >
            {withdrawal.shortId}
          </button>
          <CopyButton
            value={withdrawal.shortId}
            label={t('withdrawals.copyShortId', { shortId: withdrawal.shortId })}
          />
        </span>
      </TableCell>

      <TableCell>
        <Link
          to="/players/$playerId"
          params={{ playerId: withdrawal.playerId }}
          className="block rounded underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        >
          <span className="block text-sm">
            {handle.kind === 'none' ? t('withdrawals.player.open') : handle.value}
          </span>
          <span className="tabular block text-xs text-[var(--muted-foreground)]">
            {handle.kind === 'username'
              ? (withdrawal.playerTelegramUserId ?? t('withdrawals.player.noTelegramId'))
              : handle.kind === 'login'
                ? t('withdrawals.player.login')
                : t('withdrawals.player.noUsername')}
          </span>
        </Link>
      </TableCell>

      <TableCell className="text-end">
        <MoneyAmount money={withdrawal.amount} emphasis />
        {isZeroDecimal(withdrawal.fee.amount) ? null : (
          <span className="block text-xs text-[var(--muted-foreground)]">
            {t('withdrawals.feePrefix')} <MoneyAmount money={withdrawal.fee} withCurrency={false} />
          </span>
        )}
      </TableCell>

      <TableCell>
        <span className="block text-sm">{withdrawal.methodName}</span>
        <span className="block font-mono text-xs text-[var(--muted-foreground)]">
          {withdrawal.methodCode}
        </span>
      </TableCell>

      <TableCell>
        <span className="flex items-center gap-1.5">
          <code
            dir="ltr"
            className="max-w-48 truncate font-mono text-xs"
            title={withdrawal.payoutAddress}
          >
            {withdrawal.payoutAddress}
          </code>
          <CopyButton value={withdrawal.payoutAddress} label={t('withdrawals.copyAddress')} />
          <NetworkChip network={withdrawal.payoutNetwork} />
        </span>
      </TableCell>

      <TableCell>
        <WithdrawalModeChip mode={withdrawal.mode} />
      </TableCell>

      <TableCell>
        <WithdrawalStatusBadge status={withdrawal.status} />
      </TableCell>

      <TableCell>
        <WalletCheckChip check={withdrawal.walletCheck} />
      </TableCell>

      <TableCell className="text-sm">
        <TimeAgo value={withdrawal.requestedAt} />
      </TableCell>
    </TableRow>
  );
}
