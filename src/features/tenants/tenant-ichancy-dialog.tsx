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
import { errorMessage, isApiError } from '@/lib/api/errors';
import { useUpdateTenantIchancy } from '@/lib/api/queries';
import { useT, type Translator } from '@/lib/i18n/use-translation';
import type { Tenant, UpdateTenantIchancyBody } from '@/types';

import { tenantMessages } from './messages';
import { TenantField } from './tenant-field';

/**
 * Changing where an operator signs in to Ichancy, and as whom.
 *
 * ── ONLY WHAT CHANGED IS SENT ─────────────────────────────────────────────────────────────────
 * The password is write-only: it is sealed on arrival and never returned, so the field starts empty
 * and an empty field means "keep the stored one". Sending the other three unchanged would be
 * harmless but sending the agent id unchanged is not — the server refuses that field once players
 * are linked, and re-sending the value it already holds would turn a no-op save into a rejection.
 *
 * ── THE 422 IS SHOWN AS THE API WORDED IT ─────────────────────────────────────────────────────
 * A refused agent id is not a validation slip; it is the server saying this operator already has
 * players hanging off that agent, and repointing it would orphan them from the tree their balances
 * live in. That sentence, with whatever count the backend put in it, is more use than anything this
 * form could invent — so the refusal is printed verbatim and the dialog stays open on top of it.
 */
const DIGITS_RE = /^\d+$/;
const HTTPS_RE = /^https:\/\/\S+$/;

type TenantTranslator = Translator<(typeof tenantMessages)['en']>;

const schemaFor = (t: TenantTranslator) =>
  z.object({
    ichancyBaseUrl: z.string().regex(HTTPS_RE, t('tenants.validation.httpsUrl')),
    ichancyUsername: z.string().trim().min(1, t('tenants.validation.required')),
    ichancyPassword: z.string(),
    ichancyAgentId: z.string().regex(DIGITS_RE, t('tenants.validation.agentId')),
  });

type FormValues = z.infer<ReturnType<typeof schemaFor>>;

export function TenantIchancyDialog({
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
        <IchancyForm
          tenant={tenant}
          onDone={() => {
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function IchancyForm({ tenant, onDone }: { tenant: Tenant; onDone: () => void }) {
  const updateIchancy = useUpdateTenantIchancy();
  const t = useT(tenantMessages);
  const schema = useMemo(() => schemaFor(t), [t]);
  const [refusal, setRefusal] = useState<{ title: string; message: string } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ichancyBaseUrl: tenant.ichancyBaseUrl,
      ichancyUsername: tenant.ichancyUsername,
      ichancyPassword: '',
      ichancyAgentId: tenant.ichancyAgentId,
    },
  });

  const submit = handleSubmit(async (values) => {
    setRefusal(null);
    const body = changedFields(tenant, values);

    if (Object.keys(body).length === 0) {
      setRefusal({
        title: t('tenants.ichancyEdit.unchangedTitle'),
        message: t('tenants.ichancyEdit.unchangedBody'),
      });
      return;
    }

    try {
      await updateIchancy.mutateAsync({ id: tenant.id, body });
      // Clears the password before anything can re-render still holding it.
      reset({ ...values, ichancyPassword: '' });
      toast.success(t('tenants.ichancyEdit.successTitle', { name: tenant.displayName }), {
        description: t('tenants.ichancyEdit.successBody'),
      });
      onDone();
    } catch (error) {
      const message = errorMessage(error);
      setRefusal({
        title:
          isApiError(error) && error.status === 422
            ? t('tenants.ichancyEdit.refusedTitle')
            : t('tenants.ichancyEdit.errorTitle'),
        message,
      });
      toast.error(t('tenants.ichancyEdit.errorTitle'), { description: message });
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
        <DialogTitle>{t('tenants.ichancyEdit.title', { name: tenant.displayName })}</DialogTitle>
        <DialogDescription>{t('tenants.ichancyEdit.description')}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <TenantField
            id="tenant-ichancy-base-url"
            label={t('tenants.field.ichancyBaseUrl')}
            registration={register('ichancyBaseUrl')}
            error={errors.ichancyBaseUrl?.message}
            placeholder="https://agent.ichancy.example"
          />
        </div>
        <TenantField
          id="tenant-ichancy-username"
          label={t('tenants.field.ichancyUsername')}
          registration={register('ichancyUsername')}
          error={errors.ichancyUsername?.message}
          autoComplete="off"
        />
        <TenantField
          id="tenant-ichancy-password"
          label={t('tenants.field.ichancyPassword')}
          registration={register('ichancyPassword')}
          error={errors.ichancyPassword?.message}
          hint={t('tenants.ichancyEdit.passwordHint')}
          type="password"
          autoComplete="new-password"
        />
        <div className="sm:col-span-2">
          <TenantField
            id="tenant-ichancy-agent-id"
            label={t('tenants.field.ichancyAgentId')}
            registration={register('ichancyAgentId')}
            error={errors.ichancyAgentId?.message}
            hint={t('tenants.ichancyEdit.agentIdWarning')}
            mono
          />
        </div>
      </div>

      {refusal === null ? null : (
        <Alert tone="danger" title={refusal.title}>
          {refusal.message}
        </Alert>
      )}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="primary" loading={updateIchancy.isPending}>
          {t('tenants.ichancyEdit.submit')}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** `exactOptionalPropertyTypes` is on: an unchanged field is absent, never `undefined`. */
function changedFields(tenant: Tenant, values: FormValues): UpdateTenantIchancyBody {
  const baseUrl = values.ichancyBaseUrl.trim();
  const username = values.ichancyUsername.trim();
  const agentId = values.ichancyAgentId.trim();

  return {
    ...(baseUrl === tenant.ichancyBaseUrl ? {} : { ichancyBaseUrl: baseUrl }),
    ...(username === tenant.ichancyUsername ? {} : { ichancyUsername: username }),
    ...(values.ichancyPassword === '' ? {} : { ichancyPassword: values.ichancyPassword }),
    ...(agentId === tenant.ichancyAgentId ? {} : { ichancyAgentId: agentId }),
  };
}
