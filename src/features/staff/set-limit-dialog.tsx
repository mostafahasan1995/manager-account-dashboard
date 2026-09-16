import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useMemo, useState, type ReactNode } from 'react';
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
import { useSetApprovalLimit } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import { MONEY_STRING_REGEX } from '@/lib/money';
import type { SetApprovalLimitBody } from '@/types';

import { staffMessages, type StaffTranslator } from './messages';

/**
 * Grant a new approval limit.
 *
 * The wording matters more than the fields do. An operator reaching for this dialog is thinking
 * "raise Lina's limit", and what actually happens is that the version in force is closed and a new
 * one opened — so the form says so, twice, before it will post anything.
 *
 * Amounts stay strings the whole way through: they are validated against the same regex the backend
 * validates with and handed over untouched. Nothing here turns a limit into a JavaScript number.
 */

/** Each complaint names the field the way its label reads on screen, in whichever language that is. */
const moneyField = (t: StaffTranslator, field: string) =>
  z
    .string()
    .trim()
    .min(1, t('staff.limit.error.required', { field }))
    .regex(MONEY_STRING_REGEX, t('staff.limit.error.format', { field }))
    .refine((value) => !value.startsWith('-'), t('staff.limit.error.negative', { field }));

function limitFormSchema(t: StaffTranslator) {
  return z
    .object({
      currencyCode: z
        .string()
        .trim()
        .regex(/^[A-Za-z]{3}$/, t('staff.limit.error.currency')),
      maxSingleApproval: moneyField(t, t('staff.limit.maxSingle')),
      maxDailyApproval: moneyField(t, t('staff.limit.maxDaily')),
      secondApprovalAbove: z.string(),
    })
    .superRefine((values, ctx) => {
      const threshold = values.secondApprovalAbove.trim();
      if (threshold === '') return;
      if (!MONEY_STRING_REGEX.test(threshold) || threshold.startsWith('-')) {
        ctx.addIssue({
          code: 'custom',
          path: ['secondApprovalAbove'],
          message: t('staff.limit.error.secondAbove'),
        });
      }
    });
}

type LimitFormValues = z.infer<ReturnType<typeof limitFormSchema>>;

export function SetLimitDialog({
  open,
  onOpenChange,
  adminUserId,
  adminName,
  defaultCurrency,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adminUserId: string;
  adminName: string;
  /** The currency of the newest version, so a raise does not start from a blank field. */
  defaultCurrency: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <LimitForm
          adminUserId={adminUserId}
          adminName={adminName}
          defaultCurrency={defaultCurrency}
          onDone={() => {
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function LimitForm({
  adminUserId,
  adminName,
  defaultCurrency,
  onDone,
}: {
  adminUserId: string;
  adminName: string;
  defaultCurrency: string;
  onDone: () => void;
}) {
  const setLimit = useSetApprovalLimit();
  const t = useT(staffMessages);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const schema = useMemo(() => limitFormSchema(t), [t]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LimitFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      currencyCode: defaultCurrency,
      maxSingleApproval: '',
      maxDailyApproval: '',
      secondApprovalAbove: '',
    },
  });

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    const threshold = values.secondApprovalAbove.trim();
    const body: SetApprovalLimitBody = {
      currencyCode: values.currencyCode.trim().toUpperCase(),
      maxSingleApproval: values.maxSingleApproval.trim(),
      maxDailyApproval: values.maxDailyApproval.trim(),
      ...(threshold === '' ? {} : { secondApprovalAbove: threshold }),
    };

    try {
      await setLimit.mutateAsync({ adminUserId, body });
      toast.success(t('staff.limit.setToast', { name: adminName }));
      onDone();
    } catch (caught) {
      setSubmitError(caught);
      toast.error(errorMessage(caught));
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
        <DialogTitle>{t('staff.limit.setTitle')}</DialogTitle>
        <DialogDescription>{t('staff.limit.setBody', { name: adminName })}</DialogDescription>
      </DialogHeader>

      <Alert tone="warning" title={t('staff.limit.warnTitle')}>
        {t('staff.limit.warnBody')}
      </Alert>

      <Field
        label={t('field.currency')}
        htmlFor="limit-currency"
        error={errors.currencyCode?.message}
        hint={t('staff.limit.currencyHint')}
      >
        <Input
          id="limit-currency"
          autoComplete="off"
          spellCheck={false}
          maxLength={3}
          placeholder="NSP"
          className="w-28 font-mono uppercase"
          aria-invalid={errors.currencyCode !== undefined}
          {...register('currencyCode')}
        />
      </Field>

      <Field
        label={t('staff.limit.maxSingle')}
        htmlFor="limit-single"
        error={errors.maxSingleApproval?.message}
        hint={t('staff.limit.maxSingleHint')}
      >
        <Input
          id="limit-single"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder="500000.00"
          className="tabular"
          aria-invalid={errors.maxSingleApproval !== undefined}
          {...register('maxSingleApproval')}
        />
      </Field>

      <Field
        label={t('staff.limit.maxDaily')}
        htmlFor="limit-daily"
        error={errors.maxDailyApproval?.message}
        hint={t('staff.limit.maxDailyHint')}
      >
        <Input
          id="limit-daily"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder="2000000.00"
          className="tabular"
          aria-invalid={errors.maxDailyApproval !== undefined}
          {...register('maxDailyApproval')}
        />
      </Field>

      <Field
        label={t('staff.limit.secondAbove')}
        htmlFor="limit-second"
        error={errors.secondApprovalAbove?.message}
        hint={t('staff.limit.secondAboveHint')}
      >
        <Input
          id="limit-second"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder="300000.00"
          className="tabular"
          aria-invalid={errors.secondApprovalAbove !== undefined}
          {...register('secondApprovalAbove')}
        />
      </Field>

      {submitError === null ? null : (
        <Alert tone="danger" title={t('staff.apiRefused')}>
          {errorMessage(submitError)}
        </Alert>
      )}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="primary" loading={setLimit.isPending}>
          {t('staff.limit.submit')}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error: string | undefined;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      <p className="text-xs text-[var(--muted-foreground)]">{hint}</p>
      {error === undefined ? null : (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
