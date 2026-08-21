import type { AdminRole } from '@/types/enums';

/**
 * The constants the LOGIN SCREEN needs to know about demo mode.
 *
 * Kept apart from `fixtures.ts` deliberately: importing that module from a real screen would drag
 * every mock player, deposit and operator into the production bundle.
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
