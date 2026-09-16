import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { errorMessage } from '@/lib/api/errors';
import { useUpdateTenantBot } from '@/lib/api/queries';
import { useT, type Translator } from '@/lib/i18n/use-translation';
import type { Tenant } from '@/types';

import { tenantMessages } from './messages';
import { TenantField } from './tenant-field';

/**
 * Replacing an operator's bot token.
 *
 * Two things make this more than a text field. The token is a secret that is sealed on arrival and
 * never returned, so the field is write-only and cleared the instant the write succeeds; and the
 * new bot has no webhook, because Telegram permits exactly one webhook URL per bot and this one has
 * never been told where to deliver. An operator who replaces a token and walks away has just taken
 * the operator offline, so the warning is on the form before the click and in the toast after it.
 *
 * `getMe` runs on the server before anything is stored, so a bad token is refused rather than
 * saved — and the refusal is shown as Telegram worded it, because "invalid" and "unauthorized" send
 * a person to two different places.
 */
const BOT_TOKEN_RE = /^\d{6,}:[A-Za-z0-9_-]{30,}$/;

type TenantTranslator = Translator<(typeof tenantMessages)['en']>;

const schemaFor = (t: TenantTranslator) =>
  z.object({
    botToken: z.string().regex(BOT_TOKEN_RE, t('tenants.validation.botToken')),
  });

type FormValues = z.infer<ReturnType<typeof schemaFor>>;

export function TenantBotTokenDialog({
  open,
  tenant,
  onOpenChange,
}: {
  open: boolean;
  tenant: Tenant;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <BotTokenForm
          tenant={tenant}
          onDone={() => {
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function BotTokenForm({ tenant, onDone }: { tenant: Tenant; onDone: () => void }) {
  const updateBot = useUpdateTenantBot();
  const t = useT(tenantMessages);
  const schema = useMemo(() => schemaFor(t), [t]);
  const [refusal, setRefusal] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { botToken: '' },
  });

  const submit = handleSubmit(async (values) => {
    setRefusal(null);
    try {
      await updateBot.mutateAsync({ id: tenant.id, body: { botToken: values.botToken.trim() } });
      // Clears the secret before anything can re-render still holding it.
      reset();
      toast.success(t('tenants.bot.replacedTitle', { name: tenant.displayName }), {
        description: t('tenants.bot.replacedBody'),
      });
      onDone();
    } catch (error) {
      const message = errorMessage(error);
      setRefusal(message);
      toast.error(t('tenants.bot.errorTitle'), { description: message });
    }
  });

  return (
    <form
      onSubmit={(event) => {
        void submit(event);
      }}
      className="space-y-5"
      noValidate
    >
      <DialogHeader>
        <DialogTitle>{t('tenants.bot.title', { name: tenant.displayName })}</DialogTitle>
        <DialogDescription>{t('tenants.bot.description')}</DialogDescription>
      </DialogHeader>

      <TenantField
        id="tenant-bot-token"
        label={t('tenants.field.botToken')}
        registration={register('botToken')}
        error={errors.botToken?.message}
        hint={t('tenants.hint.botToken')}
        type="password"
        autoComplete="off"
      />

      <Alert tone="warning" title={t('tenants.bot.noWebhookTitle')}>
        {t('tenants.bot.noWebhookBody')}
      </Alert>

      {refusal === null ? null : (
        <Alert tone="danger" title={t('tenants.bot.errorTitle')}>
          {refusal}
        </Alert>
      )}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="primary" loading={updateBot.isPending}>
          {t('tenants.bot.submit')}
        </Button>
      </DialogFooter>
    </form>
  );
}
