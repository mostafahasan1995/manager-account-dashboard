import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useMemo, useState, type ReactNode } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { errorMessage, isApiError } from '@/lib/api/errors';
import { useCreateAdmin, useUpdateAdmin } from '@/lib/api/queries';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import type { AdminUser, CreateAdminBody, UpdateAdminBody } from '@/types';
import { ADMIN_ROLES, adminRoleSchema } from '@/types/enums';

import { staffMessages, type StaffTranslator } from './messages';

/**
 * Add an administrator, or edit one.
 *
 * The same form does both because they grant the same thing — a role, and with it an authority over
 * other people's money. The only field that differs is the Telegram id, which identifies the
 * account and cannot be changed afterwards.
 *
 * Nothing here guesses at what the backend will allow. `ADMIN_ALREADY_EXISTS` and
 * `ADMIN_SELF_MODIFICATION` are conflicts only the server can see, so the form asks and then shows
 * the answer.
 */

/** The backend takes a 64-bit Telegram id as a string; 19 digits is where that stops fitting. */
const TELEGRAM_ID_PATTERN = /^\d{1,19}$/;
const USERNAME_PATTERN = /^[A-Za-z0-9_]*$/;

/**
 * The schema is built per render rather than at module load: its messages are what the operator
 * reads under the field, so they have to be resolved in the language on screen right now.
 */
function adminFormSchema(creating: boolean, t: StaffTranslator) {
  return z.object({
    telegramUserId: creating
      ? z.string().trim().regex(TELEGRAM_ID_PATTERN, t('staff.form.error.telegramId'))
      : z.string(),
    displayName: z
      .string()
      .trim()
      .min(1, t('staff.form.error.displayNameRequired'))
      .max(120, t('staff.form.error.displayNameLong')),
    role: adminRoleSchema,
    username: z
      .string()
      .trim()
      .max(32, t('staff.form.error.usernameLong'))
      .regex(USERNAME_PATTERN, t('staff.form.error.usernameChars')),
    isActive: z.boolean(),
  });
}

type AdminFormValues = z.infer<ReturnType<typeof adminFormSchema>>;

export function AdminFormDialog({
  open,
  onOpenChange,
  admin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The administrator being edited, or null to add a new one. */
  admin: AdminUser | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <AdminForm
          admin={admin}
          onDone={() => {
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function AdminForm({ admin, onDone }: { admin: AdminUser | null; onDone: () => void }) {
  const creating = admin === null;
  const createAdmin = useCreateAdmin();
  const updateAdmin = useUpdateAdmin();
  const t = useT(staffMessages);
  const enumLabel = useEnumLabel();
  const [submitError, setSubmitError] = useState<unknown>(null);

  const schema = useMemo(() => adminFormSchema(creating, t), [creating, t]);

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AdminFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      telegramUserId: admin?.telegramUserId ?? '',
      displayName: admin?.displayName ?? '',
      role: admin?.role ?? 'REVIEWER',
      username: admin?.username ?? '',
      isActive: admin?.isActive ?? true,
    },
  });

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    const username = values.username.trim();
    const displayName = values.displayName.trim();

    try {
      if (admin === null) {
        const body: CreateAdminBody = {
          telegramUserId: values.telegramUserId.trim(),
          displayName,
          role: values.role,
          ...(username === '' ? {} : { username }),
        };
        await createAdmin.mutateAsync(body);
        toast.success(t('staff.form.createdToast', { name: displayName }));
      } else {
        // No `username: null` exists in the contract, so an emptied field is left alone rather than
        // sent as "" and guessed at by the server.
        const body: UpdateAdminBody = {
          displayName,
          role: values.role,
          isActive: values.isActive,
          ...(username === '' ? {} : { username }),
        };
        await updateAdmin.mutateAsync({ id: admin.id, body });
        toast.success(t('staff.form.updatedToast', { name: displayName }));
      }
      onDone();
    } catch (caught) {
      if (isApiError(caught) && caught.code === 'ADMIN_ALREADY_EXISTS') {
        setError('telegramUserId', { message: t('staff.form.duplicate') });
      }
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
        <DialogTitle>
          {creating ? t('staff.add') : t('staff.form.editTitle', { name: admin.displayName })}
        </DialogTitle>
        <DialogDescription>
          {creating ? t('staff.form.addBody') : t('staff.form.editBody')}
        </DialogDescription>
      </DialogHeader>

      {creating ? (
        <Field
          label={t('field.telegramId')}
          htmlFor="admin-telegram-id"
          error={errors.telegramUserId?.message}
          hint={t('staff.form.telegramIdHint')}
        >
          <Input
            id="admin-telegram-id"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
            placeholder="700000123"
            aria-invalid={errors.telegramUserId !== undefined}
            {...register('telegramUserId')}
          />
        </Field>
      ) : null}

      <Field
        label={t('field.displayName')}
        htmlFor="admin-display-name"
        error={errors.displayName?.message}
      >
        <Input
          id="admin-display-name"
          autoComplete="off"
          placeholder={t('staff.form.displayNamePlaceholder')}
          aria-invalid={errors.displayName !== undefined}
          {...register('displayName')}
        />
      </Field>

      <Field
        label={t('staff.form.telegramUsername')}
        htmlFor="admin-username"
        error={errors.username?.message}
        hint={creating ? t('staff.form.usernameHintNew') : t('staff.form.usernameHintEdit')}
      >
        {/* A Telegram handle is ASCII by definition, so the example stays as one in both languages. */}
        <Input
          id="admin-username"
          autoComplete="off"
          spellCheck={false}
          placeholder="lina_review"
          aria-invalid={errors.username !== undefined}
          {...register('username')}
        />
      </Field>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm leading-none font-medium">{t('field.role')}</legend>
        <div className="space-y-2">
          {ADMIN_ROLES.map((role) => (
            <label
              key={role}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-[var(--border)] p-3 text-sm hover:bg-[var(--surface-muted)] has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--primary-muted)]"
            >
              <input
                type="radio"
                value={role}
                className="mt-0.5 accent-[var(--primary)]"
                {...register('role')}
              />
              <span className="min-w-0">
                <span className="block font-medium">{enumLabel('adminRole', role)}</span>
                <span className="block text-[var(--muted-foreground)]">
                  {t(`staff.role.${role}`)}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {creating ? null : (
        <div className="flex items-center justify-between gap-4 rounded-md border border-[var(--border)] p-3">
          <div className="space-y-0.5 text-sm">
            <Label htmlFor="admin-active">{t('staff.form.accountActive')}</Label>
            <p className="text-[var(--muted-foreground)]">{t('staff.form.accountActiveHint')}</p>
          </div>
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <Switch
                id="admin-active"
                checked={field.value}
                onCheckedChange={field.onChange}
                aria-label={t('staff.form.accountActive')}
              />
            )}
          />
        </div>
      )}

      {submitError === null ? null : (
        <Alert tone="danger" title={t('staff.apiRefused')}>
          {errorMessage(submitError)}
        </Alert>
      )}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={createAdmin.isPending || updateAdmin.isPending}
        >
          {creating ? t('staff.add') : t('staff.form.saveChanges')}
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
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint === undefined ? null : <p className="text-xs text-[var(--muted-foreground)]">{hint}</p>}
      {error === undefined ? null : (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
