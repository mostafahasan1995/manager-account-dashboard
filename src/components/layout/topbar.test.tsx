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
