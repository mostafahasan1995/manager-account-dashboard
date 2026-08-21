import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/ui';
import { errorMessage } from '@/lib/api/errors';
import { useCreatePaymentMethod, useUpdatePaymentMethod } from '@/lib/api/queries';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import { MONEY_STRING_REGEX, parseDecimalToMinor } from '@/lib/money';
import type { CreatePaymentMethodBody, PaymentMethod, UpdatePaymentMethodBody } from '@/types';
import {
  PAYMENT_RAILS,
  VERIFICATION_MODES,
  paymentRailSchema,
  verificationModeSchema,
} from '@/types/enums';

import { Field, ReadOnlyField, ToggleField } from './form-field';
import { railMessages, type RailTranslator } from './messages';
import { isRoundTrippableAmount, normaliseAmount } from './rail-money';

/**
 * Create and edit a payment method.
 *
 * Every amount stays the string the operator typed all the way into the request body: the schema
 * validates it, `normaliseAmount` rounds it to the backend's scale exactly once on submit, and no
 * step in between turns it into a `number`. The min/max rule lives in the schema rather than in the
 * submit handler so it reports itself on the field that is wrong, beside the value that is wrong.
 *
 * The schema is BUILT AT RENDER from the translator rather than declared at module load, because a
 * message frozen at import time is frozen in whichever language the bundle happened to load in.
 *
 * `code`, `rail` and `currencyCode` are immutable on the backend and are shown locked rather than
 * dropped when editing — see `ReadOnlyField` for why.
 */

const METHOD_CODE_REGEX = /^[A-Z][A-Z0-9_]{1,47}$/;

function methodSchema(t: RailTranslator) {
  const amountField = z
    .string()
    .trim()
    .min(1, t('rails.validation.required'))
    .regex(MONEY_STRING_REGEX, t('rails.validation.amountFormat'))
    .refine((value) => !value.startsWith('-'), t('rails.validation.amountNegative'))
    .refine(isRoundTrippableAmount, t('rails.validation.amountScale'));

  const wholeNumberField = (max: number) =>
    z
      .string()
      .trim()
      .regex(/^\d{1,6}$/, t('rails.validation.wholeNumber'))
      .refine((value) => Number(value) <= max, t('rails.validation.atMost', { max }));

  return z
    .object({
      code: z.string().trim().regex(METHOD_CODE_REGEX, t('rails.validation.code')),
      displayName: z
        .string()
        .trim()
        .min(1, t('rails.validation.displayName'))
        .max(120, t('rails.validation.tooLong')),
      rail: paymentRailSchema,
      currencyCode: z
        .string()
        .trim()
        .regex(/^[A-Z]{3}$/, t('rails.validation.currency')),
      verificationMode: verificationModeSchema,
      minAmount: amountField,
      maxAmount: amountField,
      feeFixed: amountField,
      feeBps: wholeNumberField(10_000),
      requiresReference: z.boolean(),
      referencePattern: z.string().trim().max(200, t('rails.validation.tooLong')),
      instructions: z.string().trim().max(2_000, t('rails.validation.tooLong')),
      isActive: z.boolean(),
      sortOrder: wholeNumberField(9_999),
    })
    .superRefine((values, ctx) => {
      if (!isRoundTrippableAmount(values.minAmount) || !isRoundTrippableAmount(values.maxAmount)) {
        return;
      }
      if (parseDecimalToMinor(values.minAmount) <= parseDecimalToMinor(values.maxAmount)) return;
      ctx.addIssue({
        code: 'custom',
        path: ['maxAmount'],
        message: t('rails.validation.maxBelowMin'),
      });
    });
}

type MethodFormValues = z.infer<ReturnType<typeof methodSchema>>;

const CREATE_DEFAULTS: MethodFormValues = {
  code: '',
  displayName: '',
  rail: 'BANK_TRANSFER',
  currencyCode: '',
  verificationMode: 'MANUAL_PROOF',
  minAmount: '',
  maxAmount: '',
  feeFixed: '0.00',
  feeBps: '0',
  requiresReference: false,
  referencePattern: '',
  instructions: '',
  isActive: true,
  sortOrder: '1',
};

