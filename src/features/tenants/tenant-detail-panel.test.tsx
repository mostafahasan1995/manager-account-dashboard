import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { TENANT_IDS, mockTenants } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';

import { TenantDetailPanel } from './tenant-detail-panel';

const tenantZero = mockTenants[0]!;
const platformAdmin = { auth: { role: 'PLATFORM_ADMIN' as const } };

const envelope = (data: unknown, status = 200) =>
  HttpResponse.json(
    { success: status < 400, data, error: null, meta: { correlationId: 'test', timestamp: '' } },
    { status },
  );

describe('TenantDetailPanel', () => {
  it('shows the Ichancy and Telegram wiring for the selected tenant', async () => {
    renderPlain(
      <TenantDetailPanel tenantId={TENANT_IDS.zero} onClose={vi.fn()} onEdit={vi.fn()} />,
      platformAdmin,
    );

    expect(await screen.findByText('https://agent.ichancy.example')).toBeInTheDocument();
    expect(screen.getByText('agent_main')).toBeInTheDocument();
    expect(screen.getByText('10045')).toBeInTheDocument();
    expect(screen.getByText('-1001234567890')).toBeInTheDocument();
    expect(screen.getByText('@main_cashier_bot')).toBeInTheDocument();
    expect(screen.getByText('500,000.00 NSP')).toBeInTheDocument();
    expect(screen.getByText('30 minutes')).toBeInTheDocument();
  });

  it('reports the webhook as configured without pretending to show the token', async () => {
    renderPlain(
      <TenantDetailPanel tenantId={TENANT_IDS.zero} onClose={vi.fn()} onEdit={vi.fn()} />,
      platformAdmin,
    );

    expect(await screen.findByText('webhook configured')).toBeInTheDocument();
    expect(screen.getByText(/never returned by the API/i)).toBeInTheDocument();
  });

  it('says so when a tenant has no webhook yet', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/tenants/:id`, () =>
        envelope({ ...tenantZero, hasWebhookPath: false }),
      ),
    );

    renderPlain(
      <TenantDetailPanel tenantId={TENANT_IDS.zero} onClose={vi.fn()} onEdit={vi.fn()} />,
      platformAdmin,
    );

    expect(await screen.findByText('no webhook yet')).toBeInTheDocument();
  });

  it('shows a tenant whose counts the backend did not report', async () => {
    const { counts: _counts, ...uncounted } = tenantZero;
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/tenants/:id`, () => envelope(uncounted)),
    );

    renderPlain(
      <TenantDetailPanel tenantId={TENANT_IDS.zero} onClose={vi.fn()} onEdit={vi.fn()} />,
      platformAdmin,
    );

    expect(await screen.findAllByText('not counted')).toHaveLength(2);
  });

  it('shows the API failure rather than an empty panel', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/tenants/:id`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found.' },
            meta: { correlationId: 'test', timestamp: '' },
          },
          { status: 404 },
        ),
      ),
    );

    renderPlain(
      <TenantDetailPanel tenantId={TENANT_IDS.zero} onClose={vi.fn()} onEdit={vi.fn()} />,
      platformAdmin,
    );

    expect(await screen.findByText('Tenant not found.')).toBeInTheDocument();
    expect(screen.getByText('TENANT_NOT_FOUND')).toBeInTheDocument();
  });

  it('closes when the operator dismisses it', async () => {
    const onClose = vi.fn();
    const { user } = renderPlain(
      <TenantDetailPanel tenantId={TENANT_IDS.zero} onClose={onClose} onEdit={vi.fn()} />,
      platformAdmin,
    );

    await user.click(await screen.findByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('retries a failed read on request', async () => {
    let calls = 0;
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/tenants/:id`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              {
                success: false,
                data: null,
                error: { code: 'INTERNAL_ERROR', message: 'The platform database is unreachable.' },
                meta: { correlationId: 'test', timestamp: '' },
              },
              { status: 500 },
            )
          : envelope(tenantZero);
      }),
    );

    const { user } = renderPlain(
      <TenantDetailPanel tenantId={TENANT_IDS.zero} onClose={vi.fn()} onEdit={vi.fn()} />,
      platformAdmin,
    );

    await user.click(await screen.findByRole('button', { name: /try again/i }));

    expect(await screen.findByText('webhook configured')).toBeInTheDocument();
  });

  it('hands the tenant to the editor when a platform admin asks to edit it', async () => {
    const onEdit = vi.fn();
    const { user } = renderPlain(
      <TenantDetailPanel tenantId={TENANT_IDS.zero} onClose={vi.fn()} onEdit={onEdit} />,
      platformAdmin,
    );

    await user.click(await screen.findByRole('button', { name: /edit settings/i }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ slug: 'tenant-zero' }));
  });

  it('offers no editing or status change to a role that cannot manage tenants', async () => {
    renderPlain(
      <TenantDetailPanel tenantId={TENANT_IDS.zero} onClose={vi.fn()} onEdit={vi.fn()} />,
      { auth: { role: 'SUPER_ADMIN' } },
    );

    expect(await screen.findByText('webhook configured')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit settings/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /suspend/i })).not.toBeInTheDocument();
  });
});
