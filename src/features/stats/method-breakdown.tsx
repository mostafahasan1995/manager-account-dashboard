import { MoneyAmount } from '@/components/common';
import { EmptyState } from '@/components/common/states';
import { useT } from '@/lib/i18n/use-translation';
import type { TenantStats } from '@/types';

import { statsMessages } from './messages';

/**
 * Credited money, split by the rail it arrived on.
 *
 * ── WHY THE RAIL AND NOTHING ELSE ─────────────────────────────────────────────────────────────
 * "Which rail brought the money in" is the breakdown that changes what an operator DOES: it decides
 * which wallet to top up and which rail to put in front of players. By player or by reviewer would
 * answer curiosity instead, and both are already reachable from the deposit queue's own filters.
 *
 * The server sorts biggest-first and this renders that order verbatim. Re-sorting here would mean
 * two orderings of one list depending on which screen you opened.
 */
export function MethodBreakdown({ stats }: { stats: TenantStats }) {
  const t = useT(statsMessages);

  if (stats.byMethod.length === 0) {
    return (
      <EmptyState
        title={t('stats.byMethod.emptyTitle')}
        description={t('stats.byMethod.emptyBody')}
      />
    );
  }

  return (
    // Wide content scrolls inside its own box; the page body must never scroll sideways.
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-start">
            <th scope="col" className="px-4 py-2 text-start font-medium">
              {t('stats.byMethod.rail')}
            </th>
            <th scope="col" className="px-4 py-2 text-end font-medium">
              {t('stats.byMethod.count')}
            </th>
            <th scope="col" className="px-4 py-2 text-end font-medium">
              {t('stats.byMethod.total')}
            </th>
            <th scope="col" className="px-4 py-2 text-end font-medium">
              {t('stats.byMethod.fees')}
            </th>
          </tr>
        </thead>
        <tbody>
          {stats.byMethod.map((row) => (
            <tr key={row.paymentMethodId} className="border-b border-[var(--border)] last:border-0">
              <th scope="row" className="px-4 py-2 text-start font-normal">
                {row.displayName}
              </th>
              <td className="tabular px-4 py-2 text-end">{row.count}</td>
              <td className="px-4 py-2 text-end">
                <MoneyAmount money={row.total} emphasis />
              </td>
              <td className="px-4 py-2 text-end text-[var(--muted-foreground)]">
                <MoneyAmount money={row.fees} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
