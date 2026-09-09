import { EmptyState } from '@/components/common/states';
import { useT } from '@/lib/i18n/use-translation';
import type { ShamCashBalance } from '@/types';
import type { ShamCashDevTransaction } from '@/types/shamcash-dev';

import { shamCashDevMessages } from './messages';

/**
 * What the parser made of a page — shared by both halves of the bench, because both answer with the
 * same two lists and the whole point is being able to compare them.
 *
 * ── EVERY FIGURE IS RENDERED VERBATIM ─────────────────────────────────────────────────────────
 * No `MoneyAmount`, no grouping, no reformatting of the date. These are not this system's money —
 * they are strings read off somebody else's page, and the question being asked is "did we read this
 * correctly". Regrouping `250,000` or rewriting `2026-08-26 - 16:10:31` into the console's own
 * format would hide exactly the difference somebody is here to see.
 *
 * `dir="ltr"` on each cell for the same reason it is on `MoneyAmount`: a Latin numeric run inside an
 * Arabic page has its leading sign moved to the visual end by the bidi algorithm.
 */
export function ParsedBalances({ balances }: { balances: readonly ShamCashBalance[] }) {
  const t = useT(shamCashDevMessages);

  if (balances.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="px-4 py-2 text-start text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
          {t('shamDev.balances')}
        </caption>
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th scope="col" className="px-4 py-2 text-start font-medium">
              {t('shamDev.currency')}
            </th>
            <th scope="col" className="px-4 py-2 text-end font-medium">
              {t('shamDev.available')}
            </th>
            <th scope="col" className="px-4 py-2 text-end font-medium">
              {t('shamDev.locked')}
            </th>
          </tr>
        </thead>
        <tbody>
          {balances.map((row) => (
            <tr key={row.currency} className="border-b border-[var(--border)] last:border-0">
              <th scope="row" className="px-4 py-2 text-start font-normal">
                {row.currency}
              </th>
              <td dir="ltr" className="tabular px-4 py-2 text-end">
                {row.available}
              </td>
              <td dir="ltr" className="tabular px-4 py-2 text-end text-[var(--muted-foreground)]">
                {row.locked}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ParsedTransactions({
  transactions,
}: {
  transactions: readonly ShamCashDevTransaction[];
}) {
  const t = useT(shamCashDevMessages);

  if (transactions.length === 0) {
    return <EmptyState title={t('shamDev.noTransactions')} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="px-4 py-2 text-start text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
          {t('shamDev.transactions')}
        </caption>
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th scope="col" className="px-4 py-2 text-start font-medium">
              {t('shamDev.txId')}
            </th>
            <th scope="col" className="px-4 py-2 text-start font-medium">
              {t('shamDev.txDate')}
            </th>
            <th scope="col" className="px-4 py-2 text-end font-medium">
              {t('shamDev.txAmount')}
            </th>
            <th scope="col" className="px-4 py-2 text-start font-medium">
              {t('shamDev.txWho')}
            </th>
            <th scope="col" className="px-4 py-2 text-start font-medium">
              {t('shamDev.txCard')}
            </th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((row) => (
            <tr key={row.transactionId} className="border-b border-[var(--border)] last:border-0">
              <th scope="row" dir="ltr" className="px-4 py-2 text-start font-mono font-normal">
                {row.transactionId}
              </th>
              <td dir="ltr" className="tabular px-4 py-2 text-start whitespace-nowrap">
                {row.date}
              </td>
              <td
                dir="ltr"
                className={`tabular px-4 py-2 text-end ${
                  row.direction === 'in' ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                }`}
              >
                {/* The sign is reconstructed from `direction`, which is how the parser recorded it —
                    the amount itself is stored as a magnitude. */}
                {row.direction === 'in' ? '+' : '−'}
                {row.amount} {row.currency}
              </td>
              <td className="px-4 py-2 text-start">{row.username}</td>
              <td dir="ltr" className="px-4 py-2 text-start font-mono text-xs">
                {row.maskedCard}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
