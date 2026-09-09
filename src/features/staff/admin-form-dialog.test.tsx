import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { mockAdmins } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';

import { AdminFormDialog } from './admin-form-dialog';

/**
 * THE "ADD EMPLOYEE" FORM (2026-09-05): a display name, a role, a username and a password.
 *
 * There is nothing about Telegram here any more, and that is the point of most of these cases —
 * staff sign in at the console with a username and a password, so a form that asked for a Telegram
 * id would be asking for a credential nothing checks. The other half is the create/edit asymmetry
 * on the password: required when the account is made, blank-means-unchanged afterwards, because an
 * existing password cannot be read back to prefill the field.
 */

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

  it('asks for nothing about Telegram', async () => {
    renderPlain(<AdminFormDialog open onOpenChange={vi.fn()} admin={null} />);

    await screen.findByLabelText('Username');
    expect(screen.queryByLabelText(/telegram/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\/console/)).not.toBeInTheDocument();
  });

  it('insists on a display name', async () => {
    const { user } = renderPlain(<AdminFormDialog open onOpenChange={vi.fn()} admin={null} />);

    await user.type(await screen.findByLabelText('Username'), 'nadia_ops');
    await user.type(screen.getByLabelText('Password'), 'Sup3rSecret!');
    await user.click(screen.getByRole('button', { name: 'Add administrator' }));

    expect(
      await screen.findByText('Give this person a name their colleagues will recognise.'),
    ).toBeInTheDocument();
  });

  it('insists on a username, because it is the login', async () => {
    const onOpenChange = vi.fn();
    const { user } = renderPlain(<AdminFormDialog open onOpenChange={onOpenChange} admin={null} />);

    await user.type(await screen.findByLabelText('Display name'), 'Nadia Khoury');
    await user.type(screen.getByLabelText('Password'), 'Sup3rSecret!');
    await user.click(screen.getByRole('button', { name: 'Add administrator' }));

    expect(
      await screen.findByText(
        'A username is 3 to 64 characters: letters, digits, and . _ @ + - only.',
      ),
    ).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('insists on a password, because an account without one cannot be signed into', async () => {
    const onOpenChange = vi.fn();
    const { user } = renderPlain(<AdminFormDialog open onOpenChange={onOpenChange} admin={null} />);

    await user.type(await screen.findByLabelText('Display name'), 'Nadia Khoury');
    await user.type(screen.getByLabelText('Username'), 'nadia_ops');
    await user.click(screen.getByRole('button', { name: 'Add administrator' }));

    expect(await screen.findByText('Passwords are at least 8 characters.')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('refuses a username with a space or a character no login has', async () => {
    const { user } = renderPlain(<AdminFormDialog open onOpenChange={vi.fn()} admin={null} />);

    await user.type(await screen.findByLabelText('Display name'), 'Nadia Khoury');
    await user.type(screen.getByLabelText('Username'), 'has space');
    await user.type(screen.getByLabelText('Password'), 'Sup3rSecret!');
    await user.click(screen.getByRole('button', { name: 'Add administrator' }));

    expect(
      await screen.findByText(
        'A username is 3 to 64 characters: letters, digits, and . _ @ + - only.',
      ),
    ).toBeInTheDocument();
  });

  it('accepts an email as the username, which is what the real accounts use', async () => {
    let sentBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/admins`, async ({ request }) => {
        sentBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            success: true,
            data: {
              id: 'new-admin',
              telegramUserId: null,
              username: 'lina@example.com',
              hasPassword: true,
              displayName: 'Lina Farah',
              role: 'REVIEWER',
              isActive: true,
              lastLoginAt: null,
              createdAt: new Date().toISOString(),
            },
            error: null,
            meta: { correlationId: 'test', timestamp: new Date().toISOString() },
          },
          { status: 201 },
        );
      }),
    );
    const onOpenChange = vi.fn();
    const { user } = renderPlain(<AdminFormDialog open onOpenChange={onOpenChange} admin={null} />);

    await user.type(await screen.findByLabelText('Display name'), 'Lina Farah');
    await user.type(screen.getByLabelText('Username'), 'Lina@Example.com');
    await user.type(screen.getByLabelText('Password'), 'Sup3rSecret!');
    await user.click(screen.getByRole('button', { name: 'Add administrator' }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    // Lower-cased on the way out, so what is stored is what they will type at the login screen.
    expect(sentBody).toEqual({
      displayName: 'Lina Farah',
      role: 'REVIEWER',
      username: 'lina@example.com',
      password: 'Sup3rSecret!',
    });
  });

  it('creates the administrator and closes', async () => {
    const success = vi.spyOn(toast, 'success');
    const onOpenChange = vi.fn();
    const { user } = renderPlain(<AdminFormDialog open onOpenChange={onOpenChange} admin={null} />);

    await user.type(await screen.findByLabelText('Display name'), 'Nadia Khoury');
    await user.type(screen.getByLabelText('Username'), 'nadia_ops');
    await user.type(screen.getByLabelText('Password'), 'Sup3rSecret!');
    await user.click(screen.getByRole('radio', { name: /Finance admin/ }));
    await user.click(screen.getByRole('button', { name: 'Add administrator' }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(success).toHaveBeenCalledWith('Nadia Khoury can now sign in.');
  });

  it('says plainly what to do when the username is already taken', async () => {
    const failure = vi.spyOn(toast, 'error');
    const onOpenChange = vi.fn();
    const { user } = renderPlain(<AdminFormDialog open onOpenChange={onOpenChange} admin={null} />);

    await user.type(await screen.findByLabelText('Display name'), 'Duplicate Person');
    // A username the fixtures already hold, so the mock answers the real conflict.
    await user.type(screen.getByLabelText('Username'), 'lina_review');
    await user.type(screen.getByLabelText('Password'), 'Sup3rSecret!');
    await user.click(screen.getByRole('button', { name: 'Add administrator' }));

    expect(await screen.findByText(/already taken here/i)).toBeInTheDocument();
    expect(
      screen.getByText('That username is already taken by another administrator in this operator.'),
    ).toBeInTheDocument();
    expect(failure).toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe('AdminFormDialog — editing', () => {
  it('can rename and deactivate the account without touching the password', async () => {
    const success = vi.spyOn(toast, 'success');
    const onOpenChange = vi.fn();
    const target = mockAdmins.find((row) => row.username === 'lina_review');
    if (target === undefined) throw new Error('no fixture reviewer');

    const { user } = renderPlain(
      <AdminFormDialog open onOpenChange={onOpenChange} admin={target} />,
    );

    expect(await screen.findByLabelText('Display name')).toHaveValue('Lina Farah');
    expect(screen.getByLabelText('Username')).toHaveValue('lina_review');
    // Never prefilled: a password cannot be read back, so an empty box means "leave it alone".
    expect(screen.getByLabelText('Password')).toHaveValue('');

    await user.click(screen.getByRole('switch', { name: 'Account active' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(success).toHaveBeenCalledWith('Lina Farah updated.');
  });

  it('sets a new password when one is typed', async () => {
    let sentBody: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${config.apiBaseUrl}/v1/admin/admins/:id`, async ({ request, params }) => {
        sentBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          success: true,
          data: { ...existing, id: String(params.id), hasPassword: true },
          error: null,
          meta: { correlationId: 'test', timestamp: new Date().toISOString() },
        });
      }),
    );
    const target = mockAdmins.find((row) => row.username === 'lina_review');
    if (target === undefined) throw new Error('no fixture reviewer');
    const onOpenChange = vi.fn();
    const { user } = renderPlain(
      <AdminFormDialog open onOpenChange={onOpenChange} admin={target} />,
    );

    await user.type(await screen.findByLabelText('Password'), 'a-new-password');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(sentBody).toMatchObject({ password: 'a-new-password' });
  });

  it('leaves the password out of the body entirely when the field is left blank', async () => {
    // The quiet failure this exists for: an edit dialog that always sent the field would wipe a
    // colleague's password every time somebody renamed them.
    let sentBody: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${config.apiBaseUrl}/v1/admin/admins/:id`, async ({ request, params }) => {
        sentBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          success: true,
          data: { ...existing, id: String(params.id) },
          error: null,
          meta: { correlationId: 'test', timestamp: new Date().toISOString() },
        });
      }),
    );
    const target = mockAdmins.find((row) => row.username === 'lina_review');
    if (target === undefined) throw new Error('no fixture reviewer');
    const { user } = renderPlain(<AdminFormDialog open onOpenChange={vi.fn()} admin={target} />);

    await user.click(await screen.findByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(sentBody).not.toBeNull();
    });
    expect(sentBody).not.toHaveProperty('password');
  });

  it('can edit an admin who has no username at all, and give them one', async () => {
    /*
     * An admin created before 2026-09-05 can hold a Telegram id and nothing else. Their username
     * field prefills empty, so a schema that required one here would make their record impossible
     * to edit — including impossible to give the very username they now need to sign in.
     */
    let sentBody: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${config.apiBaseUrl}/v1/admin/admins/:id`, async ({ request, params }) => {
        sentBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          success: true,
          data: { ...existing, id: String(params.id), username: 'newly.named' },
          error: null,
          meta: { correlationId: 'test', timestamp: new Date().toISOString() },
        });
      }),
    );
    const legacy = { ...existing, username: null, hasPassword: false };
    const onOpenChange = vi.fn();
    const { user } = renderPlain(
      <AdminFormDialog open onOpenChange={onOpenChange} admin={legacy} />,
    );

    expect(await screen.findByLabelText('Username')).toHaveValue('');
    await user.type(screen.getByLabelText('Username'), 'newly.named');
    await user.type(screen.getByLabelText('Password'), 'Sup3rSecret!');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(sentBody).toMatchObject({ username: 'newly.named', password: 'Sup3rSecret!' });
  });

  it('leaves the username out of the body when the field is left blank', async () => {
    // Blank means unchanged, exactly as the hint under the field says — the contract has no way to
    // spell "erase this", and the server refuses an explicit null.
    let sentBody: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${config.apiBaseUrl}/v1/admin/admins/:id`, async ({ request, params }) => {
        sentBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          success: true,
          data: { ...existing, id: String(params.id) },
          error: null,
          meta: { correlationId: 'test', timestamp: new Date().toISOString() },
        });
      }),
    );
    const legacy = { ...existing, username: null, hasPassword: false };
    const { user } = renderPlain(<AdminFormDialog open onOpenChange={vi.fn()} admin={legacy} />);

    await user.type(await screen.findByLabelText('Display name'), ' renamed');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(sentBody).not.toBeNull();
    });
    expect(sentBody).not.toHaveProperty('username');
  });

  it('refuses a new password that is too short, rather than sending it', async () => {
    const target = mockAdmins.find((row) => row.username === 'lina_review');
    if (target === undefined) throw new Error('no fixture reviewer');
    const onOpenChange = vi.fn();
    const { user } = renderPlain(
      <AdminFormDialog open onOpenChange={onOpenChange} admin={target} />,
    );

    await user.type(await screen.findByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Passwords are at least 8 characters.')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
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
