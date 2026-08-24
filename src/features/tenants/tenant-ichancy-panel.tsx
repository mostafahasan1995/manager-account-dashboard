import { Pencil, PlugZap } from 'lucide-react';

import { CopyableValue } from '@/components/common/copy-button';
import { MinorAmount } from '@/components/common/money-amount';
import { DetailList, DetailRow } from '@/components/common/page-header';
import { TimeAgo } from '@/components/common/time';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useT } from '@/lib/i18n/use-translation';
import type { Tenant, TenantIchancyHealth } from '@/types';

import { tenantMessages } from './messages';
import type { TenantOperatorActions } from './tenant-actions';

/**
 * The Ichancy side of one operator: the agent it signs in as, whether that sign-in works, and the
 * float the agent is holding.
 *
 * ── SHARING AN AGENT IS NOT AN ERROR ──────────────────────────────────────────────────────────
 * Ichancy issues one token pair per agent account, so operators configured with the same agent
 * share ONE session — signing in for one signs in for all of them. Pointing several operators at
 * one agent is a legitimate way to test, which is exactly why the coupling has to be visible: the
 * failure it produces otherwise is intermittent deposit failures on two operators at once with
 * nothing in either log naming the cause. See docs/TENANT-OPERATIONS.md section 3.
 */
export function TenantIchancyPanel({
  tenant,
  ichancy,
  actions,
}: {
  tenant: Tenant;
  ichancy: TenantIchancyHealth;
  actions: TenantOperatorActions;
}) {
  const t = useT(tenantMessages);
  const shared = ichancy.sharesAgentWith;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('tenants.ichancy.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {ichancy.ok ? (
          <Alert tone="success" title={t('tenants.ichancy.answeredTitle')}>
            {t('tenants.ichancy.answeredBody')}
          </Alert>
        ) : (
          <Alert tone="danger" title={t('tenants.ichancy.refusedTitle')}>
            {ichancy.error ?? t('tenants.ichancy.refusedNoReason')}
          </Alert>
        )}

        {ichancy.belowWatermark ? (
          <Alert tone="danger" title={t('tenants.ichancy.belowTitle')}>
            {t('tenants.ichancy.belowBody')}
          </Alert>
        ) : null}

        {/*
         * The empty case is stated rather than left blank: "no notice" and "nobody has checked"
         * look the same on a screen, and this is the one field an operator goes looking for after
         * two operators start failing deposits at the same time.
         */}
        {shared.length === 0 ? (
          <p className="text-xs text-[var(--muted-foreground)]">{t('tenants.ichancy.notShared')}</p>
        ) : (
          <Alert tone="warning" title={t('tenants.ichancy.sharedTitle', { count: shared.length })}>
            <p>{t('tenants.ichancy.sharedBody')}</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {shared.map((operator) => (
                <li key={operator}>
                  <Badge tone="warning">
                    <span className="font-mono">{operator}</span>
                  </Badge>
                </li>
              ))}
            </ul>
          </Alert>
        )}

        <DetailList>
          <DetailRow label={t('tenants.field.ichancyBaseUrl')}>
            <span className="font-mono text-xs break-all">{ichancy.baseUrl}</span>
          </DetailRow>
          <DetailRow label={t('tenants.field.ichancyUsername')}>
            <span className="font-mono text-xs">{ichancy.username}</span>
          </DetailRow>
          <DetailRow label={t('tenants.field.ichancyAgentId')}>
            <CopyableValue value={ichancy.agentId} />
          </DetailRow>
          <DetailRow label={t('tenants.ichancy.float')}>
            {ichancy.floatMinor === null ? (
              <span className="text-[var(--muted-foreground)]">
                {t('tenants.ichancy.floatUnread')}
              </span>
            ) : (
              <span className="inline-flex flex-wrap items-center justify-end gap-2">
                <MinorAmount minor={ichancy.floatMinor} currency={tenant.currencyCode} />
                <Badge tone={ichancy.belowWatermark ? 'danger' : 'success'}>
                  {ichancy.belowWatermark
                    ? t('tenants.ichancy.belowWatermark')
                    : t('tenants.ichancy.aboveWatermark')}
                </Badge>
              </span>
            )}
          </DetailRow>
          <DetailRow label={t('tenants.ichancy.checkedAt')}>
            <TimeAgo value={ichancy.checkedAt} />
          </DetailRow>
        </DetailList>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={actions.checking}
            onClick={actions.recheck}
          >
            <PlugZap className="size-3.5" />
            {t('tenants.ichancy.test')}
          </Button>
          <Button variant="secondary" size="sm" onClick={actions.editIchancy}>
            <Pencil className="size-3.5" />
            {t('tenants.ichancy.edit')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
