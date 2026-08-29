import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { PLAYER_IDS, mockPlayers } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';
import type { AdminPlayer } from '@/types/player';

import { CreditPlayerDialog } from './credit-player-dialog';

/**
 * Giving a player points, recorded as a manual deposit.
 *
 * What is defended here mirrors the debit: nothing is recorded until the figure is read back on a
 * second screen, the figure on the wire is the one typed — minor units, a string, never a JavaScript
 * number — and a failure the console cannot prove one way or the other (a 5xx) does NOT offer to
 * send it again. What differs is that the good ending is "queued", not "done": the credit lands via
 * the deposit spine a moment later, and a large one is routed to a second approver.
 */

const CREDIT_PATH = `${config.apiBaseUrl}/v1/admin/deposits/manual`;

const playerFixture = (id: string): AdminPlayer => {
  const player = mockPlayers.find((row) => row.id === id);
  if (player === undefined) throw new Error(`no player fixture ${id}`);
  return structuredClone(player);
};

const linked = playerFixture(PLAYER_IDS.linkedActive);

const meta = () => ({ correlationId: 'test-credit', timestamp: new Date().toISOString() });

const creditBody = (overrides: Record<string, unknown> = {}) => ({
  shortId: 'MC000001',
  status: 'APPROVED',
  amount: { minor: '2500000', amount: '25000.00', currency: 'NSP' },
  outcome: 'approved',
  ...overrides,
});

