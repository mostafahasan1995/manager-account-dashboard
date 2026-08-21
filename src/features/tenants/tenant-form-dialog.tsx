import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, type ReactNode } from 'react';
import { useForm, useWatch, type UseFormRegisterReturn } from 'react-hook-form';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage } from '@/lib/api/errors';
import { useCreateTenant, useUpdateTenant } from '@/lib/api/queries';
import { useT, type Translator } from '@/lib/i18n/use-translation';
import { formatMinorToDecimal, groupDecimal, minorFromString } from '@/lib/money';
import type { CreateTenantBody, Tenant, UpdateTenantBody } from '@/types';

import { tenantMessages } from './messages';

/**
 * Create and edit, in one dialog because they are the same object seen twice — but deliberately not
 * the same form. Creating asks for three secrets and two values that can never be changed again;
 * editing must not even appear to offer those.
 *
 * Every number here stays a string all the way to the wire. Chat ids are 64-bit Telegram ids and
 * the thresholds are minor units, both of which lose their last digits as JavaScript numbers. The
 * one `Number()` in this file is the deposit expiry, which is genuinely a small integer.
 *
 * The schemas are built from `t` at render, not declared once at module load. A zod message frozen
 * at import time is whatever language the module was first evaluated in, which is English forever —
 * and a validation message is exactly the sentence an operator needs in their own language.
 */

const SLUG_RE = /^[a-z][a-z0-9-]{1,30}[a-z0-9]$/;
const BOT_TOKEN_RE = /^\d{6,}:[A-Za-z0-9_-]{30,}$/;
const CHAT_ID_RE = /^-?\d+$/;
const DIGITS_RE = /^\d+$/;
const CURRENCY_RE = /^[A-Za-z]{3}$/;
const HTTPS_RE = /^https:\/\/\S+$/;

const MIN_EXPIRY_MINUTES = 5;
const MAX_EXPIRY_MINUTES = 1440;

type TenantTranslator = Translator<(typeof tenantMessages)['en']>;

const expiryFieldFor = (t: TenantTranslator) =>
  z
    .string()
    .regex(DIGITS_RE, t('tenants.validation.wholeMinutes'))
    .refine(
      (value) => {
        const minutes = Number(value);
        return minutes >= MIN_EXPIRY_MINUTES && minutes <= MAX_EXPIRY_MINUTES;
      },
      t('tenants.validation.expiryRange', { min: MIN_EXPIRY_MINUTES, max: MAX_EXPIRY_MINUTES }),
    );

const minorFieldFor = (t: TenantTranslator) =>
  z.string().regex(DIGITS_RE, t('tenants.validation.minorUnits'));

const optionalChatIdFieldFor = (t: TenantTranslator) =>
  z
    .string()
    .refine(
      (value) => value.trim() === '' || CHAT_ID_RE.test(value.trim()),
      t('tenants.validation.chatId'),
    );

const createSchemaFor = (t: TenantTranslator) =>
  z.object({
    slug: z.string().regex(SLUG_RE, t('tenants.validation.slug')),
    displayName: z.string().trim().min(1, t('tenants.validation.displayName')),
    botToken: z.string().regex(BOT_TOKEN_RE, t('tenants.validation.botToken')),
    adminChatId: z.string().regex(CHAT_ID_RE, t('tenants.validation.chatId')),
    feedChatId: optionalChatIdFieldFor(t),
    ichancyBaseUrl: z.string().regex(HTTPS_RE, t('tenants.validation.httpsUrl')),
    ichancyUsername: z.string().trim().min(1, t('tenants.validation.required')),
    ichancyPassword: z.string().min(1, t('tenants.validation.required')),
    ichancyAgentId: z.string().regex(DIGITS_RE, t('tenants.validation.agentId')),
    currencyCode: z.string().regex(CURRENCY_RE, t('tenants.validation.currencyCode')),
    dualApprovalThresholdMinor: minorFieldFor(t),
    agentFloatLowWatermarkMinor: minorFieldFor(t),
    depositExpiryMinutes: expiryFieldFor(t),
  });
type CreateFormValues = z.infer<ReturnType<typeof createSchemaFor>>;

const editSchemaFor = (t: TenantTranslator) =>
  z.object({
    displayName: z.string().trim().min(1, t('tenants.validation.displayName')),
    adminChatId: z.string().regex(CHAT_ID_RE, t('tenants.validation.chatId')),
    feedChatId: optionalChatIdFieldFor(t),
    dualApprovalThresholdMinor: minorFieldFor(t),
    agentFloatLowWatermarkMinor: minorFieldFor(t),
    depositExpiryMinutes: expiryFieldFor(t),
  });
type EditFormValues = z.infer<ReturnType<typeof editSchemaFor>>;

