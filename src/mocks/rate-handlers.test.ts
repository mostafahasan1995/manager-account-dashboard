import { beforeEach, describe, expect, it } from 'vitest';

import { exchangeRatesApi } from '@/lib/api/endpoints';
import { configureApiClient } from '@/lib/api/client';
import { isApiError } from '@/lib/api/errors';
import { resetMockDb } from '@/mocks/db';

/**
 * The mock rate routes, driven through the real client.
 *
 * ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────────────────────────
 * The console's component tests stub the API, and demo mode and the Playwright suite do not. So the
 * mock is the only thing standing behind the rate form in two of the three places it runs, and
 * nothing was exercising it: an earlier version of this handler carried a regex that had lost its
 * escapes — `/^d{1,12}.../` rather than `/^\d{1,12}.../` — which rejected EVERY rate, including
 * correct ones, because it required a literal leading "d". Demo mode would have looked broken in a
 * way the real API is not, and no test said a word.
 *
 * ── WHY IT ASSERTS THE REFUSALS ═══════════════════════════════════════════════════════════════
 * A mock that only implements the happy path lets a console ship a form whose guards were never
 * run. The guards ARE the feature here — the 20% jump refusal is what catches the redenomination
 * mistake — so the mock has to be able to produce them, and this is what proves it can.
 */

/** The mock authorises from the bearer token, exactly as the real backend authorises from a role. */
const asRole = (role: string) => {
  configureApiClient({ getToken: () => `mock:${role}:token` });
};

describe('reading the rate', () => {
  beforeEach(() => {
    resetMockDb();
  });

  it('answers null before anybody has set one, which is where every operator starts', async () => {
    asRole('FINANCE_ADMIN');

    await expect(exchangeRatesApi.getUsdt()).resolves.toBeNull();
  });

  it('refuses a role that cannot read the payment configuration', async () => {
    asRole('VIEWER');

    const error = await exchangeRatesApi.getUsdt().catch((caught: unknown) => caught);
    expect(isApiError(error) && error.status).toBe(403);
  });
});

describe('setting the rate', () => {
  beforeEach(() => {
    resetMockDb();
  });

  it('accepts a plain decimal and answers with both forms of it', async () => {
    // The case the mangled regex used to reject. A rate that cannot be saved in demo mode is a
    // demo of a broken feature.
    asRole('FINANCE_ADMIN');

    const saved = await exchangeRatesApi.setUsdt({ rate: '13200.00' });

    expect(saved).toMatchObject({
      rate: '13200.00',
      rateMinor: '1320000',
      quoteAsset: 'USDT',
      isStale: false,
    });
  });

  it('accepts a whole number without a decimal point', async () => {
    asRole('FINANCE_ADMIN');

    await expect(exchangeRatesApi.setUsdt({ rate: '13200' })).resolves.toMatchObject({
      rateMinor: '1320000',
    });
  });

  it('keeps where the operator read it', async () => {
    asRole('FINANCE_ADMIN');

    await expect(
      exchangeRatesApi.setUsdt({ rate: '13200.00', sourceNote: 'sp-today.com' }),
    ).resolves.toMatchObject({ sourceNote: 'sp-today.com', source: 'MANUAL' });
  });

  it('refuses something that is not a decimal amount', async () => {
    asRole('FINANCE_ADMIN');

    const error = await exchangeRatesApi
      .setUsdt({ rate: 'thirteen thousand' })
      .catch((caught: unknown) => caught);

    expect(isApiError(error) && error.status).toBe(400);
    expect(isApiError(error) && error.code).toBe('VALIDATION_FAILED');
  });

  it('refuses more decimals than the currency has', async () => {
    // The DTO and the parser used to disagree about this: six accepted by validation, two by
    // arithmetic. A rate the API accepts and then cannot store is the worst of both.
    asRole('FINANCE_ADMIN');

    const error = await exchangeRatesApi.setUsdt({ rate: '13200.005' }).catch((c: unknown) => c);

    expect(isApiError(error) && error.status).toBe(400);
  });

  it('refuses a rate of zero', async () => {
    asRole('FINANCE_ADMIN');

    const error = await exchangeRatesApi.setUsdt({ rate: '0' }).catch((caught: unknown) => caught);

    expect(isApiError(error) && error.status).toBe(400);
  });

  it('refuses a role that cannot write the payment configuration', async () => {
    // PLATFORM_ADMIN reads and does not write — the same boundary a payout account follows.
    asRole('PLATFORM_ADMIN');

    const error = await exchangeRatesApi
      .setUsdt({ rate: '13200.00' })
      .catch((caught: unknown) => caught);

    expect(isApiError(error) && error.status).toBe(403);
  });
});

describe('the jump guard, in the mock', () => {
  beforeEach(async () => {
    resetMockDb();
    asRole('FINANCE_ADMIN');
    await exchangeRatesApi.setUsdt({ rate: '13200.00' });
  });

  it('refuses the 100x denomination mistake', async () => {
    // 13,200 to 132. The exact confusion the Syrian redenomination makes available.
    const error = await exchangeRatesApi.setUsdt({ rate: '132.00' }).catch((c: unknown) => c);

    expect(isApiError(error) && error.status).toBe(422);
    expect(isApiError(error) && error.code).toBe('RATE_IMPLAUSIBLE_JUMP');
  });

  it('says how far away it was, so the message can name both numbers', async () => {
    const error = await exchangeRatesApi.setUsdt({ rate: '132.00' }).catch((c: unknown) => c);

    expect(isApiError(error) && (error.details as { movedPercent: number }).movedPercent).toBe(99);
  });

  it('allows a move a currency genuinely makes', async () => {
    await expect(exchangeRatesApi.setUsdt({ rate: '15180.00' })).resolves.toMatchObject({
      rateMinor: '1518000',
    });
  });

  it('lets a large move through when it is confirmed deliberately', async () => {
    // A real devaluation must not lock an operator out of their own rail.
    await expect(
      exchangeRatesApi.setUsdt({ rate: '26400.00', confirmLargeChange: true }),
    ).resolves.toMatchObject({ rateMinor: '2640000' });
  });

  it('replaces the rate rather than accumulating two of them', async () => {
    await exchangeRatesApi.setUsdt({ rate: '14000.00' });

    await expect(exchangeRatesApi.getUsdt()).resolves.toMatchObject({ rate: '14000.00' });
  });
});
