import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, UserPlus } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Can } from '@/components/common/can';
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
import { config } from '@/config';
import { errorMessage, isApiError } from '@/lib/api/errors';
import { useCreateAdmin } from '@/lib/api/queries';
import { useAuth } from '@/lib/auth/use-auth';
import { useEnumLabel, useT, type Translator } from '@/lib/i18n/use-translation';
import type { AdminIdentity, CreateAdminBody, Tenant } from '@/types';

import { tenantMessages } from './messages';

/**
 * "Add me as an admin here" — step five of docs/TENANT-OPERATIONS.md section 7.
 *
 * ── WHY THIS NEEDS NO NEW ENDPOINT ────────────────────────────────────────────────────────────
 * Staff are unique per `(tenantId, telegramUserId)` rather than globally, so one Telegram account
 * can hold a SUPER_ADMIN row inside every operator it runs. Creating an admin while an operator is
 * selected IS the feature: `POST /v1/admin/admins`, scoped by `X-Tenant-Id`.
 *
 * ── WHY THE OPERATOR HAS TO BE SELECTED FIRST ─────────────────────────────────────────────────
 * There is exactly one way to aim an admin write at an operator: that header, which the API client
 * fills from the single global selection (`configureApiClient` / `getTenantId` in lib/api/client.ts,
 * fed by the auth provider). No admin call takes an operator per request. So this dialog never
 * writes on the strength of which panel happens to be open — it names its target on screen, and
 * when the selection is not that target, selecting becomes the first of two deliberate clicks.
 * A SUPER_ADMIN row written into the wrong operator is silent, and is the worst outcome here.
 */

type TenantTranslator = Translator<(typeof tenantMessages)['en']>;

/** PLATFORM_ADMIN is deliberately absent: it runs the platform and sees no operator's data. */
const TENANT_ROLES = ['SUPER_ADMIN', 'FINANCE_ADMIN', 'REVIEWER', 'SUPPORT', 'VIEWER'] as const;

/** The same rules the staff form and the server hold a username to. */
const USERNAME_PATTERN = /^[A-Za-z0-9._@+-]+$/;
const PASSWORD_MIN_LENGTH = 8;

const addMeSchemaFor = (t: TenantTranslator) =>
  z.object({
    displayName: z
      .string()
      .trim()
      .min(1, t('tenants.addMe.displayNameRequired'))
      .max(120, t('tenants.addMe.displayNameLong')),
    // Narrower than the shared role schema on purpose: only what this dialog offers can be sent.
    role: z.enum(TENANT_ROLES),
    /*
     * A staff account is a username and a password (2026-09-05), so this dialog has to ask for
     * both — there is nothing of the caller's it could clone instead. It used to copy their
     * Telegram id, which is no longer an identity `POST /v1/admin/admins` accepts at all.
     *
     * The username is per-OPERATOR unique, so it may well be the one they already use elsewhere;
     * the password is a NEW one, because an existing password cannot be read back to reuse.
     */
    username: z
      .string()
      .trim()
      .min(3, t('tenants.addMe.usernameInvalid'))
      .max(64, t('tenants.addMe.usernameInvalid'))
      .regex(USERNAME_PATTERN, t('tenants.addMe.usernameInvalid')),
    password: z.string().min(PASSWORD_MIN_LENGTH, t('tenants.addMe.passwordShort')),
  });

type AddMeValues = z.infer<ReturnType<typeof addMeSchemaFor>>;

/** What the API answered, kept apart from the form so the success screen cannot drift from it. */
type Outcome = { kind: 'created'; role: AddMeValues['role'] } | { kind: 'exists' };

