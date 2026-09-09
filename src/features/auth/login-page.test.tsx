import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { loginSearchSchema } from '@/app/search-schemas';
import { config } from '@/config';
import { ApiError } from '@/lib/api/errors';
import type { AuthState } from '@/lib/auth/auth-context';
import { server } from '@/test/msw-server';
import { createTestSession, renderWithProviders } from '@/test/utils';

import { LoginPage } from './login-page';

/**
 * Sign-in is the one screen an operator meets before they know anything about the console, so what
 * is tested here is mostly whether it explains itself: what it is asking for, why a session ended,
 * and — the part that costs real time when it is wrong — what to do about each of the ways a
 * sign-in can be refused.
 *
 * ONE DOOR as of 2026-09-05. The bot-code tab is gone with the `/console` command that fed it, and
 * the Ichancy agent account is no longer a separate tab: the server tries a person's own console
 * credential first and the operator's agent account second behind the same two fields. So the cases
 * that used to be "which tab" are now "which refusal", and both spellings of each refusal are
 * exercised, because which one comes back depends on how far the credential got.
 *
 * The first query in each case is a `findBy` because the router resolves its route asynchronously —
 * the same reason the real screen never flashes a wrong page.
 *
 * Half the desk reads Arabic, so "explains itself" is asserted in Arabic too: real Arabic text on
 * screen rather than a render that merely succeeded, and the document flipped to `dir="rtl"` —
 * translated strings inside an unmirrored layout would still be the wrong screen.
 */

const render = (options: Parameters<typeof renderWithProviders>[1] = {}) =>
  renderWithProviders(<LoginPage />, {
    route: '/login',
    routePath: '/login',
    validateSearch: loginSearchSchema,
    auth: { isAuthenticated: false },
    ...options,
  });

const usernameField = () => screen.findByLabelText(/username or email/i);
const passwordField = () => screen.findByLabelText(/^password$/i);
const submit = () => screen.getByRole('button', { name: /sign in/i });

const apiError = (status: number, code: string, details?: unknown) =>
  new ApiError({
    status,
    code,
    message: `server said ${code}`,
    ...(details === undefined ? {} : { details }),
  });

