import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AdminSession } from '@/types/admin';

import {
  clearSession,
  EXPIRY_WARNING_MS,
  isExpired,
  isExpiringSoon,
  loadSession,
  millisecondsUntilExpiry,
  saveSession,
  SESSION_STORAGE_KEY,
} from './session-storage';

/**
 * The session is the whole credential: there is no refresh token for admins. What matters here is
 * that an expired one is never restored — a restored dead token produces a 401 on the first request
 * of the shift, which reads as "the console is broken" rather than "please sign in".
 */

const session = (expiresInMs: number): AdminSession => ({
  accessToken: 'token',
  expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
  admin: {
    id: 'aaaaaaaa-0000-4000-8000-000000000001',
    telegramUserId: '700000001',
    role: 'SUPER_ADMIN',
    displayName: 'Nour Haddad',
  },
});

afterEach(() => {
  window.sessionStorage.clear();
});

describe('saving and loading', () => {
  it('round-trips a live session', () => {
    const live = session(60 * 60_000);
    saveSession(live);
    expect(loadSession()).toEqual(live);
  });

  it('returns null when nothing is stored', () => {
    expect(loadSession()).toBeNull();
  });

  it('clears the session on request', () => {
    saveSession(session(60_000));
    clearSession();
    expect(loadSession()).toBeNull();
  });
});

describe('refusing what it should not restore', () => {
  it('drops an expired session instead of handing back a token that will 401', () => {
    saveSession(session(-1_000));
    expect(loadSession()).toBeNull();
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('drops a corrupt entry', () => {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, 'not json at all');
    expect(loadSession()).toBeNull();
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('drops an entry whose shape no longer matches', () => {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ accessToken: 'x' }));
    expect(loadSession()).toBeNull();
  });

  it('drops an entry with an unparseable expiry rather than trusting it forever', () => {
    window.sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ ...session(1_000), expiresAt: 'not-a-date' }),
    );
    expect(loadSession()).toBeNull();
  });
});

describe('when storage itself refuses', () => {
  it('keeps working for the current tab', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    const live = session(60_000);
    expect(() => {
      saveSession(live);
    }).not.toThrow();
    expect(loadSession()).toEqual(live);

    setItem.mockRestore();
    getItem.mockRestore();
  });
});

describe('expiry arithmetic', () => {
  it('reports an expired session as expired', () => {
    expect(isExpired(session(-1))).toBe(true);
    expect(isExpired(session(1_000))).toBe(false);
  });

  it('treats an unparseable expiry as already expired', () => {
    expect(isExpired({ ...session(1_000), expiresAt: 'nonsense' })).toBe(true);
  });

  it('never reports a negative remaining time', () => {
    expect(millisecondsUntilExpiry(session(-5_000))).toBe(0);
  });

  it('warns only inside the warning window, and not after it has already gone', () => {
    expect(isExpiringSoon(session(EXPIRY_WARNING_MS - 1_000))).toBe(true);
    expect(isExpiringSoon(session(EXPIRY_WARNING_MS + 60_000))).toBe(false);
    expect(isExpiringSoon(session(-1_000))).toBe(false);
  });
});