export function TenantFormDialog({
  open,
  tenant,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  /** null opens the create form; a tenant opens the edit form for that tenant. */
  tenant: Tenant | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (tenant: Tenant) => void;
}) {
  const cancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {tenant === null ? (
          <CreateTenantForm onSaved={onSaved} onCancel={cancel} />
        ) : (
          <EditTenantForm tenant={tenant} onSaved={onSaved} onCancel={cancel} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreateTenantForm({
  onSaved,
  onCancel,
}: {
  onSaved: (tenant: Tenant) => void;
  onCancel: () => void;
}) {
  const createTenant = useCreateTenant();
  const t = useT(tenantMessages);
  const schema = useMemo(() => createSchemaFor(t), [t]);
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      slug: '',
      displayName: '',
      botToken: '',
      adminChatId: '',
      feedChatId: '',
      ichancyBaseUrl: 'https://',
      ichancyUsername: '',
      ichancyPassword: '',
      ichancyAgentId: '',
      currencyCode: '',
      dualApprovalThresholdMinor: '',
      agentFloatLowWatermarkMinor: '',
      depositExpiryMinutes: '30',
    },
  });

  const currencyCode = useWatch({ control, name: 'currencyCode' });
  const dualApprovalThresholdMinor = useWatch({ control, name: 'dualApprovalThresholdMinor' });
  const agentFloatLowWatermarkMinor = useWatch({ control, name: 'agentFloatLowWatermarkMinor' });

  const submit = handleSubmit(async (values) => {
    try {
      const created = await createTenant.mutateAsync(toCreateBody(values));
      // Clears the bot token and the Ichancy password before anything can re-render holding them.
      reset();
      toast.success(t('tenants.create.successTitle', { name: created.displayName }), {
        description: t('tenants.create.successBody'),
      });
      onSaved(created);
    } catch (error) {
      toast.error(t('tenants.create.errorTitle'), { description: errorMessage(error) });
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
        <DialogTitle>{t('tenants.new')}</DialogTitle>
        <DialogDescription>{t('tenants.create.description')}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="tenant-create-slug"
          label={t('tenants.field.slug')}
          registration={register('slug')}
          error={errors.slug?.message}
          hint={t('tenants.hint.slug')}
          // The sample values below are formats, not prose: a slug, a Telegram chat id, an https
          // URL, an agent id, a currency code. They read the same in either language.
          placeholder="northern-branch"
          className="font-mono"
        />
        <TextField
          id="tenant-create-display-name"
          label={t('field.displayName')}
          registration={register('displayName')}
          error={errors.displayName?.message}
          placeholder={t('tenants.placeholder.displayName')}
        />
        <TextField
          id="tenant-create-bot-token"
          label={t('tenants.field.botToken')}
          registration={register('botToken')}
          error={errors.botToken?.message}
          type="password"
          autoComplete="off"
          hint={t('tenants.hint.botToken')}
          wide
        />
        <TextField
          id="tenant-create-admin-chat-id"
          label={t('tenants.field.adminChatId')}
          registration={register('adminChatId')}
          error={errors.adminChatId?.message}
          placeholder="-1001234567890"
          className="font-mono"
        />
        <TextField
          id="tenant-create-feed-chat-id"
          label={`${t('tenants.field.feedChatId')} (${t('common.optional')})`}
          registration={register('feedChatId')}
          error={errors.feedChatId?.message}
          placeholder="-1009876543210"
          className="font-mono"
        />
        <TextField
          id="tenant-create-ichancy-base-url"
          label={t('tenants.field.ichancyBaseUrl')}
          registration={register('ichancyBaseUrl')}
          error={errors.ichancyBaseUrl?.message}
          placeholder="https://agent.ichancy.example"
          wide
        />
        <TextField
          id="tenant-create-ichancy-username"
          label={t('tenants.field.ichancyUsername')}
          registration={register('ichancyUsername')}
          error={errors.ichancyUsername?.message}
          autoComplete="off"
        />
        <TextField
          id="tenant-create-ichancy-password"
          label={t('tenants.field.ichancyPassword')}
          registration={register('ichancyPassword')}
          error={errors.ichancyPassword?.message}
          type="password"
          autoComplete="new-password"
        />
        <TextField
          id="tenant-create-ichancy-agent-id"
          label={t('tenants.field.ichancyAgentId')}
          registration={register('ichancyAgentId')}
          error={errors.ichancyAgentId?.message}
          hint={t('tenants.hint.agentId')}
          placeholder="10045"
          className="font-mono"
        />
        <TextField
          id="tenant-create-currency-code"
          label={t('tenants.field.currencyCode')}
          registration={register('currencyCode')}
          error={errors.currencyCode?.message}
          hint={t('tenants.hint.currencyCode')}
          placeholder="NSP"
          className="font-mono uppercase"
        />
        <MinorField
          id="tenant-create-dual-approval"
          label={t('tenants.field.dualApproval')}
          registration={register('dualApprovalThresholdMinor')}
          error={errors.dualApprovalThresholdMinor?.message}
          raw={dualApprovalThresholdMinor}
          currencyCode={currencyCode}
        />
        <MinorField
          id="tenant-create-float-watermark"
          label={t('tenants.field.floatWatermark')}
          registration={register('agentFloatLowWatermarkMinor')}
          error={errors.agentFloatLowWatermarkMinor?.message}
          raw={agentFloatLowWatermarkMinor}
          currencyCode={currencyCode}
        />
        <TextField
          id="tenant-create-deposit-expiry"
          label={t('tenants.field.depositExpiryMinutes')}
          registration={register('depositExpiryMinutes')}
          error={errors.depositExpiryMinutes?.message}
          hint={t('tenants.hint.expiryRange', {
            min: MIN_EXPIRY_MINUTES,
            max: MAX_EXPIRY_MINUTES,
          })}
          inputMode="numeric"
        />
      </div>

      <Alert tone="warning" title={t('tenants.create.suspendedTitle')}>
        {t('tenants.create.suspendedBody')}
      </Alert>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="primary" loading={createTenant.isPending}>
          {t('tenants.create.submit')}
        </Button>
      </DialogFooter>
    </form>
  );
}

function EditTenantForm({
  tenant,
  onSaved,
  onCancel,
}: {
  tenant: Tenant;
  onSaved: (tenant: Tenant) => void;
  onCancel: () => void;
}) {
  const updateTenant = useUpdateTenant();
  const t = useT(tenantMessages);
  const schema = useMemo(() => editSchemaFor(t), [t]);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<EditFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: tenant.displayName,
      adminChatId: tenant.adminChatId,
      feedChatId: tenant.feedChatId ?? '',
      dualApprovalThresholdMinor: tenant.dualApprovalThresholdMinor,
      agentFloatLowWatermarkMinor: tenant.agentFloatLowWatermarkMinor,
      depositExpiryMinutes: String(tenant.depositExpiryMinutes),
    },
  });

  const dualApprovalThresholdMinor = useWatch({ control, name: 'dualApprovalThresholdMinor' });
  const agentFloatLowWatermarkMinor = useWatch({ control, name: 'agentFloatLowWatermarkMinor' });

  const submit = handleSubmit(async (values) => {
    try {
      const updated = await updateTenant.mutateAsync({ id: tenant.id, body: toUpdateBody(values) });
      toast.success(t('tenants.edit.successTitle', { name: updated.displayName }), {
        description: t('tenants.edit.successBody'),
      });
      onSaved(updated);
    } catch (error) {
      toast.error(t('tenants.edit.errorTitle'), { description: errorMessage(error) });
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
        <DialogTitle>{t('tenants.edit.title', { name: tenant.displayName })}</DialogTitle>
        <DialogDescription>{t('tenants.edit.description')}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <ReadOnlyField
          id="tenant-edit-slug"
          label={t('tenants.field.slug')}
          value={tenant.slug}
          reason={t('tenants.immutable.slug')}
        />
        <ReadOnlyField
          id="tenant-edit-currency-code"
          label={t('tenants.field.currencyCode')}
          value={tenant.currencyCode}
          reason={t('tenants.immutable.currencyCode')}
        />
        <TextField
          id="tenant-edit-display-name"
          label={t('field.displayName')}
          registration={register('displayName')}
          error={errors.displayName?.message}
        />
        <TextField
          id="tenant-edit-deposit-expiry"
          label={t('tenants.field.depositExpiryMinutes')}
          registration={register('depositExpiryMinutes')}
          error={errors.depositExpiryMinutes?.message}
          hint={t('tenants.hint.expiryRange', {
            min: MIN_EXPIRY_MINUTES,
            max: MAX_EXPIRY_MINUTES,
          })}
          inputMode="numeric"
        />
        <TextField
          id="tenant-edit-admin-chat-id"
          label={t('tenants.field.adminChatId')}
          registration={register('adminChatId')}
          error={errors.adminChatId?.message}
          className="font-mono"
        />
        <TextField
          id="tenant-edit-feed-chat-id"
          label={`${t('tenants.field.feedChatId')} (${t('common.optional')})`}
          registration={register('feedChatId')}
          error={errors.feedChatId?.message}
          hint={t('tenants.hint.feedChatId')}
          className="font-mono"
        />
        <MinorField
          id="tenant-edit-dual-approval"
          label={t('tenants.field.dualApproval')}
          registration={register('dualApprovalThresholdMinor')}
          error={errors.dualApprovalThresholdMinor?.message}
          raw={dualApprovalThresholdMinor}
          currencyCode={tenant.currencyCode}
        />
        <MinorField
          id="tenant-edit-float-watermark"
          label={t('tenants.field.floatWatermark')}
          registration={register('agentFloatLowWatermarkMinor')}
          error={errors.agentFloatLowWatermarkMinor?.message}
          raw={agentFloatLowWatermarkMinor}
          currencyCode={tenant.currencyCode}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="primary" loading={updateTenant.isPending}>
          {t('tenants.edit.submit')}
        </Button>
      </DialogFooter>
    </form>
  );
}

function TextField({
  id,
  label,
  registration,
  error,
  hint,
  type = 'text',
  placeholder,
  autoComplete,
  inputMode,
  className,
  wide = false,
}: {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  /** Required but nullable: every call site has an error slot, most of them empty most of the time. */
  error: string | undefined;
  hint?: ReactNode;
  type?: 'text' | 'password';
  placeholder?: string;
  autoComplete?: string;
  inputMode?: 'numeric';
  className?: string;
  wide?: boolean;
}) {
  const describedBy = [
    hint === undefined ? null : `${id}-hint`,
    error === undefined ? null : `${id}-error`,
  ]
    .filter((value) => value !== null)
    .join(' ');

  return (
    <div className={wide ? 'space-y-1.5 sm:col-span-2' : 'space-y-1.5'}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        aria-invalid={error !== undefined}
        {...(describedBy === '' ? {} : { 'aria-describedby': describedBy })}
        {...(placeholder === undefined ? {} : { placeholder })}
        {...(autoComplete === undefined ? {} : { autoComplete })}
        {...(inputMode === undefined ? {} : { inputMode })}
        {...(className === undefined ? {} : { className })}
        {...registration}
      />
      {hint === undefined ? null : (
        <p id={`${id}-hint`} className="text-xs text-[var(--muted-foreground)]">
          {hint}
        </p>
      )}
      {error === undefined ? null : (
        <p id={`${id}-error`} role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
    </div>
  );
}

/** A minor-unit amount with its decimal reading underneath, so nobody counts zeroes by eye. */
function MinorField({
  id,
  label,
  registration,
  error,
  raw,
  currencyCode,
}: {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  error: string | undefined;
  raw: string;
  currencyCode: string;
}) {
  const t = useT(tenantMessages);
  const preview = minorPreview(raw, currencyCode);
  return (
    <TextField
      id={id}
      label={label}
      registration={registration}
      error={error}
      hint={
        preview === null
          ? t('tenants.hint.minorUnits')
          : t('tenants.hint.minorPreview', { preview })
      }
      inputMode="numeric"
      className="font-mono"
    />
  );
}

function minorPreview(raw: string, currencyCode: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  try {
    const decimal = groupDecimal(formatMinorToDecimal(minorFromString(trimmed)));
    const currency = currencyCode.trim().toUpperCase();
    return currency === '' ? decimal : `${decimal} ${currency}`;
  } catch {
    // Half-typed input is not an error worth shouting about; the field's own message covers it.
    return null;
  }
}

function ReadOnlyField({
  id,
  label,
  value,
  reason,
}: {
  id: string;
  label: string;
  value: string;
  reason: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        readOnly
        aria-readonly="true"
        aria-describedby={`${id}-reason`}
        className="font-mono text-[var(--muted-foreground)]"
      />
      <p id={`${id}-reason`} className="text-xs text-[var(--muted-foreground)]">
        {reason}
      </p>
    </div>
  );
}

function toCreateBody(values: CreateFormValues): CreateTenantBody {
  const feedChatId = values.feedChatId.trim();
  return {
    slug: values.slug.trim(),
    displayName: values.displayName.trim(),
    botToken: values.botToken.trim(),
    adminChatId: values.adminChatId.trim(),
    ...(feedChatId === '' ? {} : { feedChatId }),
    ichancyBaseUrl: values.ichancyBaseUrl.trim(),
    ichancyUsername: values.ichancyUsername.trim(),
    ichancyPassword: values.ichancyPassword,
    ichancyAgentId: values.ichancyAgentId.trim(),
    currencyCode: values.currencyCode.trim().toUpperCase(),
    dualApprovalThresholdMinor: values.dualApprovalThresholdMinor.trim(),
    agentFloatLowWatermarkMinor: values.agentFloatLowWatermarkMinor.trim(),
    depositExpiryMinutes: Number(values.depositExpiryMinutes),
  };
}

function toUpdateBody(values: EditFormValues): UpdateTenantBody {
  const feedChatId = values.feedChatId.trim();
  return {
    displayName: values.displayName.trim(),
    adminChatId: values.adminChatId.trim(),
    ...(feedChatId === '' ? {} : { feedChatId }),
    dualApprovalThresholdMinor: values.dualApprovalThresholdMinor.trim(),
    agentFloatLowWatermarkMinor: values.agentFloatLowWatermarkMinor.trim(),
    depositExpiryMinutes: Number(values.depositExpiryMinutes),
  };
}
