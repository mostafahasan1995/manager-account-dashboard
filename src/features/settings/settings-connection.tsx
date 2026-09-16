import { RefreshCw } from 'lucide-react';

import { CopyableValue } from '@/components/common/copy-button';
import { DetailList, DetailRow } from '@/components/common/page-header';
import { CardSkeleton, ErrorState } from '@/components/common/states';
import { TimeAgo } from '@/components/common/time';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { config } from '@/config';
import { networkError } from '@/lib/api/errors';
import { useHealth } from '@/lib/api/queries';
import { toDate } from '@/lib/format';
import { useT, type Translator } from '@/lib/i18n/use-translation';
import { humanizeEnum } from '@/lib/utils';
import type { Liveness, Readiness } from '@/types/health';
import type { Tone } from '@/types/enums';

import { settingsMessages } from './messages';

/**
 * Where this console is pointed, and whether anything is there.
 *
 * The three config lines are here because "the queue is empty" and "the queue could not be loaded"
 * look identical from a screen, and the first thing anyone asks at 2am is which backend they are
 * even talking to. The unreachable case names the two things that are actually ever wrong — the
 * backend is down, or this origin is not in its CORS allow-list — rather than a generic failure.
 */

/**
 * Terminus reports the same indicator in more than one bucket. `details` is the authoritative
 * union of up and down, but info/error are folded in first so a backend that answers with only one
 * of them still renders every check it ran.
 */
function readinessIndicators(ready: Readiness | null): [string, { status: string }][] {
  if (ready === null) return [];
  return Object.entries({
    ...(ready.info ?? {}),
    ...(ready.error ?? {}),
    ...(ready.details ?? {}),
  });
}

/**
 * When the process came up, counted back from the moment the backend answered rather than from the
 * browser's clock: the two disagree by the round trip and by however far the two clocks have
 * drifted, and the backend's own timestamp is the one its uptime is measured against.
 */
function startedAt(live: Liveness): string | null {
  const answeredAt = toDate(live.timestamp);
  if (answeredAt === null) return null;
  return new Date(answeredAt.getTime() - live.uptimeSeconds * 1000).toISOString();
}

type SettingsTranslator = Translator<(typeof settingsMessages)['en']>;

/**
 * The health words the backend sends. Only the ones Terminus actually reports are translated; a
 * status it grows tomorrow still renders as itself rather than as a missing-key stub.
 */
function livenessLabel(t: SettingsTranslator, status: string): string {
  if (status === 'ok') return t('settings.connection.liveOk');
  if (status === 'degraded') return t('settings.connection.liveDegraded');
  return humanizeEnum(status);
}

function indicatorLabel(t: SettingsTranslator, status: string): string {
  if (status === 'up') return t('settings.connection.indicatorUp');
  if (status === 'down') return t('settings.connection.indicatorDown');
  return humanizeEnum(status);
}

export function SettingsConnection() {
  const health = useHealth();
  const t = useT(settingsMessages);
  const snapshot = health.data;

  const refresh = () => {
    void health.refetch();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.connection.title')}</CardTitle>
        <CardDescription>{t('settings.connection.description')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <DetailList>
          <DetailRow label={t('settings.connection.baseUrl')}>
            <CopyableValue value={config.apiBaseUrl} />
          </DetailRow>

          <DetailRow label={t('settings.connection.mockApi')}>
            <span className="flex flex-col items-end gap-1">
              <Badge tone={config.enableMocks ? 'warning' : 'muted'}>
                {config.enableMocks ? t('settings.connection.on') : t('settings.connection.off')}
              </Badge>
              <span className="text-xs text-[var(--muted-foreground)]">
                {config.enableMocks
                  ? t('settings.connection.mockOnHint')
                  : t('settings.connection.mockOffHint')}
              </span>
            </span>
          </DetailRow>

          <DetailRow label={t('settings.connection.tenantHeader')}>
            <span className="flex flex-col items-end gap-1">
              <Badge tone={config.tenantHeaderEnabled ? 'info' : 'muted'}>
                {config.tenantHeaderEnabled
                  ? t('settings.connection.sent')
                  : t('settings.connection.notSent')}
              </Badge>
              <span className="text-xs text-[var(--muted-foreground)]">
                {config.tenantHeaderEnabled
                  ? t('settings.connection.tenantHeaderOnHint')
                  : t('settings.connection.tenantHeaderOffHint')}
              </span>
            </span>
          </DetailRow>
        </DetailList>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">{t('settings.connection.health')}</h4>
            <Button variant="ghost" size="sm" onClick={refresh} loading={health.isFetching}>
              <RefreshCw className="size-3.5" />
              {t('common.refresh')}
            </Button>
          </div>

          {health.isPending ? (
            <CardSkeleton />
          ) : !snapshot?.reachable ? (
            <div className="space-y-2">
              <ErrorState
                error={networkError(config.apiBaseUrl)}
                onRetry={refresh}
                className="py-8"
              />
              <p className="text-center text-xs text-[var(--muted-foreground)]">
                {t('settings.connection.servedFrom')}{' '}
                <code className="font-mono">{window.location.origin}</code>
                {t('settings.connection.corsHint')}
              </p>
            </div>
          ) : (
            <HealthPanel live={snapshot.live} ready={snapshot.ready} />
          )}
        </section>
      </CardContent>
    </Card>
  );
}

function HealthPanel({ live, ready }: { live: Liveness | null; ready: Readiness | null }) {
  const t = useT(settingsMessages);
  const indicators = readinessIndicators(ready);
  const readyOk = ready?.status === 'ok';

  return (
    <div className="space-y-4">
      <DetailList>
        <DetailRow label={t('settings.connection.liveness')}>
          {live === null ? (
            <Badge tone="warning">{t('settings.connection.noAnswer')}</Badge>
          ) : (
            <Badge tone={live.status === 'ok' ? 'success' : 'warning'}>
              {livenessLabel(t, live.status)}
            </Badge>
          )}
        </DetailRow>

        {live === null ? null : (
          <>
            <DetailRow label={t('settings.connection.processRole')}>
              {/* The process role is a backend identifier — `api`, `worker` — not the admin
                  role the enum labels cover, so it is shown as sent. */}
              <span className="font-mono text-xs">{live.role}</span>
            </DetailRow>
            <DetailRow label={t('settings.connection.runningSince')}>
              <TimeAgo value={startedAt(live)} />
            </DetailRow>
          </>
        )}

        <DetailRow label={t('settings.connection.readiness')}>
          {ready === null ? (
            <Badge tone="warning">{t('settings.connection.noAnswer')}</Badge>
          ) : (
            <Badge tone={readyOk ? 'success' : 'danger'}>
              {readyOk ? t('settings.connection.ready') : t('settings.connection.notReady')}
            </Badge>
          )}
        </DetailRow>
      </DetailList>

      {indicators.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          {t('settings.connection.noIndicators')}
        </p>
      ) : (
        <Table>
          <TableCaption className="sr-only">
            {t('settings.connection.indicatorsCaption')}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{t('settings.connection.check')}</TableHead>
              <TableHead>{t('field.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {indicators.map(([name, indicator]) => {
              const up = indicator.status === 'up';
              const tone: Tone = up ? 'success' : 'danger';
              return (
                <TableRow key={name}>
                  {/* The check name is whatever the backend called that dependency — `database`,
                      `redis`. It is the thing you go and restart, so it stays as sent. */}
                  <TableCell className="font-medium">{humanizeEnum(name)}</TableCell>
                  <TableCell>
                    <Badge tone={tone}>{indicatorLabel(t, indicator.status)}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
