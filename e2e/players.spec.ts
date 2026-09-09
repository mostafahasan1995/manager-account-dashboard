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

/**
 * The doors into the directory that are not a Telegram Start, and the operator's own lock. All of
 * it runs against the mock API, which registers, imports, blocks and unblocks for real in its
 * in-memory state.
 */

test('the old players are a view of their own, and the view is a URL', async ({ signedIn }) => {
  await signedIn.getByRole('tab', { name: /old players/i }).click();

  await expect(signedIn).toHaveURL(/source=ICHANCY_IMPORT/);
  // The imported account has no name and no Telegram; its Ichancy login is what names it.
  await expect(signedIn.getByRole('link', { name: 'samer1987' })).toBeVisible();
  await expect(signedIn.getByRole('link', { name: /karim nasser/i })).toBeHidden();
});

test('registers a player from the console and reports it on the page', async ({ signedIn }) => {
  await signedIn.getByRole('button', { name: /register player/i }).click();
  const dialog = signedIn.getByRole('dialog');
  await dialog.getByLabel(/first name/i).fill('Nour');
  await dialog.getByLabel(/last name/i).fill('Haddad');
  await dialog.getByRole('button', { name: /^register$/i }).click();

  await expect(
    signedIn.getByRole('status').filter({ hasText: /registered nour haddad/i }),
  ).toBeVisible();
  await expect(signedIn.getByRole('link', { name: 'Nour Haddad', exact: true })).toBeVisible();
});

test('blocks a player from the row, and the blocked view lists them', async ({ signedIn }) => {
  await signedIn.getByRole('button', { name: 'Block Karim Nasser' }).click();
  const dialog = signedIn.getByRole('dialog');
  await dialog.getByLabel(/reason/i).fill('Three accounts on one receipt');
  await dialog.getByRole('button', { name: /review this block/i }).click();
  await dialog.getByRole('button', { name: 'Block Karim Nasser' }).click();

  await expect(signedIn.getByRole('row', { name: /karim nasser/i })).toContainText(/blocked/i);

  await signedIn.getByRole('tab', { name: /^blocked$/i }).click();
  await expect(signedIn).toHaveURL(/blocked=true/);
  await expect(signedIn.getByRole('link', { name: /karim nasser/i })).toBeVisible();
});

test('the detail page says why a player is blocked and can lift it', async ({ signedIn }) => {
  await signedIn.goto('/players/bbbbbbbb-0000-4000-8000-000000000008');

  await expect(signedIn.getByText(/blocked from the bot/i)).toBeVisible();
  await expect(signedIn.getByText('Three accounts sharing one bank receipt.')).toBeVisible();

  await signedIn.getByRole('button', { name: /unblock player/i }).click();
  await signedIn
    .getByRole('dialog')
    .getByRole('button', { name: /^unblock$/i })
    .click();

  await expect(signedIn.getByText(/blocked from the bot/i)).toBeHidden();
  await expect(signedIn.getByRole('button', { name: /^block player$/i })).toBeVisible();
});
