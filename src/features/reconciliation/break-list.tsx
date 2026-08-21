import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { ChevronRight, ScanSearch } from 'lucide-react';
import type { ReactNode } from 'react';

import { MinorAmount } from '@/components/common/money-amount';
import { LoadMore } from '@/components/common/pagination';
import { SeverityBadge } from '@/components/common/risk-flags';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/states';
import { BreakStatusBadge } from '@/components/common/status-badge';
import { TimeAgo } from '@/components/common/time';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { flattenPages, useBreaks } from '@/lib/api/queries';
import { useAuth } from '@/lib/auth/use-auth';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import { truncateId } from '@/lib/utils';
import type { ReconciliationBreak } from '@/types';

import { breakListQueryFrom } from './break-display';
import { reconMessages } from './messages';

/**
 * The open breaks, worst first.
 *
 * Every row is a claim that the books and the casino disagree by a specific amount, so all three
 * figures are on the row: what the ledger expected, what was actually there, and the difference
 * between them. Showing only the delta would hide which side moved.
 */
export function BreakList() {
  const search = useSearch({ from: '/reconciliation' });
  const navigate = useNavigate();
  const t = useT(reconMessages);
  const enumLabel = useEnumLabel();
  const breaks = useBreaks(breakListQueryFrom(search));

  const rows = flattenPages(breaks.data?.pages);

  const select = (id: string) => {
    void navigate({ to: '.', search: (prev) => ({ ...prev, selected: id }) });
  };

  if (breaks.isPending) {
    return (
      <Card>
        <TableSkeleton rows={6} columns={7} />
      </Card>
    );
  }

  if (breaks.isError) {
    return (
      <Card>
        <ErrorState
          error={breaks.error}
          onRetry={() => {
            void breaks.refetch();
          }}
        />
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<ScanSearch className="size-5" />}
          title={t('recon.list.emptyTitle')}
          description={t('recon.list.emptyBody')}
        />
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableCaption className="sr-only">{t('recon.list.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{t('recon.field.severity')}</TableHead>
            <TableHead>{t('recon.field.category')}</TableHead>
            <TableHead>{t('field.status')}</TableHead>
            <TableHead className="text-end">{t('recon.field.expected')}</TableHead>
            <TableHead className="text-end">{t('recon.field.actual')}</TableHead>
            <TableHead className="text-end">{t('recon.field.delta')}</TableHead>
            <TableHead>{t('recon.field.pointsAt')}</TableHead>
            <TableHead>{t('recon.field.detected')}</TableHead>
            <TableHead>{t('recon.field.assignee')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              className="cursor-pointer"
              data-state={search.selected === row.id ? 'selected' : undefined}
              onClick={() => {
                select(row.id);
              }}
            >
              <TableCell>
                <SeverityBadge severity={row.severity} />
              </TableCell>
              <TableCell>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-sm text-start font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                  onClick={(event) => {
                    event.stopPropagation();
                    select(row.id);
                  }}
                >
                  {enumLabel('breakCategory', row.category)}
                  {/* Points into the panel it opens, which is the other edge of the screen in Arabic. */}
                  <ChevronRight className="size-3.5 text-[var(--muted-foreground)] rtl:rotate-180" />
                </button>
              </TableCell>
              <TableCell>
                <BreakStatusBadge status={row.status} />
              </TableCell>
              <TableCell className="text-end">
                <MinorAmount minor={row.expected?.minor ?? null} currency={row.currencyCode} signed />
              </TableCell>
              <TableCell className="text-end">
                <MinorAmount minor={row.actual?.minor ?? null} currency={row.currencyCode} signed />
              </TableCell>
              <TableCell className="text-end">
                <MinorAmount
                  minor={row.delta?.minor ?? null}
                  currency={row.currencyCode}
                  signed
                  className="font-semibold"
                />
              </TableCell>
              <TableCell>
                <BreakReferences row={row} />
              </TableCell>
              <TableCell>
                <TimeAgo value={row.detectedAt} />
              </TableCell>
              <TableCell>
                <Assignee adminId={row.assignedToAdminId} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <LoadMore
        hasMore={breaks.hasNextPage}
        loading={breaks.isFetchingNextPage}
        loadedCount={rows.length}
        onLoadMore={() => {
          void breaks.fetchNextPage();
        }}
        noun={t('recon.list.noun')}
      />
    </Card>
  );
}

/**
 * What the break points at, as links wherever the role can actually follow them. A reviewer with no
 * `players.read` gets the id rather than a link into a screen the router would bounce them out of.
 */
function BreakReferences({ row }: { row: ReconciliationBreak }) {
  const { can } = useAuth();
  const t = useT(reconMessages);

  const items: ReactNode[] = [];

  if (row.depositRequestId !== null) {
    const depositId = row.depositRequestId;
    const label = t('recon.ref.deposit', { id: truncateId(depositId) });
    items.push(
      can('deposits.read') ? (
        <Link
          key="deposit"
          to="/deposits"
          search={{ selected: depositId }}
          className="text-[var(--primary)] hover:underline"
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          {label}
        </Link>
      ) : (
        <span key="deposit" className="font-mono">
          {label}
        </span>
      ),
    );
  }

  if (row.playerId !== null) {
    const playerId = row.playerId;
    const label = t('recon.ref.player', { id: truncateId(playerId) });
    items.push(
      can('players.read') ? (
        <Link
          key="player"
          to="/players/$playerId"
          params={{ playerId }}
          className="text-[var(--primary)] hover:underline"
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          {label}
        </Link>
      ) : (
        <span key="player" className="font-mono">
          {label}
        </span>
      ),
    );
  }

  if (row.ledgerAccountId !== null) {
    items.push(
      <span key="ledger" className="font-mono">
        {t('recon.ref.ledger', { id: truncateId(row.ledgerAccountId) })}
      </span>,
    );
  }

  if (row.ichancyCallId !== null) {
    items.push(
      <span key="call" className="font-mono">
        {t('recon.ref.call', { id: truncateId(row.ichancyCallId) })}
      </span>,
    );
  }

  if (items.length === 0) {
    return <span className="text-xs text-[var(--muted-foreground)]">{t('recon.ref.none')}</span>;
  }

  return <span className="flex flex-col gap-0.5 text-xs">{items}</span>;
}

function Assignee({ adminId }: { adminId: string | null }) {
  const { admin } = useAuth();
  const t = useT(reconMessages);

  if (adminId === null) {
    return (
      <span className="text-sm text-[var(--muted-foreground)]">{t('recon.assignee.unassigned')}</span>
    );
  }
  if (admin !== null && admin.id === adminId) {
    return <span className="text-sm font-medium">{t('recon.assignee.you')}</span>;
  }
  return <span className="font-mono text-xs">{truncateId(adminId)}</span>;
}
