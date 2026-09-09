import { MoneyAmount } from '@/components/common';
import { EmptyState } from '@/components/common/states';
import { useT } from '@/lib/i18n/use-translation';
import type { TenantStats } from '@/types';

import { statsMessages } from './messages';

/**
 * Every operator's figures on one row each. PLATFORM_ADMIN only — the endpoint behind it answers
 * 403 to anybody else, and the page mounts this behind the same capability.
 *
 * ── THE COLUMNS ARE THE FOUR THAT COMPARE ─────────────────────────────────────────────────────
 * Opened, credited, fees kept, and what is stuck. Every other figure on this screen is worth
 * reading for ONE operator and worth nothing across a row of them — "players in total" tells you
 * how big an operator is, not how it is doing this month — so they stay on the per-operator tiles
 * and this table stays narrow enough to read without scrolling.
 *
 * Stuck money is here and not on the "nice to have" side of that line deliberately: it is the one
 * column where a big number means somebody has to be told today, and the platform view is the only
 * place a PLATFORM_ADMIN would see it for an operator they are not currently signed into.
 */
export function TenantStatsTable({ rows }: { rows: readonly TenantStats[] }) {
  const t = useT(statsMessages);

  if (rows.length === 0) {
    return (
      <EmptyState
        title={t('stats.tenants.emptyTitle')}
        description={t('stats.tenants.emptyBody')}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th scope="col" className="px-4 py-2 text-start font-medium">
              {t('stats.tenants.operator')}
            </th>
            <th scope="col" className="px-4 py-2 text-end font-medium">
              {t('stats.deposits.opened')}
            </th>
            <th scope="col" className="px-4 py-2 text-end font-medium">
              {t('stats.deposits.credited')}
            </th>
            <th scope="col" className="px-4 py-2 text-end font-medium">
              {t('stats.profit.total')}
            </th>
            <th scope="col" className="px-4 py-2 text-end font-medium">
              {t('stats.deposits.attention')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.tenantId} className="border-b border-[var(--border)] last:border-0">
              <th scope="row" className="px-4 py-2 text-start font-normal">
                <span className="block">{row.displayName}</span>
                {/* The slug, because two operators may be named alike and the slug never is. */}
                <span dir="ltr" className="block font-mono text-xs text-[var(--muted-foreground)]">
                  {row.slug}
                </span>
              </th>
              <td className="px-4 py-2 text-end">
                <MoneyAmount money={row.deposits.opened.total} />
                <span className="tabular block text-xs text-[var(--muted-foreground)]">
                  {row.deposits.opened.count}
                </span>
              </td>
              <td className="px-4 py-2 text-end">
                <MoneyAmount money={row.deposits.credited.total} emphasis />
                <span className="tabular block text-xs text-[var(--muted-foreground)]">
                  {row.deposits.credited.count}
                </span>
              </td>
              <td className="px-4 py-2 text-end">
                <MoneyAmount money={row.profit.total} />
              </td>
              <td className="px-4 py-2 text-end">
                {/* Coloured only when it is not zero: a red 0 on every row trains people to ignore
                    the column that matters most when it is finally not zero. */}
                <span
                  className={
                    row.deposits.attention.count > 0 ? 'font-semibold text-[var(--danger)]' : ''
                  }
                >
                  <MoneyAmount money={row.deposits.attention.total} />
                  <span className="tabular block text-xs text-[var(--muted-foreground)]">
                    {row.deposits.attention.count}
                  </span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
