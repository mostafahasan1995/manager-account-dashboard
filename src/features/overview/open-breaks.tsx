import { Link } from '@tanstack/react-router';
import { ArrowRight, Scale } from 'lucide-react';

import {
  BreakStatusBadge,
  EmptyState,
  ErrorState,
  MinorAmount,
  SeverityBadge,
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { flattenPages, useBreaks } from '@/lib/api/queries';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';

import { overviewMessages } from './messages';
import { OPEN_BREAKS_QUERY, PANEL_ROWS, bySeverityThenAge } from './overview-data';

/**
 * The work on this screen that is not a deposit.
 *
 * The break list endpoint takes no sort — it answers newest first — so the worst-first order a
 * person would actually work in is applied here, over the page that was loaded. That is honest for
 * a panel showing five rows out of twenty; the reconciliation screen is where the whole list lives.
 */
export function OpenBreaks() {
  const t = useT(overviewMessages);
  const enumLabel = useEnumLabel();
  const { data, isLoading, error, refetch } = useBreaks(OPEN_BREAKS_QUERY);
  const rows = [...flattenPages(data?.pages)].sort(bySeverityThenAge).slice(0, PANEL_ROWS);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Scale className="size-4 text-[var(--muted-foreground)]" />
            {t('overview.breaks.title')}
          </CardTitle>
          <CardDescription>{t('overview.breaks.description')}</CardDescription>
        </div>
        <Link
          to="/reconciliation"
          search={{ tab: 'breaks' }}
          className="inline-flex shrink-0 items-center gap-1 rounded text-sm font-medium text-[var(--primary)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        >
          {t('overview.breaks.all')}
          <ArrowRight className="size-3.5 rtl:rotate-180" />
        </Link>
      </CardHeader>

      {isLoading ? <TableSkeleton rows={5} columns={4} /> : null}

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
          title={t('overview.breaks.emptyTitle')}
          description={t('overview.breaks.emptyBody')}
        />
      ) : null}

      {!isLoading && error === null && rows.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('overview.breaks.columnBreak')}</TableHead>
              <TableHead>{t('overview.breaks.columnSeverity')}</TableHead>
              <TableHead className="text-end">{t('overview.breaks.columnDifference')}</TableHead>
              <TableHead>{t('field.status')}</TableHead>
              <TableHead className="text-end">{t('overview.breaks.columnDetected')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link
                    to="/reconciliation"
                    search={{ tab: 'breaks', selected: row.id }}
                    className="rounded text-sm font-medium text-[var(--primary)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                  >
                    {/* `category` is `string` on the wire, so one the backend adds tomorrow renders
                        as itself rather than vanishing. */}
                    {enumLabel('breakCategory', row.category)}
                  </Link>
                </TableCell>
                <TableCell>
                  <SeverityBadge severity={row.severity} />
                </TableCell>
                <TableCell className="text-end">
                  <MinorAmount minor={row.delta?.minor} currency={row.currencyCode} signed />
                </TableCell>
                <TableCell>
                  <BreakStatusBadge status={row.status} />
                </TableCell>
                <TableCell className="text-end">
                  <TimeAgo value={row.detectedAt} className="text-sm" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </Card>
  );
}
