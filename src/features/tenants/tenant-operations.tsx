import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Can } from '@/components/common/can';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { DetailList, DetailRow } from '@/components/common/page-header';
import { CardSkeleton, ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { errorMessage } from '@/lib/api/errors';
import {
  useRegisterTenantWebhook,
  useRemoveTenantWebhook,
  useSetupTenantBot,
  useTenantHealth,
} from '@/lib/api/queries';
import { formatCount } from '@/lib/format';
import { useT } from '@/lib/i18n/use-translation';
import type { Tenant } from '@/types';

import { tenantMessages } from './messages';
import type { TenantOperatorActions } from './tenant-actions';
import { TenantBotTokenDialog } from './tenant-bot-token-dialog';
import { TenantIchancyDialog } from './tenant-ichancy-dialog';
import { TenantIchancyPanel } from './tenant-ichancy-panel';
import { TenantSetupChecklist } from './tenant-setup-checklist';
import { TenantTelegramPanel } from './tenant-telegram-panel';

/**
 * Setting an operator up, and finding out why it does not answer.
 *
 * ── WHY THE WHOLE PANEL IS BEHIND ONE CAPABILITY ──────────────────────────────────────────────
 * `GET /v1/admin/tenants/:id/health` is PLATFORM_ADMIN-only, like every action under it. Gating the
 * read as well as the buttons is not extra caution: rendering this for a role the server refuses
 * would put a red error box on a panel that is working perfectly. `Can` renders nothing at all for
 * the other roles, so the query below never mounts and never fires.
 *
 * ── WHY IT DOES NOT POLL ──────────────────────────────────────────────────────────────────────
 * One health read costs a real Ichancy sign-in and two Telegram round trips. Everything it reports
 * changes because somebody on this screen changed it, so it refetches after each action and when
 * asked — never on a timer that would sign in to Ichancy every thirty seconds for as long as the
 * panel stays open.
 */
export function TenantOperations({ tenant }: { tenant: Tenant }) {
  return (
    <Can capability="tenants.manage">
      <TenantOperationsBody tenant={tenant} />
    </Can>
  );
}

function TenantOperationsBody({ tenant }: { tenant: Tenant }) {
  const query = useTenantHealth(tenant.id);
  const register = useRegisterTenantWebhook();
  const remove = useRemoveTenantWebhook();
  const setup = useSetupTenantBot();
  const [unregisterOpen, setUnregisterOpen] = useState(false);
  const [botTokenOpen, setBotTokenOpen] = useState(false);
  const [ichancyOpen, setIchancyOpen] = useState(false);
  const t = useT(tenantMessages);

  const health = query.data;
  const name = tenant.displayName;

  const runRegister = () => {
    register.mutate(
      { id: tenant.id },
      {
        onSuccess: () => {
          toast.success(t('tenants.webhook.registeredTitle', { name }), {
            description: t('tenants.webhook.registeredBody'),
          });
        },
        onError: (error) => {
          toast.error(t('tenants.webhook.registerErrorTitle'), {
            description: errorMessage(error),
          });
        },
      },
    );
  };

  const runUnregister = () => {
    remove.mutate(
      { id: tenant.id },
      {
        onSuccess: () => {
          setUnregisterOpen(false);
          toast.success(t('tenants.webhook.removedTitle', { name }), {
            description: t('tenants.webhook.removedBody'),
          });
        },
        onError: (error) => {
          toast.error(t('tenants.webhook.removeErrorTitle'), { description: errorMessage(error) });
        },
      },
    );
  };

  const runPushCommands = () => {
    setup.mutate(
      { id: tenant.id },
      {
        onSuccess: (result) => {
          toast.success(t('tenants.commands.pushedTitle', { count: result.commandsSet }));
        },
        onError: (error) => {
          toast.error(t('tenants.commands.errorTitle'), { description: errorMessage(error) });
        },
      },
    );
  };

  const actions: TenantOperatorActions = {
    registerWebhook: runRegister,
    registering: register.isPending,
    askUnregisterWebhook: () => {
      setUnregisterOpen(true);
    },
    unregistering: remove.isPending,
    pushCommands: runPushCommands,
    pushing: setup.isPending,
    replaceBotToken: () => {
      setBotTokenOpen(true);
    },
    editIchancy: () => {
      setIchancyOpen(true);
    },
    recheck: () => {
      void query.refetch();
    },
    checking: query.isFetching,
  };

  return (
    <section aria-labelledby="tenant-ops-heading" className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h3 id="tenant-ops-heading" className="text-sm font-semibold">
            {t('tenants.ops.title')}
          </h3>
          <p className="text-xs text-[var(--muted-foreground)]">{t('tenants.ops.description')}</p>
        </div>
        <Button variant="secondary" size="sm" loading={query.isFetching} onClick={actions.recheck}>
          <RefreshCw className="size-3.5" />
          {t('tenants.ops.recheck')}
        </Button>
      </div>

      {query.isPending ? <CardSkeleton /> : null}

      {query.isError ? (
        <Card>
          <ErrorState error={query.error} onRetry={actions.recheck} />
        </Card>
      ) : null}

      {health === undefined ? null : (
        <div className="space-y-4">
          <TenantSetupChecklist
            tenant={tenant}
            health={health}
            actions={actions}
            commandsSet={setup.data?.commandsSet ?? null}
          />
          <TenantTelegramPanel
            tenant={tenant}
            bot={health.bot}
            actions={actions}
            commandsResult={setup.data ?? null}
          />
          <TenantIchancyPanel tenant={tenant} ichancy={health.ichancy} actions={actions} />

          <Card>
            <CardHeader>
              <CardTitle>{t('tenants.ops.counts')}</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailList>
                <DetailRow label={t('tenants.field.players')}>
                  <span className="tabular">{formatCount(health.counts.players)}</span>
                </DetailRow>
                <DetailRow label={t('tenants.field.deposits')}>
                  <span className="tabular">{formatCount(health.counts.deposits)}</span>
                </DetailRow>
              </DetailList>
            </CardContent>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={unregisterOpen}
        onOpenChange={setUnregisterOpen}
        title={t('tenants.webhook.removeConfirmTitle', { name })}
        description={t('tenants.webhook.removeConfirmBody')}
        confirmLabel={t('tenants.webhook.removeConfirmLabel')}
        destructive
        loading={remove.isPending}
        onConfirm={runUnregister}
      />

      <TenantBotTokenDialog open={botTokenOpen} tenant={tenant} onOpenChange={setBotTokenOpen} />
      <TenantIchancyDialog open={ichancyOpen} tenant={tenant} onOpenChange={setIchancyOpen} />
    </section>
  );
}
