import type { AdminRole } from '@/types/enums';

/**
 * The constants the LOGIN SCREEN needs to know about demo mode.
 *
 * Kept apart from `fixtures.ts` deliberately: importing that module from a real screen would drag
 * every mock player, deposit and operator into the production bundle. That is also why the agent
 * logins below are written out rather than derived from `mockTenants` — they MIRROR it, and
 * `demo.mirrors-fixtures.test.ts` fails if the two ever drift.
 */

export const MOCK_SESSION_TTL_MINUTES = 60;

/**
 * The password the mock API accepts for every demo console login. Shown on the login screen.
 *
 * One password across all of them, because what the demo is showing is not password handling — it
 * is which ROLE a login lands in. Against a real backend each account's password is its own scrypt
 * hash on its `admin_users` row and nothing here resembles it.
 */
export const MOCK_CONSOLE_PASSWORD = 'demo-pass';

/**
 * Demo mode signs in as whichever role the USERNAME names.
 *
 * Roles are most of what this console IS — the queue a REVIEWER sees, the staff screen only a
 * SUPER_ADMIN can write to, the operator list only a PLATFORM_ADMIN reaches. A demo that can only
 * ever be one role cannot show any of that, and "trust me, the button disappears" is not a
 * demonstration. Against a real backend none of this exists: the role comes from `admin_users`.
 *
 * These were one-time CODES until 2026-09-05, when the bot-code door was removed and signing in
 * became a username and a password. Same purpose, spelled the way the real login now is.
 */
export const MOCK_ROLE_LOGINS: Readonly<Record<string, AdminRole>> = {
  owner: 'SUPER_ADMIN',
  platform: 'PLATFORM_ADMIN',
  finance: 'FINANCE_ADMIN',
  reviewer: 'REVIEWER',
  support: 'SUPPORT',
  viewer: 'VIEWER',
};

/** The login the demo hint offers first, and what the e2e suite signs in with. */
export const MOCK_CONSOLE_USERNAME = 'owner';

export function mockRoleForLogin(username: string): AdminRole | null {
  return MOCK_ROLE_LOGINS[username.trim().toLowerCase()] ?? null;
}

// ── The other credential: an operator's Ichancy agent account ──────────────────────────────────

/**
 * The password the mock API accepts for every operator's agent account.
 *
 * One password across all of them, because what the demo is showing is not password handling — it
 * is which OPERATOR a login lands in, and what the console says when that operator cannot be
 * entered. Against a real backend each operator's password is its own sealed secret on its tenant
 * row and nothing here resembles it.
 */
export const MOCK_AGENT_PASSWORD = 'agent-demo';

/** The active mock operators' agent logins. Both sign in; they land in different operators. */
export const MOCK_AGENT_USERNAMES: readonly string[] = ['agent_main', 'agent_north'];

/**
 * The suspended operator's agent login.
 *
 * Worth putting on screen rather than hiding: "right password, operator suspended" is the one
 * refusal on this path that a person cannot fix by retyping anything, and a demo that never shows
 * it is a demo of the happy case only.
 */
export const MOCK_SUSPENDED_AGENT_USERNAME = 'agent_pilot';
