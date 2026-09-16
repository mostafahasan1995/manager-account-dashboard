import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { config } from '@/config';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';

import { WalletBalance } from './wallet-balance';

/**
 * Almost every case in this file is one rule looked at from a different angle: an amount this card
 * could not read must never appear as `0`.
 *
 * Zero is a real answer — the wallet is empty — and it is acted on. So a card that renders an
 * outage as "0.000000 USDT" tells an operator with money in that wallet that their money is gone.
 * That is why there are more tests here about the ABSENCE of a number than about the presence of
 * one, and why each of them asserts both halves: the right words are on screen, AND no figure is.
 */

const DESTINATION_ID = 'dddddddd-0000-4000-8000-000000000003';
const balanceUrl = `${config.apiBaseUrl}/v1/admin/payment-destinations/:id/balance`;

const envelope = (data: unknown) => ({
  success: true,
  data,
  error: null,
  meta: { correlationId: 'c', timestamp: '2026-08-26T10:00:00.000Z' },
});

const read = (overrides: Record<string, unknown> = {}) => ({
  network: 'TRC20',
  address: 'TQooWa8Uhs7BgnMhcgVYNzUuLbBHwe4vC5',
  asset: 'USDT',
  scale: 6,
  balanceMinor: '1234500000',
  balance: '1234.500000',
  checkedAt: new Date().toISOString(),
  problem: null,
  detail: null,
  ...overrides,
});

/** The shape the backend answers with when the chain did not tell it anything. */
const unreadable = (overrides: Record<string, unknown> = {}) =>
  read({
    balanceMinor: null,
    balance: null,
    problem: 'CHAIN_NODE_UNAVAILABLE',
    detail: 'The TRON node did not answer in time, so what this wallet holds is unknown.',
    ...overrides,
  });

const render = (body: unknown) => {
  server.use(http.get(balanceUrl, () => HttpResponse.json(envelope(body))));
  return renderPlain(<WalletBalance destinationId={DESTINATION_ID} />);
};

describe('a balance that read', () => {
  it('shows what the wallet holds, at the six decimals USDT actually carries', async () => {
    render(read());

    // Two decimals short would be wrong by a factor of ten thousand, which is why the scale comes
    // off the response rather than the money helper's default.
    expect(await screen.findByTestId('money')).toHaveTextContent('1,234.500000 USDT');
  });

  it('shows an empty wallet as zero, because an empty wallet is a real answer', async () => {
    // The other half of the rule the rest of this file guards. Zero has to stay sayable, or the
    // card would be honest by never being useful.
    render(read({ balanceMinor: '0', balance: '0.000000' }));

    expect(await screen.findByTestId('money')).toHaveTextContent('0.000000 USDT');
  });
});

describe('a balance that could not be read', () => {
  it('is never rendered as zero', async () => {
    const { container } = render(unreadable());

    expect(await screen.findByText(/could not be read/i)).toBeInTheDocument();
    // The assertion that matters: no figure at all, not a figure that happens to be right.
    expect(screen.queryByTestId('money')).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent('0.000000');
  });

  it('says in the operator’s own language that unknown is not empty', async () => {
    render(unreadable());

    // Our sentence, not the server's: the difference between "unknown" and "empty" is the decision
    // this card is here to protect, and it has to be readable in Arabic too.
    expect(await screen.findByText(/unknown is not zero/i)).toBeInTheDocument();
  });

  it('shows the server’s own sentence about what went wrong', async () => {
    render(unreadable());

    expect(await screen.findByText(/TRON node did not answer/i)).toBeInTheDocument();
    expect(screen.getByText('CHAIN_NODE_UNAVAILABLE')).toBeInTheDocument();
  });

  it('still explains itself when the server sent no sentence at all', async () => {
    render(unreadable({ problem: null, detail: null }));

    expect(await screen.findByText(/unknown is not zero/i)).toBeInTheDocument();
    expect(screen.queryByTestId('money')).not.toBeInTheDocument();
  });

  it('treats minor units it cannot parse as unknown rather than as nothing', async () => {
    // A response that claims a balance in something that is not an integer is a number nobody has.
    // Parsing it loosely — or falling back to zero — would put a figure on screen that no system
    // computed, which is the failure this whole card exists to prevent.
    const { container } = render(read({ balanceMinor: 'not-a-number' }));

    expect(await screen.findByText(/could not be read/i)).toBeInTheDocument();
    expect(screen.queryByTestId('money')).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent('0.000000');
  });
});

describe('a request that failed outright', () => {
  it('is shown as unknown, not as an empty wallet', async () => {
    server.use(
      http.get(balanceUrl, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'CHAIN_LOOKUP_FAILED', message: 'The chain explorer refused the read.' },
            meta: { correlationId: 'c', timestamp: '2026-08-26T10:00:00.000Z' },
          },
          { status: 503 },
        ),
      ),
    );

    const { container } = renderPlain(<WalletBalance destinationId={DESTINATION_ID} />);

    expect(await screen.findByText(/could not be read/i)).toBeInTheDocument();
    expect(screen.getByText(/chain explorer refused the read/i)).toBeInTheDocument();
    expect(screen.queryByTestId('money')).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent('0.000000');
  });
});

describe('checking again', () => {
  it('asks the chain again and shows the new answer', async () => {
    // The refresh is the whole polling policy: this query has no timer, because every answer costs
    // a call to a third-party explorer. If the button stopped refetching, the number on this card
    // would silently be however old the tab is.
    let calls = 0;
    server.use(
      http.get(balanceUrl, () => {
        calls += 1;
        return HttpResponse.json(
          envelope(read(calls === 1 ? {} : { balanceMinor: '7000000', balance: '7.000000' })),
        );
      }),
    );

    const { user } = renderPlain(<WalletBalance destinationId={DESTINATION_ID} />);
    expect(await screen.findByTestId('money')).toHaveTextContent('1,234.500000 USDT');

    await user.click(screen.getByRole('button', { name: /check again/i }));

    expect(await screen.findByText('7.000000 USDT')).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('recovers a balance that failed the first time, without a page reload', async () => {
    let calls = 0;
    server.use(
      http.get(balanceUrl, () => {
        calls += 1;
        return HttpResponse.json(envelope(calls === 1 ? unreadable() : read()));
      }),
    );

    const { user } = renderPlain(<WalletBalance destinationId={DESTINATION_ID} />);
    expect(await screen.findByText(/could not be read/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /check again/i }));

    expect(await screen.findByTestId('money')).toHaveTextContent('1,234.500000 USDT');
  });
});

describe('a role that cannot see payment rails', () => {
  it('is not shown the wallet, and does not spend a chain read finding out', () => {
    // No handler is registered, and the suite fails on an unhandled request — so this passing is
    // itself the assertion that nothing was fetched.
    renderPlain(<WalletBalance destinationId={DESTINATION_ID} />, { auth: { role: 'VIEWER' } });

    expect(screen.queryByTestId('wallet-balance')).not.toBeInTheDocument();
  });
});
