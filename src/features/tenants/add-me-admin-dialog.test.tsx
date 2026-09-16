import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { AuthContext, type AuthState } from '@/lib/auth/auth-context';
import type { Locale } from '@/lib/i18n/locales';
import { TENANT_IDS, mockTenants } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { createTestAuth, renderPlain } from '@/test/utils';
import type { AdminRole } from '@/types/enums';

import { AddMeAsAdminAction } from './add-me-admin-dialog';

/**
 * The one thing that must never happen here is a SUPER_ADMIN row landing in an operator nobody
 * asked for. Every case below is about that: which operator is named, which operator the request
 * is actually aimed at, and what the owner is told to do next.
 *
 * Since 2026-09-05 a staff account is a username and a password, so this dialog asks for both
 * rather than cloning the caller's Telegram id — there is nothing of theirs left to clone, and
 * `POST /v1/admin/admins` does not accept a Telegram id at all any more.
 */

const northern = mockTenants[1]!;

/** Already in the mock directory, which is what makes the duplicate path reachable. */
const TAKEN_USERNAME = 'nour_ops';
const FREE_USERNAME = 'nour.platform@example.com';
const NEW_PASSWORD = 'Sup3rSecret!';

interface DialogOptions {
  role?: AdminRole;
  /** What the switcher currently points at. */
  tenantId?: string | null;
  /** The operator this session signed into. Absent on a token minted before the tenant claim. */
  homeTenantId?: string;
  tenantHeaderEnabled?: boolean;
  locale?: Locale;
  tenant?: typeof northern;
}

function renderAction(options: DialogOptions = {}) {
  const role = options.role ?? 'PLATFORM_ADMIN';
  const tenantId = options.tenantId === undefined ? northern.id : options.tenantId;
  const setTenantId = vi.fn();
  vi.spyOn(config, 'tenantHeaderEnabled', 'get').mockReturnValue(
    options.tenantHeaderEnabled ?? true,
  );

  const base = createTestAuth({ role, tenantId });
  const session =
    base.session === null
      ? null
      : {
          ...base.session,
          admin: {
            ...base.session.admin,
            displayName: 'Nour Haddad',
          },
          ...(options.homeTenantId === undefined ? {} : { tenantId: options.homeTenantId }),
        };
  const auth: AuthState = {
    ...base,
    session,
    admin: session?.admin ?? null,
    setTenantId,
  };

  const rendered = renderPlain(
    <AuthContext value={auth}>
      <AddMeAsAdminAction tenant={options.tenant ?? northern} />
    </AuthContext>,
    {
      auth: { role, tenantId },
      ...(options.locale === undefined ? {} : { locale: options.locale }),
    },
  );

  return { ...rendered, setTenantId };
}

const openDialog = async (options: DialogOptions = {}, action = /add me as an admin here/i) => {
  const rendered = renderAction(options);
  await rendered.user.click(screen.getByRole('button', { name: action }));
  return rendered;
};

/**
 * The credential the new account will be signed into with. Filled by every case that submits,
 * because the form now refuses without it — which is the point: an account with no password is one
 * nobody can use.
 */
async function fillCredential(
  user: Awaited<ReturnType<typeof openDialog>>['user'],
  username = FREE_USERNAME,
): Promise<void> {
  await user.type(await screen.findByLabelText(/username/i), username);
  await user.type(screen.getByLabelText(/password/i), NEW_PASSWORD);
}

describe('who is offered it', () => {
  it('offers the action to a platform admin, who is the only role the API accepts it from', () => {
    renderAction();
    expect(screen.getByRole('button', { name: /add me as an admin here/i })).toBeInTheDocument();
  });

  it.each<AdminRole>(['SUPER_ADMIN', 'FINANCE_ADMIN', 'REVIEWER', 'SUPPORT', 'VIEWER'])(
    'shows %s nothing at all, rather than a button the API would refuse',
    (role) => {
      renderAction({ role });
      expect(screen.queryByRole('button', { name: /add me as an admin here/i })).toBeNull();
    },
  );
});

describe('what the dialog knows before it asks anything', () => {
  it('fills the name from the session, and asks for the login it cannot know', async () => {
    await openDialog();

    expect(await screen.findByLabelText(/display name/i)).toHaveValue('Nour Haddad');
    // A password is never readable back from a session, so it is the one thing that must be typed.
    expect(screen.getByLabelText(/^password$/i)).toHaveValue('');
    expect(screen.queryByText(/telegram/i)).toBeNull();
  });

  it('defaults to super admin and explains every role it offers', async () => {
    await openDialog();

    expect(await screen.findByRole('radio', { name: /super admin/i })).toBeChecked();
    expect(screen.getByText(/top of one tenant/i)).toBeInTheDocument();
    expect(screen.getByText(/read-only on the deposit queue/i)).toBeInTheDocument();
    // Platform admin sees no operator data, so a row with that role here would grant nothing.
    expect(screen.queryByRole('radio', { name: /platform admin/i })).toBeNull();
  });

  it('names the operator it is about to write into, ahead of any field', async () => {
    await openDialog();

    expect(await screen.findByText(/this admin row will be written into/i)).toBeInTheDocument();
    expect(screen.getByText('northern-branch')).toBeInTheDocument();
  });
});