export function AddMeAsAdminAction({ tenant }: { tenant: Tenant }) {
  const { admin } = useAuth();
  const [open, setOpen] = useState(false);
  const t = useT(tenantMessages);

  // No signed-in identity means there is no "me" to add. The route guards make this unreachable.
  if (admin === null) return null;

  return (
    <Can capability="tenants.manage">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setOpen(true);
        }}
      >
        <UserPlus className="size-4" />
        {t('tenants.addMe.action')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <AddMeForm
            tenant={tenant}
            admin={admin}
            onDone={() => {
              setOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </Can>
  );
}

function AddMeForm({
  tenant,
  admin,
  onDone,
}: {
  tenant: Tenant;
  admin: AdminIdentity;
  onDone: () => void;
}) {
  const { session, tenantId, setTenantId } = useAuth();
  const createAdmin = useCreateAdmin();
  const t = useT(tenantMessages);
  const enumLabel = useEnumLabel();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const schema = useMemo(() => addMeSchemaFor(t), [t]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AddMeValues>({
    /*
     * Prefilled from the signed-in identity where it can be: this action is about THIS person, and
     * the display name and login they already answer to are the ones their colleagues in the new
     * operator should see. The PASSWORD cannot be prefilled — a session never carries one back —
     * so it is the one thing this dialog has to ask for.
     */
    defaultValues: {
      displayName: admin.displayName,
      role: 'SUPER_ADMIN',
      username: '',
      password: '',
    },
    resolver: zodResolver(schema),
  });

  const name = tenant.displayName;

  /*
   * With the header off, every admin request answers for the backend's default operator whatever
   * the switcher says, so selecting would change nothing. The action is refused, not aimed.
   */
  const canTarget = config.tenantHeaderEnabled;
  // No selection means the session's own operator — a correct target when that IS this operator.
  const targeted =
    canTarget && (tenantId === tenant.id || (tenantId === null && session?.tenantId === tenant.id));

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    const role = values.role;
    const body: CreateAdminBody = {
      displayName: values.displayName.trim(),
      role,
      username: values.username.trim().toLowerCase(),
      password: values.password,
    };

    try {
      await createAdmin.mutateAsync(body);
      setOutcome({ kind: 'created', role });
      toast.success(t('tenants.addMe.createdTitle', { role: enumLabel('adminRole', role), name }));
    } catch (caught) {
      // Already an admin there is the outcome that was wanted, reached earlier. Not a failure.
      if (isApiError(caught) && caught.code === 'ADMIN_ALREADY_EXISTS') {
        setOutcome({ kind: 'exists' });
        toast.success(t('tenants.addMe.existsTitle'));
        return;
      }
      setSubmitError(caught);
      toast.error(t('tenants.addMe.errorTitle'), { description: errorMessage(caught) });
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
        <DialogTitle>{t('tenants.addMe.title', { name })}</DialogTitle>
        <DialogDescription>{t('tenants.addMe.description', { name })}</DialogDescription>
      </DialogHeader>

      {/* On screen whatever happens: which operator this writes into is the fact that matters. */}
      <div className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3">
        <p className="text-xs text-[var(--muted-foreground)]">{t('tenants.addMe.target')}</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium">
          <Building2 className="size-4 shrink-0 text-[var(--muted-foreground)]" />
          <span>{name}</span>
          <span className="font-mono text-xs text-[var(--muted-foreground)]">{tenant.slug}</span>
        </p>
      </div>

      {outcome === null ? (
        <>
          {canTarget ? (
            <Alert
              tone={targeted ? 'info' : 'warning'}
              title={
                targeted
                  ? t('tenants.addMe.targetedTitle', { name })
                  : t('tenants.addMe.selectFirstTitle')
              }
            >
              {targeted
                ? t('tenants.addMe.targetedBody', { name })
                : t('tenants.addMe.selectFirstBody', { name })}
            </Alert>
          ) : (
            <Alert tone="danger" title={t('tenants.addMe.cannotTargetTitle')}>
              {t('tenants.addMe.cannotTargetBody', { name })}
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="add-me-display-name">{t('field.displayName')}</Label>
            <Input
              id="add-me-display-name"
              autoComplete="off"
              aria-invalid={errors.displayName !== undefined}
              {...register('displayName')}
            />
            <FieldError message={errors.displayName?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-me-username">{t('tenants.addMe.usernameLabel')}</Label>
            <Input
              id="add-me-username"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              dir="ltr"
              className="font-mono"
              placeholder="you@example.com"
              aria-invalid={errors.username !== undefined}
              {...register('username')}
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              {t('tenants.addMe.usernameHint', { name })}
            </p>
            <FieldError message={errors.username?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-me-password">{t('tenants.addMe.passwordLabel')}</Label>
            <Input
              id="add-me-password"
              type="password"
              autoComplete="new-password"
              spellCheck={false}
              dir="ltr"
              aria-invalid={errors.password !== undefined}
              {...register('password')}
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              {t('tenants.addMe.passwordHint')}
            </p>
            <FieldError message={errors.password?.message} />
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm leading-none font-medium">{t('field.role')}</legend>
            <div className="space-y-2">
              {TENANT_ROLES.map((role) => (
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
                      {t(`tenants.role.${role}`)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              {t('tenants.addMe.roleHint', { name })}
            </p>
          </fieldset>

          {submitError === null ? null : (
            <Alert tone="danger" title={t('tenants.addMe.errorTitle')}>
              {errorMessage(submitError)}
            </Alert>
          )}
        </>
      ) : (
        <>
          <Alert
            tone="success"
            title={
              outcome.kind === 'created'
                ? t('tenants.addMe.createdTitle', {
                    role: enumLabel('adminRole', outcome.role),
                    name,
                  })
                : t('tenants.addMe.existsTitle')
            }
          >
            {outcome.kind === 'exists' ? t('tenants.addMe.existsBody', { name }) : null}
          </Alert>

          {/*
           * The instruction, not a hint: the credential just set opens THIS operator and no other.
           * An owner who is already signed in elsewhere has to sign out first — the session in the
           * tab is scoped to the operator it was minted for, and no amount of navigating changes it.
           */}
          <Alert tone="info" title={t('tenants.addMe.nextStepTitle', { name })}>
            {t('tenants.addMe.nextStepBody', { name })}
          </Alert>
        </>
      )}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          {outcome === null ? t('common.cancel') : t('common.close')}
        </Button>
        <PrimaryAction
          t={t}
          name={name}
          done={outcome !== null}
          canTarget={canTarget}
          targeted={targeted}
          pending={createAdmin.isPending}
          onSelect={() => {
            setTenantId(tenant.id);
          }}
        />
      </DialogFooter>
    </form>
  );
}

/**
 * One primary action at a time: select the operator, or write the row into it. Never both, because
 * two buttons would let the second be pressed while the first is still the thing that decides
 * where the write lands.
 */
function PrimaryAction({
  t,
  name,
  done,
  canTarget,
  targeted,
  pending,
  onSelect,
}: {
  t: TenantTranslator;
  name: string;
  done: boolean;
  canTarget: boolean;
  targeted: boolean;
  pending: boolean;
  onSelect: () => void;
}) {
  if (done || !canTarget) return null;

  if (targeted) {
    return (
      <Button type="submit" variant="primary" loading={pending}>
        {t('tenants.addMe.submit')}
      </Button>
    );
  }

  return (
    <Button type="button" variant="primary" onClick={onSelect}>
      {t('tenants.addMe.selectAction', { name })}
    </Button>
  );
}

function FieldError({ message }: { message: string | undefined }): ReactNode {
  if (message === undefined) return null;
  return (
    <p role="alert" className="text-sm text-[var(--danger)]">
      {message}
    </p>
  );
}
