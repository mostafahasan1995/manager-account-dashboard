import { Brush } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Can } from '@/components/common/can';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { errorMessage } from '@/lib/api/errors';
import { flattenPages, useDepositQueue, useSweepDeposits } from '@/lib/api/queries';
import { useAuth } from '@/lib/auth/use-auth';
import { useFormatters } from '@/lib/i18n/use-format';
import { useT } from '@/lib/i18n/use-translation';
import { cn } from '@/lib/utils';

import { DepositFilters } from './deposit-filters';
import { hasActiveFilters, toQueueQuery } from './deposit-model';
import { DepositReviewSheet } from './deposit-review-sheet';
import { DepositTable } from './deposit-table';
import { useDepositNavigation, useDepositSearch } from './deposit-url';
import { depositMessages } from './messages';

/**
 * The deposit queue — where a reviewer spends the whole shift.
 *
 * Three decisions shape this screen. The filters and the open deposit live in the URL, so any view
 * of the queue is a link. The list polls, and says out loud how fresh it is, because a colleague
 * claiming a deposit while you read it is the normal case rather than the exception. And j/k/Enter
 * move and open, but nothing irreversible is ever one keystroke away — approving and rejecting cost
 * a deliberate click in a dialog that restates the money.
 */
export function DepositsPage() {
  const search = useDepositSearch();
  const { setSearch, clearFilters } = useDepositNavigation(search);
  const { admin } = useAuth();
  const t = useT(depositMessages);

  const query = useMemo(() => toQueueQuery(search), [search]);
  const queue = useDepositQueue(query);
  const rows = useMemo(() => flattenPages(queue.data?.pages), [queue.data]);

  const [focusedId, setFocusedId] = useState<string | undefined>(undefined);

  const openDeposit = useCallback(
    (depositId: string) => {
      setFocusedId(depositId);
      setSearch({ selected: depositId });
    },
    [setSearch],
  );

  const closePanel = useCallback(() => {
    setSearch({ selected: undefined });
  }, [setSearch]);

  const selected = search.selected;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;

      // Never steal a keystroke somebody is typing into a filter, a note or an amount.
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
          return;
        }
      }

      if (event.key === 'Escape') {
        if (selected !== undefined) closePanel();
        return;
      }

      // While the panel is open it owns the keyboard; moving the queue behind it is disorienting.
      if (selected !== undefined) return;

      if (event.key === 'j' || event.key === 'k') {
        event.preventDefault();
        const index = rows.findIndex((row) => row.id === focusedId);
        const wanted = event.key === 'j' ? index + 1 : index - 1;
        const row = rows[Math.max(0, Math.min(wanted, rows.length - 1))];
        if (row !== undefined) setFocusedId(row.id);
        return;
      }

      if (event.key === 'Enter' && focusedId !== undefined) {
        event.preventDefault();
        openDeposit(focusedId);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [rows, focusedId, selected, closePanel, openDeposit]);

  useEffect(() => {
    if (focusedId === undefined) return;
    document.getElementById(`deposit-row-${focusedId}`)?.scrollIntoView({ block: 'nearest' });
  }, [focusedId]);

  return (
    <div className="space-y-5">
      <PageHeader
        // The screen and the nav item are the same word in both languages; one string, one place.
        title={t('nav.deposits')}
        description={t('deposits.description')}
        actions={
          <>
            <QueueFreshness updatedAt={queue.dataUpdatedAt} isFetching={queue.isFetching} />
            <Can capability="deposits.sweep">
              <SweepAction />
            </Can>
          </>
        }
      />

      <DepositFilters />

      <Card className="overflow-hidden">
        <DepositTable
          rows={rows}
          isLoading={queue.isLoading}
          error={queue.error}
          onRetry={() => {
            void queue.refetch();
          }}
          selectedId={selected}
          focusedId={focusedId}
          onOpen={openDeposit}
          currentAdminId={admin?.id ?? null}
          hasMore={queue.hasNextPage}
          isLoadingMore={queue.isFetchingNextPage}
          onLoadMore={() => {
            void queue.fetchNextPage();
          }}
          emptyAction={
            hasActiveFilters(search) ? (
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                {t('deposits.queue.showAll')}
              </Button>
            ) : undefined
          }
        />
      </Card>

      <ShortcutLegend />

      <DepositReviewSheet depositId={selected} onClose={closePanel} />
    </div>
  );
}

/**
 * How stale the queue is, in words.
 *
 * The list refetches on its own, so without this a reviewer has no way to tell a quiet morning from
 * a broken connection. It ticks once a second rather than on refetch, because "updated 4 minutes
 * ago" is the reading that matters and it only becomes true by the clock moving.
 */
function QueueFreshness({ updatedAt, isFetching }: { updatedAt: number; isFetching: boolean }) {
  const t = useT(depositMessages);
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
          isFetching ? 'animate-pulse bg-[var(--info)]' : 'bg-[var(--success)]',
        )}
      />
      {isFetching
        ? t('deposits.queue.refreshing')
        : updatedAt === 0
          ? t('deposits.queue.notLoaded')
          : t('deposits.queue.updated', { time: formatters.relative(new Date(updatedAt)) })}
    </span>
  );
}

function SweepAction() {
  const t = useT(depositMessages);
  const [open, setOpen] = useState(false);
  const sweep = useSweepDeposits();

  const run = () => {
    void (async () => {
      try {
        const report = await sweep.mutateAsync(undefined);
        toast.success(t('deposits.sweep.doneTitle'), {
          description: t('deposits.sweep.doneBody', {
            expired: report.expired,
            released: report.released,
            reaped: report.reaped,
          }),
        });
        setOpen(false);
      } catch (error) {
        toast.error(t('deposits.sweep.failedTitle'), { description: errorMessage(error) });
      }
    })();
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Brush className="size-3.5" />
        {t('deposits.sweep.action')}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t('deposits.sweep.confirmTitle')}
        description={t('deposits.sweep.confirmBody')}
        confirmLabel={t('deposits.sweep.confirmLabel')}
        loading={sweep.isPending}
        onConfirm={run}
      />
    </>
  );
}

function ShortcutLegend() {
  const t = useT(depositMessages);

  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted-foreground)]">
      {/* The key caps stay Latin in both languages: they are what is printed on the keyboard. */}
      <span>
        <Key>j</Key> <Key>k</Key> {t('deposits.shortcuts.move')}
      </span>
      <span>
        <Key>Enter</Key> {t('deposits.shortcuts.open')}
      </span>
      <span>
        <Key>Esc</Key> {t('deposits.shortcuts.close')}
      </span>
      <span>{t('deposits.shortcuts.noMoney')}</span>
    </p>
  );
}

function Key({ children }: { children: string }) {
  return (
    <kbd className="rounded border border-[var(--border-strong)] bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono text-[0.7rem]">
      {children}
    </kbd>
  );
}
