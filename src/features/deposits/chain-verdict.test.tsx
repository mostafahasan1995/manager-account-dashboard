import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { config } from '@/config';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';
import type { DepositChainCheck } from '@/types';

import { ChainVerdict } from './chain-verdict';

/**
 * The on-chain verdict, as a reviewer reads it.
 *
 * Every case here pins a sentence somebody could get wrong in a hurry and lose money by, in the two
 * directions the mistake runs: reading a real, confirmed transfer that paid somebody else as good
 * news, and reading OUR outage as evidence against a player.
 */

const DEPOSIT_ID = 'eeeeeeee-0000-4000-8000-000000000001';

const verdict = (overrides: Partial<DepositChainCheck> = {}): DepositChainCheck => ({
  outcome: 'verified',
  network: 'TRC20',
  summary: 'Confirmed on TRC20 for the full amount.',
  arrived: { asset: 'USDT', scale: 6, minor: '100000000', amount: '100.000000' },
  creditable: { minor: '132000000', amount: '1320000.00', currency: 'NSP' },
  txHash: 'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1',
  fromAddress: 'TKrsHFVLvQ2vX1t7iGbPtPHY4Yz9xB8dqA',
  confirmations: 19,
  requiredConfirmations: 19,
  checkedAt: new Date().toISOString(),
  ...overrides,
});

const serve = (body: DepositChainCheck) => {
  server.use(
    http.get(`${config.apiBaseUrl}/v1/admin/deposits/${DEPOSIT_ID}/chain-check`, () =>
      HttpResponse.json({
        success: true,
        data: body,
        error: null,
        meta: { correlationId: 'test', timestamp: new Date().toISOString() },
      }),
    ),
  );
};

const renderVerdict = () => renderPlain(<ChainVerdict depositId={DEPOSIT_ID} />);

/**
 * The panel once the verdict has landed.
 *
 * The section renders during the read too — a reviewer must see that a chain check is coming rather
 * than nothing at all — so waiting on the test id alone would assert against the loading state.
 */
const settledPanel = async (marker: string | RegExp): Promise<HTMLElement> => {
  await screen.findByText(marker);
  return screen.getByTestId('chain-verdict');
};

describe('a deposit whose chain transfer came up short', () => {
  it('shows what arrived AND what it is worth, so nobody prices it by hand', async () => {
    // The reason this screen exists: the verdict used to reach only the Telegram card, and an admin
    // in the console had to take the rate and a calculator to the shortfall themselves.
    serve(
      verdict({
        outcome: 'mismatch',
        summary: 'Less arrived than was claimed: 99.500000 USDT against 100.000000 USDT expected.',
        arrived: { asset: 'USDT', scale: 6, minor: '99500000', amount: '99.500000' },
        creditable: { minor: '131340000', amount: '1313400.00', currency: 'NSP' },
      }),
    );

    renderVerdict();

    const panel = await settledPanel('Less arrived than the player claimed');
    expect(within(panel).getByText('Less arrived than the player claimed')).toBeInTheDocument();
    expect(within(panel).getByText('99.500000 USDT')).toBeInTheDocument();
    expect(within(panel).getByText('1,313,400.00 NSP')).toBeInTheDocument();
  });

  it('renders the arrived USDT at six decimals, not at the money default of two', async () => {
    // `99500000` at the default scale reads `995,000.00` — ten thousand times the truth, in the one
    // number the reviewer is deciding on. The scale travels with the response for exactly this.
    serve(
      verdict({
        outcome: 'mismatch',
        arrived: { asset: 'USDT', scale: 6, minor: '99500000', amount: '99.500000' },
      }),
    );

    renderVerdict();

    const panel = await settledPanel('99.500000 USDT');
    expect(within(panel).getByText('99.500000 USDT')).toBeInTheDocument();
    expect(within(panel).queryByText(/995,000\.00/)).toBeNull();
  });
});

