import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
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
  Textarea,
} from '@/components/ui';
import { errorMessage } from '@/lib/api/errors';
import { useCreateDestination, useUpdateDestination } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import { MONEY_STRING_REGEX } from '@/lib/money';
import type {
  CreatePaymentDestinationBody,
  PaymentDestination,
  PaymentMethod,
  UpdatePaymentDestinationBody,
} from '@/types';

import { Field, ReadOnlyField, ToggleField } from './form-field';
import { railMessages, type RailTranslator } from './messages';
import { isRoundTrippableAmount, normaliseAmount } from './rail-money';

/**
 * Create and edit a destination — the account a player is actually told to send money to.
 *
 * This is the most dangerous form in the console: a transposed digit here does not fail loudly, it
 * quietly sends real deposits to somebody else. So the identifier is rendered in a monospace face
 * where a transposition is visible, and on edit it is locked outright, because the backend refuses
 * to change it for exactly that reason.
 *
 * Like the method form, the schema is built at render so its refusals speak the operator's language.
 */

function destinationSchema(t: RailTranslator) {
  const wholeNumberField = (max: number) =>
    z
      .string()
      .trim()
      .regex(/^\d{1,4}$/, t('rails.validation.wholeNumber'))
      .refine((value) => Number(value) <= max, t('rails.validation.atMost', { max }));

  const capField = z
    .string()
    .trim()
    .refine(
      (value) => value === '' || MONEY_STRING_REGEX.test(value),
      t('rails.validation.capFormat'),
    )
    .refine((value) => !value.startsWith('-'), t('rails.validation.capNegative'))
    .refine(
      (value) => value === '' || isRoundTrippableAmount(value),
      t('rails.validation.amountScale'),
    );

  return z.object({
    label: z
      .string()
      .trim()
      .min(1, t('rails.validation.destinationLabel'))
      .max(120, t('rails.validation.tooLong')),
    accountIdentifier: z
      .string()
      .trim()
      .min(1, t('rails.validation.accountRequired'))
      .max(200, t('rails.validation.tooLong')),
    accountHolder: z.string().trim().max(160, t('rails.validation.tooLong')),
    priority: wholeNumberField(999),
    dailyCap: capField,
    notes: z.string().trim().max(1_000, t('rails.validation.tooLong')),
    isActive: z.boolean(),
  });
}

type DestinationFormValues = z.infer<ReturnType<typeof destinationSchema>>;

const CREATE_DEFAULTS: DestinationFormValues = {
  label: '',
  accountIdentifier: '',
  accountHolder: '',
  priority: '1',
  dailyCap: '',
  notes: '',
  isActive: true,
};

function toFormValues(destination: PaymentDestination | null): DestinationFormValues {
  if (destination === null) return CREATE_DEFAULTS;
  return {
    label: destination.label,
    accountIdentifier: destination.accountIdentifier,
    accountHolder: destination.accountHolder ?? '',
    priority: String(destination.priority),
    dailyCap: destination.dailyCap ?? '',
    notes: destination.notes ?? '',
    isActive: destination.isActive,
  };
}