function toFormValues(method: PaymentMethod | null): MethodFormValues {
  if (method === null) return CREATE_DEFAULTS;
  return {
    code: method.code,
    displayName: method.displayName,
    rail: method.rail,
    currencyCode: method.currencyCode,
    verificationMode: method.verificationMode,
    minAmount: method.minAmount,
    maxAmount: method.maxAmount,
    feeFixed: method.feeFixed,
    feeBps: String(method.feeBps),
    requiresReference: method.requiresReference,
    referencePattern: method.referencePattern ?? '',
    instructions: method.instructions ?? '',
    isActive: method.isActive,
    sortOrder: String(method.sortOrder),
  };
}

export function MethodFormDialog({
  open,
  onOpenChange,
  method,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` opens the create form; a method opens the edit form with the immutable fields locked. */
  method: PaymentMethod | null;
  onSaved?: ((saved: PaymentMethod) => void) | undefined;
}) {
  const t = useT(railMessages);
  const enumLabel = useEnumLabel();
  const createMethod = useCreatePaymentMethod();
  const updateMethod = useUpdatePaymentMethod();

  const schema = useMemo(() => methodSchema(t), [t]);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MethodFormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(method),
  });

  // Reopening for a different method must not show the previous one's half-typed values.
  useEffect(() => {
    if (open) reset(toFormValues(method));
  }, [open, method, reset]);

  const submit = handleSubmit(async (values) => {
    const shared = {
      displayName: values.displayName,
      verificationMode: values.verificationMode,
      minAmount: normaliseAmount(values.minAmount),
      maxAmount: normaliseAmount(values.maxAmount),
      feeFixed: normaliseAmount(values.feeFixed),
      feeBps: Number(values.feeBps),
      requiresReference: values.requiresReference,
      referencePattern: values.referencePattern,
      instructions: values.instructions,
      isActive: values.isActive,
      sortOrder: Number(values.sortOrder),
    } satisfies UpdatePaymentMethodBody;

    try {
      const saved =
        method === null
          ? await createMethod.mutateAsync({
              ...shared,
              code: values.code,
              rail: values.rail,
              currencyCode: values.currencyCode,
            } satisfies CreatePaymentMethodBody)
          : await updateMethod.mutateAsync({ id: method.id, body: shared });

      toast.success(
        method === null
          ? t('rails.method.created', { name: saved.displayName })
          : t('rails.method.saved', { name: saved.displayName }),
        {
          description:
            method === null ? t('rails.method.createdBody') : t('rails.method.savedBody'),
        },
      );
      onOpenChange(false);
      onSaved?.(saved);
    } catch (caught) {
      // Both, deliberately: the toast outlives the dialog, the alert is where the eyes already are.
      setError('root', { message: errorMessage(caught) });
      toast.error(
        method === null ? t('rails.method.createFailed') : t('rails.method.saveFailed'),
        { description: errorMessage(caught) },
      );
    }
  });

  const verificationMode = useWatch({ control, name: 'verificationMode' });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {method === null
              ? t('rails.method.newTitle')
              : t('rails.method.editTitle', { name: method.displayName })}
          </DialogTitle>
          <DialogDescription>
            {method === null ? t('rails.method.createHint') : t('rails.method.editHint')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
          {errors.root === undefined ? null : (
            <Alert tone="danger" title={t('rails.form.saveFailedTitle')}>
              {errors.root.message}
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {method === null ? (
              <Field
                id="method-code"
                label={t('rails.field.code')}
                error={errors.code?.message}
                hint={t('rails.form.codeHint')}
              >
                {(a11y) => (
                  <Input
                    {...a11y}
                    {...register('code')}
                    placeholder="BANK_SYR"
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono"
                  />
                )}
              </Field>
            ) : (
              <ReadOnlyField
                label={t('rails.field.code')}
                value={method.code}
                mono
                reason={t('rails.form.codeLocked')}
              />
            )}

            <Field
              id="method-name"
              label={t('field.displayName')}
              error={errors.displayName?.message}
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  {...register('displayName')}
                  placeholder={t('rails.form.namePlaceholder')}
                />
              )}
            </Field>

            {method === null ? (
              <Field id="method-rail" label={t('rails.field.rail')} error={errors.rail?.message}>
                {(a11y) => (
                  <Controller
                    control={control}
                    name="rail"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger {...a11y}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_RAILS.map((rail) => (
                            <SelectItem key={rail} value={rail}>
                              {enumLabel('paymentRail', rail)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
              </Field>
            ) : (
              <ReadOnlyField
                label={t('rails.field.rail')}
                value={enumLabel('paymentRail', method.rail)}
                reason={t('rails.form.railLocked')}
              />
            )}

            {method === null ? (
              <Field
                id="method-currency"
                label={t('field.currency')}
                error={errors.currencyCode?.message}
                hint={t('rails.form.currencyHint')}
              >
                {(a11y) => (
                  <Input
                    {...a11y}
                    {...register('currencyCode')}
                    placeholder="NSP"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={3}
                    className="font-mono uppercase"
                  />
                )}
              </Field>
            ) : (
              <ReadOnlyField
                label={t('field.currency')}
                value={method.currencyCode}
                mono
                reason={t('rails.form.currencyLocked')}
              />
            )}

            <Field
              id="method-verification"
              label={t('rails.field.verification')}
              error={errors.verificationMode?.message}
              hint={t(`rails.verification.${verificationMode}`)}
            >
              {(a11y) => (
                <Controller
                  control={control}
                  name="verificationMode"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger {...a11y}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VERIFICATION_MODES.map((mode) => (
                          <SelectItem key={mode} value={mode}>
                            {enumLabel('verificationMode', mode)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </Field>

            <Field
              id="method-min"
              label={t('rails.field.minAmount')}
              error={errors.minAmount?.message}
              hint={t('rails.form.minHint')}
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  {...register('minAmount')}
                  inputMode="decimal"
                  placeholder="50000.00"
                  className="tabular"
                />
              )}
            </Field>

            <Field
              id="method-max"
              label={t('rails.field.maxAmount')}
              error={errors.maxAmount?.message}
              hint={t('rails.form.maxHint')}
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  {...register('maxAmount')}
                  inputMode="decimal"
                  placeholder="5000000.00"
                  className="tabular"
                />
              )}
            </Field>

            <Field
              id="method-fee-fixed"
              label={t('rails.field.feeFixed')}
              error={errors.feeFixed?.message}
              hint={t('rails.form.feeFixedHint')}
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  {...register('feeFixed')}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="tabular"
                />
              )}
            </Field>

            <Field
              id="method-fee-bps"
              label={t('rails.field.feeBps')}
              error={errors.feeBps?.message}
              hint={t('rails.form.feeBpsHint')}
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  {...register('feeBps')}
                  inputMode="numeric"
                  placeholder="0"
                  className="tabular"
                />
              )}
            </Field>

            <Field
              id="method-sort"
              label={t('rails.field.sortOrder')}
              error={errors.sortOrder?.message}
              hint={t('rails.form.sortOrderHint')}
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  {...register('sortOrder')}
                  inputMode="numeric"
                  placeholder="1"
                  className="tabular"
                />
              )}
            </Field>

            <Field
              id="method-reference-pattern"
              label={t('rails.field.referencePattern')}
              error={errors.referencePattern?.message}
              hint={t('rails.form.referencePatternHint')}
              className="sm:col-span-2"
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  {...register('referencePattern')}
                  placeholder="^[0-9]{6,20}$"
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono"
                />
              )}
            </Field>

            <Field
              id="method-instructions"
              label={t('rails.field.instructions')}
              error={errors.instructions?.message}
              hint={t('rails.form.instructionsHint')}
              className="sm:col-span-2"
            >
              {(a11y) => (
                <Textarea
                  {...a11y}
                  {...register('instructions')}
                  placeholder={t('rails.form.instructionsPlaceholder')}
                />
              )}
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Controller
              control={control}
              name="requiresReference"
              render={({ field }) => (
                <ToggleField
                  id="method-requires-reference"
                  label={t('rails.field.requiresReference')}
                  description={t('rails.form.requiresReferenceHint')}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <ToggleField
                  id="method-active"
                  label={t('field.active')}
                  description={t('rails.form.methodActiveHint')}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
              }}
              disabled={isSubmitting}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>
              {method === null ? t('rails.method.create') : t('rails.form.saveChanges')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
