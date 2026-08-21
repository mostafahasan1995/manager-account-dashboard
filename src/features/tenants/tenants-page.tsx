import { useNavigate, useSearch } from '@tanstack/react-router';
import { Building2, Plus } from 'lucide-react';
import { useState } from 'react';

import { pruneSearch, type TenantSearch } from '@/app/search-schemas';
import { Can } from '@/components/common/can';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/states';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTenants } from '@/lib/api/queries';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import type { Tenant } from '@/types';
import { TENANT_STATUSES } from '@/types/enums';

import { tenantMessages } from './messages';
import { TenantDetailPanel } from './tenant-detail-panel';
import { TenantFormDialog } from './tenant-form-dialog';
import { TenantList } from './tenant-list';

/**
 * Tenants — the platform screen.
 *
 * `GET /v1/admin/tenants` takes no query parameters, so the status filter is applied here over the
 * whole list the API already returned. That is fine at this size and would not be at a thousand
 * tenants; when it stops being fine the backend needs a `status` param, not a paginator here.
 *
 * Editing closes the detail panel rather than opening a dialog on top of it, and saving reopens the
 * panel on the tenant that was just written, so the operator always ends up reading the row they
 * changed instead of the form they changed it in.
 */
export function TenantsPage() {
  const search = useSearch({ from: '/tenants' });
  const navigate = useNavigate();
  const tenantsQuery = useTenants();
  const [editing, setEditing] = useState<Tenant | null>(null);
  const t = useT(tenantMessages);
  const enumLabel = useEnumLabel();

  const setSearch = (patch: Partial<TenantSearch>) => {
    void navigate({ to: '.', search: (prev) => pruneSearch({ ...prev, ...patch }) });
  };

  const tenants = tenantsQuery.data ?? [];
  const visible =
    search.status === undefined
      ? tenants
      : tenants.filter((tenant) => tenant.status === search.status);

  const createOpen = search.create === true;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('tenants.title')}
        description={t('tenants.description')}
        actions={
          <Can capability="tenants.manage">
            <Button
              variant="primary"
              onClick={() => {
                setSearch({ create: true });
              }}
            >
              <Plus className="size-4" />
              {t('tenants.new')}
            </Button>
          </Can>
        }
      />

      <Alert tone="info" title={t('tenants.crossTenant.title')}>
        {t('tenants.crossTenant.body')}
      </Alert>

      <div role="group" aria-label={t('tenants.filterByStatus')} className="flex flex-wrap gap-1.5">
        <StatusFilterButton
          label={t('common.all')}
          active={search.status === undefined}
          onClick={() => {
            setSearch({ status: undefined });
          }}
        />
        {TENANT_STATUSES.map((status) => (
          <StatusFilterButton
            key={status}
            label={enumLabel('tenantStatus', status)}
            active={search.status === status}
            onClick={() => {
              setSearch({ status });
            }}
          />
        ))}
      </div>

      <Card>
        {tenantsQuery.isPending ? <TableSkeleton rows={4} columns={6} /> : null}

        {tenantsQuery.isError ? (
          <ErrorState
            error={tenantsQuery.error}
            onRetry={() => {
              void tenantsQuery.refetch();
            }}
          />
        ) : null}

        {tenantsQuery.isSuccess && visible.length === 0 ? (
          <EmptyState
            icon={<Building2 className="size-5" />}
            title={
              tenants.length === 0 ? t('tenants.empty.noneTitle') : t('tenants.empty.filteredTitle')
            }
            description={
              tenants.length === 0 ? t('tenants.empty.noneBody') : t('tenants.empty.filteredBody')
            }
            action={
              tenants.length === 0 ? (
                <Can capability="tenants.manage">
                  <Button
                    variant="primary"
                    onClick={() => {
                      setSearch({ create: true });
                    }}
                  >
                    <Plus className="size-4" />
                    {t('tenants.new')}
                  </Button>
                </Can>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch({ status: undefined });
                  }}
                >
                  {t('tenants.showAll')}
                </Button>
              )
            }
          />
        ) : null}

        {tenantsQuery.isSuccess && visible.length > 0 ? (
          <TenantList
            tenants={visible}
            selectedId={search.selected ?? null}
            onSelect={(tenantId) => {
              setSearch({ selected: tenantId });
            }}
          />
        ) : null}
      </Card>

      {search.selected === undefined ? null : (
        <TenantDetailPanel
          tenantId={search.selected}
          onClose={() => {
            setSearch({ selected: undefined });
          }}
          onEdit={(tenant) => {
            setEditing(tenant);
            setSearch({ selected: undefined });
          }}
        />
      )}

      <TenantFormDialog
        open={createOpen || editing !== null}
        tenant={editing}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setSearch({ create: undefined });
          }
        }}
        onSaved={(tenant) => {
          setEditing(null);
          setSearch({ create: undefined, selected: tenant.id });
        }}
      />
    </div>
  );
}

function StatusFilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'primary' : 'secondary'}
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
