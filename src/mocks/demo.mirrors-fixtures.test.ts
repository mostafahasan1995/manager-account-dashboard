import { describe, expect, it } from 'vitest';

import { MOCK_AGENT_USERNAMES, MOCK_SUSPENDED_AGENT_USERNAME } from './demo';
import { mockTenants } from './fixtures';

/**
 * `demo.ts` writes the mock agent logins out by hand instead of deriving them from `mockTenants`,
 * because the login SCREEN imports it and importing the fixtures there would pull every mock
 * player, deposit and operator into the production bundle. This file is the price of that: the two
 * are checked against each other here, where importing both costs nothing.
 *
 * Without it the drift is silent and slow — someone renames a mock operator's agent, the login
 * screen keeps advertising the old one, and the demo simply stops working for whoever reads the
 * hint and types what it says.
 */

const activeUsernames = mockTenants
  .filter((tenant) => tenant.status === 'ACTIVE')
  .map((tenant) => tenant.ichancyUsername);

const suspendedUsernames = mockTenants
  .filter((tenant) => tenant.status === 'SUSPENDED')
  .map((tenant) => tenant.ichancyUsername);

describe('the agent logins the login screen advertises', () => {
  it('names every active mock operator, so none of the demo is unreachable', () => {
    expect([...MOCK_AGENT_USERNAMES].sort()).toEqual([...activeUsernames].sort());
  });

  it('names a genuinely suspended operator for the refusal it demonstrates', () => {
    // The whole point of putting it on screen is that its credentials are RIGHT and it still
    // cannot be entered. Pointed at an active operator it would demonstrate the opposite.
    expect(suspendedUsernames).toContain(MOCK_SUSPENDED_AGENT_USERNAME);
    expect(MOCK_AGENT_USERNAMES).not.toContain(MOCK_SUSPENDED_AGENT_USERNAME);
  });

  it('covers every mock operator between them', () => {
    const advertised = new Set([...MOCK_AGENT_USERNAMES, MOCK_SUSPENDED_AGENT_USERNAME]);
    for (const tenant of mockTenants) {
      expect(advertised.has(tenant.ichancyUsername)).toBe(true);
    }
  });
});
