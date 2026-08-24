import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { mockAdmins } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';

import { AdminFormDialog } from './admin-form-dialog';

const existing = mockAdmins[0];
if (existing === undefined) throw new Error('fixtures are empty');

describe('AdminFormDialog — adding', () => {
  // Rendered as a PLATFORM_ADMIN so that every role is actually on offer: a SUPER_ADMIN is not
  // shown the PLATFORM_ADMIN option at all, which the "who may grant" block below covers.
  it('explains what each role is allowed to do before it is granted', async () => {
    renderPlain(<AdminFormDialog open onOpenChange={vi.fn()} admin={null} />, {
      auth: { role: 'PLATFORM_ADMIN' },
    });

    expect(
      await screen.findByText(/Runs the platform: creates, configures and suspends tenants/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Reviews and decides deposits\. Cannot change rails or staff\./i),
    ).toBeInTheDocument();
  });

  it('refuses a telegram id that is not digits, and posts nothing', async () => {
    const onOpenChange = vi.fn();
    const { user } = renderPlain(<AdminFormDialog open onOpenChange={onOpenChange} admin={null} />);

    await user.type(await screen.findByLabelText('Telegram ID'), '70a0');
    await user.type(screen.getByLabelText('Display name'), 'Nadia Khoury');
    await user.click(screen.getByRole('button', { name: 'Add administrator' }));

    expect(
      await screen.findByText('A Telegram user id is 1 to 19 digits and nothing else.'),
    ).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('refuses an id longer than a 64-bit telegram id can be', async () => {
    const { user } = renderPlain(<AdminFormDialog open onOpenChange={vi.fn()} admin={null} />);

    await user.type(await screen.findByLabelText('Telegram ID'), '1'.repeat(20));
    await user.type(screen.getByLabelText('Display name'), 'Nadia Khoury');
    await user.click(screen.getByRole('button', { name: 'Add administrator' }));

    expect(
      await screen.findByText('A Telegram user id is 1 to 19 digits and nothing else.'),
    ).toBeInTheDocument();
  });

  it('insists on a display name', async () => {
    const { user } = renderPlain(<AdminFormDialog open onOpenChange={vi.fn()} admin={null} />);

    await user.type(await screen.findByLabelText('Telegram ID'), '700000123');
    await user.click(screen.getByRole('button', { name: 'Add administrator' }));

    expect(
      await screen.findByText('Give this person a name their colleagues will recognise.'),
    ).toBeInTheDocument();
  });

  it('creates the administrator and closes', async () => {
    const success = vi.spyOn(toast, 'success');
    const onOpenChange = vi.fn();
    const { user } = renderPlain(<AdminFormDialog open onOpenChange={onOpenChange} admin={null} />);

    await user.type(await screen.findByLabelText('Telegram ID'), '700000123');
    await user.type(screen.getByLabelText('Display name'), 'Nadia Khoury');
    await user.type(screen.getByLabelText('Telegram username'), 'nadia_ops');
    await user.click(screen.getByRole('radio', { name: /Finance admin/ }));
    await user.click(screen.getByRole('button', { name: 'Add administrator' }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(success).toHaveBeenCalledWith('Nadia Khoury can now sign in with /console.');
  });

  it('says plainly what to do when the telegram account is already an administrator', async () => {
    const failure = vi.spyOn(toast, 'error');
    const onOpenChange = vi.fn();
    const { user } = renderPlain(<AdminFormDialog open onOpenChange={onOpenChange} admin={null} />);

    await user.type(await screen.findByLabelText('Telegram ID'), existing.telegramUserId);
    await user.type(screen.getByLabelText('Display name'), 'Duplicate Person');
    await user.click(screen.getByRole('button', { name: 'Add administrator' }));

    expect(await screen.findByText(/already has an administrator record/i)).toBeInTheDocument();
    expect(screen.getByText('That Telegram account is already an admin.')).toBeInTheDocument();
    expect(failure).toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe('AdminFormDialog — editing', () => {
  it('does not offer to change the telegram id, and can deactivate the account', async () => {
    const success = vi.spyOn(toast, 'success');
    const onOpenChange = vi.fn();
    const target = mockAdmins.find((row) => row.username === 'lina_review');
    if (target === undefined) throw new Error('no fixture reviewer');

    const { user } = renderPlain(
      <AdminFormDialog open onOpenChange={onOpenChange} admin={target} />,
    );

    expect(await screen.findByLabelText('Display name')).toHaveValue('Lina Farah');
    expect(screen.queryByLabelText('Telegram ID')).not.toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Account active' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(success).toHaveBeenCalledWith('Lina Farah updated.');
  });

  it('shows the API refusal instead of guessing at it', async () => {
    server.use(
      http.patch(`${config.apiBaseUrl}/v1/admin/admins/:id`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'ADMIN_SELF_MODIFICATION',
              message: 'You cannot change your own admin record.',
            },
            meta: { correlationId: 'test-1', timestamp: new Date().toISOString() },
          },
          { status: 422 },
        ),
      ),
    );

    const { user } = renderPlain(<AdminFormDialog open onOpenChange={vi.fn()} admin={existing} />);

    await user.click(await screen.findByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('You cannot change your own admin record.')).toBeInTheDocument();
  });
});

/**
 * PLATFORM_ADMIN is the only role whose grant depends on more than `admins.write`, because it is
 * the only one that reaches across tenants. Offering it to someone the server will refuse is a
 * form inviting a choice it cannot honour — and on the edit path, silently dropping it would
 * demote the very person being edited.
 */
describe('AdminFormDialog — who may grant PLATFORM_ADMIN', () => {
  it('does not offer it to a super admin, who the server would refuse', async () => {
    renderPlain(<AdminFormDialog open onOpenChange={vi.fn()} admin={null} />, {
      auth: { role: 'SUPER_ADMIN' },
    });

    expect(await screen.findByRole('radio', { name: /Super admin/i })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Platform admin/i })).not.toBeInTheDocument();
  });

  it('offers it to a platform admin working in tenant zero', async () => {
    renderPlain(<AdminFormDialog open onOpenChange={vi.fn()} admin={null} />, {
      auth: { role: 'PLATFORM_ADMIN', tenantId: null },
    });

    expect(await screen.findByRole('radio', { name: /Platform admin/i })).toBeEnabled();
  });

  it('withdraws it once that platform admin switches into an operator', async () => {
    renderPlain(<AdminFormDialog open onOpenChange={vi.fn()} admin={null} />, {
      auth: { role: 'PLATFORM_ADMIN', tenantId: 'a3f1c0de-0000-4000-8000-000000000001' },
    });

    expect(await screen.findByRole('radio', { name: /Super admin/i })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Platform admin/i })).not.toBeInTheDocument();
  });

  it('shows a platform admin being edited their own role, disabled, rather than dropping it', async () => {
    renderPlain(
      <AdminFormDialog
        open
        onOpenChange={vi.fn()}
        admin={{ ...existing, role: 'PLATFORM_ADMIN' }}
      />,
      { auth: { role: 'SUPER_ADMIN' } },
    );

    const option = await screen.findByRole('radio', { name: /Platform admin/i });
    expect(option).toBeDisabled();
    expect(option).toBeChecked();
  });
});
