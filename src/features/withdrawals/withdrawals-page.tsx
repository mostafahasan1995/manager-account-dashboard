import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { QUEUE_POLL_MS, useWithdrawals } from '@/lib/api/queries';
import { withdrawalKeys } from '@/lib/api/query-keys';
import { useFormatters } from '@/lib/i18n/use-format';
import { useT } from '@/lib/i18n/use-translation';
import { cn } from '@/lib/utils';
import type { AdminWithdrawal, Paginated } from '@/types';

import { withdrawalMessages } from './messages';
import { WithdrawalDetailSheet } from './withdrawal-detail-sheet';
import { WithdrawalFilters } from './withdrawal-filters';
import { hasActiveFilters, shouldPoll, toListQuery } from './withdrawal-model';
import { WithdrawalTable } from './withdrawal-table';
import { useWithdrawalNavigation, useWithdrawalSearch } from './withdrawal-url';

/**
 * The withdrawal queue — money going OUT, which the deposit queue's habits fit with one change.
 *
 * The filters, the page and the open withdrawal live in the URL, so any view of the queue is a
 * link. The list polls while there is something still moving in it and says how fresh it is. The
 * one change: there is no claim. A cash-out is decided once, by whoever presses the button, and
 * the server refuses the second press with a 409 that the panel renders as "already handled".
 */
export function WithdrawalsPage() {
  const search = useWithdrawalSearch();
  const { setSearch, clearFilters, goToOffset } = useWithdrawalNavigation(search);
  const t = useT(withdrawalMessages);

  const queryClient = useQueryClient();

  const query = useMemo(() => toListQuery(search), [search]);
  // Whether to poll depends on the rows, and the rows come from the query the poll setting is
  // handed to. Reading the cache directly breaks the loop without an effect: on the first render
  // there is nothing cached and the filter alone decides; once the page lands the component
  // re-renders with it, and the rows decide from then on.
  const cached = queryClient.getQueryData<Paginated<AdminWithdrawal>>(withdrawalKeys.list(query));
  const polling = shouldPoll(cached?.data ?? [], search.status);
  const list = useWithdrawals(query, { poll: polling ? QUEUE_POLL_MS : false });
  const rows = useMemo(() => list.data?.data ?? [], [list.data]);

  const selected = search.selected;

  const openWithdrawal = useCallback(
    (withdrawalId: string) => {
      setSearch({ selected: withdrawalId });
    },
    [setSearch],
  );

  const closePanel = useCallback(() => {
    setSearch({ selected: undefined });
  }, [setSearch]);

  return (
    <div className="space-y-5">
      <PageHeader
        // The screen and the nav item are the same word in both languages; one string, one place.
        title={t('nav.withdrawals')}
        description={t('withdrawals.description')}
        actions={
          <QueueFreshness
            updatedAt={list.dataUpdatedAt}
            isFetching={list.isFetching}
            live={polling}
          />
        }
      />

      <WithdrawalFilters />

      <Card className="overflow-hidden">
        <WithdrawalTable
          rows={rows}
          meta={list.data?.meta}
          isLoading={list.isLoading}
          isFetching={list.isFetching}
          error={list.error}
          onRetry={() => {
            void list.refetch();
          }}
          selectedId={selected}
          onOpen={openWithdrawal}
          onOffsetChange={goToOffset}
          emptyAction={
            hasActiveFilters(search) ? (
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                {t('withdrawals.queue.showAll')}
              </Button>
            ) : undefined
          }
        />
      </Card>

      <WithdrawalDetailSheet withdrawalId={selected} onClose={closePanel} />
    </div>
  );
}

/**
 * How stale the queue is, in words — and whether it is refreshing itself at all.
 *
 * A view of paid rows does not poll, and saying so is what stops "updated 20 minutes ago" from
 * reading as a broken connection.
 */
function QueueFreshness({
  updatedAt,
  isFetching,
  live,
}: {
  updatedAt: number;
  isFetching: boolean;
  live: boolean;
}) {
  const t = useT(withdrawalMessages);
  const formatters = useFormatters();
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick((value) => value + 1);
    }, 1_000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <span className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
      <span
        aria-hidden="true"
        className={cn(
          'size-2 rounded-full',
          isFetching
            ? 'animate-pulse bg-[var(--info)]'
            : live
              ? 'bg-[var(--success)]'
              : 'bg-[var(--border-strong)]',
        )}
      />
      {isFetching
        ? t('withdrawals.queue.refreshing')
        : updatedAt === 0
          ? t('withdrawals.queue.notLoaded')
          : t(live ? 'withdrawals.queue.updated' : 'withdrawals.queue.settled', {
              time: formatters.relative(new Date(updatedAt)),
            })}
    </span>
  );
}
