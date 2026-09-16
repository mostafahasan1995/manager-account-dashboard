import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { TENANT_IDS, mockTenants } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';

import { TenantDetailPanel } from './tenant-detail-panel';

const tenantZero = mockTenants[0]!;
const northern = mockTenants[1]!;
const platformAdmin = { auth: { role: 'PLATFORM_ADMIN' as const } };

const envelope = (data: unknown, status = 200) =>
  HttpResponse.json(
    { success: status < 400, data, error: null, meta: { correlationId: 'test', timestamp: '' } },
    { status },
  );

describe('TenantDetailPanel', () => {
  it('shows the Ichancy and Telegram wiring for the selected tenant', async () => {
    // An OPERATOR: the Telegram and Ichancy panels this reads are not rendered for tenant zero,
    // because the backend refuses a new bot token and an Ichancy edit for the platform.
    renderPlain(
      <TenantDetailPanel tenantId={TENANT_IDS.second} onClose={vi.fn()} onEdit={vi.fn()} />,
      platformAdmin,
    );

    expect(await screen.findByText('https://agent.ichancy.example')).toBeInTheDocument();
    expect(screen.getByText('agent_north')).toBeInTheDocument();
    expect(screen.getByText('10099')).toBeInTheDocument();
    expect(screen.getByText('-1001111111111')).toBeInTheDocument();
    expect(screen.getByText('@northern_cashier_bot')).toBeInTheDocument();
    expect(screen.getByText('380,000.00 NSP')).toBeInTheDocument();
    expect(screen.getByText('45 minutes')).toBeInTheDocument();
  });

  it('reports the webhook as configured without pretending to show the token', async () => {
    renderPlain(
      <TenantDetailPanel tenantId={TENANT_IDS.zero} onClose={vi.fn()} onEdit={vi.fn()} />,
      platformAdmin,
    );

    expect(await screen.findByText('path token generated')).toBeInTheDocument();
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

    expect(await screen.findByText('no path token')).toBeInTheDocument();
  });

  it('says in red that an operator has no staff group, and what that stops', async () => {
    renderPlain(
      <TenantDetailPanel tenantId={TENANT_IDS.suspended} onClose={vi.fn()} onEdit={vi.fn()} />,
      platformAdmin,
    );

    expect(await screen.findByText('No staff group yet')).toBeInTheDocument();
    expect(
      screen.getByText(/stays suspended and cannot be activated until its staff group is bound/),
    ).toBeInTheDocument();
    expect(screen.getByText('Not bound')).toBeInTheDocument();
  });

  it('warns that an active operator with no staff group refuses new deposits', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/tenants/:id`, () =>
        envelope({ ...northern, adminChatId: null }),
      ),
    );

    renderPlain(
      <TenantDetailPanel tenantId={TENANT_IDS.second} onClose={vi.fn()} onEdit={vi.fn()} />,
      { auth: { role: 'SUPER_ADMIN' } },
    );

    expect(await screen.findByText('No staff group yet')).toBeInTheDocument();
    expect(screen.getByText(/every new deposit is refused/)).toBeInTheDocument();
  });

  // What the backend really answers for tenant zero: ACTIVE, with no staff group and no feed group.
  const platformAsTheBackendAnswersIt = () => {
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/tenants/:id`, () =>
        envelope({ ...tenantZero, adminChatId: null, feedChatId: null }),
      ),
    );
  };

  it('treats tenant zero as the platform: no staff-group warning, one neutral line', async () => {
    platformAsTheBackendAnswersIt();

    renderPlain(
      <TenantDetailPanel tenantId={TENANT_IDS.zero} onClose={vi.fn()} onEdit={vi.fn()} />,
      { auth: { role: 'SUPER_ADMIN' } },
    );

    expect(
      await screen.findByText(
        'The platform itself has no staff group or feed group: those belong to each operator.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('No staff group yet')).not.toBeInTheDocument();
    expect(screen.queryByText(/every new deposit is refused/)).not.toBeInTheDocument();
    expect(screen.queryByText('Not bound')).not.toBeInTheDocument();
  });

  it('says the platform has no groups in Arabic, and its checklist offers no group step', async () => {
    platformAsTheBackendAnswersIt();

    renderPlain(
      <TenantDetailPanel tenantId={TENANT_IDS.zero} onClose={vi.fn()} onEdit={vi.fn()} />,
      { ...platformAdmin, locale: 'ar' },
    );

    expect(
      await screen.findByText(
        'المنصة نفسها ليس لها مجموعة موظفين ولا مجموعة إشعارات: هاتان المجموعتان تخصّان كل مشغّل.',
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText('قائمة خطوات الإعداد')).toBeInTheDocument();
    expect(document.querySelector('[data-step="staff-group"]')).toBeNull();
    expect(document.querySelector('[data-step="feed-group"]')).toBeNull();
    expect(screen.queryByText('لا توجد مجموعة موظفين بعد')).not.toBeInTheDocument();
  });

  it('offers the platform no Suspend, and keeps what the backend still allows', async () => {
    platformAsTheBackendAnswersIt();

    renderPlain(
      <TenantDetailPanel tenantId={TENANT_IDS.zero} onClose={vi.fn()} onEdit={vi.fn()} />,
      platformAdmin,
    );

    expect(await screen.findByText('path token generated')).toBeInTheDocument();
    // Suspending tenant zero is refused: it would lock every platform admin out of sign-in.
    expect(screen.queryByRole('button', { name: 'Suspend' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activate' })).not.toBeInTheDocument();
    // Not a blanket hiding of the footer — editing its settings is not refused.
    expect(screen.getByRole('button', { name: /edit settings/i })).toBeInTheDocument();
  });

  it('still offers Suspend for an operator', async () => {
    renderPlain(
      <TenantDetailPanel tenantId={TENANT_IDS.second} onClose={vi.fn()} onEdit={vi.fn()} />,
      platformAdmin,
    );

    expect(await screen.findByRole('button', { name: 'Suspend' })).toBeInTheDocument();
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

    expect(await screen.findByText('path token generated')).toBeInTheDocument();
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

    expect(await screen.findByText('path token generated')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit settings/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /suspend/i })).not.toBeInTheDocument();
  });
});

/**
 * The bot settings, read from the platform side. A word and a colour for each mode, the URL as a
 * link, and an honest sentence under each — because "Automatic" on its own reads as "the platform
 * moves money on the player's word alone", which neither mode ever does.
 *
 * `detailRow` scopes a query to one `<dt>/<dd>` pair (see `DetailRow` in page-header.tsx): the
 * deposit and withdrawal badges share the exact same two words ("Manual"/"Automatic",
 * "يدوي"/"تلقائي"), so a bare `getByText` is ambiguous the moment both rows are on screen — this
 * also proves each badge sits under the row that claims it, not merely that the word exists.
 */
// `find*`, not `get*`: the panel shows a loading skeleton until the tenant fetch resolves, and a
// caller right after render has often not awaited anything else first.
const detailRow = async (label: string) => within((await screen.findByText(label)).closest('div')!);

describe('TenantDetailPanel — deposits, cash-outs and the mini app', () => {
  it('reads manual for both modes and no URL for an operator that has none set', async () => {
    renderPlain(
      <TenantDetailPanel tenantId={TENANT_IDS.zero} onClose={vi.fn()} onEdit={vi.fn()} />,
      platformAdmin,
    );

    expect(await screen.findByText('Deposits, cash-outs and the mini app')).toBeInTheDocument();
    expect((await detailRow('Deposit mode')).getByText('Manual')).toBeInTheDocument();
    expect((await detailRow('Withdrawal mode')).getByText('Manual')).toBeInTheDocument();
    expect(screen.getByText('Not set')).toBeInTheDocument();
    expect(screen.getByText(/an admin decides every deposit/i)).toBeInTheDocument();
    expect(
      screen.getByText(/a person still sends the money and marks it paid/i),
    ).toBeInTheDocument();
  });

  it('reads automatic for both modes and links the URL for an operator that set everything', async () => {
    renderPlain(
      <TenantDetailPanel tenantId={TENANT_IDS.second} onClose={vi.fn()} onEdit={vi.fn()} />,
      platformAdmin,
    );

    expect((await detailRow('Deposit mode')).getByText('Automatic')).toBeInTheDocument();
    expect((await detailRow('Withdrawal mode')).getByText('Automatic')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'https://northern-cashier.example.app' });
    expect(link).toHaveAttribute('href', 'https://northern-cashier.example.app');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('reads an operator from a backend older than either setting as manual', async () => {
    const { depositMode: _dMode, withdrawalMode: _wMode, miniAppUrl: _url, ...older } = tenantZero;
    server.use(http.get(`${config.apiBaseUrl}/v1/admin/tenants/:id`, () => envelope(older)));

    renderPlain(
      <TenantDetailPanel tenantId={TENANT_IDS.zero} onClose={vi.fn()} onEdit={vi.fn()} />,
      platformAdmin,
    );

    expect((await detailRow('Deposit mode')).getByText('Manual')).toBeInTheDocument();
    expect((await detailRow('Withdrawal mode')).getByText('Manual')).toBeInTheDocument();
    expect(screen.getByText('Not set')).toBeInTheDocument();
  });

  it('names the section and both modes in Arabic', async () => {
    renderPlain(
      <TenantDetailPanel tenantId={TENANT_IDS.second} onClose={vi.fn()} onEdit={vi.fn()} />,
      { ...platformAdmin, locale: 'ar' },
    );

    expect(await screen.findByText('الإيداعات والسحوبات والتطبيق المصغّر')).toBeInTheDocument();
    expect((await detailRow('طريقة التحقق من الإيداع')).getByText('تلقائي')).toBeInTheDocument();
    expect((await detailRow('طريقة السحب')).getByText('تلقائي')).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });
});
