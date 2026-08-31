import { expect, test } from './fixtures';

/**
 * Where an operator's bot publishes, driven end to end.
 *
 * The flow worth driving in a real browser is the REFUSAL, not the happy path. Binding a chat that
 * works is one request and one row; what this screen exists for is the four ways it can fail, each
 * of which used to look identical from outside — nothing arrives — and each of which is fixed by a
 * different person. A component test can assert the sentence; only this can prove the sentence
 * survives the real bundle, the real router and the real form.
 */

test.beforeEach(async ({ signedIn }) => {
  await signedIn.goto('/telegram');
});

test('lists the destinations by their group name, and shows the one that is failing', async ({
  signedIn,
}) => {
  await expect(signedIn.getByText('Cashier ops')).toBeVisible();

  // The row this whole screen exists for: healthy in every other column, and quietly undelivered.
  await expect(signedIn.getByText(/bot was kicked from the group chat/i)).toBeVisible();

  // "Never verified" is a state, not an error and not a blank.
  await expect(signedIn.getByText('Never verified')).toBeVisible();
});

test('binds a group and shows it in the table', async ({ signedIn }) => {
  await signedIn.getByRole('button', { name: /add a destination/i }).click();
  await signedIn.getByLabel(/group or channel/i).fill('https://t.me/night_shift');
  await signedIn.getByRole('button', { name: /add destination/i }).click();

  // `exact` matters: the pick-list fixture contains "Night shift (private)", and Playwright's
  // default substring match would happily accept that instead of the row this test just created.
  await expect(signedIn.getByText('night shift', { exact: true })).toBeVisible();
});

/**
 * THE CASE THE WHOLE PICK-LIST EXISTS FOR, driven end to end.
 *
 * A private group has no @username to resolve and no invite link a bot can follow, and there is no
 * Bot API call that lists a bot's chats — so until this list existed there was no value an operator
 * could type into the group field that the server was able to accept. This is the only route in,
 * and it is worth proving through the real bundle and the real form rather than in a component test
 * alone: the id has to travel from a list, into the visible field, through the mutation, and back
 * out as a row.
 */
test('binds a private group by picking it, with no link typed anywhere', async ({ signedIn }) => {
  await signedIn.getByRole('button', { name: /add a destination/i }).click();

  const dialog = signedIn.getByRole('dialog');
  await dialog.getByRole('button', { name: /use this group: night shift \(private\)/i }).click();

  // The chat id lands in the field the operator can see — not in hidden state.
  await expect(signedIn.getByLabel(/group or channel/i)).toHaveValue('-1002233445566');
  // And the form says out loud that picking is not the same as proving.
  await expect(dialog.getByText(/checked again before anything is saved/i)).toBeVisible();

  await signedIn.getByRole('button', { name: /add destination/i }).click();

  // The ROW, not a cell: the row actions are labelled with the group's name too, so a cell query
  // matches both the name cell and the actions cell.
  await expect(signedIn.getByRole('row', { name: /night shift \(private\)/i })).toBeVisible();
});

test('marks a group that is already a destination rather than offering it twice', async ({
  signedIn,
}) => {
  await signedIn.getByRole('button', { name: /add a destination/i }).click();

  const dialog = signedIn.getByRole('dialog');
  // Cashier ops is already bound, so it carries a badge and no button.
  await expect(dialog.getByRole('button', { name: /use this group: cashier ops/i })).toBeHidden();
  await expect(
    dialog.getByRole('button', { name: /use this group: night shift \(private\)/i }),
  ).toBeVisible();
});

test('refuses a group the bot is not an administrator of, and says who fixes it', async ({
  signedIn,
}) => {
  await signedIn.getByRole('button', { name: /add a destination/i }).click();
  await signedIn.getByLabel(/group or channel/i).fill('https://t.me/notadmin_group');
  await signedIn.getByRole('button', { name: /add destination/i }).click();

  // Not "could not add destination" — the sentence names the person and the action.
  await expect(signedIn.getByText(/a group administrator must promote it/i)).toBeVisible();

  // And nothing was saved: a claim that could not be proved never becomes a row.
  await signedIn.getByRole('button', { name: /cancel/i }).click();
  await expect(signedIn.getByText('notadmin group')).toBeHidden();
});

test('refuses a private invite link with the reason a bot cannot follow one', async ({
  signedIn,
}) => {
  await signedIn.getByRole('button', { name: /add a destination/i }).click();
  await signedIn.getByLabel(/group or channel/i).fill('https://t.me/+AbCdEfGh');
  await signedIn.getByRole('button', { name: /add destination/i }).click();

  await expect(signedIn.getByText(/not a telegram group or channel/i)).toBeVisible();
});

test('sends a test message and reports that it arrived', async ({ signedIn }) => {
  const row = signedIn.getByRole('row', { name: /cashier ops/i });
  await row.getByRole('button', { name: /send a test/i }).click();

  await expect(signedIn.getByText(/test message delivered to cashier ops/i)).toBeVisible();
});

test('removing a destination disables it rather than deleting it', async ({ signedIn }) => {
  const row = signedIn.getByRole('row', { name: /cashier ops/i });
  await row.getByRole('button', { name: /^remove/i }).click();

  const dialog = signedIn.getByRole('dialog');
  await expect(dialog).toContainText(/nothing is deleted/i);
  await dialog.getByRole('button', { name: 'Remove', exact: true }).click();

  // Still listed, now marked Disabled — which is what makes it restorable. Scoped to the ROW,
  // because the confirmation copy names the group too and a bare text match would find both.
  const removed = signedIn.getByRole('row', { name: /cashier ops/i });
  await expect(removed).toBeVisible();
  await expect(removed).toContainText('Disabled');
});
