import type { AdminRole } from '@/types/enums';

/**
 * The constants the LOGIN SCREEN needs to know about demo mode.
 *
 * Kept apart from `fixtures.ts` deliberately: importing that module from a real screen would drag
 * every mock player, deposit and operator into the production bundle. That is also why the agent
 * logins below are written out rather than derived from `mockTenants` — they MIRROR it, and
 * `demo.mirrors-fixtures.test.ts` fails if the two ever drift.
 */

/** The code the mock API accepts. Shown on the login screen when mocks are on. */
export const MOCK_LOGIN_CODE = '123456';

export const MOCK_SESSION_TTL_MINUTES = 60;

/**
 * Demo mode signs in as whichever role the code names.
 *
 * Roles are most of what this console IS — the queue a REVIEWER sees, the staff screen only a
 * SUPER_ADMIN can write to, the operator list only a PLATFORM_ADMIN reaches. A demo that can only
 * ever be one role cannot show any of that, and "trust me, the button disappears" is not a
 * demonstration. Against a real backend none of this exists: the role comes from `admin_users`.
 */
export const MOCK_ROLE_CODES: Readonly<Record<string, AdminRole>> = {
  [MOCK_LOGIN_CODE]: 'SUPER_ADMIN',
  '111111': 'PLATFORM_ADMIN',
  '222222': 'FINANCE_ADMIN',
  '333333': 'REVIEWER',
  '444444': 'SUPPORT',
  '555555': 'VIEWER',
};

export function mockRoleForCode(code: string): AdminRole | null {
  return MOCK_ROLE_CODES[code.trim()] ?? null;
}

// ── The other door: an operator's Ichancy agent account ────────────────────────────────────────

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
