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
 * is actually aimed at, and what the owner is told to do next — because a /console code from the
 * wrong bot signs them into the wrong operator just as effectively as a misdirected write.
 */

const northern = mockTenants[1]!;
const pilot = mockTenants[2]!;

/** Already an admin in the mock directory, which is what makes the duplicate path reachable. */
const EXISTING_TELEGRAM_ID = '700000001';
const NEW_TELEGRAM_ID = '700000999';

interface DialogOptions {
  role?: AdminRole;
  /** What the switcher currently points at. */
  tenantId?: string | null;
  /** The operator this session signed into. Absent on a token minted before the tenant claim. */
  homeTenantId?: string;
  telegramUserId?: string;
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
            telegramUserId: options.telegramUserId ?? EXISTING_TELEGRAM_ID,
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
    { auth: { role, tenantId }, ...(options.locale === undefined ? {} : { locale: options.locale }) },
  );

  return { ...rendered, setTenantId };
}

const openDialog = async (options: DialogOptions = {}, action = /add me as an admin here/i) => {
  const rendered = renderAction(options);
  await rendered.user.click(screen.getByRole('button', { name: action }));
  return rendered;
};

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
  it('fills in the Telegram id and the name from the session, not from memory', async () => {
    await openDialog();

    expect(await screen.findByText(EXISTING_TELEGRAM_ID)).toBeInTheDocument();
    expect(screen.getByLabelText(/display name/i)).toHaveValue('Nour Haddad');
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
              telegramUserId: NEW_TELEGRAM_ID,
              username: null,
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

    const { user } = await openDialog({ telegramUserId: NEW_TELEGRAM_ID });
    await user.click(await screen.findByRole('button', { name: /^add me as an admin$/i }));

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
  it('reads an existing admin row as the outcome the owner wanted, not as a failure', async () => {
    const { user } = await openDialog();

    await user.click(await screen.findByRole('button', { name: /^add me as an admin$/i }));

    expect(await screen.findByText(/you are already an admin there/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing changed, and nothing needed to/i)).toBeInTheDocument();
    expect(screen.queryByText(/could not add you as an admin/i)).toBeNull();
    // The next step is the same either way: the account still has to sign in to that operator.
    expect(screen.getByText(/@northern_cashier_bot/)).toBeInTheDocument();
  });

  it('names THAT operator’s bot, because a code from any other one signs you in elsewhere', async () => {
    const { user } = await openDialog({ telegramUserId: NEW_TELEGRAM_ID });

    await user.click(await screen.findByRole('button', { name: /^add me as an admin$/i }));

    const instruction = await screen.findByText(/@northern_cashier_bot/);
    expect(instruction).toHaveTextContent('/console');
    expect(instruction).toHaveTextContent(/not into Northern branch/i);
    expect(screen.queryByText(/main_cashier_bot/)).toBeNull();
  });

  it('says which bot token to check when the operator has no bot username recorded', async () => {
    const { user } = await openDialog({
      tenant: pilot,
      tenantId: pilot.id,
      telegramUserId: NEW_TELEGRAM_ID,
    });

    await user.click(await screen.findByRole('button', { name: /^add me as an admin$/i }));

    expect(await screen.findByText(/confirm which bot that is in botfather/i)).toBeInTheDocument();
  });

  it('shows the API refusal as worded, rather than a shrug', async () => {
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/admins`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'VALIDATION_FAILED', message: 'telegramUserId must be numeric.' },
            meta: { correlationId: 'test', timestamp: '' },
          },
          { status: 422 },
        ),
      ),
    );

    const { user } = await openDialog();
    await user.click(await screen.findByRole('button', { name: /^add me as an admin$/i }));

    expect(await screen.findByText('telegramUserId must be numeric.')).toBeInTheDocument();
  });
});

describe('in Arabic', () => {
  it('keeps the bot handle readable while the instruction reads right to left', async () => {
    const { user } = await openDialog(
      { locale: 'ar', telegramUserId: NEW_TELEGRAM_ID },
      /أضِفني مديراً هنا/,
    );

    await user.click(await screen.findByRole('button', { name: /^أضِفني مديراً$/ }));

    const instruction = await screen.findByText(/northern_cashier_bot/);
    expect(instruction).toHaveTextContent('/console');
    expect(screen.getByText(/الخطوة التالية/)).toBeInTheDocument();
  });
});
