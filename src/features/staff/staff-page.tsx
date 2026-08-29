import { useNavigate, useSearch } from '@tanstack/react-router';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';

import { pruneSearch } from '@/app/search-schemas';
import { Can } from '@/components/common/can';
import { PageHeader } from '@/components/common/page-header';
import { Pagination } from '@/components/common/pagination';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAdmins, useOpenApprovalLimits } from '@/lib/api/queries';
import { can } from '@/lib/auth/permissions';
import { useT } from '@/lib/i18n/use-translation';
import type { AdminListQuery } from '@/types';

import { AdminFormDialog } from './admin-form-dialog';
import { staffMessages } from './messages';
import { StaffFilters, type StaffFilterState } from './staff-filters';
import { StaffTable } from './staff-table';

/**
 * The staff directory: who can move money, and how much.
 *
 * Reading it needs `admins.read` (finance admins and super admins); every change on this screen and
 * the one behind it is `admins.write`, which only a SUPER_ADMIN holds. That split is the whole
 * point of the screen, so a finance admin sees the directory in full and not one write control.
 */

const DEFAULT_LIMIT = 20;

export function StaffPage() {
  // No `from`: this screen hangs off the pathless layout that requires a session, and for those
  // routes TanStack's type-level id (`/protected/staff`) is not the one it registers at runtime
  // (`/staff`), so naming either breaks the build or the app. The nearest match is exact anyway —
  // only the staff route renders this — so what comes back is always staffSearchSchema's output.
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const t = useT(staffMessages);
  const [addOpen, setAddOpen] = useState(false);

  const query: AdminListQuery = {
    ...(search.role === undefined ? {} : { role: search.role }),
    ...(search.isActive === undefined ? {} : { isActive: search.isActive }),
    limit: search.limit ?? DEFAULT_LIMIT,
    offset: search.offset ?? 0,
  };
  const admins = useAdmins(query);
  const rows = admins.data?.data ?? [];

  // Only the roles that actually decide deposits AND are bound by a limit are checked for one: a
  // limit on a support account would be a number nobody ever evaluates, and flagging its absence
  // would be noise. PLATFORM_ADMIN decides deposits but is the owner superset — exempt from the
  // approval limit — so its approvals are never DENIED for want of one, and flagging it is the same
  // noise.
  const deciderIds = rows
    .filter((row) => row.isActive && can(row.role, 'deposits.decide') && row.role !== 'PLATFORM_ADMIN')
    .map((row) => row.id);
  const limits = useOpenApprovalLimits(deciderIds);
  const noOpenLimit = new Set(
    limits.isPending ? [] : deciderIds.filter((id) => !limits.openByAdminId.has(id)),
  );

  const filtered = search.role !== undefined || search.isActive !== undefined;

  const applyFilters = (next: StaffFilterState) => {
    void navigate({
      to: '/staff',
      search: (prev) =>
        pruneSearch({ ...prev, role: next.role, isActive: next.isActive, offset: undefined }),
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('nav.staff')}
        description={t('staff.description')}
        actions={
          <Can capability="admins.write">
            <Button
              variant="primary"
              onClick={() => {
                setAddOpen(true);
              }}
            >
              <UserPlus className="size-4" />
              {t('staff.add')}
            </Button>
          </Can>
        }
      />

      <StaffFilters role={search.role} isActive={search.isActive} onChange={applyFilters} />

      <Card>
        {admins.isPending ? (
          <TableSkeleton rows={6} columns={7} />
        ) : admins.isError ? (
          <ErrorState
            error={admins.error}
            onRetry={() => {
              void admins.refetch();
            }}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title={filtered ? t('staff.empty.filteredTitle') : t('staff.empty.title')}
            description={filtered ? t('staff.empty.filteredBody') : t('staff.empty.body')}
            {...(filtered
              ? {
                  action: (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        applyFilters({ role: undefined, isActive: undefined });
                      }}
                    >
                      {t('staff.empty.showAll')}
                    </Button>
                  ),
                }
              : {})}
          />
        ) : (
          <>
            <StaffTable admins={rows} noOpenLimit={noOpenLimit} />
            <Pagination
              meta={admins.data.meta}
              disabled={admins.isFetching}
              onOffsetChange={(offset) => {
                void navigate({
                  to: '/staff',
                  search: (prev) =>
                    pruneSearch({ ...prev, offset: offset === 0 ? undefined : offset }),
                });
              }}
            />
          </>
        )}
      </Card>

      <AdminFormDialog open={addOpen} onOpenChange={setAddOpen} admin={null} />
    </div>
  );
}
