import { beforeEach, describe, expect, it } from 'vitest';

import { configureApiClient } from '@/lib/api/client';
import { walletBalancesApi } from '@/lib/api/endpoints';
import { isApiError } from '@/lib/api/errors';
import { db, resetMockDb } from '@/mocks/db';
import { DESTINATION_IDS, METHOD_IDS } from '@/mocks/fixtures';
import { UNREADABLE_WALLET_ADDRESS } from '@/mocks/wallet-balance';

/**
 * The mock chain read, driven through the real client.
 *
 * ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────────────────────────
 * The component tests stub this endpoint; demo mode and the Playwright suite do not. So in two of
 * the three places this console runs, the mock IS the backend — and a mock that can only succeed
 * would quietly make the unavailable state unreachable everywhere except in a unit test. The state
 * would then be the one nobody ever looks at, which is precisely the state a wallet is in on the
 * day it matters.
 *
 * So the thing being asserted here is that the mock can FAIL to read, in both of the ways a real
 * one does: a placeholder account that was never a wallet, and a real wallet whose chain node did
 * not answer.
 */

const asRole = (role: string) => {
  configureApiClient({ getToken: () => `mock:${role}:token` });
};

let seq = 0;

/**
 * A crypto rail with the account of the caller's choosing, and the id it is asked about.
 *
 * The CODE is the caller's to choose and is deliberately not a parameter any more: this helper used
 * to set it, and the tests that passed `USDT_BEP20` were asserting a network the code had named
 * rather than one the address carried. What makes this rail answerable is `rail: 'CRYPTO'`, which
 * `METHOD_IDS.retired` already is under a code — `OLD_CRYPTO` — that no table has ever heard of.
 *
 * The row is pushed with an id of its own rather than through `createDestination`, because the mock
 * db's id generator restarts at 1 on every reset and would hand back one the fixtures already use —
 * the lookup would then find the seeded bank account instead of this wallet.
 */
const chainDestination = (address: string): string => {
  const method = db.methods.find((row) => row.id === METHOD_IDS.retired);
  if (method === undefined) throw new Error('the CRYPTO fixture method has gone');
  if (method.rail !== 'CRYPTO') throw new Error('the fixture method is no longer a crypto rail');

  seq += 1;
  const id = `dddddddd-0000-4000-8000-${String(900 + seq).padStart(12, '0')}`;
  db.destinations.push({
    id,
    paymentMethodId: METHOD_IDS.retired,
    label: 'Payout wallet',
    accountIdentifier: address,
    accountHolder: null,
    notes: null,
    isActive: true,
    priority: 1,
    dailyCap: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  });
  return id;
};

describe('reading a payout wallet', () => {
  beforeEach(() => {
    resetMockDb();
    asRole('FINANCE_ADMIN');
  });

  it('answers what the wallet holds, in minor units and as a decimal', async () => {
    const id = chainDestination('TQooWa8Uhs7BgnMhcgVYNzUuLbBHwe4vC5');

    const balance = await walletBalancesApi.read(id);

    expect(balance.network).toBe('TRC20');
    expect(balance.scale).toBe(6);
    expect(balance.balanceMinor).toMatch(/^\d+$/);
    // Both forms of the same number, and they have to agree: a screen reconciling them would be a
    // second place for the scale to be wrong. Six decimals, and the same digits either side.
    expect(balance.balance).toMatch(/^\d+\.\d{6}$/);
    expect(balance.balance?.replace('.', '')).toBe(balance.balanceMinor);
    expect(balance.problem).toBeNull();
  });

  it('reads the same figure twice, so a demo does not invent a new balance per reload', async () => {
    const id = chainDestination('TQooWa8Uhs7BgnMhcgVYNzUuLbBHwe4vC5');

    const first = await walletBalancesApi.read(id);
    const second = await walletBalancesApi.read(id);

    expect(second.balanceMinor).toBe(first.balanceMinor);
  });

  it('reads a BEP20 wallet as BEP20', async () => {
    const id = chainDestination('0x55d398326f99059fF775485246999027B3197955');

    const balance = await walletBalancesApi.read(id);

    expect(balance.network).toBe('BEP20');
    expect(balance.balanceMinor).toMatch(/^\d+$/);
  });

  /**
   * The house rule, asserted against the mock rather than only against the console.
   *
   * Both addresses below sit on ONE method, whose code is `OLD_CRYPTO` and names no chain — which is
   * the ordinary case, not an edge one: an operator calls their rail whatever they like, and the
   * first real one was called `USDT`. A destination is verified against the chain of its OWN
   * address, so a TRC20 and a BEP20 account can share a method and each still read correctly.
   */
  it('reads each account on the chain its own address names, whatever the method is called', async () => {
    const tron = chainDestination('TQooWa8Uhs7BgnMhcgVYNzUuLbBHwe4vC5');
    const bsc = chainDestination('0x55d398326f99059fF775485246999027B3197955');

    await expect(walletBalancesApi.read(tron)).resolves.toMatchObject({ network: 'TRC20' });
    await expect(walletBalancesApi.read(bsc)).resolves.toMatchObject({ network: 'BEP20' });
  });

  /**
   * The regression pin for the last code-keyed lookup in this console.
   *
   * This handler used to consult a `USDT_TRC20`/`USDT_BEP20` table BEFORE the address, so a method
   * carrying one of those two names overrode what the operator had actually pasted — a TRON address
   * on a rail named `USDT_BEP20` was reported as an unreadable BEP20 wallet. The real server cannot
   * do that: `DestinationBalanceService.read()` is handed an address and is never told the method.
   *
   * It survived because it was inert for exactly the rails a real operator creates, which is the
   * same shape as the bug that left the whole chain-check answering "skipped" for months.
   */
  it('ignores a method code that names a chain, and answers on the address instead', async () => {
    const method = db.methods.find((row) => row.id === METHOD_IDS.retired);
    if (method === undefined) throw new Error('the CRYPTO fixture method has gone');
    method.code = 'USDT_BEP20';

    const balance = await walletBalancesApi.read(
      chainDestination('TQooWa8Uhs7BgnMhcgVYNzUuLbBHwe4vC5'),
    );

    expect(balance.network).toBe('TRC20');
    expect(balance.balanceMinor).toMatch(/^\d+$/);
  });
});

