import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { mockTenants } from '@/mocks/fixtures';
import { renderPlain } from '@/test/utils';
import type { Tenant } from '@/types';

import { TenantList } from './tenant-list';

const tenantZero = mockTenants[0]!;
const suspended = mockTenants[2]!;

describe('TenantList', () => {
  it('puts the tenants in a real table, one row each', () => {
    renderPlain(<TenantList tenants={mockTenants} selectedId={null} onSelect={vi.fn()} />);

    const rows = screen.getAllByRole('row');
    // One header row plus one per tenant.
    expect(rows).toHaveLength(mockTenants.length + 1);
    expect(screen.getByRole('columnheader', { name: 'Tenant' })).toBeInTheDocument();
  });

  it('shows the thresholds as amounts in the tenant currency, never as raw minor units', () => {
    renderPlain(<TenantList tenants={[tenantZero]} selectedId={null} onSelect={vi.fn()} />);

    expect(screen.getByText('500,000.00 NSP')).toBeInTheDocument();
    expect(screen.getByText('1,000,000.00 NSP')).toBeInTheDocument();
    expect(screen.queryByText('50000000')).not.toBeInTheDocument();
  });

  it('says the status as a word, not only as a colour', () => {
    renderPlain(<TenantList tenants={mockTenants} selectedId={null} onSelect={vi.fn()} />);

    expect(screen.getAllByText('Active')).toHaveLength(2);
    expect(screen.getByText('Suspended')).toBeInTheDocument();
  });

  it('distinguishes a tenant whose counts were not reported from one with none', () => {
    const { counts: _counts, ...uncounted } = tenantZero;
    const empty: Tenant = { ...suspended, counts: { players: 0, deposits: 0 } };

    renderPlain(<TenantList tenants={[uncounted, empty]} selectedId={null} onSelect={vi.fn()} />);

    const uncountedRow = screen.getByRole('button', { name: /main operation/i }).closest('tr');
    expect(uncountedRow).not.toBeNull();
    expect(within(uncountedRow!).getAllByText('not counted')).toHaveLength(2);

    const emptyRow = screen.getByRole('button', { name: /pilot operator/i }).closest('tr');
    expect(within(emptyRow!).getAllByText('0')).toHaveLength(2);
  });

  it('reports a tenant that has no bot username yet', () => {
    renderPlain(<TenantList tenants={[suspended]} selectedId={null} onSelect={vi.fn()} />);

    expect(screen.getByText('no bot yet')).toBeInTheDocument();
  });

  it('selects a tenant by name and marks the current one', async () => {
    const onSelect = vi.fn();
    const { user } = renderPlain(
      <TenantList tenants={mockTenants} selectedId={tenantZero.id} onSelect={onSelect} />,
    );

    expect(screen.getByRole('button', { name: /main operation/i })).toHaveAttribute(
      'aria-current',
      'true',
    );

    await user.click(screen.getByRole('button', { name: /northern branch/i }));
    expect(onSelect).toHaveBeenCalledWith(mockTenants[1]!.id);
  });
});
