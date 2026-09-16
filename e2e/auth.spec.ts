import {
  DEMO_AGENT_PASSWORD,
  DEMO_AGENT_USERNAME,
  DEMO_PASSWORD,
  DEMO_SUSPENDED_AGENT_USERNAME,
  DEMO_USERNAME,
  expect,
  fillAgentCredentials,
  fillCredentials,
  test,
} from './fixtures';

/**
 * Sign-in, end to end, against the real bundle.
 *
 * ONE form as of 2026-09-05: a username or email, and a password. The bot-code door and the
 * separate Ichancy tab are both gone — the server tries a person's own console credential first
 * and the operator's agent account second behind the same two fields, so what used to be two
 * describe blocks about two doors is now one about one form and the answers it can give.
 */

test.describe('signing in', () => {
  test('the screen asks for one credential, with no door to choose first', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByLabel(/username or email/i)).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
    // Nothing to pick between, and no bot command to go and find.
    await expect(page.getByRole('tab')).toHaveCount(0);
    await expect(page.getByText('/console')).toHaveCount(0);
  });

  test('a console username and password sign in', async ({ page }) => {
    await fillCredentials(page, DEMO_USERNAME, DEMO_PASSWORD);

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/API healthy/i)).toBeVisible();
  });

  test('an Ichancy agent account signs into its own operator, through the same form', async ({
    page,
  }) => {
    await fillAgentCredentials(page, DEMO_AGENT_USERNAME);

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/API healthy/i)).toBeVisible();
  });

  test('a wrong password says the credentials open nothing, and nothing more', async ({ page }) => {
    await fillCredentials(page, DEMO_USERNAME, 'not-the-password');

    await expect(page.getByRole('alert')).toContainText(/do not open anything/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test('a suspended operator is told to ask a platform admin, not to retype', async ({ page }) => {
    // The refusal that matters most: the credentials ARE right, and telling this person their
    // password is wrong would leave them retyping a correct one indefinitely.
    await fillAgentCredentials(page, DEMO_SUSPENDED_AGENT_USERNAME);

    await expect(page.getByRole('alert')).toContainText(/suspended/i);
    await expect(page.getByRole('alert')).toContainText(/platform admin/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test('the password is cleared after a refusal but the username is not', async ({ page }) => {
    await fillCredentials(page, DEMO_USERNAME, 'not-the-password');
    await expect(page.getByRole('alert')).toBeVisible();

    await expect(page.getByLabel(/username or email/i)).toHaveValue(DEMO_USERNAME);
    await expect(page.getByLabel(/^password$/i)).toHaveValue('');
  });
});

test.describe('where a sign-in lands', () => {
  test('an unauthenticated visitor is sent to the login screen and returned afterwards', async ({
    page,
  }) => {
    await page.goto('/deposits');
    await expect(page).toHaveURL(/\/login/);
    // The destination is remembered, which is what makes a shared queue link survive a sign-in.
    await expect(page).toHaveURL(/redirect/);

    await page.getByLabel(/username or email/i).fill(DEMO_USERNAME);
    await page.getByLabel(/^password$/i).fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/deposits/);
  });

  test('the redirect is honoured for an agent credential too', async ({ page }) => {
    await page.goto('/deposits');
    await expect(page).toHaveURL(/redirect/);

    await page.getByLabel(/username or email/i).fill(DEMO_AGENT_USERNAME);
    await page.getByLabel(/^password$/i).fill(DEMO_AGENT_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/deposits/);
  });
});

test.describe('the session', () => {
  test('survives a reload', async ({ signedIn }) => {
    await signedIn.goto('/deposits');
    await signedIn.reload();
    await expect(signedIn).toHaveURL(/\/deposits/);
    await expect(signedIn).not.toHaveURL(/\/login/);
  });

  test('signing out returns to the login screen and does not come back', async ({ signedIn }) => {
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
