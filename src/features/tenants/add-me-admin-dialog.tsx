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

const addMeSchemaFor = (t: TenantTranslator) =>
  z.object({
    displayName: z
      .string()
      .trim()
      .min(1, t('tenants.addMe.displayNameRequired'))
      .max(120, t('tenants.addMe.displayNameLong')),
    // Narrower than the shared role schema on purpose: only what this dialog offers can be sent.
    role: z.enum(TENANT_ROLES),
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
    // The signed-in identity, not a blank form: this action is about THIS account, and retyping a
    // 64-bit Telegram id from memory is how a row lands under somebody else's id.
    defaultValues: { displayName: admin.displayName, role: 'SUPER_ADMIN' },
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
      telegramUserId: admin.telegramUserId,
      displayName: values.displayName.trim(),
      role,
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
            <p className="text-sm leading-none font-medium">{t('tenants.addMe.you')}</p>
            <p className="font-mono text-sm">{admin.telegramUserId}</p>
            <p className="text-xs text-[var(--muted-foreground)]">{t('tenants.addMe.youHint')}</p>
          </div>

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
           * The instruction, not a hint: a /console code is minted by ONE bot and is scoped to the
           * operator that bot belongs to. Sending it to the bot already open on a phone is how an
           * owner signs into the operator they were trying to leave.
           */}
          <Alert tone="info" title={t('tenants.addMe.nextStepTitle', { name })}>
            {tenant.botUsername === null
              ? t('tenants.addMe.nextStepNoBot', { name })
              : t('tenants.addMe.nextStepWithBot', { bot: tenant.botUsername, name })}
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
