import { AlertTriangle, Landmark } from 'lucide-react';

import { MinorAmount } from '@/components/common/money-amount';
import { DetailList, DetailRow } from '@/components/common/page-header';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/common/states';
import { TimeAgo } from '@/components/common/time';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCount } from '@/lib/format';
import { useRailAgeing } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import type { RailAgeingRow } from '@/types';

import { reconMessages } from './messages';

/**
 * How long money has been sitting in each rail clearing account.
 *
 * A clearing account is a waiting room: money enters when a deposit is credited and leaves when the
 * bank statement proves it arrived. Anything still there after thirty days never got that proof, so
 * the balance is a claim nobody has checked — which is why the stale accounts are called out rather
 * than left as one more row in a table.
 */
export function RailAgeingTab() {
  const ageing = useRailAgeing();
  const t = useT(reconMessages);

  if (ageing.isPending) {
    return (
      <div className="space-y-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (ageing.isError) {
    return (
      <Card>
        <ErrorState
          error={ageing.error}
          onRetry={() => {
            void ageing.refetch();
          }}
        />
      </Card>
    );
  }

  const report = ageing.data;
  const stale = new Set(report.staleAccountCodes);

  if (report.rows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Landmark className="size-5" />}
          title={t('recon.ageing.emptyTitle')}
          description={t('recon.ageing.emptyBody')}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted-foreground)]">
        <TimeAgo value={report.generatedAt} prefix={t('recon.ageing.generated')} />.
      </p>

      {report.staleAccountCodes.length > 0 ? (
        <Alert tone="danger" title={t('recon.ageing.staleTitle')}>
          {t('recon.ageing.staleBody', { accounts: report.staleAccountCodes.join(', ') })}
        </Alert>
      ) : null}

      {report.rows.map((row) => (
        <AccountCard key={row.accountId} row={row} stale={stale.has(row.accountCode)} />
      ))}
    </div>
  );
}

function AccountCard({ row, stale }: { row: RailAgeingRow; stale: boolean }) {
  const t = useT(reconMessages);

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="font-mono text-sm">{row.accountCode}</CardTitle>
        {stale ? (
          <Badge tone="danger">
            <AlertTriangle className="size-3" />
            {t('recon.ageing.staleBadge')}
          </Badge>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4">
        <DetailList>
          <DetailRow label={t('field.currency')}>{row.currencyCode}</DetailRow>
          <DetailRow label={t('recon.ageing.balance')}>
            <MinorAmount minor={row.balanceMinor} currency={row.currencyCode} />
          </DetailRow>
          <DetailRow label={t('recon.ageing.oldest')}>
            <TimeAgo value={row.oldestUnsettledAt} />
          </DetailRow>
        </DetailList>

        <Table>
          <TableCaption className="sr-only">
            {t('recon.ageing.caption', { account: row.accountCode })}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{t('recon.ageing.age')}</TableHead>
              <TableHead className="text-end">{t('recon.ageing.net')}</TableHead>
              <TableHead className="text-end">{t('recon.ageing.entries')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {row.buckets.map((bucket) => (
              <TableRow key={bucket.label}>
                {/* The bucket label is the backend's own `0-1d` / `30d+`: a unit, read the same in
                    both languages, so it stays as sent and stays left-to-right. */}
                <TableCell dir="ltr" className="text-start whitespace-nowrap">
                  {bucket.label}
                </TableCell>
                <TableCell className="text-end">
                  <MinorAmount minor={bucket.netMinor} currency={row.currencyCode} signed />
                </TableCell>
                <TableCell className="tabular text-end">{formatCount(bucket.entryCount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