describe('aiming the write at the operator being viewed', () => {
  it('sends the viewed operator in X-Tenant-Id, which is the only way to aim this write', async () => {
    let sentTenantId: string | null = null;
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/admins`, ({ request }) => {
        sentTenantId = request.headers.get('X-Tenant-Id');
        return HttpResponse.json(
          {
            success: true,
            data: {
              id: 'new-admin',
              telegramUserId: null,
              telegramLinked: false,
              username: null,
              hasPassword: false,
              displayName: 'Nour Haddad',
              role: 'SUPER_ADMIN',
              isActive: true,
              lastLoginAt: null,
              createdAt: new Date().toISOString(),
            },
            error: null,
            meta: { correlationId: 'test', timestamp: '' },
          },
          { status: 201 },
        );
      }),
    );

    const { user } = await openDialog();
    await fillCredential(user);
    await user.click(screen.getByRole('button', { name: /^add me as an admin$/i }));

    expect(await screen.findByText(/next: sign in to northern branch/i)).toBeInTheDocument();
    expect(sentTenantId).toBe(northern.id);
  });

  it('refuses to write while the console is pointed somewhere else, and offers to point it here', async () => {
    const { user, setTenantId } = await openDialog({ tenantId: TENANT_IDS.zero });

    expect(
      await screen.findByText(/the console is pointed at a different operator/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^add me as an admin$/i })).toBeNull();

    await user.click(screen.getByRole('button', { name: /select northern branch, then add me/i }));
    expect(setTenantId).toHaveBeenCalledWith(northern.id);
  });

  it('treats no selection as the home operator, so its own operator needs no switch', async () => {
    await openDialog({ tenantId: null, homeTenantId: northern.id });

    expect(
      await screen.findByText(/the console is pointed at northern branch/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^add me as an admin$/i })).toBeInTheDocument();
  });

  it('offers no write at all when the header this depends on is switched off', async () => {
    await openDialog({ tenantHeaderEnabled: false });

    expect(
      await screen.findByText(/this console cannot aim a write at an operator/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^add me as an admin$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /select northern branch/i })).toBeNull();
  });
});

describe('what it says afterwards', () => {
  it('reads a taken username as the outcome the owner wanted, not as a failure', async () => {
    const { user } = await openDialog();
    await fillCredential(user, TAKEN_USERNAME);

    await user.click(screen.getByRole('button', { name: /^add me as an admin$/i }));

    expect(await screen.findByText(/you are already an admin there/i)).toBeInTheDocument();
    expect(
      screen.getByText(/if the existing account is yours, sign in with it/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/could not add you as an admin/i)).toBeNull();
  });

  it('tells the owner to sign in with what they just set, naming no bot at all', async () => {
    // The old instruction was "send /console to THAT operator's bot", because a code from another
    // bot signed you into another operator. Signing in no longer goes through Telegram, so the
    // wrong-bot mistake it guarded against cannot happen.
    const { user } = await openDialog();
    await fillCredential(user);

    await user.click(screen.getByRole('button', { name: /^add me as an admin$/i }));

    expect(await screen.findByText(/next: sign in to northern branch/i)).toBeInTheDocument();
    expect(screen.getByText(/username and password you just set/i)).toBeInTheDocument();
    expect(screen.queryByText(/@northern_cashier_bot/)).toBeNull();
    expect(screen.queryByText(/\/console/)).toBeNull();
  });

  it('refuses a password too short to be one, before anything is sent', async () => {
    const { user } = await openDialog();
    await user.type(await screen.findByLabelText(/username/i), FREE_USERNAME);
    await user.type(screen.getByLabelText(/^password$/i), 'short');

    await user.click(screen.getByRole('button', { name: /^add me as an admin$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 8 characters/i);
  });

  it('shows the API refusal as worded, rather than a shrug', async () => {
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/admins`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'VALIDATION_FAILED', message: 'username is already taken.' },
            meta: { correlationId: 'test', timestamp: '' },
          },
          { status: 422 },
        ),
      ),
    );

    const { user } = await openDialog();
    await fillCredential(user);
    await user.click(screen.getByRole('button', { name: /^add me as an admin$/i }));

    expect(await screen.findByText('username is already taken.')).toBeInTheDocument();
  });
});

describe('in Arabic', () => {
  it('asks for the login in Arabic, and says what to do next in Arabic', async () => {
    const { user } = await openDialog({ locale: 'ar' }, /أضِفني مديراً هنا/);

    await user.type(await screen.findByLabelText('اسم المستخدم'), FREE_USERNAME);
    await user.type(screen.getByLabelText('كلمة المرور'), NEW_PASSWORD);
    await user.click(screen.getByRole('button', { name: /^أضِفني مديراً$/ }));

    expect(await screen.findByText(/الخطوة التالية/)).toBeInTheDocument();
  });
});
