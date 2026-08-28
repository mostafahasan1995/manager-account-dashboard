import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
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
} from '@/components/ui';
import { errorMessage } from '@/lib/api/errors';
import { useSetDeclaredBalance } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import { MONEY_STRING_REGEX } from '@/lib/money';
import type { PaymentDestination } from '@/types';

import { Field } from './form-field';
import { railMessages, type RailTranslator } from './messages';
import { isRoundTrippableAmount, normaliseAmount } from './rail-money';

/**
 * Set or clear the operator's hand-typed balance for one account.
 *
 * ── WHY AMOUNT AND CURRENCY MOVE TOGETHER ─────────────────────────────────────────────────────
 * A balance is one fact — "200 USD" — not two fields that drift. So the form refuses one without
 * the other, and clearing means emptying BOTH: an amount with no currency is a number nobody can
 * read, and a currency with no amount is not a balance at all. The backend enforces the same pairing;
 * this says it earlier and in the operator's language.
 *
 * ── WHY THIS IS NOT THE DESTINATION FORM ──────────────────────────────────────────────────────
 * `DestinationFormDialog` edits the account itself — the number money is sent to, locked once set.
 * A declared balance is bookkeeping ABOUT that account and changes often; folding it in would put a
 * frequently-edited field next to the one field on this screen that must never be casually touched.
 */
function declaredBalanceSchema(t: RailTranslator) {
  return z
    .object({
      amount: z
        .string()
        .trim()
        .refine(
          (value) => value === '' || MONEY_STRING_REGEX.test(value),
          t('financial.declared.amountFormat'),
        )
        .refine((value) => !value.startsWith('-'), t('financial.declared.amountNegative'))
        .refine(
          (value) => value === '' || isRoundTrippableAmount(value),
          t('rails.validation.amountScale'),
        ),
      // 2–8 letters, matching the backend. Case is folded to upper on submit, so an operator typing
      // "usd" is not scolded for it.
      currency: z
        .string()
        .trim()
        .refine(
          (value) => value === '' || /^[A-Za-z]{2,8}$/.test(value),
          t('financial.declared.currencyFormat'),
        ),
    })
    // Both or neither: the pairing the balance is meaningless without.
    .refine((values) => (values.amount === '') === (values.currency === ''), {
      message: t('financial.declared.pairRequired'),
      path: ['amount'],
    });
}

type DeclaredBalanceValues = z.infer<ReturnType<typeof declaredBalanceSchema>>;

export function DeclaredBalanceDialog({
  open,
  onOpenChange,
  destination,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destination: PaymentDestination;
}) {
  const t = useT(railMessages);
  const setDeclaredBalance = useSetDeclaredBalance();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DeclaredBalanceValues>({
    resolver: zodResolver(declaredBalanceSchema(t)),
    defaultValues: {
      amount: destination.declaredBalance ?? '',
      currency: destination.declaredBalanceCurrency ?? '',
    },
  });

  // Reopening for a different account, or after a save, starts from what that account currently has.
  useEffect(() => {
    if (open) {
      reset({
        amount: destination.declaredBalance ?? '',
        currency: destination.declaredBalanceCurrency ?? '',
      });
    }
  }, [open, destination, reset]);

  const submit = handleSubmit(async (values) => {
    const clearing = values.amount === '';
    try {
      await setDeclaredBalance.mutateAsync({
        id: destination.id,
        body: clearing
          ? { balance: null, currency: null }
          : { balance: normaliseAmount(values.amount), currency: values.currency.toUpperCase() },
      });
      toast.success(
        clearing ? t('financial.declared.cleared') : t('financial.declared.saved'),
        { description: destination.label },
      );
      onOpenChange(false);
    } catch (caught) {
      setError('root', { message: errorMessage(caught) });
      toast.error(t('financial.declared.saveFailed'), { description: errorMessage(caught) });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('financial.declared.title', { name: destination.label })}</DialogTitle>
          <DialogDescription>{t('financial.declared.hint')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
          {errors.root === undefined ? null : (
            <Alert tone="danger" title={t('rails.form.saveFailedTitle')}>
              {errors.root.message}
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <Field
              id="declared-amount"
              label={t('financial.declared.amountLabel')}
              error={errors.amount?.message}
              hint={t('financial.declared.amountHint')}
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  {...register('amount')}
                  inputMode="decimal"
                  placeholder="200.00"
                  className="tabular"
                  autoComplete="off"
                />
              )}
            </Field>

            <Field
              id="declared-currency"
              label={t('financial.declared.currencyLabel')}
              error={errors.currency?.message}
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  {...register('currency')}
                  placeholder="USD"
                  className="uppercase"
                  autoComplete="off"
                  maxLength={8}
                />
              )}
            </Field>
          </div>

          {/* Said out loud, because an empty form is not an error here — it is how a balance is
              removed, and a reader should not be left guessing whether Save will clear or reject. */}
          <p className="text-xs text-[var(--muted-foreground)]">
            {t('financial.declared.clearNote')}
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
