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
import { chainAddressProblem, detectWalletNetwork } from './wallet-address';

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

/**
 * @param isChainRail whether this method pays on a blockchain — `rail === 'CRYPTO'`, and NOT the
 * method's code. At create time there is no address yet to read a chain off, so the rail is the
 * only signal available; it is also the only one that stays true when an operator names their
 * method `USDT` instead of `USDT_TRC20`. See the header of ./wallet-address.
 */
function destinationSchema(t: RailTranslator, isChainRail: boolean) {
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

  return (
    z
      .object({
        label: z
          .string()
          .trim()
          .min(1, t('rails.validation.destinationLabel'))
          .max(120, t('rails.validation.tooLong')),
        accountIdentifier: z
          .string()
          .trim()
          .min(1, t('rails.validation.accountRequired'))
          .max(200, t('rails.validation.tooLong'))
          // Only on a chain rail. Every other rail takes an account number whose shape this console
          // has no business asserting — a rule that rejected a valid Syriatel number would be a worse
          // bug than the one it was added to prevent.
          .superRefine((value, ctx) => {
            if (!isChainRail) return;
            const problem = chainAddressProblem(value);
            if (problem === null) return;
            ctx.addIssue({ code: 'custom', message: t(problem) });
          }),
        /**
         * Not a field, a speed bump. Format validation cannot tell a well-formed address of yours from
         * a well-formed address of somebody else's, and the wrong-clipboard paste is the failure that
         * actually happens. Nothing but a human comparing characters catches that, so this asks for it
         * once — at the only moment it is still free, because the address cannot be edited afterwards.
         */
        addressConfirmed: z.boolean(),
        accountHolder: z.string().trim().max(160, t('rails.validation.tooLong')),
        priority: wholeNumberField(999),
        dailyCap: capField,
        notes: z.string().trim().max(1_000, t('rails.validation.tooLong')),
        isActive: z.boolean(),
      })
      // Object-level, because the tick is only meaningful once the address it refers to has passed
      // its own checks. On edit the field is locked and the default is already true.
      .refine((values) => !isChainRail || values.addressConfirmed, {
        message: t('rails.validation.walletUnconfirmed'),
        path: ['addressConfirmed'],
      })
  );
}

/**
 * A shape to compare against, not an address to copy. A real contract address (Tether’s own on
 * Tron), chosen because an operator glancing between the placeholder and their phone is checking
 * length and prefix — which a row of Xs would not show them. One example rather than one per chain:
 * the field accepts either chain now, and the placeholder is only visible while it is empty.
 */
const CHAIN_ADDRESS_PLACEHOLDER = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const ACCOUNT_PLACEHOLDER = 'SY84 0000 0000 0001 2345';

type DestinationFormValues = z.infer<ReturnType<typeof destinationSchema>>;

const CREATE_DEFAULTS: DestinationFormValues = {
  label: '',
  accountIdentifier: '',
  addressConfirmed: false,
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
    // Already saved, and locked. Nothing is left to confirm.
    addressConfirmed: true,
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

  const isChainRail = method.rail === 'CRYPTO';
  const schema = useMemo(() => destinationSchema(t, isChainRail), [t, isChainRail]);

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

  /*
   * The chain of whatever is in the box right now — echoed beside the read-back tick.
   *
   * This is what replaced the old code table's cross-network refusal. Nothing here knows which
   * chain a rail is "supposed" to pay on any more, so the console cannot refuse the other one; what
   * it can do is put the chain it READ in front of the person being asked to confirm the address.
   * Somebody who pasted the BEP20 address out of the other rail's clipboard sees the word BEP20 on
   * a rail they think of as TRC20, which is the moment the mistake is still free to fix.
   */
  const typedAccount = useWatch({ control, name: 'accountIdentifier' });
  const pastedNetwork = isChainRail ? detectWalletNetwork(typedAccount.trim()) : null;

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
        destination === null ? t('rails.destination.addFailed') : t('rails.destination.saveFailed'),
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
              <>
                <Field
                  id="destination-account"
                  label={t('rails.field.account')}
                  error={errors.accountIdentifier?.message}
                  hint={isChainRail ? t('rails.form.walletHint') : t('rails.form.accountHint')}
                  className="sm:col-span-2"
                >
                  {(a11y) => (
                    <Input
                      {...a11y}
                      {...register('accountIdentifier')}
                      placeholder={isChainRail ? CHAIN_ADDRESS_PLACEHOLDER : ACCOUNT_PLACEHOLDER}
                      autoComplete="off"
                      spellCheck={false}
                      // Monospace so a transposition is visible, and wrapping so a 42-character
                      // address can be read back in full rather than scrolled through.
                      className="font-mono break-all"
                    />
                  )}
                </Field>

                {!isChainRail ? null : (
                  <div className="sm:col-span-2">
                    <Controller
                      control={control}
                      name="addressConfirmed"
                      render={({ field }) => (
                        <ToggleField
                          id="destination-address-confirmed"
                          label={t('rails.form.walletConfirm')}
                          description={
                            pastedNetwork === null
                              ? undefined
                              : t('rails.form.walletDetected', { network: pastedNetwork })
                          }
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                    {errors.addressConfirmed === undefined ? null : (
                      <p className="mt-1 text-xs text-[var(--danger)]">
                        {errors.addressConfirmed.message}
                      </p>
                    )}
                  </div>
                )}
              </>
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
              {destination === null ? t('rails.destination.add') : t('rails.form.saveChanges')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