describe('what it tells you', () => {
  it('asks for one credential, with no choice of door to make first', async () => {
    render();

    expect(await usernameField()).toBeInTheDocument();
    expect(await passwordField()).toBeInTheDocument();
    // The tabs are gone: a screen that still asked "which kind of account?" would be asking a
    // question only the backend can answer.
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('focuses the username field so the operator can just type', async () => {
    render();
    expect(await usernameField()).toHaveFocus();
  });

  it('will not submit until both halves of the credential are there', async () => {
    const { user } = render();

    expect(await screen.findByRole('button', { name: /sign in/i })).toBeDisabled();
    await user.type(await usernameField(), 'nadia_ops');
    expect(submit()).toBeDisabled();
    await user.type(await passwordField(), 'x');
    expect(submit()).toBeEnabled();
  });

  it('mentions no bot command anywhere — there is none to send', async () => {
    render();

    await usernameField();
    expect(screen.queryByText('/console')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/one-time code/i)).not.toBeInTheDocument();
  });
});

describe('signing in', () => {
  it('sends the credential and navigates away from the login screen', async () => {
    const signIn = vi.fn().mockResolvedValue(createTestSession('FINANCE_ADMIN'));
    const { user, location } = render({ auth: { isAuthenticated: false, signIn } });

    await user.type(await usernameField(), 'nadia_ops');
    await user.type(await passwordField(), 'Sup3rSecret!');
    await user.click(submit());

    // No operatorSlug on the first attempt: the overwhelming majority of logins open one operator
    // and must not be asked a question with one answer.
    expect(signIn).toHaveBeenCalledWith({ username: 'nadia_ops', password: 'Sup3rSecret!' });
    await vi.waitFor(() => {
      expect(location()).not.toContain('/login');
    });
  });

  it('accepts an email as the login, which is what the real accounts are spelled as', async () => {
    const signIn = vi.fn().mockResolvedValue(createTestSession('SUPER_ADMIN'));
    const { user } = render({ auth: { isAuthenticated: false, signIn } });

    await user.type(await usernameField(), 'owner@example.com');
    await user.type(await passwordField(), 'Sup3rSecret!');
    await user.click(submit());

    expect(signIn).toHaveBeenCalledWith({
      username: 'owner@example.com',
      password: 'Sup3rSecret!',
    });
  });

  it('sends a PLATFORM_ADMIN to the operators screen, the only one it can open', async () => {
    const signIn = vi.fn().mockResolvedValue(createTestSession('PLATFORM_ADMIN'));
    const { user, location } = render({ auth: { isAuthenticated: false, signIn } });

    await user.type(await usernameField(), 'platform');
    await user.type(await passwordField(), 'Sup3rSecret!');
    await user.click(submit());

    await vi.waitFor(() => {
      expect(location()).toContain('/tenants');
    });
  });

  it('returns the operator to where they were sent away from', async () => {
    const signIn = vi.fn().mockResolvedValue(createTestSession('SUPER_ADMIN'));
    const { user, location } = render({
      route: '/login?redirect=%2Fdeposits',
      auth: { isAuthenticated: false, signIn },
    });

    await user.type(await usernameField(), 'nadia_ops');
    await user.type(await passwordField(), 'Sup3rSecret!');
    await user.click(submit());

    await vi.waitFor(() => {
      expect(location()).toContain('/deposits');
    });
  });
});

describe('when one credential opens several operators', () => {
  const ambiguous = (code: string) =>
    apiError(409, code, {
      operators: [
        { slug: 'tenant-zero', displayName: 'Main operation' },
        { slug: 'northern-branch', displayName: 'Northern branch' },
      ],
    });

  const arrive = async (signIn: AuthState['signIn']) => {
    const rendered = render({ auth: { isAuthenticated: false, signIn } });
    await rendered.user.type(await usernameField(), 'shared_login');
    await rendered.user.type(await passwordField(), 'Sup3rSecret!');
    await rendered.user.click(submit());
    return rendered;
  };

  it('asks which one rather than refusing, and never calls it a bad password', async () => {
    const signIn = vi.fn().mockRejectedValue(ambiguous('ADMIN_OPERATOR_AMBIGUOUS'));
    await arrive(signIn);

    expect(await screen.findByText(/which operator/i)).toBeInTheDocument();
    expect(screen.getByText('Northern branch')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does the same when it was the agent credential that opened several', async () => {
    // Same question, different spelling: the server answers AGENT_ when the credential reached the
    // operator's Ichancy account rather than a personal one. A screen that handled only one would
    // report the other as a bad password and throw the credential away.
    const signIn = vi.fn().mockRejectedValue(ambiguous('AGENT_OPERATOR_AMBIGUOUS'));
    await arrive(signIn);

    expect(await screen.findByText(/which operator/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('re-sends the same credential with the chosen operator, without asking for it again', async () => {
    const signIn = vi
      .fn()
      .mockRejectedValueOnce(ambiguous('ADMIN_OPERATOR_AMBIGUOUS'))
      .mockResolvedValueOnce(createTestSession('SUPER_ADMIN'));
    const { user, location } = await arrive(signIn);

    await user.click(await screen.findByRole('radio', { name: /northern branch/i }));
    await user.click(screen.getByRole('button', { name: /sign in to northern branch/i }));

    expect(signIn).toHaveBeenLastCalledWith({
      username: 'shared_login',
      password: 'Sup3rSecret!',
      operatorSlug: 'northern-branch',
    });
    await vi.waitFor(() => {
      expect(location()).not.toContain('/login');
    });
  });

  it('offers a way back to the credential, for somebody who used the wrong account', async () => {
    const signIn = vi.fn().mockRejectedValue(ambiguous('ADMIN_OPERATOR_AMBIGUOUS'));
    const { user } = await arrive(signIn);

    await user.click(await screen.findByRole('button', { name: /use a different account/i }));

    expect(await usernameField()).toHaveFocus();
    // The password is dropped on the way back, so nothing rejected is left sitting in the field.
    expect(await passwordField()).toHaveValue('');
  });
});

describe('when the credential is refused', () => {
  const refuse = async (error: unknown) => {
    const signIn = vi.fn().mockRejectedValue(error);
    const rendered = render({ auth: { isAuthenticated: false, signIn } });
    await rendered.user.type(await usernameField(), 'nadia_ops');
    await rendered.user.type(await passwordField(), 'wrong');
    await rendered.user.click(submit());
    return rendered;
  };

  it('says the credentials open nothing, without saying which half was wrong', async () => {
    await refuse(apiError(401, 'ADMIN_CREDENTIALS_INVALID'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/do not open anything/i);
  });

  it('says the same for a credential that got as far as the agent account', async () => {
    // The person typing cannot tell the two apart and should not have to: a sentence about Ichancy
    // would be about an account a new manager may not know exists.
    await refuse(apiError(401, 'AGENT_CREDENTIALS_INVALID'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/do not open anything/i);
  });

  it('tells a suspended operator to ask a platform admin, not to retype', async () => {
    // The one thing that must not happen here: a correct password reported as incorrect, leaving
    // an owner typing it again forever against an operator only somebody else can activate.
    await refuse(apiError(403, 'AGENT_OPERATOR_NOT_ACTIVE'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/suspended/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/platform admin/i);
  });

  it('explains a console account somebody switched off, rather than blaming the password', async () => {
    // Not "this operator has no staff yet" — the first agent sign-in creates that row. This is the
    // row having been deactivated afterwards, which is a decision and needs naming as one.
    await refuse(apiError(403, 'AGENT_OPERATOR_HAS_NO_OWNER'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/has been deactivated/i);
  });

  it('keeps the username and clears the password, then returns focus to it', async () => {
    await refuse(apiError(401, 'ADMIN_CREDENTIALS_INVALID'));

    await screen.findByRole('alert');
    expect(await usernameField()).toHaveValue('nadia_ops');
    expect(await passwordField()).toHaveValue('');
    expect(await passwordField()).toHaveFocus();
  });

  it('carries a real API refusal all the way from the wire to the sentence', async () => {
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/auth/credentials`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'ADMIN_CREDENTIALS_INVALID',
              message: 'Those credentials are not valid.',
            },
            meta: { correlationId: 'c', timestamp: 't' },
          },
          { status: 401 },
        ),
      ),
    );

    // The real signIn, so the ApiError travels the whole way from the API to the message.
    const { user } = renderWithProviders(<LoginPage />, {
      route: '/login',
      routePath: '/login',
      validateSearch: loginSearchSchema,
      auth: {
        isAuthenticated: false,
        signIn: async (credentials) => {
          const { authApi } = await import('@/lib/api/endpoints');
          return authApi.signIn(credentials);
        },
      },
    });

    await user.type(await usernameField(), 'nadia_ops');
    await user.type(await passwordField(), 'wrong');
    await user.click(submit());

    expect(await screen.findByRole('alert')).toHaveTextContent(/do not open anything/i);
  });
});

describe('when the session ended by itself', () => {
  it('says why, above the form', async () => {
    render({ auth: { isAuthenticated: false, signOutReason: 'expired' } });

    expect(await screen.findByText(/your session expired/i)).toBeInTheDocument();
  });
});

describe('in Arabic', () => {
  it('renders the screen in Arabic, not in English behind an Arabic layout', async () => {
    render({ locale: 'ar' });

    expect(await screen.findByRole('heading', { name: 'تسجيل الدخول' })).toBeInTheDocument();
    expect(screen.getByLabelText('اسم المستخدم أو البريد الإلكتروني')).toBeInTheDocument();
    expect(screen.getByLabelText('كلمة المرور')).toBeInTheDocument();
  });

  it('calls itself by its Arabic name, not by an English one baked in at build time', async () => {
    /*
     * The product name used to come from `VITE_APP_NAME`, an env string, so a fully Arabic screen
     * carried "Cashier Console" in the one place a person looks to find out where they are. The
     * translated name existed the whole time and nothing rendered it.
     */
    render({ locale: 'ar' });

    expect(await screen.findByText('إدارة الصرّاف')).toBeInTheDocument();
    expect(screen.queryByText(/cashier/i)).not.toBeInTheDocument();
  });

  it('calls itself Cashier Admin in English', async () => {
    render({ locale: 'en' });

    expect(await screen.findByText('Cashier Admin')).toBeInTheDocument();
  });

  it('types the login left to right, even in an Arabic layout', async () => {
    // A login is Latin. Left in the RTL run, the caret lands on the wrong end of a half-typed
    // email and the value reads back reordered.
    render({ locale: 'ar' });

    expect(await screen.findByLabelText('اسم المستخدم أو البريد الإلكتروني')).toHaveAttribute(
      'dir',
      'ltr',
    );
  });

  it('mirrors the document, and mirrors it back for English', async () => {
    const { unmount } = render({ locale: 'ar' });
    await screen.findByRole('heading', { name: 'تسجيل الدخول' });

    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.getAttribute('lang')).toBe('ar');

    unmount();
    render({ locale: 'en' });
    await screen.findByRole('heading', { name: 'Sign in' });

    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  });
});

describe('which backend it is talking to', () => {
  it('shows the real API target when the mock API is off', async () => {
    render();
    expect(await screen.findByText(config.apiBaseUrl)).toBeInTheDocument();
    expect(screen.queryByText(/demo mode/i)).not.toBeInTheDocument();
  });

  // Last on purpose: replacing a data property with a getter is not something a spy restores
  // cleanly, so nothing after this may depend on `config.enableMocks`.
  it('tells the operator which password the mock API accepts when mocks are on', async () => {
    vi.spyOn(config, 'enableMocks', 'get').mockReturnValue(true);
    render();

    expect(await screen.findByText(/demo mode/i)).toBeInTheDocument();
    expect(screen.getByText(/demo-pass/)).toBeInTheDocument();
  });

  it('lists a login per role, so every role-gated screen can actually be demonstrated', async () => {
    vi.spyOn(config, 'enableMocks', 'get').mockReturnValue(true);
    render();

    await screen.findByText(/demo mode/i);
    expect(screen.getByText('Platform admin')).toBeInTheDocument();
    expect(screen.getByText('Reviewer')).toBeInTheDocument();
    expect(screen.getByText('platform')).toBeInTheDocument();
  });

  it('demonstrates the agent credential too, refusal included', async () => {
    vi.spyOn(config, 'enableMocks', 'get').mockReturnValue(true);
    render();

    await screen.findByText(/demo mode/i);
    expect(screen.getByText(/agent_main, agent_north/)).toBeInTheDocument();
    expect(screen.getByText(/agent_pilot is the suspended operator/)).toBeInTheDocument();
  });
});
