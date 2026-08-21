import { Pencil } from 'lucide-react';

import { Can } from '@/components/common/can';
import { CopyableValue } from '@/components/common/copy-button';
import { MinorAmount } from '@/components/common/money-amount';
import { DetailList, DetailRow } from '@/components/common/page-header';
import { CardSkeleton, ErrorState } from '@/components/common/states';
import { TenantStatusBadge } from '@/components/common/status-badge';
import { TimeAgo } from '@/components/common/time';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { formatCount } from '@/lib/format';
import { useTenant } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import type { Tenant } from '@/types';

import { AddMeAsAdminAction } from './add-me-admin-dialog';
import { tenantMessages } from './messages';
import { TenantStatusActions } from './tenant-status-actions';

/**
 * Everything the platform knows about one tenant.
 *
 * It re-reads the tenant by id rather than reusing the row from the list, because this panel is
 * where somebody decides whether to activate a live bot and the list behind it may be a minute old.
 *
 * No secret is on this screen and none can be: the bot token, the Ichancy password and the webhook
 * path token are write-only in the API. The panel says so where each would have been, rather than
 * leaving a field that looks empty because something failed to load.
 */
export function TenantDetailPanel({
  tenantId,
  onClose,
  onEdit,
}: {
  tenantId: string;
  onClose: () => void;
  onEdit: (tenant: Tenant) => void;
}) {
  const query = useTenant(tenantId);
  const tenant = query.data;
  const t = useT(tenantMessages);

  return (
    <Sheet
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{tenant?.displayName ?? t('tenants.detail.fallbackTitle')}</SheetTitle>
          <SheetDescription>
            {tenant === undefined
              ? t('tenants.detail.loading')
              : t('tenants.detail.slug', { slug: tenant.slug })}
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          {query.isPending ? <CardSkeleton /> : null}

          {query.isError ? (
            <ErrorState
              error={query.error}
              onRetry={() => {
                void query.refetch();
              }}
            />
          ) : null}

          {tenant === undefined ? null : <TenantDetails tenant={tenant} />}
        </SheetBody>

        {tenant === undefined ? null : (
          <SheetFooter className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Can capability="tenants.manage">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onEdit(tenant);
                  }}
                >
                  <Pencil className="size-4" />
                  {t('tenants.editSettings')}
                </Button>
              </Can>
              {/* Staff are per operator, so this is how one Telegram account gets into all of them. */}
              <AddMeAsAdminAction tenant={tenant} />
            </div>
            <TenantStatusActions tenant={tenant} />
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

function TenantDetails({ tenant }: { tenant: Tenant }) {
  const t = useT(tenantMessages);

  return (
    <div className="space-y-6">
      <section aria-labelledby="tenant-identity-heading" className="space-y-2">
        <h3 id="tenant-identity-heading" className="text-sm font-semibold">
          {t('tenants.section.identity')}
        </h3>
        <DetailList>
          <DetailRow label={t('field.status')}>
            <TenantStatusBadge status={tenant.status} />
          </DetailRow>
          <DetailRow label={t('tenants.field.slug')}>
            <CopyableValue value={tenant.slug} />
          </DetailRow>
          <DetailRow label={t('tenants.field.id')}>
            <CopyableValue value={tenant.id} />
          </DetailRow>
          <DetailRow label={t('tenants.field.bot')}>
            {tenant.botUsername === null ? (
              <span className="text-[var(--muted-foreground)]">
                {t('tenants.noBotUsernameYet')}
              </span>
            ) : (
              <span className="font-mono text-xs">@{tenant.botUsername}</span>
            )}
          </DetailRow>
          <DetailRow label={t('tenants.field.players')}>
            <CountValue value={tenant.counts?.players} />
          </DetailRow>
          <DetailRow label={t('tenants.field.deposits')}>
            <CountValue value={tenant.counts?.deposits} />
          </DetailRow>
          <DetailRow label={t('field.created')}>
            <TimeAgo value={tenant.createdAt} />
          </DetailRow>
          <DetailRow label={t('field.updated')}>
            <TimeAgo value={tenant.updatedAt} />
          </DetailRow>
        </DetailList>
      </section>

      <section aria-labelledby="tenant-money-heading" className="space-y-2">
        <h3 id="tenant-money-heading" className="text-sm font-semibold">
          {t('tenants.section.money')}
        </h3>
        <DetailList>
          <DetailRow label={t('field.currency')}>
            <span className="font-mono text-xs">{tenant.currencyCode}</span>
          </DetailRow>
          <DetailRow label={t('tenants.field.dualApproval')}>
            <MinorAmount minor={tenant.dualApprovalThresholdMinor} currency={tenant.currencyCode} />
          </DetailRow>
          <DetailRow label={t('tenants.field.floatWatermark')}>
            <MinorAmount
              minor={tenant.agentFloatLowWatermarkMinor}
              currency={tenant.currencyCode}
            />
          </DetailRow>
          <DetailRow label={t('tenants.field.depositExpiry')}>
            {t('tenants.minutes', { count: tenant.depositExpiryMinutes })}
          </DetailRow>
        </DetailList>
      </section>

      <section aria-labelledby="tenant-wiring-heading" className="space-y-2">
        <h3 id="tenant-wiring-heading" className="text-sm font-semibold">
          {t('tenants.section.wiring')}
        </h3>
        <DetailList>
          <DetailRow label={t('tenants.field.ichancyBaseUrl')}>
            <span className="font-mono text-xs break-all">{tenant.ichancyBaseUrl}</span>
          </DetailRow>
          <DetailRow label={t('tenants.field.ichancyUsername')}>
            <span className="font-mono text-xs">{tenant.ichancyUsername}</span>
          </DetailRow>
          <DetailRow label={t('tenants.field.ichancyAgentId')}>
            <CopyableValue value={tenant.ichancyAgentId} />
          </DetailRow>
          <DetailRow label={t('tenants.field.adminChatId')}>
            <CopyableValue value={tenant.adminChatId} />
          </DetailRow>
          <DetailRow label={t('tenants.field.feedChatId')}>
            {tenant.feedChatId === null ? (
              <span className="text-[var(--muted-foreground)]">{t('common.none')}</span>
            ) : (
              <CopyableValue value={tenant.feedChatId} />
            )}
          </DetailRow>
          <DetailRow label={t('tenants.field.webhook')}>
            <Badge tone={tenant.hasWebhookPath ? 'success' : 'warning'}>
              {tenant.hasWebhookPath
                ? t('tenants.webhook.configured')
                : t('tenants.webhook.missing')}
            </Badge>
          </DetailRow>
        </DetailList>
        <p className="text-xs text-[var(--muted-foreground)]">{t('tenants.secretsNote')}</p>
      </section>
    </div>
  );
}

function CountValue({ value }: { value: number | undefined }) {
  const t = useT(tenantMessages);
  if (value === undefined) {
    return <span className="text-[var(--muted-foreground)]">{t('tenants.notCounted')}</span>;
  }
  return <span className="tabular">{formatCount(value)}</span>;
}
