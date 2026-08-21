import { KeyRound, Link2, Link2Off, ListPlus } from 'lucide-react';

import { DetailList, DetailRow } from '@/components/common/page-header';
import { TimeAgo } from '@/components/common/time';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCount } from '@/lib/format';
import { useT } from '@/lib/i18n/use-translation';
import type { Tenant, TenantBotHealth, TenantBotSetup } from '@/types';

import { tenantMessages } from './messages';
import type { TenantOperatorActions } from './tenant-actions';

/**
 * The Telegram side of one operator.
 *
 * ── THE WEBHOOK IS THE HEADLINE, NOT A DOT ────────────────────────────────────────────────────
 * An operator whose webhook is not registered receives NOTHING: its bot never answers, `/console`
 * does nothing, and nobody can sign into it — see docs/TENANT-OPERATIONS.md section 5. That is not
 * a degraded state to colour red in a corner, it is the whole operator being offline, so it is
 * stated in a sentence with the button that fixes it underneath.
 *
 * The two failing shapes are told apart on purpose. No webhook at all and a webhook pointing at
 * somebody else's deployment look identical in a status pill and lead to completely different
 * conversations — one is "we never finished setting it up", the other is "two deployments are
 * fighting over this bot".
 *
 * `pendingUpdateCount` and `lastErrorMessage` are the two fields that explain a bot which "does not
 * work" while everything else looks correct, so they are shown whenever Telegram reports them.
 */
export function TenantTelegramPanel({
  tenant,
  bot,
  actions,
  commandsResult,
}: {
  tenant: Tenant;
  bot: TenantBotHealth;
  actions: TenantOperatorActions;
  /** The result of a push made in this session, which is the only way the console can know one. */
  commandsResult: TenantBotSetup | null;
}) {
  const t = useT(tenantMessages);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('tenants.telegram.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {bot.webhookMatches ? (
          <Alert tone="success" title={t('tenants.webhook.deliveringTitle')}>
            {t('tenants.webhook.deliveringBody')}
          </Alert>
        ) : (
          <Alert tone="danger" title={t('tenants.webhook.silentTitle', { name: tenant.displayName })}>
            {bot.webhookUrl === null
              ? t('tenants.webhook.silentNoneBody')
              : t('tenants.webhook.silentElsewhereBody', { url: bot.webhookUrl })}
          </Alert>
        )}

        {bot.pendingUpdateCount > 0 ? (
          <Alert tone="warning" title={t('tenants.telegram.pendingTitle', { count: bot.pendingUpdateCount })}>
            {t('tenants.telegram.pendingBody')}
          </Alert>
        ) : null}

        {bot.lastErrorMessage === null ? null : (
          <Alert tone="warning" title={t('tenants.telegram.lastErrorTitle')}>
            <span className="break-words">{bot.lastErrorMessage}</span>
            {bot.lastErrorDate === null ? null : (
              <span className="block">
                <TimeAgo value={bot.lastErrorDate} />
              </span>
            )}
          </Alert>
        )}

        <DetailList>
          <DetailRow label={t('tenants.field.bot')}>
            {bot.username === null ? (
              <span className="text-[var(--muted-foreground)]">{t('tenants.noBotYet')}</span>
            ) : (
              <span className="font-mono text-xs">@{bot.username}</span>
            )}
          </DetailRow>
          <DetailRow label={t('tenants.telegram.deliveringTo')}>
            {bot.webhookUrl === null ? (
              <span className="text-[var(--muted-foreground)]">
                {t('tenants.telegram.noWebhookUrl')}
              </span>
            ) : (
              <span className="font-mono text-xs break-all">{bot.webhookUrl}</span>
            )}
          </DetailRow>
          <DetailRow label={t('tenants.telegram.pending')}>
            <span className="tabular">{formatCount(bot.pendingUpdateCount)}</span>
          </DetailRow>
        </DetailList>

        {commandsResult === null ? null : (
          <p className="text-xs text-[var(--muted-foreground)]">
            {t('tenants.commands.pushedBody', {
              count: commandsResult.commandsSet,
              scopes: commandsResult.scopes.join(', '),
            })}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant={bot.webhookMatches ? 'secondary' : 'primary'}
            size="sm"
            loading={actions.registering}
            onClick={actions.registerWebhook}
          >
            <Link2 className="size-3.5" />
            {t('tenants.webhook.register')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            loading={actions.unregistering}
            onClick={actions.askUnregisterWebhook}
          >
            <Link2Off className="size-3.5" />
            {t('tenants.webhook.remove')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            loading={actions.pushing}
            onClick={actions.pushCommands}
          >
            <ListPlus className="size-3.5" />
            {t('tenants.commands.push')}
          </Button>
          <Button variant="secondary" size="sm" onClick={actions.replaceBotToken}>
            <KeyRound className="size-3.5" />
            {t('tenants.bot.replace')}
          </Button>
        </div>

        <p className="text-xs text-[var(--muted-foreground)]">{t('tenants.webhook.whichOne')}</p>
      </CardContent>
    </Card>
  );
}
