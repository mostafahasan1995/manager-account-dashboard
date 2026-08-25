import { expect, test as base, type Page } from '@playwright/test';

/**
 * Shared Playwright setup.
 *
 * The suite runs against the REAL production bundle with the in-browser mock API switched on, so
 * every flow here is the one an operator performs — the same JavaScript, the same router, the same
 * money formatting — with none of the backend, database or Telegram bot a real environment needs.
 *
 * Sign-in has TWO doors, so it has two helpers. `signInWithCode` is the Telegram bot code, and it is
 * what `signedIn` uses: the code names the ROLE in demo mode, which is what lets a spec choose the
 * one it needs. `signInAsAgent` is an operator's own Ichancy account, which always lands as that
 * operator's super admin and is therefore only used by the specs that are about the door itself.
 */

/** The code the mock API accepts. Mirrors src/mocks/demo.ts. */
export const DEMO_CODE = '123456';

/** An active mock operator's agent login, and the password every mock agent accepts. */
export const DEMO_AGENT_USERNAME = 'agent_main';
export const DEMO_AGENT_PASSWORD = 'agent-demo';
/** The mock operator that is SUSPENDED — right credentials, and still no way in. */
export const DEMO_SUSPENDED_AGENT_USERNAME = 'agent_pilot';

export async function signInWithCode(page: Page, code: string = DEMO_CODE): Promise<void> {
  await page.goto('/login');
  // The code lives behind its own tab; the screen opens on the operator's own account.
  await page.getByRole('tab', { name: /bot code/i }).click();
  await page.getByLabel(/one-time code/i).fill(code);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Fills the agent form and submits it. Does NOT assert success — refusals are a flow too. */
export async function fillAgentCredentials(
  page: Page,
  username: string,
  password: string = DEMO_AGENT_PASSWORD,
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/ichancy username/i).fill(username);
  await page.getByLabel(/ichancy password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
}

export async function signInAsAgent(
  page: Page,
  username: string = DEMO_AGENT_USERNAME,
): Promise<void> {
  await fillAgentCredentials(page, username);
  await expect(page).not.toHaveURL(/\/login/);
}

/** Kept as the historical name, since almost every flow starts from a signed-in page. */
export const signIn = signInWithCode;

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
