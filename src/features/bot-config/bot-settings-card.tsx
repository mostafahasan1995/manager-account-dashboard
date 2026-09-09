import { useState } from 'react';
import { toast } from 'sonner';

import { Can, CardSkeleton, ErrorState } from '@/components/common';
import { Alert, Button, Card, CardContent, Input, Label } from '@/components/ui';
import { errorMessage } from '@/lib/api/errors';
import { useBotSettings, useUpdateBotSettings } from '@/lib/api/queries';
import { useAuth } from '@/lib/auth/use-auth';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import type { BotSettings, DepositMode, UpdateBotSettingsBody, WithdrawalMode } from '@/types';
import { DEPOSIT_MODES, WITHDRAWAL_MODES } from '@/types/enums';

import { botConfigMessages } from './messages';
import { SectionHeader } from './surface-state';

/**
 * The operator settings the bot reads at runtime that are not buttons: where the app button
 * opens, whether a submitted deposit is checked against provider evidence before a person sees
 * it, and whether a cash-out waits for a person.
 *
 * ── WHY IT SENDS A DIFF AND NOT THE FORM ──────────────────────────────────────────────────────
 * `PATCH /v1/admin/bot-menu/settings` leaves an absent key alone and reads `miniAppUrl: null` as
 * "clear it". So the body is built from what CHANGED: a URL emptied by the operator goes out as
 * null — an explicit clear — while a URL that was never there and is still empty is not mentioned
 * at all. Sending `miniAppUrl: ""` is never an option: the server refuses anything that is not
 * https, and an empty string is the wrong way to say "none".
 *
 * ── WHY THE MODE'S EXPLANATION IS THE HONEST ONE ──────────────────────────────────────────────
 * "Automatic" would be read as "the money is sent by itself", and nothing on this platform can
 * send money: the Sham Cash API is read-only. AUTO approves, debits the casino balance and checks
 * the payout wallet; a person still performs the transfer and marks it paid. The radio says so in
 * the same sentence as the option, so an operator switching it on knows what they are switching on.
 *
 * Everybody who can open the page may read this card. The Save button is behind `botSettings.write`
 * and the fields are disabled without it — the server enforces the same table.
 */
export function BotSettingsCard() {
  const settings = useBotSettings();
  const { can } = useAuth();
  const mayWrite = can('botSettings.write');

  if (settings.isPending) return <CardSkeleton />;

  if (settings.isError) {
    return (
      <Card>
        <ErrorState
          error={settings.error}
          onRetry={() => {
            void settings.refetch();
          }}
        />
      </Card>
    );
  }

  const saved = settings.data;
  return (
    // Keyed on the saved values: after a save the server's answer re-seeds the form, and a refetch
    // that answers the same thing leaves an operator's half-typed URL alone.
    <BotSettingsForm
      key={`${saved.miniAppUrl ?? ''}|${saved.depositMode}|${saved.withdrawalMode}`}
      saved={saved}
      mayWrite={mayWrite}
    />
  );
}

const HTTPS_RE = /^https:\/\/\S+$/;

