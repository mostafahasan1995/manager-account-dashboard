import { expect, test } from './fixtures';

/**
 * The flow the console exists for: find a deposit, read it, claim it, decide it.
 *
 * These run against the real bundle and the in-browser mock API, whose state actually changes — an
 * approved deposit really leaves the reviewable queue, which is what makes these worth running.
 */

test.beforeEach(async ({ signedIn }) => {
  await signedIn.goto('/deposits');
});

test.describe('the queue', () => {
  test('lists what is waiting, with its money and its status', async ({ signedIn }) => {
    await expect(signedIn.getByRole('button', { name: 'K7QP42', exact: true })).toBeVisible();

    const row = signedIn.getByRole('row', { name: /K7QP42/ });
    await expect(row).toContainText('15,000.00 NSP');
    await expect(row).toContainText('Submitted');
  });

  test('marks a deposit somebody else is holding', async ({ signedIn }) => {
    const row = signedIn.getByRole('row', { name: /B4LM63/ });
    await expect(row).toContainText(/someone else/i);
  });

  test('filtering by short id narrows the queue and lands in the URL', async ({ signedIn }) => {
    await signedIn.getByLabel('Short ID', { exact: true }).fill('K7QP42');
    await signedIn.getByLabel('Short ID', { exact: true }).press('Enter');

    await expect(signedIn).toHaveURL(/shortId=K7QP42/);
    await expect(signedIn.getByRole('button', { name: 'K7QP42', exact: true })).toBeVisible();
    await expect(signedIn.getByRole('button', { name: 'M2WX88', exact: true })).toBeHidden();
  });

  test('a filtered queue is a shareable link', async ({ signedIn }) => {
    await signedIn.goto('/deposits?shortId=M2WX88');
    await expect(signedIn.getByRole('button', { name: 'M2WX88', exact: true })).toBeVisible();
    await expect(signedIn.getByRole('button', { name: 'K7QP42', exact: true })).toBeHidden();
  });
});

test.describe('reviewing one', () => {
  test('opens the panel as a link, showing the risk the backend flagged', async ({ signedIn }) => {
    await signedIn.getByRole('button', { name: 'M2WX88', exact: true }).click();

    await expect(signedIn).toHaveURL(/selected=/);
    const panel = signedIn.getByRole('dialog');
    await expect(panel).toContainText('M2WX88');
    await expect(panel).toContainText(/identical proof already seen/i);
  });

  test('closes on Escape and leaves the URL clean', async ({ signedIn }) => {
    await signedIn.getByRole('button', { name: 'K7QP42', exact: true }).click();
    await expect(signedIn.getByRole('dialog')).toBeVisible();

    await signedIn.keyboard.press('Escape');

    await expect(signedIn.getByRole('dialog')).toBeHidden();
    await expect(signedIn).not.toHaveURL(/selected=/);
  });
});

test.describe('deciding', () => {
  test('claim, then approve, and the deposit leaves the reviewable queue', async ({ signedIn }) => {
    await signedIn.getByRole('button', { name: 'K7QP42', exact: true }).click();

    const panel = signedIn.getByRole('dialog');
    await panel.getByRole('button', { name: /claim to review/i }).click();
    await expect(signedIn.getByText(/you have K7QP42/i)).toBeVisible();

    await panel.getByRole('button', { name: /approve…/i }).click();

    const approve = signedIn.getByRole('dialog').filter({ hasText: /approve deposit K7QP42/i });
    await expect(approve).toContainText('15,000.00');
    await approve.getByRole('button', { name: /^approve/i }).click();

    await expect(signedIn.getByText(/approved K7QP42/i)).toBeVisible();
    await expect(signedIn.getByRole('button', { name: 'K7QP42', exact: true })).toBeHidden();
  });

  test('a large approval asks for a second pair of eyes instead of moving the money', async ({
    signedIn,
  }) => {
    // P0BB31 is 1,400,000.00 — above the tenant's dual-approval threshold.
    await signedIn.getByRole('button', { name: 'P0BB31', exact: true }).click();

    const panel = signedIn.getByRole('dialog');
    await panel.getByRole('button', { name: /claim to review/i }).click();
    await panel.getByRole('button', { name: /approve…/i }).click();

    const approve = signedIn.getByRole('dialog').filter({ hasText: /approve deposit P0BB31/i });
    await approve.getByRole('button', { name: /^approve/i }).click();

    await expect(signedIn.getByText(/second approval|second approver/i).first()).toBeVisible();
  });

  test('rejecting needs a reason, and a fraud reason needs an explanation', async ({
    signedIn,
  }) => {
    await signedIn.getByRole('button', { name: 'M2WX88', exact: true }).click();

    const panel = signedIn.getByRole('dialog');
    await panel.getByRole('button', { name: /claim to review/i }).click();
    await panel.getByRole('button', { name: /reject…/i }).click();

    const reject = signedIn.getByRole('dialog').filter({ hasText: /reject deposit M2WX88/i });

    await reject.getByRole('combobox').click();
    await signedIn.getByRole('option', { name: /suspected fraud/i }).click();

    // The note stops being optional the moment the reason is one that needs explaining.
    await expect(reject.getByLabel(/^note$/i)).toBeVisible();
    await reject.getByLabel(/^note$/i).fill('Same receipt as K7QP42, different player.');
    await reject.getByRole('button', { name: /^reject/i }).click();

    await expect(signedIn.getByText(/rejected M2WX88/i)).toBeVisible();
  });
});
