import {
  DEMO_AGENT_PASSWORD,
  DEMO_AGENT_USERNAME,
  DEMO_CODE,
  DEMO_SUSPENDED_AGENT_USERNAME,
  expect,
  fillAgentCredentials,
  test,
} from './fixtures';

test.describe('signing in as an operator', () => {
  test('the screen opens on the account an operator actually holds', async ({ page }) => {
    await page.goto('/login');

    // Both doors are on offer, and the one most people need is the one already open.
    await expect(page.getByRole('tab', { name: /ichancy account/i })).toHaveAttribute(
      'data-state',
      'active',
    );
    await expect(page.getByLabel(/ichancy username/i)).toBeVisible();
    await expect(page.getByRole('tab', { name: /bot code/i })).toBeVisible();
  });

  test('an Ichancy agent account signs into its own operator', async ({ page }) => {
    await fillAgentCredentials(page, DEMO_AGENT_USERNAME);

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/API healthy/i)).toBeVisible();
  });

  test('a wrong password says the credentials open nothing, and nothing more', async ({ page }) => {
    await fillAgentCredentials(page, DEMO_AGENT_USERNAME, 'not-the-password');

    await expect(page.getByRole('alert')).toContainText(/do not open any operator/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test('a suspended operator is told to ask a platform admin, not to retype', async ({ page }) => {
    // The refusal that matters most on this door: the credentials ARE right, and telling this
    // person their password is wrong would leave them retyping a correct one indefinitely.
    await fillAgentCredentials(page, DEMO_SUSPENDED_AGENT_USERNAME);

    await expect(page.getByRole('alert')).toContainText(/suspended/i);
    await expect(page.getByRole('alert')).toContainText(/platform admin/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test('the password is cleared after a refusal but the username is not', async ({ page }) => {
    await fillAgentCredentials(page, DEMO_AGENT_USERNAME, 'not-the-password');
    await expect(page.getByRole('alert')).toBeVisible();

    await expect(page.getByLabel(/ichancy username/i)).toHaveValue(DEMO_AGENT_USERNAME);
    await expect(page.getByLabel(/ichancy password/i)).toHaveValue('');
  });
});

test.describe('signing in with a bot code', () => {
  test('an unauthenticated visitor is sent to the login screen and returned afterwards', async ({
    page,
  }) => {
    await page.goto('/deposits');
    await expect(page).toHaveURL(/\/login/);
    // The destination is remembered, which is what makes a shared queue link survive a sign-in.
    await expect(page).toHaveURL(/redirect/);

    await page.getByRole('tab', { name: /bot code/i }).click();
    await page.getByLabel(/one-time code/i).fill(DEMO_CODE);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/deposits/);
  });

  test('a wrong code is refused without saying whether it was wrong or merely late', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByRole('tab', { name: /bot code/i }).click();
    await page.getByLabel(/one-time code/i).fill('000000');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByRole('alert')).toContainText(/not valid or has expired/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test('the redirect is honoured through the agent door too', async ({ page }) => {
    await page.goto('/deposits');
    await expect(page).toHaveURL(/redirect/);

    await page.getByLabel(/ichancy username/i).fill(DEMO_AGENT_USERNAME);
    await page.getByLabel(/ichancy password/i).fill(DEMO_AGENT_PASSWORD);
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
