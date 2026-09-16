import { expect, test as base, type Page } from '@playwright/test';

/**
 * Shared Playwright setup.
 *
 * The suite runs against the REAL production bundle with the in-browser mock API switched on, so
 * every flow here is the one an operator performs — the same JavaScript, the same router, the same
 * money formatting — with none of the backend, database or Telegram bot a real environment needs.
 *
 * Sign-in is ONE form as of 2026-09-05: a username or email, and a password. In demo mode the
 * USERNAME names the role (see src/mocks/demo.ts), which is what lets a spec sign in as the role it
 * needs. `signInAsAgent` fills the same form with an operator's Ichancy account, which the server
 * tries second and which always lands as that operator's super admin — used only by the specs that
 * are about that credential.
 */

/** The password the mock API accepts for every demo console login. Mirrors src/mocks/demo.ts. */
export const DEMO_PASSWORD = 'demo-pass';

/** The demo login that lands as a SUPER_ADMIN — the role almost every flow needs. */
export const DEMO_USERNAME = 'owner';

/** An active mock operator's agent login, and the password every mock agent accepts. */
export const DEMO_AGENT_USERNAME = 'agent_main';
export const DEMO_AGENT_PASSWORD = 'agent-demo';
/** The mock operator that is SUSPENDED — right credentials, and still no way in. */
export const DEMO_SUSPENDED_AGENT_USERNAME = 'agent_pilot';

/** Fills the sign-in form and submits it. Does NOT assert success — refusals are a flow too. */
export async function fillCredentials(
  page: Page,
  username: string,
  password: string = DEMO_PASSWORD,
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/username or email/i).fill(username);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
}

export async function signInAs(page: Page, username: string = DEMO_USERNAME): Promise<void> {
  await fillCredentials(page, username);
  await expect(page).not.toHaveURL(/\/login/);
}

/** The same form, filled with an operator's Ichancy account instead of a person's own login. */
export async function fillAgentCredentials(
  page: Page,
  username: string,
  password: string = DEMO_AGENT_PASSWORD,
): Promise<void> {
  await fillCredentials(page, username, password);
}

export async function signInAsAgent(
  page: Page,
  username: string = DEMO_AGENT_USERNAME,
): Promise<void> {
  await fillAgentCredentials(page, username);
  await expect(page).not.toHaveURL(/\/login/);
}

/** Kept as the historical name, since almost every flow starts from a signed-in page. */
export const signIn = signInAs;

/** A signed-in page, since almost every flow starts there. */
export const test = base.extend<{ signedIn: Page }>({
  // Playwright's second argument is the fixture handoff, conventionally called `use`. Renamed here
  // because that is also a React hook name, and the hooks lint rule cannot tell the two apart.
  signedIn: async ({ page }, runTest) => {
    await signIn(page);
    await runTest(page);
  },
});

export { expect };
