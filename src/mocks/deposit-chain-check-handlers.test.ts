import { beforeEach, describe, expect, it } from 'vitest';

import { configureApiClient } from '@/lib/api/client';
import { depositChainChecksApi } from '@/lib/api/endpoints';
import { isApiError } from '@/lib/api/errors';
import { db, resetMockDb } from '@/mocks/db';
import { MOCK_TX_HASHES } from '@/mocks/deposit-chain-check';
import { DEPOSIT_IDS, METHOD_IDS } from '@/mocks/fixtures';
import { minorFromString } from '@/lib/money';

/**
 * The mock chain verdict, driven through the real client.
 *
 * ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────────────────────────
 * Component tests stub this endpoint; demo mode and the Playwright suite do not. In two of the
 * three places this console runs, the mock IS the backend — so a mock that could only answer
 * `verified` would make five of the seven outcomes unreachable outside a unit test, and the two
 * that matter most would be the two nobody ever sees.
 *
 * What is asserted here is therefore that the mock can answer BADLY: short (`mismatch`), stolen
 * (`suspect`), and silent (`unavailable`) — and that the last of those is structurally distinct
 * from the refusals rather than a flavour of them.
 */

const TRON_WALLET = 'TQooWa8Uhs7BgnMhcgVYNzUuLbBHwe4vC5';
const BSC_WALLET = '0x55d398326f99059fF775485246999027B3197955';

/** 13,200 NSP per USDT — the rate this operator actually runs. */
const RATE_MINOR = 13_200_00n;

const asRole = (role: string) => {
  configureApiClient({ getToken: () => `mock:${role}:token` });
};

const setRate = (rateMinor: bigint | null) => {
  db.usdtRate =
    rateMinor === null
      ? null
      : {
          quoteAsset: 'USDT',
          currencyCode: 'NSP',
          rateMinor,
          source: 'MANUAL',
          sourceNote: null,
          setByAdminId: null,
          effectiveFrom: new Date().toISOString(),
        };
};

/**
 * Repoints a seeded deposit at a USDT rail paying into `address`, and gives it `txHash` as the
 * reference a player submitted.
 *
 * `claimedMinor` defaults to 1,320,000.00 NSP, which is exactly 100 USDT at the operator's rate —
 * so a shortfall reads as the round "99.5 arrived against 100 expected" a reviewer would recognise.
 */
const cryptoDeposit = (
  txHash: string | null,
  { address = TRON_WALLET, claimedMinor = 1_320_000_00n } = {},
): string => {
  const deposit = db.deposits.find((row) => row.id === DEPOSIT_IDS.awaitingReview);
  if (deposit === undefined) throw new Error('the awaitingReview fixture has gone');

  deposit.paymentMethodId = METHOD_IDS.usdtTrc20;
  deposit.externalReference = txHash;
  deposit.claimed = {
    minor: claimedMinor.toString(),
    amount: '1320000.00',
    currency: deposit.claimed.currency,
  };
  deposit.destination = {
    ...(deposit.destination ?? {
      methodName: 'USDT',
      instructions: null,
      requiresReference: true,
      label: 'Payout wallet',
      accountHolder: null,
    }),
    // Plain `USDT`, exactly as the live operator's rail is coded. The check must still work.
    methodCode: 'USDT',
    accountIdentifier: address,
  };
  return deposit.id;
};

