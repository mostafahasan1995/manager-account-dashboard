import { PauseCircle, PlayCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Can } from '@/components/common/can';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { errorMessage, isApiError } from '@/lib/api/errors';
import { useActivateTenant, useSuspendTenant } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import { TENANT_STAFF_GROUP_REQUIRED, type Tenant } from '@/types';
import { isPlatformTenant } from '@/types/tenant';

import { tenantMessages } from './messages';

/**
 * Activate and suspend.
 *
 * These are the two buttons on this screen that reach a live bot, so neither is a plain click.
 * Activation can genuinely fail — the backend signs in to Ichancy with the stored credentials
 * before it lets a tenant serve — so the failure is shown as the API worded it and the dialog stays
 * open on top of it; "something went wrong" would leave the operator guessing between a wrong
 * password, a wrong agent id and an unreachable Ichancy.
 *
 * The two icons keep their orientation in Arabic. Neither points anywhere: a pause and a play glyph
 * mean stopped and running, the same way they do on any device, and mirroring them would turn a
 * symbol an operator recognises instantly into one they have to read.
 *
 * ── WHY THE PLATFORM LOSES SUSPEND AND KEEPS ACTIVATE ─────────────────────────────────────────
 * Suspending tenant zero is refused (422 TENANT_PLATFORM_LOCKED: it would lock every platform admin
 * out of sign-in), so that button is not offered for it. Activating it is NOT refused — the backend
 * answers an already-serving operator as it is, 200 — so the rule is written as "no Suspend here",
 * not "no status buttons here". In practice tenant zero is always ACTIVE and therefore shows
 * neither; the day the API says otherwise, the console offers the one call that would still work
 * rather than a footer with nothing in it and no way to fix the row.
 */
export function TenantStatusActions({ tenant }: { tenant: Tenant }) {
  const activate = useActivateTenant();
  const suspend = useSuspendTenant();
  const [activateOpen, setActivateOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [activateError, setActivateError] = useState<unknown>(null);
  const t = useT(tenantMessages);

  const runActivate = async () => {
    setActivateError(null);
    try {
      const updated = await activate.mutateAsync(tenant.id);
      toast.success(t('tenants.activate.successTitle', { name: updated.displayName }), {
        description: updated.ichancyFake
          ? t('tenants.activate.successBodyFake')
          : t('tenants.activate.successBody'),
      });
      setActivateOpen(false);
    } catch (error) {
      setActivateError(error);
      toast.error(t('tenants.activate.errorTitle'), { description: errorMessage(error) });
    }
  };

  // Titled by what the server refused, since "Ichancy refused the sign-in" is wrong for a refusal
  // that happened before any sign-in was attempted.
  const refusedTitle =
    isApiError(activateError) && activateError.code === TENANT_STAFF_GROUP_REQUIRED
      ? t('tenants.activate.refusedStaffGroupTitle')
      : t('tenants.activate.refusedTitle');

  const runSuspend = async () => {
    try {
      const updated = await suspend.mutateAsync(tenant.id);
      toast.success(t('tenants.suspend.successTitle', { name: updated.displayName }), {
        description: t('tenants.suspend.successBody'),
      });
      setSuspendOpen(false);
    } catch (error) {
      toast.error(t('tenants.suspend.errorTitle'), { description: errorMessage(error) });
    }
  };

  const active = tenant.status === 'ACTIVE';
  const maySuspend = active && !isPlatformTenant(tenant);
  const mayActivate = !active;
  // The platform while it is serving: nothing here can be done to it, so nothing is drawn — not an
  // empty row of buttons, and not a disabled one inviting a click the server would refuse.
  if (!maySuspend && !mayActivate) return null;

  return (
    <Can capability="tenants.manage">
      <div className="flex flex-wrap gap-2">
        {maySuspend ? (
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              setSuspendOpen(true);
            }}
          >
            <PauseCircle className="size-4" />
            {t('tenants.suspend.action')}
          </Button>
        ) : null}
        {mayActivate ? (
          <Button
            variant="success"
            size="sm"
            onClick={() => {
              setActivateError(null);
              setActivateOpen(true);
            }}
          >
            <PlayCircle className="size-4" />
            {t('tenants.activate.action')}
          </Button>
        ) : null}
      </div>

      <ConfirmDialog
        open={activateOpen}
        onOpenChange={setActivateOpen}
        title={t('tenants.activate.confirmTitle', { name: tenant.displayName })}
        description={t('tenants.activate.confirmBody')}
        confirmLabel={t('tenants.activate.confirmLabel')}
        loading={activate.isPending}
        onConfirm={() => void runActivate()}
      >
        {/*
         * Warned, not disabled: the server decides, and a group bound in Telegram a second ago may not
         * have reached this screen yet. The refusal below says the same thing if it still holds.
         */}
        {tenant.adminChatId === null && activateError === null ? (
          <Alert tone="warning" title={t('tenants.activate.noStaffGroupTitle')}>
            {t('tenants.activate.noStaffGroupBody')}
          </Alert>
        ) : null}
        {activateError === null ? null : (
          <Alert tone="danger" title={refusedTitle}>
            {errorMessage(activateError)}
          </Alert>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        title={t('tenants.suspend.confirmTitle', { name: tenant.displayName })}
        description={t('tenants.suspend.confirmBody')}
        confirmLabel={t('tenants.suspend.confirmLabel')}
        confirmWord={tenant.slug}
        destructive
        loading={suspend.isPending}
        onConfirm={() => void runSuspend()}
      />
    </Can>
  );
}
