import { z } from 'zod';

import { isoDateTime } from './api';

/**
 * Whether this operator has linked a Sham Cash browser session, and when.
 *
 * The cookies themselves are NEVER returned — the backend seals them and hands back only this. So
 * the form can say "linked 2 hours ago", but nothing in the console can ever read the session back.
 */
export const shamCashStatusSchema = z.object({
  linked: z.boolean(),
  updatedAt: isoDateTime.nullable(),
});
export type ShamCashStatus = z.infer<typeof shamCashStatusSchema>;

/**
 * The cookies an operator copies from their logged-in Sham Cash browser. `accessToken` and
 * `authToken` are the ones that say "signed in"; `forge` (the anti-forgery cookie) is optional.
 */
export interface SetShamCashSessionBody {
  accessToken: string;
  authToken: string;
  forge?: string;
  /** The `shamcash-pin-code-hash` value from localStorage — the app checks the typed PIN against it. */
  pinCodeHash?: string;
  /** The 4-digit PIN the app asks for after sign-in; the reader types it at the gate. */
  pin?: string;
}

/** One wallet the account holds: what is available, and what is locked/reserved. */
export const shamCashBalanceSchema = z.object({
  currency: z.enum(['SYP', 'USD', 'EUR']),
  available: z.string(),
  locked: z.string(),
});
export type ShamCashBalance = z.infer<typeof shamCashBalanceSchema>;

export const shamCashTransactionSchema = z.object({
  transactionId: z.string(),
  date: z.string(),
  amount: z.string(),
  currency: z.string(),
  direction: z.enum(['in', 'out']),
  username: z.string(),
  maskedCard: z.string(),
});
export type ShamCashTransaction = z.infer<typeof shamCashTransactionSchema>;

/**
 * What a balance check concluded — a discriminated union, because the four outcomes are acted on
 * differently and `expired` / `unavailable` must never be mistaken for a wallet of zeros.
 */
export const shamCashReadResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    balances: z.array(shamCashBalanceSchema),
    transactions: z.array(shamCashTransactionSchema),
    checkedAt: isoDateTime,
  }),
  z.object({ status: z.literal('not_linked') }),
  z.object({ status: z.literal('expired') }),
  z.object({ status: z.literal('unavailable'), detail: z.string() }),
]);
export type ShamCashReadResult = z.infer<typeof shamCashReadResultSchema>;
