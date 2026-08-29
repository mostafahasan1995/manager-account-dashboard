import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/utils';

import { HealthPill } from './health-pill';
import { TenantNotice } from './tenant-notice';
import { Topbar } from './topbar';

describe('Topbar', () => {
  it('names the signed-in admin and their role', async () => {
    renderWithProviders(<Topbar onOpenNav={vi.fn()} />, { auth: { role: 'FINANCE_ADMIN' } });

    expect(await screen.findByText('Test Admin')).toBeInTheDocument();
    expect(screen.getByText('Finance admin')).toBeInTheDocument();
  });

  it('shows how long the session has left, because nothing will refresh it', async () => {
    renderWithProviders(<Topbar onOpenNav={vi.fn()} />, { auth: { role: 'REVIEWER' } });
    // The test session is an hour out.
    expect(await screen.findByText(/1h 00m|59m/)).toBeInTheDocument();
  });

  it('signs out from the account menu', async () => {
    const signOut = vi.fn();
    const { user } = renderWithProviders(<Topbar onOpenNav={vi.fn()} />, {
      auth: { role: 'REVIEWER', signOut },
    });

    await user.click(await screen.findByRole('button', { name: /account menu/i }));
    await user.click(await screen.findByRole('menuitem', { name: /sign out/i }));

    expect(signOut).toHaveBeenCalledWith('manual');
  });

  it('opens the navigation drawer on small screens', async () => {
    const onOpenNav = vi.fn();
    const { user } = renderWithProviders(<Topbar onOpenNav={onOpenNav} />, {
      auth: { role: 'REVIEWER' },
    });

    await user.click(await screen.findByRole('button', { name: /open navigation/i }));
    expect(onOpenNav).toHaveBeenCalled();
  });

  it('cycles the theme preference', async () => {
    const { user } = renderWithProviders(<Topbar onOpenNav={vi.fn()} />, {
      auth: { role: 'REVIEWER' },
    });

    const toggle = await screen.findByRole('button', { name: /switch theme, currently system/i });
    await user.click(toggle);

    expect(await screen.findByRole('button', { name: /currently light/i })).toBeInTheDocument();
  });

  /*
   * ── The float is IN the bar, not merely built ─────────────────────────────────────────────
   *
   * The two cases below are the guard for a failure that has already happened once: the agent float
   * had a component and a green test file of its own, and appeared on no screen in the console,
   * because nothing rendered it. A component test cannot catch that — it mounts the component
   * itself. Only the bar can say whether the bar carries it.
   *
   * The operator asked three times for this number. Whatever else changes about the top bar, the
   * float stays in it, and the request behind it stays unable to take the bar down with it.
   */
  it('carries the agent float, because a pill on no screen is a pill nobody reads', async () => {
    renderWithProviders(<Topbar onOpenNav={vi.fn()} />, { auth: { role: 'FINANCE_ADMIN' } });

    expect(await screen.findByText('Agent float')).toBeInTheDocument();
    expect(screen.getByText('4,437,500.00 NSP')).toBeInTheDocument();
  });

  it('survives a float read that fails, since this bar renders above every screen', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/reconciliation/agent-float`, () =>
        HttpResponse.error(),
      ),
    );

    renderWithProviders(<Topbar onOpenNav={vi.fn()} />, { auth: { role: 'FINANCE_ADMIN' } });

    // The endpoint does not exist on the backend yet, so this is today's state on every route: the
    // pill goes quiet and everything an operator navigates and signs out with is still there.
    expect(await screen.findByText('Test Admin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open navigation/i })).toBeInTheDocument();
    expect(screen.queryByText('Agent float')).not.toBeInTheDocument();
  });
});

describe('HealthPill', () => {
  it('reports a healthy API', async () => {
    renderWithProviders(<HealthPill />);
    expect(await screen.findByText('API healthy')).toBeInTheDocument();
  });

  it('says the API is unreachable rather than letting a screen look merely empty', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/health/live`, () => HttpResponse.error()),
      http.get(`${config.apiBaseUrl}/health/ready`, () => HttpResponse.error()),
    );

    renderWithProviders(<HealthPill />);
    expect(await screen.findByText('API unreachable')).toBeInTheDocument();
  });

  it('reports degraded when a dependency is down but the process is alive', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/health/ready`, () =>
        HttpResponse.json(
          {
            success: true,
            data: {
              status: 'error',
              info: { database: { status: 'up' } },
              error: { redis: { status: 'down' } },
              details: {},
            },
            error: null,
            meta: { correlationId: 'c', timestamp: 't' },
          },
          { status: 503 },
        ),
      ),
    );

    renderWithProviders(<HealthPill />);
    expect(await screen.findByText('API degraded')).toBeInTheDocument();
  });
});

describe('TenantNotice', () => {
  it('states plainly that everything but tenant management is single-tenant today', async () => {
    renderWithProviders(<TenantNotice />);
    expect(await screen.findByText(/single-tenant mode/i)).toBeInTheDocument();
    expect(screen.getByText(/does not accept a tenant claim/i)).toBeInTheDocument();
  });

  it('disappears once the backend accepts a tenant claim', async () => {
    vi.spyOn(config, 'tenantHeaderEnabled', 'get').mockReturnValue(true);
    const { container } = renderWithProviders(<TenantNotice />);

    await vi.waitFor(() => {
      expect(container.querySelector('p')).toBeNull();
    });
  });
});
