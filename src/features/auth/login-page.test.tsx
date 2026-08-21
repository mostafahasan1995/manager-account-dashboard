import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { loginSearchSchema } from '@/app/search-schemas';
import { config } from '@/config';
import { server } from '@/test/msw-server';
import { createTestSession, renderWithProviders } from '@/test/utils';

import { LoginPage } from './login-page';

/**
 * Sign-in is the one screen an operator meets before they know anything about the console, so what
 * is tested here is mostly whether it explains itself: where the code comes from, why a session
 * ended, and what to do when the code is refused.
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

const codeField = () => screen.findByLabelText(/one-time code/i);

describe('what it tells you', () => {
  it('says where the code comes from, because there is no password to fall back on', async () => {
    render();
    expect(await screen.findByText(/console/)).toBeInTheDocument();
    expect(await codeField()).toBeInTheDocument();
  });

  it('focuses the code field so the operator can just type', async () => {
    render();
    expect(await codeField()).toHaveFocus();
  });

  it('will not submit an empty code', async () => {
    render();
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeDisabled();
  });
});

describe('signing in', () => {
  it('exchanges the code and navigates away from the login screen', async () => {
    const signIn = vi.fn().mockResolvedValue(createTestSession('REVIEWER'));
    const { user, location } = render({ auth: { isAuthenticated: false, signIn } });

    await user.type(await codeField(), '123456');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(signIn).toHaveBeenCalledWith('123456');
    await vi.waitFor(() => {
      expect(location()).not.toContain('/login');
    });
  });

  it('sends a PLATFORM_ADMIN to the tenants screen, which is the only one it can open', async () => {
    const signIn = vi.fn().mockResolvedValue(createTestSession('PLATFORM_ADMIN'));
    const { user, location } = render({ auth: { isAuthenticated: false, signIn } });

    await user.type(await codeField(), '123456');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await vi.waitFor(() => {
      expect(location()).toContain('/tenants');
    });
  });

  it('returns the operator to where they were sent away from', async () => {
    const signIn = vi.fn().mockResolvedValue(createTestSession('REVIEWER'));
    const { user, location } = render({
      route: '/login?redirect=%2Fdeposits',
      auth: { isAuthenticated: false, signIn },
    });

    await user.type(await codeField(), '123456');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await vi.waitFor(() => {
      expect(location()).toContain('/deposits');
    });
  });
});

describe('when the code is refused', () => {
  it('says so without distinguishing invalid from expired, exactly as the backend does', async () => {
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

    // The real signIn, so the ApiError travels the whole way from the API to the message.
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

    await user.type(await codeField(), '000000');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/not valid or has expired/i);
  });

  it('clears the field and returns focus, so the next code can be typed straight in', async () => {
    const signIn = vi.fn().mockRejectedValue(new Error('nope'));
    const { user } = render({ auth: { isAuthenticated: false, signIn } });

    const field = await codeField();
    await user.type(field, '000000');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await vi.waitFor(() => {
      expect(field).toHaveValue('');
    });
    expect(field).toHaveFocus();
  });

  it('shows the raw message for a failure that is not a bad code', async () => {
    const signIn = vi.fn().mockRejectedValue(new Error('The API is unreachable'));
    const { user } = render({ auth: { isAuthenticated: false, signIn } });

    await user.type(await codeField(), '123456');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The API is unreachable');
  });
});

describe('in Arabic', () => {
  it('renders the screen in Arabic, not in English behind an Arabic layout', async () => {
    render({ locale: 'ar' });

    expect(await screen.findByText('تسجيل الدخول برمز البوت')).toBeInTheDocument();
    expect(screen.getByLabelText('رمز دخول لمرة واحدة')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تسجيل الدخول' })).toBeInTheDocument();
  });

  it('leaves the bot command in Latin, because it is typed into Telegram exactly as shown', async () => {
    render({ locale: 'ar' });

    const command = await screen.findByText('/console');
    expect(command).toHaveAttribute('dir', 'ltr');
  });

  it('mirrors the document, and mirrors it back for English', async () => {
    const { unmount } = render({ locale: 'ar' });
    await screen.findByText('تسجيل الدخول برمز البوت');

    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.getAttribute('lang')).toBe('ar');

    unmount();
    render({ locale: 'en' });
    await screen.findByText('Sign in with a bot code');

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
});
