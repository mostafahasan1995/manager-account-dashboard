import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { configureApiClient } from '@/lib/api/client';
import { authApi } from '@/lib/api/endpoints';
import type { AdminSession } from '@/types/admin';

import { AuthContext, type AuthState, type SignOutReason } from './auth-context';
import { can as roleCan, type Capability } from './permissions';
import {
  clearSession,
  isExpiringSoon,
  loadSession,
  millisecondsUntilExpiry,
  saveSession,
} from './session-storage';

const TENANT_STORAGE_KEY = 'cashier-console.tenant.v1';

/** Recomputed on a timer so the header countdown and the expiry warning stay honest. */
const EXPIRY_TICK_MS = 30_000;

function readStoredTenant(): string | null {
  try {
    return window.sessionStorage.getItem(TENANT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  /*
   * The stored session is read SYNCHRONOUSLY, in the state initialiser, not in an effect.
   *
   * An effect would mean the first render says "signed out", which every route guard would believe:
   * a refresh on /deposits would redirect to /login and only then correct itself. Reading it here
   * means the very first render already knows, so there is no restoring state, no spinner, and no
   * flash of the wrong screen. `loadSession` already refuses an expired one.
   */
  const [session, setSession] = useState<AdminSession | null>(() => loadSession());
  const [signOutReason, setSignOutReason] = useState<SignOutReason | null>(null);
  const [tenantId, setTenantIdState] = useState<string | null>(() => readStoredTenant());
  const [now, setNow] = useState(() => Date.now());

  /*
   * The API client reads the token through refs, kept in sync by an effect rather than assigned
   * during render — writing a ref while rendering is a side effect, and React may render a
   * component it then throws away.
   *
   * Being one commit behind costs nothing here: every request originates from an event handler or
   * an effect, both of which run after the commit that updated these.
   */
  const sessionRef = useRef<AdminSession | null>(session);
  const tenantRef = useRef<string | null>(tenantId);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    tenantRef.current = tenantId;
  }, [tenantId]);

  const signOut = useCallback((reason: SignOutReason = 'manual') => {
    clearSession();
    sessionRef.current = null;
    setSession(null);
    setSignOutReason(reason === 'manual' ? null : reason);
  }, []);

  useEffect(() => {
    configureApiClient({
      getToken: () => sessionRef.current?.accessToken ?? null,
      getTenantId: () => tenantRef.current,
      // Any 401 anywhere ends the session exactly once, from one place.
      onUnauthorized: () => {
        if (sessionRef.current !== null) signOut('unauthorized');
      },
    });
  }, [signOut]);

  /*
   * One timer does both jobs: it moves the countdown, and it ends the session when the countdown
   * reaches zero. Deciding that inside the tick rather than in an effect that watches `now` means
   * the sign-out is caused by time passing, which is what actually happened — an effect would make
   * it a consequence of a re-render, and would fire again on any render that changed `now`.
   */
  useEffect(() => {
    const timer = window.setInterval(() => {
      const at = Date.now();
      setNow(at);
      // There is no refresh token for admins: when it expires, the session simply ends.
      if (sessionRef.current !== null && millisecondsUntilExpiry(sessionRef.current, at) <= 0) {
        signOut('expired');
      }
    }, EXPIRY_TICK_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [signOut]);

  const signIn = useCallback(async (code: string): Promise<AdminSession> => {
    const next = await authApi.exchangeBotCode(code.trim());
    saveSession(next);
    sessionRef.current = next;
    setSession(next);
    setSignOutReason(null);
    setNow(Date.now());
    return next;
  }, []);

  const setTenantId = useCallback((next: string | null) => {
    tenantRef.current = next;
    setTenantIdState(next);
    try {
      if (next === null) window.sessionStorage.removeItem(TENANT_STORAGE_KEY);
      else window.sessionStorage.setItem(TENANT_STORAGE_KEY, next);
    } catch {
      // A browser that refuses storage still gets a working selection for this tab.
    }
  }, []);

  const value = useMemo<AuthState>(() => {
    const role = session?.admin.role ?? null;
    return {
      session,
      admin: session?.admin ?? null,
      role,
      isAuthenticated: session !== null,
      // Restoring is synchronous now — see the state initialiser. Kept on the interface because the
      // route guards read it, and because a future async restore would need it back.
      isRestoring: false,
      signOutReason,
      expiresInMs: session === null ? 0 : millisecondsUntilExpiry(session, now),
      expiringSoon: session !== null && isExpiringSoon(session, now),
      signIn,
      signOut,
      can: (capability: Capability) => roleCan(role, capability),
      tenantId,
      setTenantId,
    };
  }, [session, signOutReason, now, signIn, signOut, tenantId, setTenantId]);

  return <AuthContext value={value}>{children}</AuthContext>;
}
