import type { AdminSession } from '@/types/admin';
import { adminSessionSchema } from '@/types/admin';

/**
 * Where the access token lives between page loads.
 *
 * `sessionStorage`, not `localStorage`: this console decides money, it is used on shared machines,
 * and the backend issues admin tokens with NO refresh token. Scoping the session to the browser tab
 * means closing the tab ends it, which matches how the credential itself behaves — when it expires
 * the admin asks the Telegram bot for a new code, which takes about five seconds.
 *
 * Storage is wrapped because it throws in a locked-down browser (Safari private mode, an enterprise
 * policy); a console that cannot persist a session must still work for the current tab.
 */

export const SESSION_STORAGE_KEY = 'cashier-console.session.v1';

const memoryFallback = new Map<string, string>();

function readRaw(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return memoryFallback.get(key) ?? null;
  }
}

function writeRaw(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    memoryFallback.set(key, value);
  }
}

function removeRaw(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    memoryFallback.delete(key);
  }
}

export function loadSession(now = Date.now()): AdminSession | null {
  const raw = readRaw(SESSION_STORAGE_KEY);
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    removeRaw(SESSION_STORAGE_KEY);
    return null;
  }

  const result = adminSessionSchema.safeParse(parsed);
  if (!result.success) {
    removeRaw(SESSION_STORAGE_KEY);
    return null;
  }

  // An expired token is not worth restoring: every request it makes would 401 and bounce the admin
  // back to the login screen with an error instead of a clean "please sign in".
  if (isExpired(result.data, now)) {
    removeRaw(SESSION_STORAGE_KEY);
    return null;
  }

  return result.data;
}

export function saveSession(session: AdminSession): void {
  writeRaw(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  removeRaw(SESSION_STORAGE_KEY);
}

export function isExpired(session: AdminSession, now = Date.now()): boolean {
  const expiresAt = Date.parse(session.expiresAt);
  return Number.isNaN(expiresAt) || expiresAt <= now;
}

export function millisecondsUntilExpiry(session: AdminSession, now = Date.now()): number {
  const expiresAt = Date.parse(session.expiresAt);
  if (Number.isNaN(expiresAt)) return 0;
  return Math.max(0, expiresAt - now);
}

/** Below this the console warns; there is no refresh, so the warning is the only notice given. */
export const EXPIRY_WARNING_MS = 5 * 60_000;

export function isExpiringSoon(session: AdminSession, now = Date.now()): boolean {
  const remaining = millisecondsUntilExpiry(session, now);
  return remaining > 0 && remaining <= EXPIRY_WARNING_MS;
}
