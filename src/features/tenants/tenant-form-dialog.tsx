import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
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
import { Input, baseField } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateTenant, useUpdateTenant } from '@/lib/api/queries';
import {
  useEnumLabel,
  useT,
  type Translator,
  type TranslatorKey,
} from '@/lib/i18n/use-translation';
import { formatMinorToDecimal, groupDecimal, minorFromString } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { CreateTenantBody, Tenant, TenantCreated, UpdateTenantBody } from '@/types';
import { tenantDepositMode, tenantWithdrawalMode } from '@/types/tenant';
import {
  DEPOSIT_MODES,
  WITHDRAWAL_MODES,
  depositModeSchema,
  withdrawalModeSchema,
} from '@/types/enums';

import { useChatRejectionSentence } from './chat-rejection';
import { tenantMessages } from './messages';

/**
 * Create and edit, in one dialog because they are the same object seen twice — but deliberately not
 * the same form. Creating asks for three secrets and two values that can never be changed again;
 * editing must not even appear to offer those.
 *
 * ── FOUR FIELDS, AND A DISCLOSURE FOR THE REST ────────────────────────────────────────────────
 * `POST /v1/admin/tenants` requires a display name, a bot token and the Ichancy login. Every other
 * value has a server-side default — the slug from the display name, the rest from the platform
 * settings row — or is legitimately empty: the staff and feed groups, which are bound from the
 * operator's page after it exists (owner decision, 2026-09-15). So the form asks for four things and
 * puts the rest behind "Advanced", each labelled with what it gets when left blank.
 *
 * An omitted optional field is ABSENT from the request body, never `""` and never `null`: an empty
 * string is a value, and a backend that stores it has silently overwritten the default it was
 * supposed to resolve. `toCreateBody` is the single place that decides this, and it spreads a field
 * in only when it holds something.
 *
 * Every number here stays a string all the way to the wire. Chat ids are 64-bit Telegram ids and
 * the thresholds are minor units, both of which lose their last digits as JavaScript numbers. The
 * one `Number()` in this file is the deposit expiry, which is genuinely a small integer.
 *
 * The schemas are built from `t` at render, not declared once at module load. A zod message frozen
 * at import time is whatever language the module was first evaluated in, which is English forever —
 * and a validation message is exactly the sentence an operator needs in their own language.
 *
 * ── THE BOT SETTINGS, AND WHAT "EMPTY" MEANS ON EACH FORM ─────────────────────────────────────
 * `depositMode`, `withdrawalMode` and `miniAppUrl` are the same settings the bot-config screen
 * edits from inside the operator, seen from the platform side. On CREATE all follow the rule
 * above: blank is absent, and the server's default (manual, no URL) applies. On EDIT the rule has
 * to bend for the URL,
 * because "absent" and "cleared" are different requests to a PATCH: a URL the operator emptied goes
 * out as `miniAppUrl: null` — the API's spelling of "remove it" — but ONLY when the row held one;
 * an operator that never had a URL and still has none sends nothing. The mode is a select with no
 * blank on the edit form, so it is sent when it differs from what the row holds and omitted
 * otherwise — a backend older than the setting is never sent a key it does not know for a value
 * that did not change.
 */

const SLUG_RE = /^[a-z][a-z0-9-]{1,30}[a-z0-9]$/;
const BOT_TOKEN_RE = /^\d{6,}:[A-Za-z0-9_-]{30,}$/;
const CHAT_ID_RE = /^-?\d+$/;
const DIGITS_RE = /^\d+$/;
const CURRENCY_RE = /^[A-Za-z]{3}$/;
const HTTPS_RE = /^https:\/\/\S+$/;

const MIN_EXPIRY_MINUTES = 5;
const MAX_EXPIRY_MINUTES = 1440;
/** The API caps the display name at 120 characters, so the form says so before the API has to. */
const MAX_DISPLAY_NAME = 120;

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

/**
 * An optional field on the create form: blank is not a failure, it is the request to let the server
 * decide. Anything actually typed is held to the same shape the required version would be.
 */
const optionalFieldFor = (pattern: RegExp, message: string) =>
  z.string().refine((value) => value.trim() === '' || pattern.test(value.trim()), message);

const optionalChatIdFieldFor = (t: TenantTranslator) =>
  optionalFieldFor(CHAT_ID_RE, t('tenants.validation.chatId'));

