import { MinorAmount } from '@/components/common/money-amount';
import { TenantStatusBadge } from '@/components/common/status-badge';
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
import { formatCount } from '@/lib/format';
import { useT } from '@/lib/i18n/use-translation';
import { cn } from '@/lib/utils';
import type { Tenant } from '@/types';

import { tenantMessages } from './messages';

/**
 * The tenant table.
 *
 * `counts` is optional on the wire, and a missing pair is not a zero: the backend omits the object
 * when it has not counted, so rendering 0 would tell a platform admin this operator has no players
 * at all. Two different claims, so two different cells.
 *
 * Numeric columns are `text-end`, not `text-right`: they sit against the reading edge in English
 * and against the other one in Arabic, which is where a column of amounts has to line up for
 * anybody comparing two of them.
 */
export function TenantList({
  tenants,
  selectedId,
  onSelect,
}: {
  tenants: readonly Tenant[];
  selectedId: string | null;
  onSelect: (tenantId: string) => void;
}) {
  const t = useT(tenantMessages);

  return (
    <Table>
      {/* The caption counts what is on screen, which is not the whole platform once a status
          filter is on. */}
      <TableCaption>{t('tenants.list.caption', { count: tenants.length })}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{t('tenants.field.tenant')}</TableHead>
          <TableHead>{t('field.status')}</TableHead>
          <TableHead>{t('tenants.field.bot')}</TableHead>
          <TableHead className="text-end">{t('tenants.field.players')}</TableHead>
          <TableHead className="text-end">{t('tenants.field.deposits')}</TableHead>
          <TableHead>{t('field.currency')}</TableHead>
          <TableHead className="text-end">{t('tenants.field.depositExpiry')}</TableHead>
          <TableHead className="text-end">{t('tenants.field.dualApproval')}</TableHead>
          <TableHead className="text-end">{t('tenants.field.floatLowWater')}</TableHead>
          <TableHead>{t('field.created')}</TableHead>
          <TableHead>{t('field.updated')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tenants.map((tenant) => {
          const selected = tenant.id === selectedId;
          return (
            <TableRow key={tenant.id} className={cn(selected && 'bg-[var(--primary-muted)]')}>
              <TableCell>
                <button
                  type="button"
                  aria-current={selected}
                  onClick={() => {
                    onSelect(tenant.id);
                  }}
                  className="rounded-sm text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                >
                  <span className="font-medium">{tenant.displayName}</span>
                  <span className="block font-mono text-xs text-[var(--muted-foreground)]">
                    {tenant.slug}
                  </span>
                </button>
              </TableCell>
              <TableCell>
                <TenantStatusBadge status={tenant.status} />
              </TableCell>
              <TableCell>
                {tenant.botUsername === null ? (
                  <span className="text-[var(--muted-foreground)]">{t('tenants.noBotYet')}</span>
                ) : (
                  <span className="font-mono text-xs">@{tenant.botUsername}</span>
                )}
              </TableCell>
              <TableCell className="text-end">
                <CountCell value={tenant.counts?.players} />
              </TableCell>
              <TableCell className="text-end">
                <CountCell value={tenant.counts?.deposits} />
              </TableCell>
              <TableCell className="font-mono text-xs">{tenant.currencyCode}</TableCell>
              <TableCell className="tabular text-end whitespace-nowrap">
                {t('tenants.minutesShort', { count: tenant.depositExpiryMinutes })}
              </TableCell>
              <TableCell className="text-end">
                <MinorAmount
                  minor={tenant.dualApprovalThresholdMinor}
                  currency={tenant.currencyCode}
                />
              </TableCell>
              <TableCell className="text-end">
                <MinorAmount
                  minor={tenant.agentFloatLowWatermarkMinor}
                  currency={tenant.currencyCode}
                />
              </TableCell>
              <TableCell>
                <TimeAgo value={tenant.createdAt} className="text-[var(--muted-foreground)]" />
              </TableCell>
              <TableCell>
                <TimeAgo value={tenant.updatedAt} className="text-[var(--muted-foreground)]" />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function CountCell({ value }: { value: number | undefined }) {
  const t = useT(tenantMessages);
  if (value === undefined) {
    return (
      <span className="text-xs text-[var(--muted-foreground)]">{t('tenants.notCounted')}</span>
    );
  }
  return <span className="tabular">{formatCount(value)}</span>;
}