describe('a deposit paid on a chain', () => {
  beforeEach(() => {
    resetMockDb();
    asRole('SUPER_ADMIN');
    setRate(RATE_MINOR);
  });

  it('reads the network off the ADDRESS, not off a rail code that says nothing', async () => {
    // The bug this pins cost months of silence: `networkFor()` keyed on `USDT_TRC20`/`USDT_BEP20`,
    // the operator's rail is coded plain `USDT`, so every real deposit answered "skipped" and no
    // deposit on that rail was ever checked. An address cannot lie about its chain; a name can.
    const tron = await depositChainChecksApi.read(cryptoDeposit(MOCK_TX_HASHES.verified));
    expect(tron.network).toBe('TRC20');
    expect(tron.outcome).toBe('verified');

    resetMockDb();
    setRate(RATE_MINOR);
    const bsc = await depositChainChecksApi.read(
      cryptoDeposit(MOCK_TX_HASHES.verified, { address: BSC_WALLET }),
    );
    expect(bsc.network).toBe('BEP20');
  });

  it('reports USDT at six decimals, and the creditable amount at the tenant scale', async () => {
    const verdict = await depositChainChecksApi.read(cryptoDeposit(MOCK_TX_HASHES.verified));

    // 1,320,000.00 NSP at 13,200.00 per USDT is exactly 100 USDT — 100_000000 in µUSDT.
    expect(verdict.arrived).toMatchObject({ asset: 'USDT', scale: 6, minor: '100000000' });
    expect(verdict.arrived?.amount).toBe('100.000000');
    // The two shapes must never be confused: the creditable figure is NSP at scale 2.
    expect(verdict.creditable).toMatchObject({ minor: '132000000', currency: 'NSP' });
  });

  it('answers mismatch with BOTH numbers: what arrived, and what it is worth', async () => {
    // The whole reason a human is asked. Half a dollar short of 100 USDT, priced back at the rate.
    const verdict = await depositChainChecksApi.read(cryptoDeposit(MOCK_TX_HASHES.mismatch));

    expect(verdict.outcome).toBe('mismatch');
    expect(verdict.arrived?.amount).toBe('99.500000');
    expect(verdict.creditable?.amount).toBe('1313400.00');
    // Less than was claimed — a "creditable" amount above the claim would be the bug that pays out
    // money nobody sent.
    expect(minorFromString(verdict.creditable?.minor ?? '0')).toBeLessThan(132_000_000n);
  });

  it('offers nothing to credit on a suspect transfer, however real it looks', async () => {
    // Confirmed, full amount, from a known sender — and it paid somebody else's wallet. A figure
    // beside it would read as permission, so there is none.
    const verdict = await depositChainChecksApi.read(cryptoDeposit(MOCK_TX_HASHES.suspect));

    expect(verdict.outcome).toBe('suspect');
    expect(verdict.confirmations).toBe(verdict.requiredConfirmations);
    expect(verdict.arrived).not.toBeNull();
    expect(verdict.creditable).toBeNull();
  });

  it('offers nothing to credit while a transfer is still shallow', async () => {
    const verdict = await depositChainChecksApi.read(cryptoDeposit(MOCK_TX_HASHES.pending));

    expect(verdict.outcome).toBe('pending');
    expect(verdict.confirmations).toBeLessThan(verdict.requiredConfirmations ?? 0);
    expect(verdict.creditable).toBeNull();
  });

  it('answers unavailable with no figures at all when the node did not reply', async () => {
    // The state that must not read as a rejection. It carries no arrived amount, no creditable
    // amount and no confirmation depth — there is nothing to mistake for a finding.
    const verdict = await depositChainChecksApi.read(cryptoDeposit(MOCK_TX_HASHES.unavailable));

    expect(verdict.outcome).toBe('unavailable');
    expect(verdict.arrived).toBeNull();
    expect(verdict.creditable).toBeNull();
    expect(verdict.confirmations).toBeNull();
    expect(verdict.summary).toMatch(/nothing here counts against this deposit/i);
  });

  it('answers missing when the chain looked and found no such transfer', async () => {
    const verdict = await depositChainChecksApi.read(cryptoDeposit(MOCK_TX_HASHES.missing));

    expect(verdict.outcome).toBe('missing');
    expect(verdict.arrived).toBeNull();
  });

  it('answers missing when the player submitted no hash to look up', async () => {
    const verdict = await depositChainChecksApi.read(cryptoDeposit(null));

    expect(verdict.outcome).toBe('missing');
    expect(verdict.txHash).toBeNull();
  });

  it('treats an unset rate as OUR gap, not as a verdict on the transfer', async () => {
    // Without a rate nothing on chain can be priced — and that is a fact about this console's
    // configuration. Reporting it as `missing` would say the chain looked and found nothing, which
    // is a statement about the player made because of a blank field on our own screen.
    setRate(null);

    const verdict = await depositChainChecksApi.read(cryptoDeposit(MOCK_TX_HASHES.mismatch));

    expect(verdict.outcome).toBe('unavailable');
    expect(verdict.creditable).toBeNull();
  });
});

describe('a deposit with no chain behind it', () => {
  beforeEach(() => {
    resetMockDb();
    asRole('SUPER_ADMIN');
    setRate(RATE_MINOR);
  });

  it('is skipped rather than refused — a bank transfer has nothing to read', async () => {
    const verdict = await depositChainChecksApi.read(DEPOSIT_IDS.awaitingReview);

    expect(verdict.outcome).toBe('skipped');
    expect(verdict.network).toBeNull();
    expect(verdict.creditable).toBeNull();
  });

  it('is skipped when the rail is CRYPTO but the account is a placeholder, not a wallet', async () => {
    // What every freshly provisioned operator's USDT rail looks like until somebody pastes an
    // address. There is no chain to ask, and inventing one would be worse than saying so.
    const id = cryptoDeposit(MOCK_TX_HASHES.verified, {
      address: 'SEED-PLACEHOLDER-USDT-TRC20-0000',
    });

    await expect(depositChainChecksApi.read(id)).resolves.toMatchObject({ outcome: 'skipped' });
  });

  it('answers 404 for a deposit that does not exist', async () => {
    const error = await depositChainChecksApi.read('nope').catch((caught: unknown) => caught);

    expect(isApiError(error) && error.status).toBe(404);
  });
});
