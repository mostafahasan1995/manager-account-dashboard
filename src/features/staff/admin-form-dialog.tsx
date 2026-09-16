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
import { mayGrantRole } from '@/lib/auth/permissions';
import { useAuth } from '@/lib/auth/use-auth';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import type { AdminUser, CreateAdminBody, UpdateAdminBody } from '@/types';
import { ADMIN_ROLES, adminRoleSchema } from '@/types/enums';

import { staffMessages, type StaffTranslator } from './messages';

/**
 * Add an employee, or edit one.
 *
 * The same form does both because they grant the same thing — a role, and with it an authority over
 * other people's money. A staff account is a display name, a role, a USERNAME and a PASSWORD, and
 * that is the whole of it: there is nothing here about Telegram, because since 2026-09-05 the
 * console is opened with those two credentials and the bot's `/console` command no longer exists.
 *
 * ── THE ONE ASYMMETRY BETWEEN ADDING AND EDITING ──────────────────────────────────────────────
 * On create the password is REQUIRED — an account with no password is an account nobody can sign
 * into, which is the whole point of creating it. On edit it is OPTIONAL and blank means UNCHANGED,
 * because the existing password cannot be read back to prefill the field, so a required field there
 * would force whoever renames a colleague to reset their password as a side effect.
 *
 * ── WHY THE USERNAME ACCEPTS AN EMAIL ─────────────────────────────────────────────────────────
 * It is the login, and people are given either. The pattern is therefore wide enough for both, and
 * matches the server's exactly — a stricter rule here would refuse accounts the backend is perfectly
 * happy to create, which is the worst kind of validation because the operator cannot see the rule
 * that stopped them.
 *
 * Nothing here guesses at what the backend will allow. `ADMIN_ALREADY_EXISTS` and
 * `ADMIN_SELF_MODIFICATION` are conflicts only the server can see, so the form asks and then shows
 * the answer.
 */

/**
 * Letters, digits and the punctuation an email or a handle is made of — the same rule as the
 * server's ADMIN_USERNAME_PATTERN. Kept in step by the shape of the message, not by an import:
 * these are two codebases, and the console must not be the stricter of the two.
 */
const USERNAME_PATTERN = /^[A-Za-z0-9._@+-]+$/;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 64;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;

/**
 * The schema is built per render rather than at module load: its messages are what the operator
 * reads under the field, so they have to be resolved in the language on screen right now.
 */
