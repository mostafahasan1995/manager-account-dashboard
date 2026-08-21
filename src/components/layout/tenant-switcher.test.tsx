import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { AuthContext, type AuthState } from '@/lib/auth/auth-context';
import { TENANT_IDS } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { createTestAuth, renderWithProviders } from '@/test/utils';
import type { AdminRole } from '@/types/enums';

import { TenantScopeStrip, TenantSwitcher } from './tenant-switcher';

/**
 * The switcher decides WHOSE money is on screen, so the two things worth proving are that it appears
 * for exactly one role, and that it never appears when the backend would ignore it anyway. A
 * selector that looks like it works but is discarded server-side is worse than none at all.
 */

const renderSwitcher = (role: AdminRole, tenantHeaderEnabled = true) => {
  vi.spyOn(config, 'tenantHeaderEnabled', 'get').mockReturnValue(tenantHeaderEnabled);
  return renderWithProviders(<TenantSwitcher />, { auth: { role } });
};

describe('who sees it', () => {
  it('is offered to a platform admin, who is the only role the backend honours it for', async () => {
    renderSwitcher('PLATFORM_ADMIN');
    expect(await screen.findByRole('button')).toBeInTheDocument();
  });

  it.each<AdminRole>(['SUPER_ADMIN', 'FINANCE_ADMIN', 'REVIEWER', 'SUPPORT', 'VIEWER'])(
    'is hidden from %s, whose X-Tenant-Id the backend ignores',
    (role) => {
      const { container } = renderSwitcher(role);
      expect(container).toBeEmptyDOMElement();
    },
  );

  it('is hidden entirely when the tenant header is switched off', () => {
    const { container } = renderSwitcher('PLATFORM_ADMIN', false);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('choosing an operator', () => {
  it('lists the operators and names the one currently selected', async () => {
    const { user } = renderSwitcher('PLATFORM_ADMIN');

    await user.click(await screen.findByRole('button'));

    expect(await screen.findByRole('menuitem', { name: /main operation/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /northern branch/i })).toBeInTheDocument();
  });

  it('marks a suspended operator, because its data is still readable and still different', async () => {
    const { user } = renderSwitcher('PLATFORM_ADMIN');

    await user.click(await screen.findByRole('button'));

    const pilot = await screen.findByRole('menuitem', { name: /pilot operator/i });
    expect(pilot).toHaveTextContent(/suspended/i);
  });

  it('offers a way back to the operator you actually belong to', async () => {
    const { user } = renderSwitcher('PLATFORM_ADMIN');

    await user.click(await screen.findByRole('button'));
    expect(await screen.findByRole('menuitem', { name: /your own operator/i })).toBeInTheDocument();
  });
});

/**
 * The strip is the only thing on a busy screen that says whose money is on it. Its two failure
 * modes are opposite and equally bad: absent while another operator is selected, or present while
 * you are reading your own — the second is what teaches people to stop reading it.
 */
const renderStrip = (options: { tenantId: string | null; homeTenantId?: string } = { tenantId: TENANT_IDS.second }) => {
  vi.spyOn(config, 'tenantHeaderEnabled', 'get').mockReturnValue(true);
  const setTenantId = vi.fn();
  const base = createTestAuth({ role: 'PLATFORM_ADMIN', tenantId: options.tenantId });
  const session =
    base.session === null
      ? null
      : {
          ...base.session,
          ...(options.homeTenantId === undefined ? {} : { tenantId: options.homeTenantId }),
        };
  const auth: AuthState = { ...base, session, setTenantId };

  return {
    ...renderWithProviders(
      <AuthContext value={auth}>
        <TenantScopeStrip />
      </AuthContext>,
      { auth: { role: 'PLATFORM_ADMIN', tenantId: options.tenantId } },
    ),
    setTenantId,
  };
};

describe('the strip under the top bar', () => {
  it('names the operator being read whenever it is not your own', async () => {
    renderStrip({ tenantId: TENANT_IDS.second });

    expect(await screen.findByText(/you are reading northern branch/i)).toBeInTheDocument();
  });

  it('stays out of the way when nothing is selected, which means your own operator', () => {
    const { container } = renderStrip({ tenantId: null });
    expect(container).toBeEmptyDOMElement();
  });

  it('stays out of the way when the selection IS your own operator', () => {
    const { container } = renderStrip({
      tenantId: TENANT_IDS.zero,
      homeTenantId: TENANT_IDS.zero,
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('names the id while the operator list is still loading, rather than nothing', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/tenants`, () => HttpResponse.json(null, { status: 500 })),
    );

    renderStrip({ tenantId: 'a-tenant-nobody-has-listed' });

    expect(await screen.findByText(/a-tenant-nobody-has-listed/)).toBeInTheDocument();
  });

  it('gets you back to your own operator in one click', async () => {
    const { user, setTenantId } = renderStrip({ tenantId: TENANT_IDS.second });

    await user.click(await screen.findByRole('button', { name: /your own operator/i }));

    expect(setTenantId).toHaveBeenCalledWith(null);
  });
});
