import { RefreshCw } from 'lucide-react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useMemo } from 'react';

import { Can } from '@/components/common';
import { PageHeader } from '@/components/common/page-header';
import { CardSkeleton, ErrorState } from '@/components/common/states';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { statsSearchSchema } from '@/app/search-schemas';
import { usePlatformStats, useTenantStats } from '@/lib/api/queries';
import { useAuth } from '@/lib/auth/use-auth';
import { useFormatters } from '@/lib/i18n/use-format';
import { useT } from '@/lib/i18n/use-translation';
import { cn } from '@/lib/utils';
import { DEPOSIT_STATUSES } from '@/types/enums';
import { STATS_PERIODS, type StatsPeriodKey } from '@/types/stats';

import { MethodBreakdown } from './method-breakdown';
import { statsMessages } from './messages';
import { DepositTiles, LifetimeTile, ProfitTile, WithdrawalAndPlayerTiles } from './stats-tiles';
import { TenantStatsTable } from './tenant-stats-table';

/**
 * The numbers screen — what actually happened, as opposed to what still needs deciding.
 *
 * ── WHY THIS SCREEN EXISTS AT ALL ─────────────────────────────────────────────────────────────
 * The deposit queue defaults to the three statuses that need a human, which on a healthy operator
 * is a handful of rows out of thousands. It is the right default for the screen a reviewer works
 * a shift in and completely wrong for "how did this month go" — the credited deposits, the ones
 * that WORKED, were the rows the console never showed. Everything here is aggregated server-side,
 * so no amount of history makes it slower.
 *
 * ── THE WINDOW IS IN THE URL, AND IN UTC ──────────────────────────────────────────────────────
 * In the URL for the same reason every filter in this console is: a figure quoted in a message is
 * only useful if the link beside it opens the same window. In UTC because the server computes it
 * that way and the Telegram `/report` message quotes the same boundaries — a console that silently
 * re-cut the window to the browser's timezone would disagree with the bot by up to a day at the
 * edges and there would be no way to tell which was right. The header prints the resolved window
 * the SERVER used, never one recomputed here.
 *
 * ── THE PLATFORM TABLE IS THE SAME QUESTION, ONE LEVEL UP ─────────────────────────────────────
 * Mounted only for `platformFinance.read`, so no request goes out that the backend would answer
 * with a 403 — the same arrangement the overview's breaks tile uses.
 */
export function StatsPage() {
  const t = useT(statsMessages);
  const format = useFormatters();
  const navigate = useNavigate();
  const { can } = useAuth();

  // Read loosely and re-validated with the route's own schema, exactly as the deposit queue does:
  // the schema is the contract, and running it costs one parse per navigation.
  const raw = useSearch({ strict: false });
  const search = useMemo(() => statsSearchSchema.parse(raw), [raw]);
  // `undefined` means the server's own default. Naming it here too would be a second place to
  // change it, so the switcher marks 'month' pressed when nothing is set instead.
  const period: StatsPeriodKey = search.period ?? 'month';

  const stats = useTenantStats(period);
  const isPlatform = can('platformFinance.read');
  const platform = usePlatformStats(period, { enabled: isPlatform });

  const refreshing = stats.isFetching || (isPlatform && platform.isFetching);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('stats.title')}
        description={t('stats.description')}
        actions={
          <Button
            variant="secondary"
            loading={refreshing}
            onClick={() => {
              void stats.refetch();
              if (isPlatform) void platform.refetch();
            }}
          >
            <RefreshCw className="size-4" />
            {t('stats.refresh')}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium tracking-wide text-[var(--muted-foreground)] uppercase">
          {t('stats.period.label')}
        </span>
        {STATS_PERIODS.map((key) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={key === period ? 'secondary' : 'ghost'}
            aria-pressed={key === period}
            onClick={() => {
              // 'month' is the server's default, so it is expressed as an ABSENT param rather than
              // as `?period=month`. One canonical URL per window, and a link somebody shares of the
              // default view looks like the default view.
              void navigate({
                to: '/stats',
                search: key === 'month' ? {} : { period: key },
              });
            }}
          >
            {t(`stats.period.${key}` as 'stats.period.day')}
          </Button>
        ))}

        {stats.data === undefined ? null : (
          <span
            dir="ltr"
            className="tabular ms-auto text-xs text-[var(--muted-foreground)]"
            data-testid="stats-window"
          >
            {t('stats.period.window', {
              from: format.dateTime(stats.data.period.from),
              to: format.dateTime(stats.data.period.to),
            })}
          </span>
        )}
      </div>

      {stats.isError ? (
        <Card>
          <ErrorState
            error={stats.error}
            onRetry={() => {
              void stats.refetch();
            }}
          />
        </Card>
      ) : null}

      {stats.data === undefined ? (
        stats.isError ? null : (
          <CardSkeleton />
        )
      ) : (
        // Dimmed while the next window is loading, so the tiles on screen are visibly the previous
        // answer rather than silently passing for the new one.
        <div className={cn('space-y-6', stats.isPlaceholderData && 'opacity-60')}>
          <Card>
            <CardHeader>
              <CardTitle>{t('stats.deposits.title')}</CardTitle>
              <CardDescription>{t('stats.deposits.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DepositTiles stats={stats.data} />
              <div className="grid gap-3 sm:grid-cols-2">
                <LifetimeTile stats={stats.data} />
                <div className="flex items-end">
                  <Button variant="ghost" size="sm" asChild>
                    {/* Every status spelled out: an ABSENT status filter means the reviewable
                        three to the backend, so a bare link here would open a screen showing far
                        fewer deposits than the tile beside it just counted. */}
                    <Link to="/deposits" search={{ status: [...DEPOSIT_STATUSES] }}>
                      {t('stats.deposits.viewAll')}
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('stats.profit.title')}</CardTitle>
              <CardDescription>{t('stats.profit.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <ProfitTile stats={stats.data} />
              </div>

              {/* THE SENTENCE THAT STOPS A ZERO READING AS A BAD MONTH. Nothing charges a fee on a
                  fresh install, so "0 kept" is a setting, and this is what sends somebody to the
                  rails screen instead of to us. */}
              {stats.data.profit.chargingRails === 0 ? (
                <Alert tone="info" title={t('stats.profit.title')}>
                  <span className="flex flex-wrap items-center gap-2">
                    {t('stats.profit.noRails', { active: stats.data.profit.activeRails })}
                    <Can capability="paymentMethods.read">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to="/payment-methods" search={{}}>
                          {t('stats.profit.noRailsAction')}
                        </Link>
                      </Button>
                    </Can>
                  </span>
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('stats.withdrawals.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <WithdrawalAndPlayerTiles stats={stats.data} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('stats.byMethod.title')}</CardTitle>
              <CardDescription>{t('stats.byMethod.description')}</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <MethodBreakdown stats={stats.data} />
            </CardContent>
          </Card>
        </div>
      )}

      <Can capability="platformFinance.read">
        <Card>
          <CardHeader>
            <CardTitle>{t('stats.tenants.title')}</CardTitle>
            <CardDescription>{t('stats.tenants.description')}</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {platform.isError ? (
              <ErrorState
                error={platform.error}
                onRetry={() => {
                  void platform.refetch();
                }}
              />
            ) : platform.data === undefined ? (
              <CardSkeleton />
            ) : (
              <TenantStatsTable rows={platform.data.tenants} />
            )}
          </CardContent>
        </Card>
      </Can>

      <p className="text-xs text-[var(--muted-foreground)]">{t('stats.period.utcNote')}</p>
    </div>
  );
}
