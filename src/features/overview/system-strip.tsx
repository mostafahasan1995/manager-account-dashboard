import { Link } from '@tanstack/react-router';
import { Activity, ArrowRight } from 'lucide-react';

import { CardSkeleton, EmptyState, ErrorState, TimeAgo } from '@/components/common';
import { Badge, Card } from '@/components/ui';
import { useRailAgeing } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';

import { overviewMessages } from './messages';

/**
 * One line about the money that is not moving.
 *
 * Rail ageing is a wide report; the only part of it worth a cashier's attention at the start of a
 * shift is `staleAccountCodes` — the accounts still holding funds past the last ageing bucket. That
 * is a rail that has quietly stopped settling, which nothing else on this screen would ever show.
 * The balances themselves belong on the reconciliation screen, one link away.
 *
 * The sentence carries its own count, which is why it is a plural key rather than a template: two
 * stale accounts is a dual in Arabic, and a console that reads «حسابان» where it means two is the
 * difference between a translated screen and a screen written in the language.
 */
export function SystemStrip() {
  const t = useT(overviewMessages);
  const { data, isLoading, error, refetch } = useRailAgeing();

  if (isLoading) {
    return <CardSkeleton />;
  }

  if (error !== null) {
    return (
      <Card>
        <ErrorState
          error={error}
          onRetry={() => {
            void refetch();
          }}
          className="py-8"
        />
      </Card>
    );
  }

  const rows = data?.rows ?? [];
  const stale = data?.staleAccountCodes ?? [];

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          title={t('overview.system.emptyTitle')}
          description={t('overview.system.emptyBody')}
          className="py-8"
        />
      </Card>
    );
  }

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Activity className="size-4 text-[var(--muted-foreground)]" />
          {t('overview.system.title')}
        </span>

        {stale.length > 0 ? (
          <Badge tone="danger">{t('overview.system.staleBadge')}</Badge>
        ) : (
          <Badge tone="success">{t('overview.system.settlingBadge')}</Badge>
        )}

        <p className="text-sm text-[var(--muted-foreground)]">
          {stale.length > 0
            ? t('overview.system.staleAccounts', { count: stale.length, total: rows.length })
            : t('overview.system.noStaleAccounts', { count: rows.length })}
        </p>

        {stale.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {stale.map((code) => (
              <li key={code}>
                {/* Account codes are identifiers: left in English, and left LTR inside an Arabic
                    line so `RAIL_CLEARING:BANK_SYR` cannot be read back in the wrong order. */}
                <Badge tone="danger" className="font-mono" dir="ltr">
                  {code}
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <TimeAgo
          value={data?.generatedAt}
          prefix={t('overview.system.checked')}
          className="text-xs text-[var(--muted-foreground)]"
        />
        <Link
          to="/reconciliation"
          search={{ tab: 'ageing' }}
          className="inline-flex shrink-0 items-center gap-1 rounded text-sm font-medium text-[var(--primary)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        >
          {t('overview.system.railAgeing')}
          <ArrowRight className="size-3.5 rtl:rotate-180" />
        </Link>
      </div>
    </Card>
  );
}
