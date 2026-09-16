import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { server } from '@/test/msw-server';
import type { AdminSession } from '@/types/admin';

import { AuthProvider } from './auth-provider';
import { EXPIRY_WARNING_MS, SESSION_STORAGE_KEY } from './session-storage';
import { useAuth } from './use-auth';

/**
 * The provider is the only thing standing between a stale token and a console full of 401s, so
 * these tests cover the four moments that matter: restoring, signing in, expiring, and being told
 * by the API that the session is no longer good.
 */

const storedSession = (expiresInMs: number): AdminSession => ({
  accessToken: 'stored-token',
  expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
  admin: {
    id: 'aaaaaaaa-0000-4000-8000-000000000001',
    telegramUserId: '700000001',
    role: 'FINANCE_ADMIN',
    displayName: 'Sami Aziz',
  },
});

function Probe() {
  const { admin, isAuthenticated, isRestoring, signIn, signOut, can, signOutReason, expiringSoon } =
    useAuth();

  return (
    <div>
      <span data-testid="state">
        {isRestoring ? 'restoring' : isAuthenticated ? 'authenticated' : 'anonymous'}
      </span>
      <span data-testid="who">{admin?.displayName ?? 'nobody'}</span>
      <span data-testid="reason">{signOutReason ?? 'none'}</span>
      <span data-testid="can-decide">{String(can('deposits.decide'))}</span>
      <span data-testid="can-tenants">{String(can('tenants.manage'))}</span>
      <span data-testid="expiring">{String(expiringSoon)}</span>
      <button
        onClick={() => {
          // The real login screen renders the rejection; this probe only has to not explode.
          void signIn({ username: 'owner', password: 'demo-pass' }).catch(() => undefined);
        }}
      >
        sign in
      </button>
      <button
        onClick={() => {
          signOut('manual');
        }}
      >
        sign out
      </button>
    </div>
  );
}

const renderProvider = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

afterEach(() => {
  window.sessionStorage.clear();
});

describe('restoring', () => {
  it('restores a live session so a refresh does not bounce to the login screen', async () => {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(storedSession(60 * 60_000)));
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('authenticated');
    });
    expect(screen.getByTestId('who')).toHaveTextContent('Sami Aziz');
  });

  it('does not restore an expired one', async () => {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(storedSession(-1_000)));
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('anonymous');
    });
  });

  it('finishes restoring even when there is nothing to restore', async () => {
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('anonymous');
    });
  });
});

describe('signing in', () => {
  it('exchanges the credential, stores the session and exposes the role', async () => {
    const user = userEvent.setup();
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('anonymous');
    });

    await user.click(screen.getByRole('button', { name: 'sign in' }));

    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('authenticated');
    });
    // The mock API signs in as the fixture SUPER_ADMIN.
    expect(screen.getByTestId('can-decide')).toHaveTextContent('true');
    expect(screen.getByTestId('can-tenants')).toHaveTextContent('false');
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull();
  });

  it('leaves the console signed out when the credential is refused', async () => {
    const user = userEvent.setup();
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

    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('anonymous');
    });

    // The rejection surfaces to the caller; the provider itself must not blow up on it.
    await user.click(screen.getByRole('button', { name: 'sign in' }));

    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('anonymous');
    });
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
});

describe('signing out', () => {
  it('clears storage and reports no reason for a deliberate sign-out', async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(storedSession(60 * 60_000)));
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('authenticated');
    });

    await user.click(screen.getByRole('button', { name: 'sign out' }));

    expect(screen.getByTestId('state')).toHaveTextContent('anonymous');
    expect(screen.getByTestId('reason')).toHaveTextContent('none');
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
});

describe('expiry', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('flags a session that is about to end, since there is no refresh to save it', async () => {
    window.sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(storedSession(EXPIRY_WARNING_MS - 10_000)),
    );
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('expiring')).toHaveTextContent('true');
    });
  });

  it('signs out by itself when the token expires, and says why', async () => {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(storedSession(40_000)));
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('authenticated');
    });

    // The provider re-checks on a timer rather than on every render.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('anonymous');
    });
    expect(screen.getByTestId('reason')).toHaveTextContent('expired');
  });
});

describe('a 401 from anywhere in the app', () => {
  it('ends the session once, with the reason the login screen shows', async () => {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(storedSession(60 * 60_000)));
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/players`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'UNAUTHENTICATED', message: 'A bearer access token is required.' },
            meta: { correlationId: 'c', timestamp: 't' },
          },
          { status: 401 },
        ),
      ),
    );

    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('authenticated');
    });

    const { playersApi } = await import('@/lib/api/endpoints');
    await expect(playersApi.list()).rejects.toThrow();

    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('anonymous');
    });
    expect(screen.getByTestId('reason')).toHaveTextContent('unauthorized');
  });
});
