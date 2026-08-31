import { expect, test } from './fixtures';

/**
 * The flow support staff run while a player is on the phone: find the account, see whether it is
 * linked to Ichancy, and link it if it is not — because an unlinked player is one who cannot be
 * credited.
 */

test.beforeEach(async ({ signedIn }) => {
  await signedIn.goto('/players');
});

test('finds an account by name and keeps the search in the URL', async ({ signedIn }) => {
  await signedIn.getByLabel(/search players/i).fill('karim');

  await expect(signedIn).toHaveURL(/search=karim/);
  // The player LINK, not the cell: every row now carries Deposit and Withdrawal actions whose
  // accessible names name the player (a table of identical "Deposit" buttons is unusable with a
  // screen reader), so /karim nasser/i matches the name cell and the actions cell both. The link is
  // the unambiguous thing, and it is what "the account is findable" actually means.
  await expect(signedIn.getByRole('link', { name: /karim nasser/i })).toBeVisible();
  await expect(signedIn.getByRole('link', { name: /maya/i })).toBeHidden();
});

test('a hand-typed "linked=no" shows everyone, and never the opposite of what it says', async ({
  signedIn,
}) => {
  /*
   * `?linked=no` is not a value this console ever writes — it writes real JSON booleans — but a
   * shared link is a thing people edit by hand, and this one used to filter to LINKED. The schema
   * now reads an unparseable boolean as ABSENT, so the honest answer is the unfiltered list: an
   * unlinked player must still be visible on a link that asked for unlinked players.
   */
  await signedIn.goto('/players?linked=no');

  await expect(signedIn.getByRole('row', { name: /maya/i })).toContainText(/not linked/i);
  await expect(signedIn.getByRole('link', { name: /karim nasser/i })).toBeVisible();
});

test('shows which players cannot be credited yet', async ({ signedIn }) => {
  const row = signedIn.getByRole('row', { name: /maya/i });
  await expect(row).toContainText(/pending ichancy/i);
  await expect(row).toContainText(/not linked/i);
});

test('opens a player and shows their Ichancy identity', async ({ signedIn }) => {
  await signedIn.getByRole('link', { name: /karim nasser/i }).click();

  await expect(signedIn).toHaveURL(/\/players\//);
  await expect(signedIn.getByText('tg512340001')).toBeVisible();
  await expect(signedIn.getByText('99001')).toBeVisible();
});

test('creates the missing Ichancy account and reports the login it got', async ({ signedIn }) => {
  await signedIn.getByRole('link', { name: /maya/i }).click();

  await signedIn.getByRole('button', { name: /create ichancy account/i }).click();
  await signedIn
    .getByRole('dialog')
    .getByRole('button', { name: /create/i })
    .click();

  await expect(signedIn.getByText(/tg512340002/).first()).toBeVisible();
});

test('a player id that does not exist explains itself rather than blanking', async ({
  signedIn,
}) => {
  await signedIn.goto('/players/bbbbbbbb-0000-4000-8000-000000009999');
  await expect(signedIn.getByRole('alert')).toContainText(/not found/i);
});
