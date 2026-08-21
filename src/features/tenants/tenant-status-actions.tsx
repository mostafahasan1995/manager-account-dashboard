import { PauseCircle, PlayCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Can } from '@/components/common/can';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/api/errors';
import { useActivateTenant, useSuspendTenant } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import type { Tenant } from '@/types';

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
 */
export function TenantStatusActions({ tenant }: { tenant: Tenant }) {
  const activate = useActivateTenant();
  const suspend = useSuspendTenant();
  const [activateOpen, setActivateOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);
  const t = useT(tenantMessages);

  const runActivate = async () => {
    setActivateError(null);
    try {
      const updated = await activate.mutateAsync(tenant.id);
      toast.success(t('tenants.activate.successTitle', { name: updated.displayName }), {
        description: t('tenants.activate.successBody'),
      });
      setActivateOpen(false);
    } catch (error) {
      const message = errorMessage(error);
      setActivateError(message);
      toast.error(t('tenants.activate.errorTitle'), { description: message });
    }
  };

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

  return (
    <Can capability="tenants.manage">
      <div className="flex flex-wrap gap-2">
        {tenant.status === 'ACTIVE' ? (
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
        ) : (
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
        )}
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
        {activateError === null ? null : (
          <Alert tone="danger" title={t('tenants.activate.refusedTitle')}>
            {activateError}
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
