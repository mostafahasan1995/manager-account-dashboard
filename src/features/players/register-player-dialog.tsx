import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { Controller, useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@/components/ui';
import { errorMessage } from '@/lib/api/errors';
import { useRegisterPlayer } from '@/lib/api/queries';
import { useT, type Translator } from '@/lib/i18n/use-translation';
import type { RegisterPlayerResult } from '@/types/player';

import { playerMessages } from './messages';
import {
  registeredPlayerName,
  toRegisterBody,
  type RegisterFormValues,
} from './register-player-body';

/**
 * Registering a player from the console — the third door into the directory, after a Telegram
 * Start and the Ichancy import.
 *
 * Every field is optional to the API, and an omitted one is ABSENT from the body, never `""`: the
 * backend stores what it is given, and an empty string is a value. `toRegisterBody` is the one
 * place that decides this. The form does ask for at least one identifying thing, because a row with
 * nothing on it is a player nobody can ever find again — that rule is the console's, not the
 * server's.
 *
 * The Ichancy link is the part that can go wrong on its own. The row is written first, in a
 * transaction; the Ichancy call happens after it and is reported beside it, so "registered, but no
 * account" is a real outcome this dialog hands back rather than a failure it swallows. The page
 * keeps that outcome on screen after the dialog closes.
 *
 * The schema is built from `t` at render, as the tenant form does, so a validation message is in
 * the operator's language rather than in whichever one the module loaded in.
 */

const DIGITS_RE = /^\d+$/;
/** The API's cap on a name or a phone; the form says so before the API has to. */
const MAX_TEXT = 120;

type PlayerTranslator = Translator<(typeof playerMessages)['en']>;

const schemaFor = (t: PlayerTranslator) =>
  z
    .object({
      telegramUserId: z
        .string()
        .refine(
          (value) => value.trim() === '' || DIGITS_RE.test(value.trim()),
          t('players.register.validation.telegramUserId'),
        ),
      firstName: z
        .string()
        .trim()
        .max(MAX_TEXT, t('players.register.validation.tooLong', { max: MAX_TEXT })),
      lastName: z
        .string()
        .trim()
        .max(MAX_TEXT, t('players.register.validation.tooLong', { max: MAX_TEXT })),
      phone: z
        .string()
        .trim()
        .max(MAX_TEXT, t('players.register.validation.tooLong', { max: MAX_TEXT })),
      createIchancyAccount: z.boolean(),
    })
    .refine(
      (values) =>
        [values.telegramUserId, values.firstName, values.lastName, values.phone].some(
          (value) => value.trim() !== '',
        ),
      { message: t('players.register.validation.nothing'), path: ['telegramUserId'] },
    );

export function RegisterPlayerDialog({
  open,
  onOpenChange,
  onRegistered,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegistered: (result: RegisterPlayerResult) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Mounted only while open, so every opening starts from an empty form. */}
        <RegisterForm
          onCancel={() => {
            onOpenChange(false);
          }}
          onRegistered={onRegistered}
        />
      </DialogContent>
    </Dialog>
  );
}

function RegisterForm({
  onCancel,
  onRegistered,
}: {
  onCancel: () => void;
  onRegistered: (result: RegisterPlayerResult) => void;
}) {
  const t = useT(playerMessages);
  const mutation = useRegisterPlayer();
  const schema = useMemo(() => schemaFor(t), [t]);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      telegramUserId: '',
      firstName: '',
      lastName: '',
      phone: '',
      createIchancyAccount: false,
    },
  });

  const failure: unknown = mutation.error;

  const submit = handleSubmit(async (values) => {
    try {
      const result = await mutation.mutateAsync(toRegisterBody(values));
      toast.success(t('players.register.successTitle', { name: registeredPlayerName(result) }));
      onRegistered(result);
    } catch (error) {
      toast.error(t('players.register.failedTitle'), { description: errorMessage(error) });
    }
  });

  return (
    <form
      onSubmit={(event) => {
        void submit(event);
      }}
      className="space-y-4"
      noValidate
    >
      <DialogHeader>
        <DialogTitle>{t('players.register.title')}</DialogTitle>
        <DialogDescription>{t('players.register.description')}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="register-telegram-id"
          label={t('players.register.field.telegramUserId')}
          registration={register('telegramUserId')}
          error={errors.telegramUserId?.message}
          hint={t('players.register.hint.telegramUserId')}
          inputMode="numeric"
          className="font-mono"
          wide
        />
        <TextField
          id="register-first-name"
          label={t('players.field.firstName')}
          registration={register('firstName')}
          error={errors.firstName?.message}
        />
        <TextField
          id="register-last-name"
          label={t('players.field.lastName')}
          registration={register('lastName')}
          error={errors.lastName?.message}
        />
        <TextField
          id="register-phone"
          label={t('players.field.phone')}
          registration={register('phone')}
          error={errors.phone?.message}
          hint={t('players.register.hint.phone')}
          inputMode="tel"
          className="font-mono"
          wide
        />
      </div>

      <Controller
        control={control}
        name="createIchancyAccount"
        render={({ field }) => (
          <div className="flex items-start gap-3">
            <Checkbox
              id="register-create-ichancy"
              checked={field.value}
              onCheckedChange={(checked) => {
                field.onChange(checked === true);
              }}
              aria-describedby="register-create-ichancy-hint"
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label htmlFor="register-create-ichancy">{t('players.register.createIchancy')}</Label>
              <p
                id="register-create-ichancy-hint"
                className="text-xs text-[var(--muted-foreground)]"
              >
                {t('players.register.createIchancyHint')}
              </p>
            </div>
          </div>
        )}
      />

      {/* ERROR: the server's refusal — a Telegram id another player holds, most often. */}
      {failure == null ? null : (
        <Alert tone="danger" title={t('players.register.failedTitle')}>
          {errorMessage(failure)}
        </Alert>
      )}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={mutation.isPending}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="primary" loading={mutation.isPending}>
          {t('players.register.submit')}
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
  inputMode,
  className,
  wide = false,
}: {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  error: string | undefined;
  hint?: string;
  inputMode?: 'numeric' | 'tel';
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
        type="text"
        autoComplete="off"
        aria-invalid={error !== undefined}
        {...(describedBy === '' ? {} : { 'aria-describedby': describedBy })}
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
