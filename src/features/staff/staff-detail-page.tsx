import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, Pencil, ShieldOff, UserMinus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Can } from '@/components/common/can';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { CopyableValue } from '@/components/common/copy-button';
import { DetailList, DetailRow, PageHeader } from '@/components/common/page-header';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/common/states';
import { ActiveBadge, RoleBadge } from '@/components/common/status-badge';
import { TimeAgo } from '@/components/common/time';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { errorMessage, isApiError } from '@/lib/api/errors';
import { useAdmin, useApprovalLimits, useDeactivateAdmin } from '@/lib/api/queries';
import { can } from '@/lib/auth/permissions';
import { useT } from '@/lib/i18n/use-translation';
import { isCurrentLimit } from '@/types';

import { AdminFormDialog } from './admin-form-dialog';
import { ApprovalLimitTimeline } from './approval-limit-timeline';
import { staffMessages } from './messages';
import { SetLimitDialog } from './set-limit-dialog';

/**
 * One administrator: who they are, and what they are allowed to release.
 *
 * The two refusals the backend really returns here — you cannot change your own record, and the
 * last active super admin cannot be removed — are shown as the API worded them rather than guessed
 * at in advance. Disabling the button on a hunch would hide the case where the hunch is wrong; a
 * console that quietly disagrees with the server is worse than one that asks and reports.
 */

