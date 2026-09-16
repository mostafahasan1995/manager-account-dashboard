import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { PLAYER_IDS, mockPlayers } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';
import type { AdminPlayer } from '@/types/player';

import { DebitPlayerDialog } from './debit-player-dialog';

/**
 * The one form in this console that takes money OUT of a live casino account.
 *
 * What is being defended here is not that the dialog renders. It is that nothing leaves this screen
 * until a person has read the figure back on a second screen, that the figure which leaves is the
 * one they typed — as minor units, in a string, never through a JavaScript number — and that a
 * failure the console cannot prove one way or the other does NOT offer to send it again.
 */

const DEBIT_PATH = `${config.apiBaseUrl}/v1/admin/players/:id/debit`;

const playerFixture = (id: string): AdminPlayer => {
  const player = mockPlayers.find((row) => row.id === id);
  if (player === undefined) throw new Error(`no player fixture ${id}`);
  return structuredClone(player);
};

const linked = playerFixture(PLAYER_IDS.linkedActive);
const unlinked = playerFixture(PLAYER_IDS.pendingLink);

const meta = () => ({ correlationId: 'test-debit', timestamp: new Date().toISOString() });

const debitBody = (overrides: Record<string, unknown> = {}) => ({
  debitId: '77777777-0000-4000-8000-000000000001',
  playerId: linked.id,
  amountMinor: '150000',
  status: 'DEBITED',
  playerBalanceBeforeMinor: '320000',
  playerBalanceAfterMinor: '170000',
  verifiedBy: 'BALANCE_DELTA',
  reason: 'Chargeback on the original deposit',
  decidedBy: 'aaaaaaaa-0000-4000-8000-000000000001',
  createdAt: new Date().toISOString(),
  ...overrides,
});

/** Installs a debit endpoint that records exactly what went over the wire. */
function captureDebit(respond: () => Response) {
  const sent: string[] = [];
  server.use(
    http.post(DEBIT_PATH, async ({ request }) => {
      sent.push(await request.text());
      return respond();
    }),
  );
  return sent;
}

const okResponse =
  (overrides: Record<string, unknown> = {}) =>
  () =>
    HttpResponse.json(
      { success: true, data: debitBody(overrides), error: null, meta: meta() },
      { status: 200 },
    );

const failResponse = (status: number, code: string, message: string) => () =>
  HttpResponse.json(
    { success: false, data: null, error: { code, message }, meta: meta() },
    { status },
  );

const renderDialog = (player: AdminPlayer = linked) => {
  const onDebited = vi.fn();
  const onOpenChange = vi.fn();
  const onUnproven = vi.fn();
  const result = renderPlain(
    <DebitPlayerDialog
      player={player}
      open
      onOpenChange={onOpenChange}
      onDebited={onDebited}
      onUnproven={onUnproven}
    />,
  );
  return { ...result, onDebited, onOpenChange, onUnproven };
};

type User = ReturnType<typeof renderDialog>['user'];

const fillIn = async (user: User, amount: string, reason: string) => {
  await user.type(screen.getByLabelText('Amount to take out (NSP)'), amount);
  await user.type(screen.getByLabelText('Reason'), reason);
};

const review = async (user: User) => {
  await user.click(screen.getByRole('button', { name: 'Review this debit' }));
};