export function DestinationFormDialog({
  open,
  onOpenChange,
  method,
  destination,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  method: PaymentMethod;
  /** `null` opens the create form; a destination opens the edit form with the account locked. */
  destination: PaymentDestination | null;
}) {
  const t = useT(railMessages);
  const createDestination = useCreateDestination();
  const updateDestination = useUpdateDestination();

  const schema = useMemo(() => destinationSchema(t), [t]);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DestinationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(destination),
  });

  useEffect(() => {
    if (open) reset(toFormValues(destination));
  }, [open, destination, reset]);

  const submit = handleSubmit(async (values) => {
    const shared = {
      label: values.label,
      accountHolder: values.accountHolder,
      priority: Number(values.priority),
      notes: values.notes,
      isActive: values.isActive,
      // An empty cap is left out rather than sent as "": the update body has no way to say "none",
      // so a cap can be raised or lowered here but not removed. See the hint on the field.
      ...(values.dailyCap === '' ? {} : { dailyCap: normaliseAmount(values.dailyCap) }),
    } satisfies UpdatePaymentDestinationBody;

    try {
      const saved =
        destination === null
          ? await createDestination.mutateAsync({
              methodId: method.id,
              body: {
                ...shared,
                accountIdentifier: values.accountIdentifier,
              } satisfies CreatePaymentDestinationBody,
            })
          : await updateDestination.mutateAsync({ id: destination.id, body: shared });

      toast.success(
        destination === null
          ? t('rails.destination.added', { name: saved.label })
          : t('rails.destination.saved', { name: saved.label }),
        {
          description:
            destination === null
              ? t('rails.destination.addedBody', { method: method.displayName })
              : t('rails.destination.savedBody'),
        },
      );
      onOpenChange(false);
    } catch (caught) {
      setError('root', { message: errorMessage(caught) });
      toast.error(
        destination === null
          ? t('rails.destination.addFailed')
          : t('rails.destination.saveFailed'),
        { description: errorMessage(caught) },
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {destination === null
              ? t('rails.destination.newTitle', { name: method.displayName })
              : t('rails.destination.editTitle', { name: destination.label })}
          </DialogTitle>
          <DialogDescription>
            {destination === null
              ? t('rails.destination.createHint')
              : t('rails.destination.editHint')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
          {errors.root === undefined ? null : (
            <Alert tone="danger" title={t('rails.form.saveFailedTitle')}>
              {errors.root.message}
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="destination-label"
              label={t('rails.field.label')}
              error={errors.label?.message}
              hint={t('rails.form.labelHint')}
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  {...register('label')}
                  placeholder={t('rails.form.labelPlaceholder')}
                />
              )}
            </Field>

            <Field
              id="destination-priority"
              label={t('rails.field.priority')}
              error={errors.priority?.message}
              hint={t('rails.form.priorityHint')}
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  {...register('priority')}
                  inputMode="numeric"
                  placeholder="1"
                  className="tabular"
                />
              )}
            </Field>

            {destination === null ? (
              <Field
                id="destination-account"
                label={t('rails.field.account')}
                error={errors.accountIdentifier?.message}
                hint={t('rails.form.accountHint')}
                className="sm:col-span-2"
              >
                {(a11y) => (
                  <Input
                    {...a11y}
                    {...register('accountIdentifier')}
                    placeholder="SY84 0000 0000 0001 2345"
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono"
                  />
                )}
              </Field>
            ) : (
              <ReadOnlyField
                label={t('rails.field.account')}
                value={destination.accountIdentifier}
                mono
                reason={t('rails.form.accountLocked')}
              />
            )}

            <Field
              id="destination-holder"
              label={t('rails.field.accountHolder')}
              error={errors.accountHolder?.message}
              hint={t('rails.form.accountHolderHint')}
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  {...register('accountHolder')}
                  placeholder={t('rails.form.accountHolderPlaceholder')}
                />
              )}
            </Field>

            <Field
              id="destination-cap"
              label={t('rails.field.dailyCap')}
              error={errors.dailyCap?.message}
              hint={t('rails.form.dailyCapHint', { currency: method.currencyCode })}
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  {...register('dailyCap')}
                  inputMode="decimal"
                  placeholder="20000000.00"
                  className="tabular"
                />
              )}
            </Field>

            <Field
              id="destination-notes"
              label={t('rails.field.notes')}
              error={errors.notes?.message}
              hint={t('rails.form.notesHint')}
              className="sm:col-span-2"
            >
              {(a11y) => (
                <Textarea
                  {...a11y}
                  {...register('notes')}
                  placeholder={t('rails.form.notesPlaceholder')}
                />
              )}
            </Field>
          </div>

          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <ToggleField
                id="destination-active"
                label={t('field.active')}
                description={t('rails.form.destinationActiveHint')}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />

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
              {destination === null
                ? t('rails.destination.add')
                : t('rails.form.saveChanges')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