/** Installs the manual-deposit endpoint and records exactly what went over the wire. */
function captureCredit(respond: () => Response) {
  const sent: string[] = [];
  server.use(
    http.post(CREDIT_PATH, async ({ request }) => {
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
      { success: true, data: creditBody(overrides), error: null, meta: meta() },
      { status: 202 },
    );

const failResponse = (status: number, code: string, message: string) => () =>
  HttpResponse.json(
    { success: false, data: null, error: { code, message }, meta: meta() },
    { status },
  );

const renderDialog = (player: AdminPlayer = linked) => {
  const onCredited = vi.fn();
  const onOpenChange = vi.fn();
  const result = renderPlain(
    <CreditPlayerDialog player={player} open onOpenChange={onOpenChange} onCredited={onCredited} />,
  );
  return { ...result, onCredited, onOpenChange };
};

type User = ReturnType<typeof renderDialog>['user'];

const fillIn = async (user: User, amount: string, reason: string) => {
  await user.type(screen.getByLabelText('Amount to give (NSP)'), amount);
  await user.type(screen.getByLabelText('Reason'), reason);
};

const review = async (user: User) => {
  await user.click(screen.getByRole('button', { name: 'Review this credit' }));
};

describe('CreditPlayerDialog', () => {
  it('will not move to the confirmation without an amount and a reason', async () => {
    const { user } = renderDialog();

    await review(user);

    expect(screen.getByText('Enter the amount to give.')).toBeInTheDocument();
    expect(screen.getByText(/Give a reason\./)).toBeInTheDocument();
    expect(screen.queryByText(/Give this to/)).not.toBeInTheDocument();
  });

  it('refuses an amount that is not a plain decimal, rather than guessing at it', async () => {
    const { user } = renderDialog();

    await fillIn(user, '25,000', 'Paid at the office');
    await review(user);

    expect(
      screen.getByText('Digits and at most two decimals — 25000.00, not 25,000 or 2.5e4.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Give this to/)).not.toBeInTheDocument();
  });

  it('refuses a credit of nothing', async () => {
    const { user } = renderDialog();

    await fillIn(user, '0.00', 'Paid at the office');
    await review(user);

    expect(screen.getByText('The amount has to be more than zero.')).toBeInTheDocument();
  });

  it('records nothing until the confirmation is pressed, and queues it on confirm', async () => {
    const sent = captureCredit(okResponse());
    const { user, onCredited } = renderDialog();

    await fillIn(user, '25000.00', 'Paid at the office in cash');
    await review(user);

    expect(await screen.findByText('Give this to Karim Nasser?')).toBeInTheDocument();
    expect(screen.getByText('Giving')).toBeInTheDocument();
    expect(screen.getByTestId('money')).toHaveTextContent('25,000.00 NSP');
    expect(screen.getByText('Paid at the office in cash')).toBeInTheDocument();
    // Reading it back is not doing it.
    expect(sent).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Credit 25,000.00 NSP' }));

    await vi.waitFor(() => {
      expect(onCredited).toHaveBeenCalledTimes(1);
    });
    expect(sent).toHaveLength(1);
    expect(onCredited.mock.calls[0]?.[0]).toMatchObject({ status: 'APPROVED' });
  });

  it('sends playerId and minor units as a string, never through a JavaScript number', async () => {
    const sent = captureCredit(okResponse({ amount: { minor: '9007199254740993', amount: '90071992547409.93', currency: 'NSP' } }));
    const { user } = renderDialog();

    // Two minor units past Number.MAX_SAFE_INTEGER: a double cannot hold this figure exactly.
    await fillIn(user, '90071992547409.93', 'Reconciling the office float');
    await review(user);

    await user.click(
      await screen.findByRole('button', { name: 'Credit 90,071,992,547,409.93 NSP' }),
    );

    await vi.waitFor(() => {
      expect(sent).toHaveLength(1);
    });

    const body = JSON.parse(sent[0] ?? '{}') as {
      playerId: unknown;
      amountMinor: unknown;
      reason: unknown;
    };
    expect(body.playerId).toBe(linked.id);
    expect(body.amountMinor).toBe('9007199254740993');
    expect(body.reason).toBe('Reconciling the office float');
    // The proof it never touched a double: Number() cannot even hold what was sent.
    expect(String(Number(body.amountMinor))).toBe('9007199254740992');
  });

  it('shows a large credit being routed to a second approver as its own message', async () => {
    captureCredit(okResponse({ status: 'PENDING_SECOND_APPROVAL', outcome: 'awaiting_second_approval' }));
    const { user, onCredited } = renderDialog();

    await fillIn(user, '25000.00', 'A big office payment');
    await review(user);
    await user.click(screen.getByRole('button', { name: 'Credit 25,000.00 NSP' }));

    await vi.waitFor(() => {
      expect(onCredited).toHaveBeenCalledTimes(1);
    });
    expect(onCredited.mock.calls[0]?.[0]).toMatchObject({ status: 'PENDING_SECOND_APPROVAL' });
  });

  it('surfaces the error and offers another go when the server refused before recording it', async () => {
    captureCredit(failResponse(422, 'AMOUNT_BELOW_MINIMUM', 'A credit must be at least 25000.00 NSP.'));
    const { user, onCredited } = renderDialog();

    await fillIn(user, '100.00', 'Too small');
    await review(user);
    await user.click(screen.getByRole('button', { name: 'Credit 100.00 NSP' }));

    const alert = await screen.findByText('The credit did not go through');
    expect(
      within(alert.closest('[role="status"]') ?? alert).getByText(
        'A credit must be at least 25000.00 NSP.',
      ),
    ).toBeInTheDocument();
    // A 4xx recorded nothing, so trying again is safe and the button is still there.
    expect(screen.getByRole('button', { name: 'Credit 100.00 NSP' })).toBeInTheDocument();
    expect(onCredited).not.toHaveBeenCalled();
  });

  it('refuses to offer another go when the failure might already have been queued', async () => {
    captureCredit(failResponse(500, 'INTERNAL_ERROR', 'The deposit service is unavailable.'));
    const { user, onCredited } = renderDialog();

    await fillIn(user, '25000.00', 'Paid at the office');
    await review(user);
    await user.click(screen.getByRole('button', { name: 'Credit 25,000.00 NSP' }));

    expect(await screen.findByText('This may already have been queued')).toBeInTheDocument();
    // The one thing this screen must not do after an unproven failure.
    expect(screen.queryByRole('button', { name: /^Credit / })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop here' })).toBeInTheDocument();
    expect(onCredited).not.toHaveBeenCalled();
  });
});