describe('DebitPlayerDialog', () => {
  it('will not move to the confirmation without an amount and a reason', async () => {
    const { user } = renderDialog();

    await review(user);

    expect(screen.getByText('Enter the amount to take out.')).toBeInTheDocument();
    expect(
      screen.getByText(/Say why\. Whoever answers this player’s complaint reads it/),
    ).toBeInTheDocument();
    // Still on the form: nothing has been read back, so nothing can be confirmed.
    expect(screen.queryByText(/Take this money out of/)).not.toBeInTheDocument();
  });

  it('refuses an amount that is not a plain decimal, rather than guessing at it', async () => {
    const { user } = renderDialog();

    await fillIn(user, '1,500', 'Chargeback');
    await review(user);

    expect(
      screen.getByText('Digits and at most two decimals — 1500.00, not 1,500 or 1.5e3.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Take this money out of/)).not.toBeInTheDocument();
  });

  it('refuses a debit of nothing', async () => {
    const { user } = renderDialog();

    await fillIn(user, '0.00', 'Chargeback');
    await review(user);

    expect(screen.getByText('The amount has to be more than zero.')).toBeInTheDocument();
  });

  it('sends nothing until the confirmation is pressed, and shows the amount on the way', async () => {
    const sent = captureDebit(okResponse());
    const { user, onDebited } = renderDialog();

    await fillIn(user, '1500.00', 'Chargeback on the original deposit');
    await review(user);

    // The confirmation states plainly what is about to happen, with the amount in full.
    expect(
      await screen.findByText('Take this money out of Karim Nasser’s casino account?'),
    ).toBeInTheDocument();
    expect(screen.getByText('Taking out')).toBeInTheDocument();
    expect(screen.getByTestId('money')).toHaveTextContent('1,500.00 NSP');
    expect(screen.getByText('Chargeback on the original deposit')).toBeInTheDocument();
    expect(screen.getByText('The console cannot undo this')).toBeInTheDocument();
    // Reading it back is not doing it.
    expect(sent).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Debit 1,500.00 NSP' }));

    await vi.waitFor(() => {
      expect(onDebited).toHaveBeenCalledTimes(1);
    });
    expect(sent).toHaveLength(1);
    expect(onDebited.mock.calls[0]?.[0]).toMatchObject({ status: 'DEBITED' });
  });

  it('puts minor units on the wire as a string, never through a JavaScript number', async () => {
    const sent = captureDebit(okResponse({ amountMinor: '9007199254740993' }));
    const { user } = renderDialog();

    // Two minor units past Number.MAX_SAFE_INTEGER: a double cannot hold this figure, so anything
    // that had been near one would arrive as ...992 and debit the wrong amount.
    await fillIn(user, '90071992547409.93', 'Reversing a mistaken credit');
    await review(user);

    expect(
      await screen.findByRole('button', { name: 'Debit 90,071,992,547,409.93 NSP' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Debit 90,071,992,547,409.93 NSP' }));

    await vi.waitFor(() => {
      expect(sent).toHaveLength(1);
    });

    const body = JSON.parse(sent[0] ?? '{}') as { amountMinor: unknown; reason: unknown };
    expect(body.amountMinor).toBe('9007199254740993');
    expect(body.reason).toBe('Reversing a mistaken credit');
    // The proof it never touched a double: Number() cannot even hold what was sent.
    expect(String(Number(body.amountMinor))).toBe('9007199254740992');
  });

  it('surfaces the error and offers another go when the server refused before Ichancy', async () => {
    captureDebit(failResponse(400, 'VALIDATION_FAILED', 'The request payload is invalid.'));
    const { user, onDebited } = renderDialog();

    await fillIn(user, '1500.00', 'Chargeback');
    await review(user);
    await user.click(screen.getByRole('button', { name: 'Debit 1,500.00 NSP' }));

    const alert = await screen.findByText('The debit did not go through');
    expect(
      within(alert.closest('[role="status"]') ?? alert).getByText(
        'The request payload is invalid.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Nothing was taken. Fix what the message says and send it again.'),
    ).toBeInTheDocument();
    // A 400 never reached Ichancy, so trying again is safe and the button is still there.
    expect(screen.getByRole('button', { name: 'Debit 1,500.00 NSP' })).toBeInTheDocument();
    expect(onDebited).not.toHaveBeenCalled();
  });

  it('refuses to offer another go when the failure might already have taken the money', async () => {
    captureDebit(failResponse(500, 'INTERNAL_ERROR', 'The debit service is unavailable.'));
    const { user, onUnproven, onDebited } = renderDialog();

    await fillIn(user, '1500.00', 'Chargeback');
    await review(user);
    await user.click(screen.getByRole('button', { name: 'Debit 1,500.00 NSP' }));

    expect(await screen.findByText('This may already have gone through')).toBeInTheDocument();
    expect(
      screen.getByText(/Read the balance in Ichancy before anybody sends this again/),
    ).toBeInTheDocument();
    // The one thing this screen must not do after an unproven failure.
    expect(screen.queryByRole('button', { name: /^Debit / })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop here' })).toBeInTheDocument();
    // And it is handed up, so closing this dialog cannot make the warning disappear.
    expect(onUnproven).toHaveBeenCalledTimes(1);
    expect(onDebited).not.toHaveBeenCalled();
  });

  it('says there is nothing to debit when the player has no Ichancy account', async () => {
    const { user, onOpenChange } = renderDialog(unlinked);

    expect(screen.getByText('This player has no Ichancy account')).toBeInTheDocument();
    expect(screen.queryByLabelText('Amount to take out (NSP)')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('reports Ichancy refusing the debit as an answer, not as a broken request', async () => {
    const { user, onDebited } = renderDialog();

    // Straight at the mock backend: the balance fixture is 3,200.00, so this is more than there is.
    await fillIn(user, '9999.00', 'Chargeback');
    await review(user);
    await user.click(screen.getByRole('button', { name: 'Debit 9,999.00 NSP' }));

    await vi.waitFor(() => {
      expect(onDebited).toHaveBeenCalledTimes(1);
    });
    expect(onDebited.mock.calls[0]?.[0]).toMatchObject({
      status: 'REJECTED',
      // Nothing moved, and nothing verified it.
      playerBalanceBeforeMinor: '320000',
      playerBalanceAfterMinor: '320000',
      verifiedBy: null,
    });
  });
});