export function StaffDetailPage() {
  // Nearest match rather than a named route id, for the reason spelled out in staff-page.tsx.
  const { adminId } = useParams({ strict: false });
  const admin = useAdmin(adminId);
  const limits = useApprovalLimits(adminId);
  const deactivate = useDeactivateAdmin();
  const t = useT(staffMessages);

  const [editOpen, setEditOpen] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [refusal, setRefusal] = useState<unknown>(null);

  /** What each refusal means, keyed on the code the API actually sent back. */
  const refusalContext: Record<string, string> = {
    ADMIN_SELF_MODIFICATION: t('staff.refusal.selfModification'),
    ADMIN_LAST_SUPER_ADMIN: t('staff.refusal.lastSuperAdmin'),
  };

  if (adminId === undefined) {
    return (
      <EmptyState
        title={t('staff.detail.noAdminTitle')}
        description={t('staff.detail.noAdminBody')}
        action={
          <Button variant="secondary" size="sm" asChild>
            <Link to="/staff">{t('staff.detail.backToStaff')}</Link>
          </Button>
        }
      />
    );
  }

  if (admin.isPending) {
    return (
      <div className="space-y-5">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (admin.isError) {
    return (
      <ErrorState
        error={admin.error}
        onRetry={() => {
          void admin.refetch();
        }}
      />
    );
  }

  const row = admin.data;
  const versions = limits.data ?? [];
  const openLimit = versions.find(isCurrentLimit);
  // PLATFORM_ADMIN decides deposits but is the owner superset, exempt from the approval limit — so it
  // is never DENIED for want of one, and the "no limit in force" warning would be a false alarm.
  const decidesDeposits = can(row.role, 'deposits.decide') && row.role !== 'PLATFORM_ADMIN';

  const confirmDeactivate = async () => {
    try {
      await deactivate.mutateAsync(row.id);
      toast.success(t('staff.detail.deactivatedToast', { name: row.displayName }));
      setConfirmOpen(false);
    } catch (caught) {
      setRefusal(caught);
      toast.error(errorMessage(caught));
    }
  };

  return (
    <div className="space-y-5">
      <Link
        to="/staff"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        {/* Points back the way the reader came from, which is the other side in Arabic. */}
        <ArrowLeft className="size-3.5 rtl:rotate-180" />
        {t('staff.detail.allStaff')}
      </Link>

      <PageHeader
        title={row.displayName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <RoleBadge role={row.role} />
            <ActiveBadge isActive={row.isActive} />
            {row.username === null ? null : (
              <span className="text-[var(--muted-foreground)]">@{row.username}</span>
            )}
          </span>
        }
        actions={
          <Can capability="admins.write">
            <Button
              variant="secondary"
              onClick={() => {
                setEditOpen(true);
              }}
            >
              <Pencil className="size-4" />
              {t('common.edit')}
            </Button>
            {row.isActive ? (
              <Button
                variant="danger"
                onClick={() => {
                  setRefusal(null);
                  setConfirmOpen(true);
                }}
              >
                <UserMinus className="size-4" />
                {t('common.deactivate')}
              </Button>
            ) : null}
          </Can>
        }
      />

      {/* Only once the limits have actually loaded: a failed request is not the same as no limit. */}
      {limits.isSuccess && decidesDeposits && openLimit === undefined ? (
        <Alert tone="danger" title={t('staff.detail.noLimitTitle')}>
          {t('staff.detail.noLimitBody', { name: row.displayName })}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{t('staff.detail.identity')}</CardTitle>
            <CardDescription>{t(`staff.role.${row.role}`)}</CardDescription>
          </CardHeader>
          <CardContent>
            <DetailList>
              <DetailRow label={t('field.telegramId')}>
                {row.telegramUserId === null ? (
                  <span className="text-[var(--muted-foreground)]">{t('staff.telegram.none')}</span>
                ) : (
                  <CopyableValue value={row.telegramUserId} />
                )}
              </DetailRow>
              <DetailRow label={t('field.username')}>
                {row.username === null ? (
                  <span className="text-[var(--muted-foreground)]">{t('common.notSet')}</span>
                ) : (
                  `@${row.username}`
                )}
              </DetailRow>
              <DetailRow label={t('staff.detail.consolePassword')}>
                {row.hasPassword ? (
                  t('staff.detail.consolePasswordSet')
                ) : (
                  <span className="text-[var(--muted-foreground)]">{t('common.notSet')}</span>
                )}
              </DetailRow>
              <DetailRow label={t('field.role')}>
                <RoleBadge role={row.role} />
              </DetailRow>
              <DetailRow label={t('staff.column.account')}>
                <ActiveBadge isActive={row.isActive} />
              </DetailRow>
              <DetailRow label={t('staff.column.lastLogin')}>
                {row.lastLoginAt === null ? (
                  <span className="text-[var(--muted-foreground)]">{t('staff.neverSignedIn')}</span>
                ) : (
                  <TimeAgo value={row.lastLoginAt} />
                )}
              </DetailRow>
              <DetailRow label={t('staff.column.added')}>
                <TimeAgo value={row.createdAt} />
              </DetailRow>
              <DetailRow label={t('staff.detail.recordId')}>
                <CopyableValue value={row.id} />
              </DetailRow>
            </DetailList>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>{t('staff.detail.limitsTitle')}</CardTitle>
              <CardDescription>{t('staff.detail.limitsBody')}</CardDescription>
            </div>
            <Can capability="admins.write">
              <Button
                variant="primary"
                size="sm"
                className="shrink-0"
                onClick={() => {
                  setLimitOpen(true);
                }}
              >
                {t('staff.detail.setLimit')}
              </Button>
            </Can>
          </CardHeader>
          <CardContent>
            {limits.isPending ? (
              <CardSkeleton />
            ) : limits.isError ? (
              <ErrorState
                error={limits.error}
                onRetry={() => {
                  void limits.refetch();
                }}
              />
            ) : (
              <>
                {!decidesDeposits && openLimit === undefined ? (
                  <p className="mb-3 flex items-start gap-2 text-sm text-[var(--muted-foreground)]">
                    <ShieldOff className="mt-0.5 size-3.5 shrink-0" />
                    {t('staff.detail.noLimitNeeded')}
                  </p>
                ) : null}
                <ApprovalLimitTimeline limits={versions} adminName={row.displayName} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <AdminFormDialog open={editOpen} onOpenChange={setEditOpen} admin={row} />

      <SetLimitDialog
        open={limitOpen}
        onOpenChange={setLimitOpen}
        adminUserId={row.id}
        adminName={row.displayName}
        defaultCurrency={versions[0]?.currencyCode ?? ''}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(next) => {
          setConfirmOpen(next);
          if (!next) setRefusal(null);
        }}
        title={t('staff.detail.deactivateTitle', { name: row.displayName })}
        description={t('staff.detail.deactivateBody')}
        confirmLabel={t('common.deactivate')}
        destructive
        loading={deactivate.isPending}
        onConfirm={() => {
          void confirmDeactivate();
        }}
      >
        {refusal === null ? null : (
          <Alert tone="danger" title={t('staff.apiRefused')}>
            <p>{errorMessage(refusal)}</p>
            {isApiError(refusal) && refusalContext[refusal.code] !== undefined ? (
              <p className="mt-1">{refusalContext[refusal.code]}</p>
            ) : null}
          </Alert>
        )}
      </ConfirmDialog>
    </div>
  );
}
