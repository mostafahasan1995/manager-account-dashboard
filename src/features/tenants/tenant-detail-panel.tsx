import { Pencil } from 'lucide-react';

import { Can } from '@/components/common/can';
import { CopyableValue } from '@/components/common/copy-button';
import { MinorAmount } from '@/components/common/money-amount';
import { DetailList, DetailRow } from '@/components/common/page-header';
import { CardSkeleton, ErrorState } from '@/components/common/states';
import { TenantStatusBadge } from '@/components/common/status-badge';
import { TimeAgo } from '@/components/common/time';
import { Alert } from '@/components/ui/alert';
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
import { useTenant } from '@/lib/api/queries';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import type { Tenant } from '@/types';
import { isPlatformTenant, tenantDepositMode, tenantWithdrawalMode } from '@/types/tenant';

import { AddMeAsAdminAction } from './add-me-admin-dialog';
import { tenantMessages } from './messages';
import { TenantOperations } from './tenant-operations';
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
  const enumLabel = useEnumLabel();
  const depositMode = tenantDepositMode(tenant);
  const withdrawalMode = tenantWithdrawalMode(tenant);
  const miniAppUrl = tenant.miniAppUrl ?? null;
  const platform = isPlatformTenant(tenant);

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

      {/*
       * The same settings the bot-config screen edits from inside the operator. Each mode is a
       * word and a colour — automatic is the one that moves without a person having looked first,
       * so it is the one that carries the warning tone — and a sentence under the list says what
       * each word means, so a platform admin reading "Automatic" does not assume the platform
       * moves money on the player's word alone.
       */}
      <section aria-labelledby="tenant-bot-heading" className="space-y-2">
        <h3 id="tenant-bot-heading" className="text-sm font-semibold">
          {t('tenants.section.bot')}
        </h3>
        <DetailList>
          <DetailRow label={t('tenants.field.depositMode')}>
            <Badge tone={depositMode === 'AUTO' ? 'warning' : 'muted'}>
              {enumLabel('depositMode', depositMode)}
            </Badge>
          </DetailRow>
          <DetailRow label={t('tenants.field.withdrawalMode')}>
            <Badge tone={withdrawalMode === 'AUTO' ? 'warning' : 'muted'}>
              {enumLabel('withdrawalMode', withdrawalMode)}
            </Badge>
          </DetailRow>
          <DetailRow label={t('tenants.field.miniAppUrl')}>
            {miniAppUrl === null ? (
              <span className="text-[var(--muted-foreground)]">{t('common.notSet')}</span>
            ) : (
              <a
                href={miniAppUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs break-all underline"
              >
                {miniAppUrl}
              </a>
            )}
          </DetailRow>
        </DetailList>
        <p className="text-xs text-[var(--muted-foreground)]">
          {t('tenants.bot.depositModeExplained')}
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">{t('tenants.bot.modeExplained')}</p>
      </section>

      {/*
       * The Ichancy triple is NOT repeated here. It is on the operations panel below, beside the
       * verdict on whether that agent actually answered — a base URL and a username are worth
       * reading only next to the answer to "does this sign in", and printing them twice invites an
       * operator to compare two copies of the same field for a difference that cannot exist.
       */}
      <section aria-labelledby="tenant-chats-heading" className="space-y-2">
        <h3 id="tenant-chats-heading" className="text-sm font-semibold">
          {t('tenants.section.chats')}
        </h3>
        {/*
         * No staff group is not a blank cell: it is an operator whose review cards and alerts go
         * nowhere, and which cannot be activated. Said in red, with the consequence and the place to
         * fix it, for every role that can open this panel.
         *
         * Except for tenant zero. The platform is not an operator: it has no staff group by design,
         * the backend refuses every bind for it (TENANT_PLATFORM_LOCKED), and it takes no deposits of
         * its own. A red warning there would be both alarming and impossible to act on, so one
         * neutral line says what is true instead.
         */}
        {platform ? (
          <p className="text-xs text-[var(--muted-foreground)]">{t('tenants.platform.noGroups')}</p>
        ) : tenant.adminChatId === null ? (
          <Alert tone="danger" title={t('tenants.staffGroup.missingTitle')}>
            {tenant.status === 'ACTIVE'
              ? t('tenants.staffGroup.missingActiveBody')
              : t('tenants.staffGroup.missingSuspendedBody')}
          </Alert>
        ) : null}
        <DetailList>
          <DetailRow label={t('tenants.field.adminChatId')}>
            {tenant.adminChatId !== null ? (
              <CopyableValue value={tenant.adminChatId} />
            ) : platform ? (
              <span className="text-[var(--muted-foreground)]">{t('common.none')}</span>
            ) : (
              <span className="text-[var(--danger)]">{t('tenants.chat.notBound')}</span>
            )}
          </DetailRow>
          <DetailRow label={t('tenants.field.feedChatId')}>
            {tenant.feedChatId === null ? (
              <span className="text-[var(--muted-foreground)]">{t('common.none')}</span>
            ) : (
              <CopyableValue value={tenant.feedChatId} />
            )}
          </DetailRow>
          {/*
            The path token in the DATABASE, which every operator has from the moment it is created —
            not Telegram's registration, which is the thing that decides whether the bot receives
            anything. A green "webhook configured" here read as delivery working and flatly
            contradicted the setup checklist below, which is the panel that actually knows. Neutral
            tone, and wording that says which of the two this is.
          */}
          <DetailRow label={t('tenants.field.webhookPath')}>
            <Badge tone="muted">
              {tenant.hasWebhookPath
                ? t('tenants.webhook.pathGenerated')
                : t('tenants.webhook.noPath')}
            </Badge>
          </DetailRow>
        </DetailList>
        <p className="text-xs text-[var(--muted-foreground)]">{t('tenants.secretsNote')}</p>
      </section>

      <TenantOperations tenant={tenant} />
    </div>
  );
}
