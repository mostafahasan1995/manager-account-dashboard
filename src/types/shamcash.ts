import { z } from 'zod';

import { isoDateTime } from './api';

/**
 * The operator's Sham Cash account, as this console sees it.
 *
 * ══ WHAT THIS REPLACED ═══════════════════════════════════════════════════════════════════════
 * A browser SESSION: cookies pasted from a logged-in browser, replayed in headless Chromium to read
 * a rendered page. Sham Cash issues API keys now, so the cookies, the browser, the proxy and the
 * page parser are all gone — and with them the `linked` / `updatedAt` fields that described a
 * session's freshness. A key does not lapse, so there is nothing to date.
 */
export const shamCashStatusSchema = z.object({
  /**
   * Whether a key is configured. The KEY is never returned, by this or any endpoint — a console
   * that echoes a secret back turns every screenshot and browser cache into a place it leaks from.
   */
  apiLinked: z.boolean(),
  /**
   * Returned in full, because it is not a credential: it is the path segment in the endpoint URL,
   * and an operator needs to read back what was saved to check it against their Sham Cash dashboard.
   */
  walletId: z.string().nullable(),
});
export type ShamCashStatus = z.infer<typeof shamCashStatusSchema>;

/**
 * One currency's holdings.
 *
 * Amounts are STRINGS. It is not this system's money — it is a figure read from somebody else's
 * account — and turning it into a Number is the precision loss the money rules forbid on our own.
 */
export const shamCashBalanceSchema = z.object({
  currency: z.string(),
  available: z.string(),
  locked: z.string(),
});
export type ShamCashBalance = z.infer<typeof shamCashBalanceSchema>;

/**
 * What a balance read found.
 *
 * ══ THE NEVER-0 DISCIPLINE ═══════════════════════════════════════════════════════════════════
 * A union, not a nullable list, because a FAILURE MUST NEVER RENDER AS AN EMPTY WALLET. "No key
 * configured", "the key was rejected" and "the API could not be reached" are three different things
 * an operator does three different things about, and collapsing any of them into a zero balance is
 * the most alarming false statement this console could make to somebody with money in that account.
 */
export const shamCashReadResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    balances: z.array(shamCashBalanceSchema),
    checkedAt: isoDateTime,
  }),
  z.object({ status: z.literal('not_linked') }),
  z.object({ status: z.literal('unauthorized') }),
  z.object({ status: z.literal('unavailable'), detail: z.string() }),
]);
export type ShamCashReadResult = z.infer<typeof shamCashReadResultSchema>;

/**
 * The HTTP API credentials. BOTH are required — a key with no wallet id has no URL to call, and a
 * wallet id with no key produces a request that will be rejected, so there is no useful half.
 */
export interface SetShamCashApiBody {
  walletId: string;
  apiKey: string;
}

/**
 * A live proof that the saved key works.
 *
 * ══ WHY THE TWO HALVES ARE REPORTED SEPARATELY ═══════════════════════════════════════════════
 * Reading the balance and listing transactions are different endpoints and can fail apart. "The key
 * is fine but lookups are down" and "the key is wrong" are different problems with different fixes,
 * so one combined ✅/❌ would hide exactly the split this test exists to surface.
 */
export const shamCashApiTransactionSchema = z.looseObject({
  id: z.string(),
  type: z.enum(['credit', 'debit']),
  /** A NUMBER on the wire, in MAJOR units — unlike this system's own money, which is minor strings. */
  amount: z.number(),
  currency: z.string(),
  counterparty: z.string().nullable(),
  occurredAt: z.string(),
});
export type ShamCashApiTransaction = z.infer<typeof shamCashApiTransactionSchema>;

export const shamCashTestResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('not_linked') }),
  z.object({ status: z.literal('unauthorized') }),
  z.object({
    status: z.literal('ok'),
    balance: shamCashReadResultSchema,
    transactions: z.discriminatedUnion('status', [
      z.object({
        status: z.literal('ok'),
        sample: z.array(shamCashApiTransactionSchema),
        total: z.number(),
      }),
      z.object({ status: z.literal('failed'), detail: z.string() }),
    ]),
  }),
]);
export type ShamCashTestResult = z.infer<typeof shamCashTestResultSchema>;
