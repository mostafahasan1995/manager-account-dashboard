import { expect, test as base, type Page } from '@playwright/test';

/**
 * Shared Playwright setup.
 *
 * The suite runs against the REAL production bundle with the in-browser mock API switched on, so
 * every flow here is the one an operator performs — the same JavaScript, the same router, the same
 * money formatting — with none of the backend, database or Telegram bot a real environment needs.
 */

/** The code the mock API accepts. Mirrors src/mocks/demo.ts. */
export const DEMO_CODE = '123456';

export async function signIn(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/one-time code/i).fill(DEMO_CODE);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

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