describe('a transfer that is real, confirmed, and paid somebody else', () => {
  it('reads as a stop rather than as one more warning', async () => {
    // Everything a reviewer normally checks is present on a suspect transfer, which is precisely
    // what makes it convincing. If it looked like the other cautions it would be approved past.
    serve(
      verdict({
        outcome: 'suspect',
        summary: 'This transfer paid TWd4WrZ9wn84f5x1hZhL6ZKUZbHjPGuMdc, not a wallet of yours.',
        creditable: null,
      }),
    );

    renderVerdict();

    const panel = await settledPanel('Stop — this transfer did not pay you');
    expect(within(panel).getByText('Stop — this transfer did not pay you')).toBeInTheDocument();
    expect(within(panel).getByText(/Reject it/)).toBeInTheDocument();
    // The wallet it actually paid, in the server's own words: the specific that makes it checkable.
    expect(within(panel).getByText(/TWd4WrZ9wn84f5x1hZhL6ZKUZbHjPGuMdc/)).toBeInTheDocument();
  });

  it('offers no amount to credit, because a figure there would read as permission', async () => {
    serve(verdict({ outcome: 'suspect', creditable: null }));

    renderVerdict();

    const panel = await settledPanel('Stop — this transfer did not pay you');
    expect(within(panel).queryByText('Worth crediting')).toBeNull();
  });
});

describe('a chain this console could not read', () => {
  it('does not read as a rejection — it is our outage and says nothing about the deposit', async () => {
    serve(
      verdict({
        outcome: 'unavailable',
        summary: 'The TRC20 node did not answer in time.',
        arrived: null,
        creditable: null,
        confirmations: null,
        requiredConfirmations: null,
      }),
    );

    renderVerdict();

    const panel = await settledPanel('We could not read the chain');
    expect(within(panel).getByText('We could not read the chain')).toBeInTheDocument();
    expect(within(panel).getByText(/This is our outage, not a verdict/)).toBeInTheDocument();
    expect(within(panel).getByText(/Nothing here counts against the player/)).toBeInTheDocument();
    // No language from the refusals may leak in here.
    expect(within(panel).queryByText(/Stop —/)).toBeNull();
    expect(within(panel).queryByText(/Nothing on the chain matches this/)).toBeNull();
  });

  it('says the same thing when the request itself failed, not only when the node did', async () => {
    // A 500 from our own API is our outage too. There is deliberately no path from "we failed to
    // ask" to anything that reads as a finding against the player.
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/deposits/${DEPOSIT_ID}/chain-check`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'UPSTREAM_UNAVAILABLE', message: 'nope' },
            meta: { correlationId: 'test', timestamp: new Date().toISOString() },
          },
          { status: 502 },
        ),
      ),
    );

    renderVerdict();

    expect(await screen.findByText('We could not read the chain')).toBeInTheDocument();
  });
});

describe('a deposit with no chain behind it', () => {
  it('renders nothing at all, so the section is not noise on every bank transfer', async () => {
    // Most deposits are cash and bank transfers. A panel saying "not applicable" on all of them is
    // how a reviewer learns to skip past the one deposit where it matters.
    serve(
      verdict({
        outcome: 'skipped',
        network: null,
        arrived: null,
        creditable: null,
        txHash: null,
        fromAddress: null,
        confirmations: null,
        requiredConfirmations: null,
      }),
    );

    const { queryClient } = renderVerdict();

    await expect
      .poll(() => queryClient.isFetching() === 0 && queryClient.getQueryCache().getAll().length > 0)
      .toBe(true);
    expect(screen.queryByTestId('chain-verdict')).toBeNull();
  });
});

describe('a transfer that has not confirmed yet', () => {
  it('names the depth reached and the depth needed rather than only saying "pending"', async () => {
    serve(
      verdict({
        outcome: 'pending',
        confirmations: 3,
        requiredConfirmations: 19,
        creditable: null,
      }),
    );

    renderVerdict();

    const panel = await settledPanel('Found, but not confirmed yet');
    expect(within(panel).getByText('Found, but not confirmed yet')).toBeInTheDocument();
    expect(within(panel).getByText('3 of 19')).toBeInTheDocument();
  });
});

describe('an arrived amount this console cannot parse', () => {
  it('shows no figure at all rather than a zero or the server’s own string', async () => {
    // Minor units that will not parse are not zero — they are a number nobody has. The same rule
    // the wallet balance card lives by: one number on screen, from one source, or none.
    serve(
      verdict({
        outcome: 'mismatch',
        arrived: { asset: 'USDT', scale: 6, minor: 'not-a-number', amount: '99.500000' },
      }),
    );

    renderVerdict();

    const panel = await settledPanel('Less arrived than the player claimed');
    expect(within(panel).queryByText('Arrived on chain')).toBeNull();
    expect(within(panel).queryByText(/99\.500000/)).toBeNull();
  });
});
