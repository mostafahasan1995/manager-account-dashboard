import { RefreshCw } from 'lucide-react';

import { CopyableValue } from '@/components/common/copy-button';
import { DetailList, DetailRow } from '@/components/common/page-header';
import { CardSkeleton, ErrorState } from '@/components/common/states';
import { TimeAgo } from '@/components/common/time';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEgressStatus } from '@/lib/api/queries';
import { useT, type Translator } from '@/lib/i18n/use-translation';
import { humanizeEnum } from '@/lib/utils';
import type { EgressStatus } from '@/types/egress';
import type { Tone } from '@/types/enums';

import { settingsMessages } from './messages';

/**
 * Where the BACKEND leaves the internet, and whether a VPN is carrying its default route.
 *
 * This is not the same question the Health panel answers, and the difference is the whole reason
 * the card exists: a `CLOUDFLARE_BLOCKED` deposit row means Cloudflare disliked the IP that made the
 * call, and ICHANCY_PROXY_URL applied inside the Nest process does NOT change the host's own IP.
 * The operator's first question at that point is "what IP is actually leaving this box, and is the
 * tunnel I installed in front of it or not" — a proxy summary and a readable public IP answer both.
 *
 * Two readings are deliberately kept apart: a tunnel interface being UP is not the VPN carrying
 * traffic. Only a DEFAULT ROUTE on that interface is, so "Windscribe installed, routing reserved"
 * renders as `Up, not routing` rather than as a green lie.
 */

type SettingsTranslator = Translator<(typeof settingsMessages)['en']>;

function routeLabel(t: SettingsTranslator, route: EgressStatus['proxy']['route']): string {
  switch (route) {
    case 'direct':
      return t('settings.egress.routeDirect');
    case 'undici':
      return t('settings.egress.routeUndici');
    case 'relay':
      return t('settings.egress.routeRelay');
    case 'inline':
      return t('settings.egress.routeInline');
  }
}

function sourceLabel(t: SettingsTranslator, source: EgressStatus['publicIp']['source']): string {
  if (source === 'fresh') return t('settings.egress.sourceFresh');
  if (source === 'cached') return t('settings.egress.sourceCached');
  return t('settings.egress.sourceUnreachable');
}

export function SettingsEgress() {
  const egress = useEgressStatus();
  const t = useT(settingsMessages);
  const snapshot = egress.data;

  const refresh = () => {
    void egress.refetch();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.egress.title')}</CardTitle>
        <CardDescription>{t('settings.egress.description')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={refresh} loading={egress.isFetching}>
            <RefreshCw className="size-3.5" />
            {t('common.refresh')}
          </Button>
        </div>

        {egress.isPending ? (
          <CardSkeleton />
        ) : snapshot === undefined ? (
          <div className="space-y-2">
            <p className="text-sm text-[var(--muted-foreground)]">
              {t('settings.egress.unavailable')}
            </p>
            <ErrorState error={egress.error} onRetry={refresh} className="py-8" />
          </div>
        ) : (
          <EgressPanel snapshot={snapshot} />
        )}
      </CardContent>
    </Card>
  );
}

function EgressPanel({ snapshot }: { snapshot: EgressStatus }) {
  const t = useT(settingsMessages);
  const ip = snapshot.publicIp;
  const vpn = snapshot.vpn;
  const proxy = snapshot.proxy;

  const tunnelUp = vpn.interfaces.length > 0;
  const vpnTone: Tone = vpn.active ? 'success' : tunnelUp ? 'warning' : 'muted';
  const vpnLabel = vpn.active
    ? t('settings.egress.vpnActive')
    : tunnelUp
      ? t('settings.egress.vpnUpNotRouting')
      : t('settings.egress.vpnOff');

  return (
    <DetailList>
      <DetailRow label={t('settings.egress.publicIp')}>
        <span className="flex flex-col items-end gap-1">
          {ip.ip === null ? (
            <Badge tone={ip.source === 'unreachable' ? 'danger' : 'warning'}>
              {t('settings.egress.noIp')}
            </Badge>
          ) : (
            <CopyableValue value={ip.ip} />
          )}
          <span className="text-xs text-[var(--muted-foreground)]">
            {sourceLabel(t, ip.source)}
          </span>
        </span>
      </DetailRow>

      <DetailRow label={t('settings.egress.vpn')}>
        <span className="flex flex-col items-end gap-1">
          <Badge tone={vpnTone}>{vpnLabel}</Badge>
          <span className="text-xs text-[var(--muted-foreground)]">
            {t('settings.egress.vpnInterfaces')}:{' '}
            {tunnelUp
              ? vpn.interfaces.map((iface) => iface.name).join(', ')
              : t('settings.egress.none')}
          </span>
        </span>
      </DetailRow>

      <DetailRow label={t('settings.egress.route')}>{routeLabel(t, proxy.route)}</DetailRow>

      <DetailRow label={t('settings.egress.proxy')}>
        {proxy.configured ? (
          <span className="flex flex-col items-end gap-1">
            {/* Host:port only. The password is never in this payload and is never rendered. */}
            <span className="font-mono text-xs">
              {proxy.scheme === null ? '' : `${proxy.scheme}://`}
              {proxy.hostport}
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">
              {proxy.authenticated
                ? t('settings.egress.proxyAuth')
                : t('settings.egress.proxyNoAuth')}
            </span>
          </span>
        ) : (
          <span className="text-xs text-[var(--muted-foreground)]">
            {t('settings.egress.proxyNone')}
          </span>
        )}
      </DetailRow>

      <DetailRow label={t('settings.egress.transport')}>
        {humanizeEnum(snapshot.transport)}
      </DetailRow>

      <DetailRow label={t('settings.egress.evaluated')}>
        <TimeAgo value={snapshot.evaluatedAt} />
      </DetailRow>
    </DetailList>
  );
}
