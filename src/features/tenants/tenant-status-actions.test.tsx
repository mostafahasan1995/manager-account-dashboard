import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { mockTenants } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';

import { TenantStatusActions } from './tenant-status-actions';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const activeTenant = mockTenants[0]!;
const suspendedTenant = mockTenants[2]!;
const platformAdmin = { auth: { role: 'PLATFORM_ADMIN' as const } };

describe('TenantStatusActions', () => {
  it('offers suspend for a live tenant and activate for a stopped one', () => {
    const { unmount } = renderPlain(
      <TenantStatusActions tenant={activeTenant} />,
      platformAdmin,
    );
    expect(screen.getByRole('button', { name: 'Suspend' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activate' })).not.toBeInTheDocument();
    unmount();

    renderPlain(<TenantStatusActions tenant={suspendedTenant} />, platformAdmin);
    expect(screen.getByRole('button', { name: 'Activate' })).toBeInTheDocument();
  });

  it('will not suspend until the operator types the slug', async () => {
    const { user } = renderPlain(<TenantStatusActions tenant={activeTenant} />, platformAdmin);

    await user.click(screen.getByRole('button', { name: 'Suspend' }));

    const confirm = await screen.findByRole('button', { name: 'Suspend tenant' });
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText('Type tenant-zero to confirm'), 'tenant-zer');
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText('Type tenant-zero to confirm'), 'o');
    expect(confirm).toBeEnabled();
  });

  it('says what suspending stops and what it does not', async () => {
    const { user } = renderPlain(<TenantStatusActions tenant={activeTenant} />, platformAdmin);

    await user.click(screen.getByRole('button', { name: 'Suspend' }));

    expect(await screen.findByText(/bot stops answering/i)).toBeInTheDocument();
    expect(screen.getByText(/already in flight still land/i)).toBeInTheDocument();
  });

  it('suspends once the slug matches, and reports it', async () => {
    const { user } = renderPlain(<TenantStatusActions tenant={activeTenant} />, platformAdmin);

    await user.click(screen.getByRole('button', { name: 'Suspend' }));
    await user.type(screen.getByLabelText('Type tenant-zero to confirm'), 'tenant-zero');
    await user.click(screen.getByRole('button', { name: 'Suspend tenant' }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Main operation is suspended',
        expect.objectContaining({ description: expect.stringContaining('stopped answering') }),
      );
    });
  });

  it('warns that activating runs a real Ichancy sign-in', async () => {
    const { user } = renderPlain(<TenantStatusActions tenant={suspendedTenant} />, platformAdmin);

    await user.click(screen.getByRole('button', { name: 'Activate' }));

    expect(await screen.findByText(/signs in to Ichancy/i)).toBeInTheDocument();
  });

  it('surfaces the API message when that sign-in fails', async () => {
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/tenants/:id/activate`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'ICHANCY_SIGNIN_FAILED',
              message: 'Ichancy refused the sign-in: agent 10123 does not belong to agent_pilot.',
            },
            meta: { correlationId: 'test', timestamp: '' },
          },
          { status: 502 },
        ),
      ),
    );

    const { user } = renderPlain(<TenantStatusActions tenant={suspendedTenant} />, platformAdmin);

    await user.click(screen.getByRole('button', { name: 'Activate' }));
    await user.click(await screen.findByRole('button', { name: 'Activate tenant' }));

    expect(
      await screen.findByText(
        'Ichancy refused the sign-in: agent 10123 does not belong to agent_pilot.',
      ),
    ).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith(
      'Activation failed',
      expect.objectContaining({
        description: 'Ichancy refused the sign-in: agent 10123 does not belong to agent_pilot.',
      }),
    );
  });

  it('activates a suspended tenant when Ichancy accepts', async () => {
    const { user } = renderPlain(<TenantStatusActions tenant={suspendedTenant} />, platformAdmin);

    await user.click(screen.getByRole('button', { name: 'Activate' }));
    await user.click(await screen.findByRole('button', { name: 'Activate tenant' }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Pilot operator is active',
        expect.objectContaining({ description: expect.stringContaining('Ichancy accepted') }),
      );
    });
  });

  it('shows nothing at all to a role that cannot manage tenants', () => {
    renderPlain(<TenantStatusActions tenant={activeTenant} />, { auth: { role: 'SUPER_ADMIN' } });

    expect(screen.queryByRole('button', { name: 'Suspend' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activate' })).not.toBeInTheDocument();
  });
});