/** Blank, or whole minutes inside the range — reported as two different sentences. */
const optionalExpiryFieldFor = (t: TenantTranslator) =>
  optionalFieldFor(DIGITS_RE, t('tenants.validation.wholeMinutes')).refine(
    (value) => {
      const trimmed = value.trim();
      if (trimmed === '' || !DIGITS_RE.test(trimmed)) return true;
      const minutes = Number(trimmed);
      return minutes >= MIN_EXPIRY_MINUTES && minutes <= MAX_EXPIRY_MINUTES;
    },
    t('tenants.validation.expiryRange', { min: MIN_EXPIRY_MINUTES, max: MAX_EXPIRY_MINUTES }),
  );

const createSchemaFor = (t: TenantTranslator) =>
  z.object({
    // The four the API cannot supply for you.
    displayName: z
      .string()
      .trim()
      .min(1, t('tenants.validation.displayName'))
      .max(MAX_DISPLAY_NAME, t('tenants.validation.displayNameLong')),
    botToken: z.string().regex(BOT_TOKEN_RE, t('tenants.validation.botToken')),
    ichancyUsername: z.string().trim().min(1, t('tenants.validation.required')),
    ichancyPassword: z.string().min(1, t('tenants.validation.required')),
    // Advanced: every one of these is omitted from the body when blank.
    slug: optionalFieldFor(SLUG_RE, t('tenants.validation.slug')),
    adminChatId: optionalChatIdFieldFor(t),
    feedChatId: optionalChatIdFieldFor(t),
    ichancyBaseUrl: optionalFieldFor(HTTPS_RE, t('tenants.validation.httpsUrl')),
    ichancyAgentId: optionalFieldFor(DIGITS_RE, t('tenants.validation.agentId')),
    currencyCode: optionalFieldFor(CURRENCY_RE, t('tenants.validation.currencyCode')),
    dualApprovalThresholdMinor: optionalFieldFor(DIGITS_RE, t('tenants.validation.minorUnits')),
    agentFloatLowWatermarkMinor: optionalFieldFor(DIGITS_RE, t('tenants.validation.minorUnits')),
    depositExpiryMinutes: optionalExpiryFieldFor(t),
    depositMode: z.enum(['', ...DEPOSIT_MODES]),
    withdrawalMode: z.enum(['', ...WITHDRAWAL_MODES]),
    miniAppUrl: optionalFieldFor(HTTPS_RE, t('tenants.validation.httpsUrl')),
  });
type CreateFormValues = z.infer<ReturnType<typeof createSchemaFor>>;

/**
 * The fields behind the disclosure. A validation message inside a collapsed section is a form that
 * refuses to submit and says nothing, so submitting with an error in here opens it.
 */
const ADVANCED_FIELDS = [
  'slug',
  'adminChatId',
  'feedChatId',
  'ichancyBaseUrl',
  'ichancyAgentId',
  'currencyCode',
  'dualApprovalThresholdMinor',
  'agentFloatLowWatermarkMinor',
  'depositExpiryMinutes',
  'depositMode',
  'withdrawalMode',
  'miniAppUrl',
] as const satisfies readonly (keyof CreateFormValues)[];