function adminFormSchema(creating: boolean, t: StaffTranslator) {
  return z.object({
    displayName: z
      .string()
      .trim()
      .min(1, t('staff.form.error.displayNameRequired'))
      .max(120, t('staff.form.error.displayNameLong')),
    role: adminRoleSchema,
    /*
     * Required on create, blank-means-unchanged on edit — the same rule as the password below, and
     * for two reasons. The hint under the field says so, and a schema that disagreed with its own
     * hint would refuse a save with no visible cause. More importantly an admin created before
     * 2026-09-05 can have NO username at all: the field prefills empty for them, and a hard
     * minimum here would make their record impossible to edit — including impossible to give a
     * username to.
     */
    username: creating
      ? z
          .string()
          .trim()
          .min(USERNAME_MIN_LENGTH, t('staff.form.error.username'))
          .max(USERNAME_MAX_LENGTH, t('staff.form.error.username'))
          .regex(USERNAME_PATTERN, t('staff.form.error.username'))
      : z
          .string()
          .trim()
          .refine(
            (value) =>
              value.length === 0 ||
              (value.length >= USERNAME_MIN_LENGTH &&
                value.length <= USERNAME_MAX_LENGTH &&
                USERNAME_PATTERN.test(value)),
            { message: t('staff.form.error.username') },
          ),
    /*
     * Not trimmed: a leading or trailing space is a real character in a password, exactly as the
     * backend's CreateAdminUserDto.password documents. On edit an empty string means "leave it
     * alone" and is stripped from the body rather than sent.
     */
    password: creating
      ? z
          .string()
          .min(PASSWORD_MIN_LENGTH, t('staff.form.error.passwordShort'))
          .max(PASSWORD_MAX_LENGTH, t('staff.form.error.passwordLong'))
      : z
          .string()
          .refine((value) => value.length === 0 || value.length >= PASSWORD_MIN_LENGTH, {
            message: t('staff.form.error.passwordShort'),
          })
          .refine((value) => value.length <= PASSWORD_MAX_LENGTH, {
            message: t('staff.form.error.passwordLong'),
          }),
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
  const { role: actorRole, tenantId } = useAuth();
  const [submitError, setSubmitError] = useState<unknown>(null);

  /**
   * The roles this person may actually hand out — plus, when editing, the role the admin already
   * holds even if it is not grantable.
   *
   * That second half matters: a SUPER_ADMIN cannot grant PLATFORM_ADMIN, but can open the edit
   * dialog for one (they share tenant zero). Dropping the option outright would leave the radio
   * group with nothing selected and quietly demote them on save. Shown and disabled says the truth
   * and cannot act on it.
   */
  const roleOptions = useMemo(
    () =>
      ADMIN_ROLES.map((role) => ({
        role,
        grantable: mayGrantRole(actorRole, role, tenantId),
      })).filter(({ role, grantable }) => grantable || role === admin?.role),
    [actorRole, tenantId, admin?.role],
  );

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
      displayName: admin?.displayName ?? '',
      role: admin?.role ?? 'REVIEWER',
      username: admin?.username ?? '',
      password: '',
      isActive: admin?.isActive ?? true,
    },
  });

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    // Lower-cased to match what the server stores, so the operator sees the username they will
    // actually type at the login screen rather than the capitalisation they happened to use here.
    const username = values.username.trim().toLowerCase();
    const displayName = values.displayName.trim();
    // Not trimmed, same reasoning as the schema: a password's leading/trailing space is real.
    const password = values.password;

    try {
      if (admin === null) {
        const body: CreateAdminBody = {
          displayName,
          role: values.role,
          username,
          password,
        };
        await createAdmin.mutateAsync(body);
        toast.success(t('staff.form.createdToast', { name: displayName }));
      } else {
        // An emptied field is left ALONE rather than sent as "": the contract has no `null` for
        // either, and blank means "unchanged" for the password because it cannot be read back to
        // prefill the field in the first place.
        const body: UpdateAdminBody = {
          displayName,
          role: values.role,
          isActive: values.isActive,
          ...(username === '' ? {} : { username }),
          ...(password === '' ? {} : { password }),
        };
        await updateAdmin.mutateAsync({ id: admin.id, body });
        toast.success(t('staff.form.updatedToast', { name: displayName }));
      }
      onDone();
    } catch (caught) {
      if (isApiError(caught) && caught.code === 'ADMIN_ALREADY_EXISTS') {
        // The only unique field a staff account has, so the message goes where the fix is.
        setError('username', { message: t('staff.form.duplicate') });
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
        label={t('staff.form.username')}
        htmlFor="admin-username"
        error={errors.username?.message}
        hint={creating ? t('staff.form.usernameHintNew') : t('staff.form.usernameHintEdit')}
      >
        {/*
         * A login is Latin and typed left to right in either language, never capitalised and never
         * spell-corrected. `dir="ltr"` keeps the caret on the right end of a half-typed email in
         * the Arabic layout.
         */}
        <Input
          id="admin-username"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          dir="ltr"
          className="font-mono"
          placeholder="lina@example.com"
          aria-invalid={errors.username !== undefined}
          {...register('username')}
        />
      </Field>

      <Field
        label={t('staff.form.password')}
        htmlFor="admin-password"
        error={errors.password?.message}
        hint={creating ? t('staff.form.passwordHintNew') : t('staff.form.passwordHintEdit')}
      >
        <Input
          id="admin-password"
          type="password"
          autoComplete="new-password"
          spellCheck={false}
          dir="ltr"
          aria-invalid={errors.password !== undefined}
          {...register('password')}
        />
      </Field>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm leading-none font-medium">{t('field.role')}</legend>
        <div className="space-y-2">
          {roleOptions.map(({ role, grantable }) => (
            <label
              key={role}
              className={
                'flex items-start gap-3 rounded-md border border-[var(--border)] p-3 text-sm ' +
                'has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--primary-muted)] ' +
                (grantable
                  ? 'cursor-pointer hover:bg-[var(--surface-muted)]'
                  : 'cursor-not-allowed opacity-60')
              }
            >
              <input
                type="radio"
                value={role}
                disabled={!grantable}
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