describe('a wallet the chain could not be asked about', () => {
  beforeEach(() => {
    resetMockDb();
    asRole('FINANCE_ADMIN');
  });

  it('answers 200 with no balance, not a zero and not an error', async () => {
    // The distinction the whole feature rests on. A 5xx would be wrong too: the request was fine,
    // it is the answer that is missing, and a screen has to be able to say that.
    const id = chainDestination(UNREADABLE_WALLET_ADDRESS);

    const balance = await walletBalancesApi.read(id);

    expect(balance.balanceMinor).toBeNull();
    expect(balance.balance).toBeNull();
    expect(balance.problem).toBe('CHAIN_NODE_UNAVAILABLE');
    expect(balance.detail).toMatch(/unknown/i);
  });

  it('says a placeholder account has nothing on chain to read', async () => {
    // What every freshly provisioned operator's USDT rail looks like until somebody pastes a real
    // address — and the sentence has to name the consequence, because a player has been sending
    // money to that string.
    const id = chainDestination('SEED-PLACEHOLDER-USDT-TRC20-0000');

    const balance = await walletBalancesApi.read(id);

    expect(balance.balanceMinor).toBeNull();
    expect(balance.problem).toBe('ADDRESS_NOT_A_WALLET');
    expect(balance.detail).toMatch(/gone nowhere/i);
    // No network either, because none was detected and none may be invented. The server answers the
    // same way, and a schema that demanded one here would reject the response every freshly
    // provisioned rail produces.
    expect(balance.network).toBeNull();
  });
});

describe('destinations that have no chain', () => {
  beforeEach(() => {
    resetMockDb();
    asRole('FINANCE_ADMIN');
  });

  it('refuses a bank account rather than inventing a network for it', async () => {
    const error = await walletBalancesApi
      .read(DESTINATION_IDS.bankPrimary)
      .catch((caught: unknown) => caught);

    expect(isApiError(error) && error.status).toBe(409);
    expect(isApiError(error) && error.code).toBe('DESTINATION_NOT_ON_CHAIN');
  });

  it('answers 404 for a destination that does not exist', async () => {
    const error = await walletBalancesApi.read('nope').catch((caught: unknown) => caught);

    expect(isApiError(error) && error.status).toBe(404);
  });
});

describe('who may ask', () => {
  beforeEach(() => {
    resetMockDb();
  });

  it('refuses a role that cannot read the payment configuration', async () => {
    // Mirrors the backend boundary: the rails are readable by everyone who can see them, and a
    // VIEWER cannot. A mock that answered anyway would let a screen ship a request the real server
    // refuses.
    asRole('VIEWER');
    const destination = db.destinations[0];

    const error = await walletBalancesApi
      .read(destination?.id ?? '')
      .catch((caught: unknown) => caught);

    expect(isApiError(error) && error.status).toBe(403);
  });
});