const editSchemaFor = (t: TenantTranslator) =>
  z.object({
    displayName: z.string().trim().min(1, t('tenants.validation.displayName')),
    // Optional since an operator may have no staff group: blank keeps what is stored (PATCH cannot
    // unset a group; the checklist removes one), and a typed id is a bind the server verifies.
    adminChatId: optionalChatIdFieldFor(t),
    feedChatId: optionalChatIdFieldFor(t),
    dualApprovalThresholdMinor: minorFieldFor(t),
    agentFloatLowWatermarkMinor: minorFieldFor(t),
    depositExpiryMinutes: expiryFieldFor(t),
    depositMode: depositModeSchema,
    withdrawalMode: withdrawalModeSchema,
    miniAppUrl: optionalFieldFor(HTTPS_RE, t('tenants.validation.httpsUrl')),
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
  /** A create hands back the provisioning report too; an edit answers the bare row. */
  onSaved: (tenant: TenantCreated) => void;
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
  onSaved: (tenant: TenantCreated) => void;
  onCancel: () => void;
}) {
  const createTenant = useCreateTenant();
  const t = useT(tenantMessages);
  const rejectionSentence = useChatRejectionSentence();
  const schema = useMemo(() => createSchemaFor(t), [t]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(schema),
    // Every optional field starts empty, and empty is what keeps it out of the request entirely.
    defaultValues: {
      displayName: '',
      botToken: '',
      ichancyUsername: '',
      ichancyPassword: '',
      slug: '',
      adminChatId: '',
      feedChatId: '',
      ichancyBaseUrl: '',
      ichancyAgentId: '',
      currencyCode: '',
      dualApprovalThresholdMinor: '',
      agentFloatLowWatermarkMinor: '',
      depositExpiryMinutes: '',
      depositMode: '',
      withdrawalMode: '',
      miniAppUrl: '',
    },
  });

  const currencyCode = useWatch({ control, name: 'currencyCode' });
  const dualApprovalThresholdMinor = useWatch({ control, name: 'dualApprovalThresholdMinor' });
  const agentFloatLowWatermarkMinor = useWatch({ control, name: 'agentFloatLowWatermarkMinor' });

  const submit = handleSubmit(
    async (values) => {
      try {
        const created = await createTenant.mutateAsync(toCreateBody(values));
        // Clears the bot token and the Ichancy password before anything can re-render holding them.
        reset();
        setShowAdvanced(false);
        toast.success(t('tenants.create.successTitle', { name: created.displayName }), {
          description: t('tenants.create.successBody'),
        });
        onSaved(created);
      } catch (error) {
        toast.error(t('tenants.create.errorTitle'), { description: rejectionSentence(error) });
      }
    },
    (fieldErrors) => {
      // Somebody typed into an advanced field and closed the section: show them what it says.
      if (ADVANCED_FIELDS.some((name) => fieldErrors[name] !== undefined)) setShowAdvanced(true);
    },
  );

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

      <section aria-labelledby="tenant-create-required-heading" className="space-y-3">
        <div className="space-y-1">
          <h3 id="tenant-create-required-heading" className="text-sm font-semibold">
            {t('tenants.create.required')}
          </h3>
          <p className="text-xs text-[var(--muted-foreground)]">
            {t('tenants.create.requiredHint')}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="tenant-create-display-name"
            label={t('field.displayName')}
            registration={register('displayName')}
            error={errors.displayName?.message}
            placeholder={t('tenants.placeholder.displayName')}
            wide
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
        </div>
      </section>

      <section className="space-y-3">
        <Button
          type="button"
          variant={showAdvanced ? 'secondary' : 'ghost'}
          size="sm"
          aria-expanded={showAdvanced}
          // Only while the section exists: aria-controls pointing at nothing is worse than absent.
          {...(showAdvanced ? { 'aria-controls': 'tenant-create-advanced' } : {})}
          onClick={() => {
            setShowAdvanced(!showAdvanced);
          }}
        >
          {/* Collapsed, the chevron points the way the language reads: right in English, left in Arabic. */}
          <ChevronDown className={showAdvanced ? 'size-4' : 'size-4 -rotate-90 rtl:rotate-90'} />
          {t('tenants.create.advanced')}
        </Button>

        {showAdvanced ? (
          <div id="tenant-create-advanced" className="space-y-3">
            <p className="text-xs text-[var(--muted-foreground)]">
              {t('tenants.create.advancedHint')}
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="tenant-create-slug"
                label={t('tenants.field.slug')}
                registration={register('slug')}
                error={errors.slug?.message}
                hint={t('tenants.default.slug')}
                // The sample values below are formats, not prose: a slug, a Telegram chat id, an
                // https URL, an agent id, a currency code. They read the same in either language.
                placeholder="northern-branch"
                className="font-mono"
              />
              <TextField
                id="tenant-create-admin-chat-id"
                label={t('tenants.field.adminChatId')}
                registration={register('adminChatId')}
                error={errors.adminChatId?.message}
                hint={t('tenants.default.adminChatId')}
                placeholder="-1001234567890"
                className="font-mono"
              />
              <TextField
                id="tenant-create-feed-chat-id"
                label={`${t('tenants.field.feedChatId')} (${t('common.optional')})`}
                registration={register('feedChatId')}
                error={errors.feedChatId?.message}
                hint={t('tenants.default.feedChatId')}
                placeholder="-1009876543210"
                className="font-mono"
              />
              <TextField
                id="tenant-create-ichancy-base-url"
                label={t('tenants.field.ichancyBaseUrl')}
                registration={register('ichancyBaseUrl')}
                error={errors.ichancyBaseUrl?.message}
                hint={t('tenants.default.ichancyBaseUrl')}
                placeholder="https://agent.ichancy.example"
                wide
              />
              <TextField
                id="tenant-create-ichancy-agent-id"
                label={t('tenants.field.ichancyAgentId')}
                registration={register('ichancyAgentId')}
                error={errors.ichancyAgentId?.message}
                hint={t('tenants.default.ichancyAgentId')}
                placeholder="10045"
                className="font-mono"
                wide
              />
              <TextField
                id="tenant-create-currency-code"
                label={t('tenants.field.currencyCode')}
                registration={register('currencyCode')}
                error={errors.currencyCode?.message}
                hint={t('tenants.default.currencyCode')}
                placeholder="NSP"
                className="font-mono uppercase"
              />
              <TextField
                id="tenant-create-deposit-expiry"
                label={t('tenants.field.depositExpiryMinutes')}
                registration={register('depositExpiryMinutes')}
                error={errors.depositExpiryMinutes?.message}
                hint={t('tenants.default.depositExpiryMinutes', {
                  min: MIN_EXPIRY_MINUTES,
                  max: MAX_EXPIRY_MINUTES,
                })}
                inputMode="numeric"
              />
              <MinorField
                id="tenant-create-dual-approval"
                label={t('tenants.field.dualApproval')}
                registration={register('dualApprovalThresholdMinor')}
                error={errors.dualApprovalThresholdMinor?.message}
                raw={dualApprovalThresholdMinor}
                currencyCode={currencyCode}
                blankHint={t('tenants.default.dualApproval')}
              />
              <MinorField
                id="tenant-create-float-watermark"
                label={t('tenants.field.floatWatermark')}
                registration={register('agentFloatLowWatermarkMinor')}
                error={errors.agentFloatLowWatermarkMinor?.message}
                raw={agentFloatLowWatermarkMinor}
                currencyCode={currencyCode}
                blankHint={t('tenants.default.floatWatermark')}
              />
              <DepositModeField
                id="tenant-create-deposit-mode"
                registration={register('depositMode')}
                error={errors.depositMode?.message}
                hint={t('tenants.default.depositMode')}
                allowUnset
              />
              <WithdrawalModeField
                id="tenant-create-withdrawal-mode"
                registration={register('withdrawalMode')}
                error={errors.withdrawalMode?.message}
                hint={t('tenants.default.withdrawalMode')}
                allowUnset
              />
              <TextField
                id="tenant-create-mini-app-url"
                label={`${t('tenants.field.miniAppUrl')} (${t('common.optional')})`}
                registration={register('miniAppUrl')}
                error={errors.miniAppUrl?.message}
                hint={`${t('tenants.hint.miniAppUrl')} ${t('tenants.default.miniAppUrl')}`}
                placeholder="https://cashier.example.app"
                className="font-mono"
              />
            </div>
          </div>
        ) : null}
      </section>

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
  const rejectionSentence = useChatRejectionSentence();
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
      adminChatId: tenant.adminChatId ?? '',
      feedChatId: tenant.feedChatId ?? '',
      dualApprovalThresholdMinor: tenant.dualApprovalThresholdMinor,
      agentFloatLowWatermarkMinor: tenant.agentFloatLowWatermarkMinor,
      depositExpiryMinutes: String(tenant.depositExpiryMinutes),
      depositMode: tenantDepositMode(tenant),
      withdrawalMode: tenantWithdrawalMode(tenant),
      miniAppUrl: tenant.miniAppUrl ?? '',
    },
  });

  const dualApprovalThresholdMinor = useWatch({ control, name: 'dualApprovalThresholdMinor' });
  const agentFloatLowWatermarkMinor = useWatch({ control, name: 'agentFloatLowWatermarkMinor' });

  const submit = handleSubmit(async (values) => {
    try {
      const updated = await updateTenant.mutateAsync({
        id: tenant.id,
        body: toUpdateBody(values, tenant),
      });
      toast.success(t('tenants.edit.successTitle', { name: updated.displayName }), {
        description: t('tenants.edit.successBody'),
      });
      onSaved(updated);
    } catch (error) {
      toast.error(t('tenants.edit.errorTitle'), { description: rejectionSentence(error) });
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
          hint={t('tenants.hint.adminChatId')}
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
        <DepositModeField
          id="tenant-edit-deposit-mode"
          registration={register('depositMode')}
          error={errors.depositMode?.message}
          hint={t('tenants.hint.depositMode')}
        />
        <WithdrawalModeField
          id="tenant-edit-withdrawal-mode"
          registration={register('withdrawalMode')}
          error={errors.withdrawalMode?.message}
          hint={t('tenants.hint.withdrawalMode')}
        />
        <TextField
          id="tenant-edit-mini-app-url"
          label={`${t('tenants.field.miniAppUrl')} (${t('common.optional')})`}
          registration={register('miniAppUrl')}
          error={errors.miniAppUrl?.message}
          hint={`${t('tenants.hint.miniAppUrl')} ${t('tenants.hint.miniAppUrlClear')}`}
          placeholder="https://cashier.example.app"
          className="font-mono"
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

/**
 * How the operator's bot answers a deposit or a cash-out, as a native select: two options and a
 * blank one on the create form, where blank means "let the server decide" exactly as every other
 * optional field there does. Native rather than the Radix picker because a form of eleven text
 * inputs does not need a listbox for two values, and a native control is what the keyboard and the
 * screen reader already know. Shared between the deposit and withdrawal fields below them — the
 * two differ only in which enum they read and which two message keys they show.
 */
type TenantMessageKey = TranslatorKey<typeof tenantMessages.en>;

function ModeField({
  id,
  values,
  enumGroup,
  labelKey,
  unsetKey,
  registration,
  error,
  hint,
  allowUnset = false,
}: {
  id: string;
  values: readonly ('AUTO' | 'MANUAL')[];
  enumGroup: 'depositMode' | 'withdrawalMode';
  labelKey: TenantMessageKey;
  unsetKey: TenantMessageKey;
  registration: UseFormRegisterReturn;
  error: string | undefined;
  hint: string;
  allowUnset?: boolean;
}) {
  const t = useT(tenantMessages);
  const enumLabel = useEnumLabel();

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{t(labelKey)}</Label>
      <select
        id={id}
        aria-invalid={error !== undefined}
        aria-describedby={`${id}-hint`}
        className={cn(baseField, 'appearance-auto')}
        {...registration}
      >
        {allowUnset ? <option value="">{t(unsetKey)}</option> : null}
        {values.map((mode) => (
          <option key={mode} value={mode}>
            {enumLabel(enumGroup, mode)}
          </option>
        ))}
      </select>
      <p id={`${id}-hint`} className="text-xs text-[var(--muted-foreground)]">
        {hint}
      </p>
      {error === undefined ? null : (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
    </div>
  );
}

function DepositModeField(props: {
  id: string;
  registration: UseFormRegisterReturn;
  error: string | undefined;
  hint: string;
  allowUnset?: boolean;
}) {
  return (
    <ModeField
      {...props}
      values={DEPOSIT_MODES}
      enumGroup="depositMode"
      labelKey="tenants.field.depositMode"
      unsetKey="tenants.depositMode.unset"
    />
  );
}

function WithdrawalModeField(props: {
  id: string;
  registration: UseFormRegisterReturn;
  error: string | undefined;
  hint: string;
  allowUnset?: boolean;
}) {
  return (
    <ModeField
      {...props}
      values={WITHDRAWAL_MODES}
      enumGroup="withdrawalMode"
      labelKey="tenants.field.withdrawalMode"
      unsetKey="tenants.withdrawalMode.unset"
    />
  );
}

/**
 * A minor-unit amount with its decimal reading underneath, so nobody counts zeroes by eye.
 *
 * `blankHint` is what an empty field says on the create form: that field is optional there and the
 * platform default is the thing worth knowing while it is empty. The reading takes over the moment
 * there is something to read.
 */
function MinorField({
  id,
  label,
  registration,
  error,
  raw,
  currencyCode,
  blankHint,
}: {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  error: string | undefined;
  raw: string;
  currencyCode: string;
  blankHint?: string;
}) {
  const t = useT(tenantMessages);
  const preview = minorPreview(raw, currencyCode);

  const hint = (): string => {
    if (preview !== null) return t('tenants.hint.minorPreview', { preview });
    if (blankHint !== undefined && raw.trim() === '') return blankHint;
    return t('tenants.hint.minorUnits');
  };

  return (
    <TextField
      id={id}
      label={label}
      registration={registration}
      error={error}
      hint={hint()}
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

/**
 * The four required fields, plus only those optional ones that were actually filled in.
 *
 * A blank field is spread in as `{}`, so the key never appears in the JSON at all. That is the
 * whole contract: the server resolves a MISSING field from the platform defaults, and would store
 * an empty string as a value — a tenant with no currency rather than the platform's.
 */
function toCreateBody(values: CreateFormValues): CreateTenantBody {
  const slug = values.slug.trim();
  const adminChatId = values.adminChatId.trim();
  const feedChatId = values.feedChatId.trim();
  const ichancyBaseUrl = values.ichancyBaseUrl.trim();
  const ichancyAgentId = values.ichancyAgentId.trim();
  const currencyCode = values.currencyCode.trim().toUpperCase();
  const dualApprovalThresholdMinor = values.dualApprovalThresholdMinor.trim();
  const agentFloatLowWatermarkMinor = values.agentFloatLowWatermarkMinor.trim();
  const depositExpiryMinutes = values.depositExpiryMinutes.trim();
  const miniAppUrl = values.miniAppUrl.trim();

  return {
    displayName: values.displayName.trim(),
    botToken: values.botToken.trim(),
    ichancyUsername: values.ichancyUsername.trim(),
    ichancyPassword: values.ichancyPassword,
    ...(slug === '' ? {} : { slug }),
    ...(adminChatId === '' ? {} : { adminChatId }),
    ...(feedChatId === '' ? {} : { feedChatId }),
    ...(ichancyBaseUrl === '' ? {} : { ichancyBaseUrl }),
    ...(ichancyAgentId === '' ? {} : { ichancyAgentId }),
    ...(currencyCode === '' ? {} : { currencyCode }),
    ...(dualApprovalThresholdMinor === '' ? {} : { dualApprovalThresholdMinor }),
    ...(agentFloatLowWatermarkMinor === '' ? {} : { agentFloatLowWatermarkMinor }),
    // The only Number() on this form: minutes are a small integer, unlike every other value here.
    ...(depositExpiryMinutes === '' ? {} : { depositExpiryMinutes: Number(depositExpiryMinutes) }),
    // Blank is the server's default — manual, and no URL — like every other optional field here.
    ...(values.depositMode === '' ? {} : { depositMode: values.depositMode }),
    ...(values.withdrawalMode === '' ? {} : { withdrawalMode: values.withdrawalMode }),
    ...(miniAppUrl === '' ? {} : { miniAppUrl }),
  };
}

/**
 * The changeable fields, plus the three bot settings under the rule described at the top of the
 * file: a URL the operator emptied is sent as `null` only when the row held one, and each mode is
 * sent only when it differs from what the row holds.
 */
function toUpdateBody(values: EditFormValues, tenant: Tenant): UpdateTenantBody {
  const adminChatId = values.adminChatId.trim();
  const feedChatId = values.feedChatId.trim();
  const miniAppUrl = values.miniAppUrl.trim();
  const hadMiniAppUrl = (tenant.miniAppUrl ?? null) !== null;
  return {
    displayName: values.displayName.trim(),
    // Blank is "leave the group alone": an operator with no staff group sends nothing, and PATCH has
    // no spelling for removing one. An unchanged id goes back as before and verifies nothing.
    ...(adminChatId === '' ? {} : { adminChatId }),
    ...(feedChatId === '' ? {} : { feedChatId }),
    dualApprovalThresholdMinor: values.dualApprovalThresholdMinor.trim(),
    agentFloatLowWatermarkMinor: values.agentFloatLowWatermarkMinor.trim(),
    depositExpiryMinutes: Number(values.depositExpiryMinutes),
    ...(values.depositMode === tenantDepositMode(tenant)
      ? {}
      : { depositMode: values.depositMode }),
    ...(values.withdrawalMode === tenantWithdrawalMode(tenant)
      ? {}
      : { withdrawalMode: values.withdrawalMode }),
    ...(miniAppUrl !== '' ? { miniAppUrl } : hadMiniAppUrl ? { miniAppUrl: null } : {}),
  };
}
