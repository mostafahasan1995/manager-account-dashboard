import { Landmark, RefreshCw } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/states';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePlatformFinanceBalances, useRefreshAllTenantFinance } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';

import { FinanceBalancesTable } from './finance-balances-table';
import { financeMessages } from './messages';

/**
 * Operator finances — the platform screen.
 *
 * PLATFORM_ADMIN only; the route guards it on `platformFinance.read` and the backend enforces the
 * same. It reads the CHEAP overview on mount — every operator's agent float, plus whether the USDT
 * and Sham Cash columns have been loaded — and leaves the two expensive columns to a Refresh, one
 * operator at a time, or "Refresh all" which drips through the shared limiter two at a time.
 *
 * The one rule the screen exists to hold is in the table's cell renderers: a read that did not land
 * is rendered as what it is, never as a zero. The page just arranges the states around it.
 */
export function PlatformFinancePage() {
  const balancesQuery = usePlatformFinanceBalances();
  const refreshAll = useRefreshAllTenantFinance();
  const t = useT(financeMessages);

  const rows = balancesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('finance.title')}
        description={t('finance.description')}
        actions={
          rows.length === 0 ? undefined : (
            <Button
              variant="secondary"
              loading={refreshAll.isPending}
              onClick={() => {
                refreshAll.mutate(rows.map((row) => row.tenantId));
              }}
            >
              <RefreshCw className="size-4" />
              {t('finance.refreshAll')}
            </Button>
          )
        }
      />

      <Alert tone="info" title={t('finance.title')}>
        {t('finance.note')}
      </Alert>

      <Card>
        {balancesQuery.isPending ? <TableSkeleton rows={3} columns={4} /> : null}

        {balancesQuery.isError ? (
          <ErrorState
            error={balancesQuery.error}
            onRetry={() => {
              void balancesQuery.refetch();
            }}
          />
        ) : null}

        {balancesQuery.isSuccess && rows.length === 0 ? (
          <EmptyState
            icon={<Landmark className="size-5" />}
            title={t('finance.empty.title')}
            description={t('finance.empty.body')}
          />
        ) : null}

        {balancesQuery.isSuccess && rows.length > 0 ? <FinanceBalancesTable rows={rows} /> : null}
      </Card>
    </div>
  );
}
