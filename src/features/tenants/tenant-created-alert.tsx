import { CircleCheck, CircleX } from 'lucide-react';
import type { ReactNode } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/use-translation';
import type { Tenant, TenantProvisioning } from '@/types';

import { tenantMessages } from './messages';

/**
 * What `POST /v1/admin/tenants` actually did beside creating the row.
 *
 * Provisioning is five steps that can each fail on their own — the webhook, the command menus,
 * activation, the payment rails and the player import — and the response reports every one as a
 * boolean plus a nullable error. This alert reads them out in that shape: a tick or a cross per
 * step, and the server's own sentence beside a cross. It is the only place the import's result
 * from creation is ever shown, because the tenant row does not carry it.
 *
 * The placeholder warning is the line that matters most, and it is the reason this alert is
 * `warning` rather than `success` while it holds: a provisioned rail pointing at `REPLACE ME` can
 * take a real deposit.
 */
export function TenantCreatedAlert({
  tenant,
  provisioning,
  onDismiss,
}: {
  tenant: Tenant;
  provisioning: TenantProvisioning;
  onDismiss: () => void;
}) {
  const t = useT(tenantMessages);
  const reason = (error: string | null) => ({ error: error ?? t('tenants.created.noReason') });

  const steps: { key: string; ok: boolean; text: string }[] = [
    {
      key: 'webhook',
      ok: provisioning.webhookRegistered,
      text: provisioning.webhookRegistered
        ? t('tenants.created.webhookOk')
        : t('tenants.created.webhookFailed', reason(provisioning.webhookError)),
    },
    {
      key: 'menus',
      ok: provisioning.menusPushed,
      text: provisioning.menusPushed
        ? t('tenants.created.menusOk')
        : t('tenants.created.menusFailed', reason(provisioning.menuError)),
    },
    {
      key: 'activated',
      ok: provisioning.activated,
      text: provisioning.activated
        ? t('tenants.created.activated')
        : t('tenants.created.notActivated', reason(provisioning.activationError)),
    },
    {
      key: 'rails',
      ok: provisioning.paymentMethodsError === null,
      text:
        provisioning.paymentMethodsError === null
          ? t('tenants.created.rails', { count: provisioning.paymentMethodsCreated })
          : t('tenants.created.railsFailed', { error: provisioning.paymentMethodsError }),
    },
    {
      key: 'players',
      ok: provisioning.playersImportError === null,
      text:
        provisioning.playersImportError === null
          ? t('tenants.created.playersImported', { count: provisioning.playersImported })
          : t('tenants.created.playersImportError', { error: provisioning.playersImportError }),
    },
  ];

  return (
    <Alert
      tone={provisioning.paymentMethodsNeedAccounts ? 'warning' : 'success'}
      title={t('tenants.created.title', { name: tenant.displayName })}
    >
      <ul className="space-y-1">
        {steps.map((step) => (
          <StepLine key={step.key} ok={step.ok}>
            {step.text}
          </StepLine>
        ))}
      </ul>
      {provisioning.paymentMethodsNeedAccounts ? (
        <p className="font-medium text-[var(--foreground)]">{t('tenants.created.placeholders')}</p>
      ) : null}
      <div className="pt-1">
        <Button variant="secondary" size="sm" onClick={onDismiss}>
          {t('tenants.created.dismiss')}
        </Button>
      </div>
    </Alert>
  );
}

function StepLine({ ok, children }: { ok: boolean; children: ReactNode }) {
  const Icon = ok ? CircleCheck : CircleX;
  return (
    <li className="flex items-start gap-2">
      <Icon
        className={
          ok
            ? 'mt-0.5 size-4 shrink-0 text-[var(--success)]'
            : 'mt-0.5 size-4 shrink-0 text-[var(--danger)]'
        }
        aria-hidden="true"
      />
      <span>{children}</span>
    </li>
  );
}
