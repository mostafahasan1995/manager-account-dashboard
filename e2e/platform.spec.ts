import { DEMO_CODE, expect, signInWithCode, test } from './fixtures';

/**
 * The platform login: one account that runs every operator on the platform.
 *
 * The switcher is the part worth driving end to end, because its whole job is to change WHOSE money
 * the next screen shows — and a picker that merely looks like it worked is the exact failure it
 * exists to prevent. The mock serves a smaller book of business for any operator that is not the
 * home one, so a visibly different queue is the proof the header reached the server.
 */

const PLATFORM_CODE = '111111';

/*
 * Shared with the rest of the suite rather than copied here, now that sign-in has two doors and the
 * code lives behind one of them. The local copy this replaces was already a second place that had
 * to know where the code field is — which is exactly what went stale when the screen grew a tab.
 */
const signIn = signInWithCode;

test('a platform login lands on the operator list, not on somebody else’s queue', async ({
  page,
}) => {
  await signIn(page, PLATFORM_CODE);

  await expect(page).toHaveURL(/\/tenants/);
  await expect(page.getByRole('row', { name: /northern branch/i })).toBeVisible();
  await expect(page.getByRole('row', { name: /pilot operator/i })).toContainText(/suspended/i);
});

test('picking an operator changes what every other screen answers for', async ({ page }) => {
  await signIn(page, PLATFORM_CODE);

  /*
   * Until another is chosen, the switcher names the operator the session belongs to.
   *
   * `exact` is load-bearing. The trigger's accessible name is the slug alone; a menu item's is
   * "Main operation tenant-zero", so the moment the operator list resolves and the menu opens, a
   * substring match names two buttons. That made this a race rather than a failure — the first
   * click opened the menu, and any actionability re-check resolved the locator again against two
   * elements and died on strict mode. It passed alone and failed in a full parallel run.
   */
  await page.getByRole('button', { name: 'tenant-zero', exact: true }).click();
  await page.getByRole('menuitem', { name: /northern branch/i }).click();
  await expect(page.getByRole('button', { name: /northern branch/i }).first()).toBeVisible();

  await page.goto('/deposits');
  await expect(page.getByRole('button', { name: 'K7QP42', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'P0BB31', exact: true })).toBeHidden();
});

test('a platform admin manages staff but never decides money', async ({ page }) => {
  await signIn(page, PLATFORM_CODE);

  await page.goto('/staff');
  await expect(page.getByRole('button', { name: /add administrator/i })).toBeVisible();

  await page.goto('/deposits');
  await page.getByRole('button', { name: 'K7QP42', exact: true }).click();
  const panel = page.getByRole('dialog');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('button', { name: /approve/i })).toBeHidden();
  await expect(panel.getByRole('button', { name: /claim to review/i })).toBeHidden();
});

test('an operator’s own role never sees the picker', async ({ page }) => {
  await signIn(page, DEMO_CODE);
  await expect(page.getByRole('button', { name: /tenant-zero/i })).toBeHidden();
});
