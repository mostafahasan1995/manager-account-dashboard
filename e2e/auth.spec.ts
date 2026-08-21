import { DEMO_CODE, expect, test } from './fixtures';

test.describe('signing in', () => {
  test('an unauthenticated visitor is sent to the login screen and returned afterwards', async ({
    page,
  }) => {
    await page.goto('/deposits');
    await expect(page).toHaveURL(/\/login/);
    // The destination is remembered, which is what makes a shared queue link survive a sign-in.
    await expect(page).toHaveURL(/redirect/);

    await page.getByLabel(/one-time code/i).fill(DEMO_CODE);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/deposits/);
  });

  test('a wrong code is refused without saying whether it was wrong or merely late', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel(/one-time code/i).fill('000000');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByRole('alert')).toContainText(/not valid or has expired/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test('the session survives a reload', async ({ signedIn }) => {
    await signedIn.goto('/deposits');
    await signedIn.reload();
    await expect(signedIn).toHaveURL(/\/deposits/);
    await expect(signedIn).not.toHaveURL(/\/login/);
  });

  test('signing out returns to the login screen and the session does not come back', async ({
    signedIn,
  }) => {
    await signedIn.getByRole('button', { name: /account menu/i }).click();
    await signedIn.getByRole('menuitem', { name: /sign out/i }).click();

    await expect(signedIn).toHaveURL(/\/login/);

    await signedIn.goto('/deposits');
    await expect(signedIn).toHaveURL(/\/login/);
  });
});

test.describe('the shell', () => {
  test('says which backend it is talking to and that it is healthy', async ({ signedIn }) => {
    await expect(signedIn.getByText(/API healthy/i)).toBeVisible();
  });

  test('no longer claims to be single-tenant, now that the API carries the operator', async ({
    signedIn,
  }) => {
    await expect(signedIn.getByText(/single-tenant mode/i)).toBeHidden();
  });

  test('a link that goes nowhere lands on a page that offers a way back', async ({ signedIn }) => {
    await signedIn.goto('/not-a-real-screen');
    await expect(signedIn.getByText(/does not exist/i)).toBeVisible();
    await signedIn.getByRole('link', { name: /back to the overview/i }).click();
    await expect(signedIn).toHaveURL(/\/$/);
  });
});
