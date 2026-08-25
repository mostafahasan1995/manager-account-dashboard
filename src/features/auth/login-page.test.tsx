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
 * is tested here is mostly whether it explains itself: which of the two accounts it is asking for,
 * why a session ended, and — the part that costs real time when it is wrong — what to do about each
 * of the ways a sign-in can be refused.
 *
 * Two doors, and they are not interchangeable. An OPERATOR holds an Ichancy agent account; the
 * PLATFORM holds a Telegram bot code and no agent at all. Most of the cases below exist because a
 * screen that blurred the two would send half the people who see it to the wrong field.
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

const usernameField = () => screen.findByLabelText(/ichancy username/i);
const passwordField = () => screen.findByLabelText(/ichancy password/i);
const codeField = () => screen.findByLabelText(/one-time code/i);
const submit = () => screen.getByRole('button', { name: /sign in/i });

/** The code lives behind its own tab now; nearly every bot-code case starts by opening it. */
async function openCodeTab(user: ReturnType<typeof render>['user']): Promise<void> {
  await user.click(await screen.findByRole('tab', { name: /bot code/i }));
}

const apiError = (status: number, code: string, details?: unknown) =>
  new ApiError({ status, code, message: `server said ${code}`, ...(details === undefined ? {} : { details }) });

describe('what it tells you', () => {
  it('offers both accounts, and opens on the one an operator holds', async () => {
    render();

    expect(await screen.findByRole('tab', { name: /ichancy account/i })).toHaveAttribute(
      'data-state',
      'active',
    );
    expect(screen.getByRole('tab', { name: /bot code/i })).toBeInTheDocument();
    expect(await usernameField()).toBeInTheDocument();
  });

  it('focuses the username field so the operator can just type', async () => {
    render();
    expect(await usernameField()).toHaveFocus();
  });

  it('will not submit until both halves of the credential are there', async () => {
    const { user } = render();

    expect(await screen.findByRole('button', { name: /sign in/i })).toBeDisabled();
    await user.type(await usernameField(), 'agent_main');
    expect(submit()).toBeDisabled();
    await user.type(await passwordField(), 'x');
    expect(submit()).toBeEnabled();
  });

  it('still says where a bot code comes from, on the door that needs one', async () => {
    const { user } = render();
    await openCodeTab(user);

    expect(await screen.findByText('/console')).toBeInTheDocument();
    expect(await codeField()).toBeInTheDocument();
  });
});

describe('signing in as an operator', () => {
  it('sends the agent credentials and navigates away from the login screen', async () => {
    const signInWithAgent = vi.fn().mockResolvedValue(createTestSession('SUPER_ADMIN'));
    const { user, location } = render({ auth: { isAuthenticated: false, signInWithAgent } });

    await user.type(await usernameField(), 'agent_main');
    await user.type(await passwordField(), 'agent-demo');
    await user.click(submit());

    // No operatorSlug on the first attempt: the overwhelming majority of agents run one operator
    // and must not be asked a question with one answer.
    expect(signInWithAgent).toHaveBeenCalledWith({
      username: 'agent_main',
      password: 'agent-demo',
    });
    await vi.waitFor(() => {
      expect(location()).not.toContain('/login');
    });
  });

  it('returns the operator to where they were sent away from', async () => {
    const signInWithAgent = vi.fn().mockResolvedValue(createTestSession('SUPER_ADMIN'));
    const { user, location } = render({
      route: '/login?redirect=%2Fdeposits',
      auth: { isAuthenticated: false, signInWithAgent },
    });

    await user.type(await usernameField(), 'agent_main');
    await user.type(await passwordField(), 'agent-demo');
    await user.click(submit());

    await vi.waitFor(() => {
      expect(location()).toContain('/deposits');
    });
  });
});