function BotSettingsForm({ saved, mayWrite }: { saved: BotSettings; mayWrite: boolean }) {
  const t = useT(botConfigMessages);
  const enumLabel = useEnumLabel();
  const update = useUpdateBotSettings();

  const [url, setUrl] = useState(saved.miniAppUrl ?? '');
  const [depositMode, setDepositMode] = useState<DepositMode>(saved.depositMode);
  const [withdrawalMode, setWithdrawalMode] = useState<WithdrawalMode>(saved.withdrawalMode);

  const trimmedUrl = url.trim();
  const urlInvalid = trimmedUrl !== '' && !HTTPS_RE.test(trimmedUrl);
  const body = diff(saved, trimmedUrl, depositMode, withdrawalMode);
  const dirty = Object.keys(body).length > 0;

  const save = async () => {
    try {
      await update.mutateAsync(body);
      toast.success(t('botConfig.settings.saved'));
    } catch (caught) {
      toast.error(t('botConfig.settings.failed'), { description: errorMessage(caught) });
    }
  };

  return (
    <Card>
      <SectionHeader title={t('botConfig.settings.title')} state="live">
        {t('botConfig.settings.body')}
      </SectionHeader>
      <CardContent className="space-y-5">
        {mayWrite ? null : (
          <p className="text-xs text-[var(--muted-foreground)]">
            {t('botConfig.settings.readOnly')}
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="bot-mini-app-url">{t('botConfig.settings.miniAppUrl')}</Label>
          <Input
            id="bot-mini-app-url"
            value={url}
            placeholder="https://example.ngrok-free.app"
            inputMode="url"
            autoComplete="off"
            disabled={!mayWrite}
            aria-invalid={urlInvalid}
            aria-describedby="bot-mini-app-url-hint bot-mini-app-url-error"
            className="font-mono"
            onChange={(event) => {
              setUrl(event.target.value);
            }}
          />
          <p id="bot-mini-app-url-hint" className="text-xs text-[var(--muted-foreground)]">
            {t('botConfig.settings.miniAppUrlHint')} {t('botConfig.settings.miniAppUrlNgrok')}
          </p>
          <p
            id="bot-mini-app-url-error"
            role="alert"
            className="text-sm text-[var(--danger)] empty:hidden"
          >
            {urlInvalid ? t('botConfig.settings.miniAppUrlInvalid') : null}
          </p>
          <ChatMenuButtonStatus saved={saved} />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t('botConfig.settings.depositMode')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {DEPOSIT_MODES.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-[var(--border)] p-3 text-sm hover:bg-[var(--surface-muted)] has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--primary-muted)] has-[:disabled]:cursor-not-allowed"
              >
                <input
                  type="radio"
                  name="bot-deposit-mode"
                  value={option}
                  checked={depositMode === option}
                  disabled={!mayWrite}
                  className="mt-0.5 accent-[var(--primary)]"
                  onChange={() => {
                    setDepositMode(option);
                  }}
                />
                <span className="min-w-0">
                  <span className="block font-medium">{enumLabel('depositMode', option)}</span>
                  <span className="block text-[var(--muted-foreground)]">
                    {t(`botConfig.settings.depositModeOption.${option}.body`)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t('botConfig.settings.withdrawalMode')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {WITHDRAWAL_MODES.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-[var(--border)] p-3 text-sm hover:bg-[var(--surface-muted)] has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--primary-muted)] has-[:disabled]:cursor-not-allowed"
              >
                <input
                  type="radio"
                  name="bot-withdrawal-mode"
                  value={option}
                  checked={withdrawalMode === option}
                  disabled={!mayWrite}
                  className="mt-0.5 accent-[var(--primary)]"
                  onChange={() => {
                    setWithdrawalMode(option);
                  }}
                />
                <span className="min-w-0">
                  <span className="block font-medium">{enumLabel('withdrawalMode', option)}</span>
                  <span className="block text-[var(--muted-foreground)]">
                    {t(`botConfig.settings.mode.${option}.body`)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <Can capability="botSettings.write">
          <Button
            variant="primary"
            size="sm"
            loading={update.isPending}
            disabled={!dirty || urlInvalid}
            onClick={() => {
              void save();
            }}
          >
            {t('common.save')}
          </Button>
        </Can>
      </CardContent>
    </Card>
  );
}

/**
 * Whether Telegram's own menu button was pointed at the app — reported, never assumed, because
 * `setChatMenuButton` is best-effort on the server and can fail while the URL still saved.
 */
function ChatMenuButtonStatus({ saved }: { saved: BotSettings }) {
  const t = useT(botConfigMessages);

  if (saved.miniAppUrl === null) {
    return (
      <p className="text-xs text-[var(--muted-foreground)]">
        {t('botConfig.settings.chatMenuButtonNone')}
      </p>
    );
  }
  if (saved.chatMenuButtonSet) {
    return (
      <p className="text-xs text-[var(--success)]">{t('botConfig.settings.chatMenuButtonSet')}</p>
    );
  }
  return (
    <Alert tone="warning" hideIcon className="p-3">
      {t('botConfig.settings.chatMenuButtonUnset')}
    </Alert>
  );
}

/** Only what changed. An emptied URL is an explicit clear; one that was never there is silence. */
function diff(
  saved: BotSettings,
  url: string,
  depositMode: DepositMode,
  withdrawalMode: WithdrawalMode,
): UpdateBotSettingsBody {
  const savedUrl = saved.miniAppUrl ?? '';
  return {
    ...(url === savedUrl ? {} : { miniAppUrl: url === '' ? null : url }),
    ...(depositMode === saved.depositMode ? {} : { depositMode }),
    ...(withdrawalMode === saved.withdrawalMode ? {} : { withdrawalMode }),
  };
}