describe('when one Ichancy agent runs several operators', () => {
  const ambiguous = () =>
    apiError(409, 'AGENT_OPERATOR_AMBIGUOUS', {
      operators: [
        { slug: 'tenant-zero', displayName: 'Main operation' },
        { slug: 'northern-branch', displayName: 'Northern branch' },
      ],
    });

  const arrive = async (signInWithAgent: AuthState['signInWithAgent']) => {
    const rendered = render({ auth: { isAuthenticated: false, signInWithAgent } });
    await rendered.user.type(await usernameField(), 'shared_agent');
    await rendered.user.type(await passwordField(), 'agent-demo');
    await rendered.user.click(submit());
    return rendered;
  };

  it('asks which one rather than refusing, and never calls it a bad password', async () => {
    const signInWithAgent = vi.fn().mockRejectedValue(ambiguous());
    await arrive(signInWithAgent);

    expect(await screen.findByText(/which operator/i)).toBeInTheDocument();
    expect(screen.getByText('Northern branch')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('re-sends the same credential with the chosen operator, without asking for it again', async () => {
    const signInWithAgent = vi
      .fn()
      .mockRejectedValueOnce(ambiguous())
      .mockResolvedValueOnce(createTestSession('SUPER_ADMIN'));
    const { user, location } = await arrive(signInWithAgent);

    await user.click(await screen.findByRole('radio', { name: /northern branch/i }));
    await user.click(screen.getByRole('button', { name: /sign in to northern branch/i }));

    expect(signInWithAgent).toHaveBeenLastCalledWith({
      username: 'shared_agent',
      password: 'agent-demo',
      operatorSlug: 'northern-branch',
    });
    await vi.waitFor(() => {
      expect(location()).not.toContain('/login');
    });
  });

  it('offers a way back to the credentials, for an agent signed into with the wrong account', async () => {
    const signInWithAgent = vi.fn().mockRejectedValue(ambiguous());
    const { user } = await arrive(signInWithAgent);

    await user.click(await screen.findByRole('button', { name: /use a different account/i }));

    expect(await usernameField()).toHaveFocus();
    // The password is dropped on the way back, so nothing rejected is left sitting in the field.
    expect(await passwordField()).toHaveValue('');
  });
});

describe('when the agent credentials are refused', () => {
  const refuse = async (error: unknown) => {
    const signInWithAgent = vi.fn().mockRejectedValue(error);
    const rendered = render({ auth: { isAuthenticated: false, signInWithAgent } });
    await rendered.user.type(await usernameField(), 'agent_main');
    await rendered.user.type(await passwordField(), 'wrong');
    await rendered.user.click(submit());
    return rendered;
  };

  it('says the credentials open nothing, without saying which half was wrong', async () => {
    await refuse(apiError(401, 'AGENT_CREDENTIALS_INVALID'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/do not open any operator/i);
  });

  it('tells a suspended operator to ask a platform admin, not to retype', async () => {
    // The one thing that must not happen here: a correct password reported as incorrect, leaving
    // an owner typing it again forever against an operator only somebody else can activate.
    await refuse(apiError(403, 'AGENT_OPERATOR_NOT_ACTIVE'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/suspended/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/platform admin/i);
  });

  it('explains a console account somebody switched off, rather than blaming the password', async () => {
    // Not "this operator has no staff yet" — the first sign-in creates that row. This is the row
    // having been deactivated afterwards, which is a decision and needs naming as one.
    await refuse(apiError(403, 'AGENT_OPERATOR_HAS_NO_OWNER'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/has been deactivated/i);
  });

  it('keeps the username and clears the password, then returns focus to it', async () => {
    await refuse(apiError(401, 'AGENT_CREDENTIALS_INVALID'));

    await screen.findByRole('alert');
    expect(await usernameField()).toHaveValue('agent_main');
    expect(await passwordField()).toHaveValue('');
    expect(await passwordField()).toHaveFocus();
  });

  it('carries a real API refusal all the way from the wire to the sentence', async () => {
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/auth/ichancy`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'AGENT_CREDENTIALS_INVALID',
              message: 'Those Ichancy credentials are not valid.',
            },
            meta: { correlationId: 'c', timestamp: 't' },
          },
          { status: 401 },
        ),
      ),
    );

    // The real signInWithAgent, so the ApiError travels the whole way from the API to the message.
    const { user } = renderWithProviders(<LoginPage />, {
      route: '/login',
      routePath: '/login',
      validateSearch: loginSearchSchema,
      auth: {
        isAuthenticated: false,
        signInWithAgent: async (credentials) => {
          const { authApi } = await import('@/lib/api/endpoints');
          return authApi.signInWithAgent(credentials);
        },
      },
    });

    await user.type(await usernameField(), 'agent_main');
    await user.type(await passwordField(), 'wrong');
    await user.click(submit());

    expect(await screen.findByRole('alert')).toHaveTextContent(/do not open any operator/i);
  });
});

describe('signing in with a bot code', () => {
  it('exchanges the code and navigates away from the login screen', async () => {
    const signIn = vi.fn().mockResolvedValue(createTestSession('REVIEWER'));
    const { user, location } = render({ auth: { isAuthenticated: false, signIn } });
    await openCodeTab(user);

    await user.type(await codeField(), '123456');
    await user.click(submit());

    expect(signIn).toHaveBeenCalledWith('123456');
    await vi.waitFor(() => {
      expect(location()).not.toContain('/login');
    });
  });

  it('sends a PLATFORM_ADMIN to the operators screen, which is the only one it can open', async () => {
    // And it is only reachable through this door: the platform runs no Ichancy agent of its own.
    const signIn = vi.fn().mockResolvedValue(createTestSession('PLATFORM_ADMIN'));
    const { user, location } = render({ auth: { isAuthenticated: false, signIn } });
    await openCodeTab(user);

    await user.type(await codeField(), '111111');
    await user.click(submit());

    await vi.waitFor(() => {
      expect(location()).toContain('/tenants');
    });
  });

  it('says a code is refused without distinguishing invalid from expired, as the backend does', async () => {
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/auth/bot-code`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'BOT_CODE_INVALID', message: 'That code is not valid.' },
            meta: { correlationId: 'c', timestamp: 't' },
          },
          { status: 401 },
        ),
      ),
    );

    const { user } = renderWithProviders(<LoginPage />, {
      route: '/login',
      routePath: '/login',
      validateSearch: loginSearchSchema,
      auth: {
        isAuthenticated: false,
        signIn: async (code: string) => {
          const { authApi } = await import('@/lib/api/endpoints');
          return authApi.exchangeBotCode(code);
        },
      },
    });

    await openCodeTab(user);
    await user.type(await codeField(), '000000');
    await user.click(submit());

    expect(await screen.findByRole('alert')).toHaveTextContent(/not valid or has expired/i);
  });

  it('clears the field and returns focus, so the next code can be typed straight in', async () => {
    const signIn = vi.fn().mockRejectedValue(new Error('nope'));
    const { user } = render({ auth: { isAuthenticated: false, signIn } });
    await openCodeTab(user);

    const field = await codeField();
    await user.type(field, '000000');
    await user.click(submit());

    await vi.waitFor(() => {
      expect(field).toHaveValue('');
    });
    expect(field).toHaveFocus();
  });
});

describe('when the session ended by itself', () => {
  it('says why, above whichever door is open', async () => {
    render({ auth: { isAuthenticated: false, signOutReason: 'expired' } });

    expect(await screen.findByText(/your session expired/i)).toBeInTheDocument();
  });
});

describe('in Arabic', () => {
  it('renders the screen in Arabic, not in English behind an Arabic layout', async () => {
    render({ locale: 'ar' });

    expect(await screen.findByRole('heading', { name: 'تسجيل الدخول' })).toBeInTheDocument();
    expect(screen.getByLabelText('اسم مستخدم Ichancy')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'رمز البوت' })).toBeInTheDocument();
  });

  it('leaves the bot command in Latin, because it is typed into Telegram exactly as shown', async () => {
    const { user } = render({ locale: 'ar' });
    await user.click(await screen.findByRole('tab', { name: 'رمز البوت' }));

    const command = await screen.findByText('/console');
    expect(command).toHaveAttribute('dir', 'ltr');
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
  it('tells the operator which code the mock API accepts when mocks are on', async () => {
    vi.spyOn(config, 'enableMocks', 'get').mockReturnValue(true);
    render();

    expect(await screen.findByText(/demo mode/i)).toBeInTheDocument();
    // The code appears twice on purpose: once in the sentence, once in the role list below it.
    expect(screen.getAllByText('123456').length).toBeGreaterThan(0);
  });

  it('lists a code per role, so every role-gated screen can actually be demonstrated', async () => {
    vi.spyOn(config, 'enableMocks', 'get').mockReturnValue(true);
    render();

    await screen.findByText(/demo mode/i);
    expect(screen.getByText('Platform admin')).toBeInTheDocument();
    expect(screen.getByText('Reviewer')).toBeInTheDocument();
    expect(screen.getByText('111111')).toBeInTheDocument();
  });

  it('demonstrates the other door too, refusal included', async () => {
    vi.spyOn(config, 'enableMocks', 'get').mockReturnValue(true);
    render();

    await screen.findByText(/demo mode/i);
    expect(screen.getByText(/agent_main, agent_north/)).toBeInTheDocument();
    expect(screen.getByText(/agent_pilot is the suspended operator/)).toBeInTheDocument();
  });
});
