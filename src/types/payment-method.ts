import { z } from 'zod';

import { isoDateTime } from './api';
import { paymentRailSchema, verificationModeSchema, type PaymentRail } from './enums';

export const paymentMethodSchema = z.looseObject({
  id: z.string(),
  code: z.string(),
  displayName: z.string(),
  rail: paymentRailSchema,
  currencyCode: z.string(),
  verificationMode: verificationModeSchema,
  minAmount: z.string(),
  maxAmount: z.string(),
  feeFixed: z.string(),
  feeBps: z.number(),
  requiresReference: z.boolean(),
  /**
   * Whether a receipt photo is still required.
   *
   * Off means this rail takes a reference NUMBER instead — the stronger evidence, since it can be
   * matched against a statement and the backend refuses the same one twice.
   */
  requiresProof: z.boolean(),
  instructions: z.string().nullable(),
  requiredProofFields: z.array(z.unknown()).optional(),
  isActive: z.boolean(),
  sortOrder: z.number(),
  referencePattern: z.string().nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const paymentDestinationSchema = z.looseObject({
  id: z.string(),
  label: z.string(),
  accountIdentifier: z.string(),
  accountHolder: z.string().nullable(),
  notes: z.string().nullable(),
  paymentMethodId: z.string(),
  isActive: z.boolean(),
  priority: z.number(),
  dailyCap: z.string().nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type PaymentDestination = z.infer<typeof paymentDestinationSchema>;

export interface PaymentMethodListQuery {
  isActive?: boolean;
  rail?: PaymentRail;
}

export interface CreatePaymentMethodBody {
  code: string;
  displayName: string;
  rail: PaymentRail;
  currencyCode: string;
  verificationMode: z.infer<typeof verificationModeSchema>;
  minAmount: string;
  maxAmount: string;
  feeFixed?: string;
  feeBps?: number;
  requiresReference?: boolean;
  requiresProof?: boolean;
  referencePattern?: string;
  instructions?: string;
  isActive?: boolean;
  sortOrder?: number;
}

/** `code`, `rail` and `currencyCode` are immutable — reinterpreting them would rewrite history. */
export type UpdatePaymentMethodBody = Partial<
  Omit<CreatePaymentMethodBody, 'code' | 'rail' | 'currencyCode'>
>;

export interface CreatePaymentDestinationBody {
  label: string;
  accountIdentifier: string;
  accountHolder?: string;
  isActive?: boolean;
  priority?: number;
  dailyCap?: string;
  notes?: string;
}

/** The account number itself cannot be edited: that would silently redirect players' money. */
export type UpdatePaymentDestinationBody = Partial<
  Omit<CreatePaymentDestinationBody, 'accountIdentifier'>
>;

// ── The rate that prices a crypto deposit ──────────────────────────────────────────────────────

/**
 * `GET` / `PUT /v1/admin/exchange-rates/usdt` — what one USDT is worth in the operator's currency.
 *
 * ══ WHY BOTH `rate` AND `rateMinor` ═══════════════════════════════════════════════════════════
 * `rate` is the decimal an operator recognises and types; `rateMinor` is what actually multiplies a
 * deposit. Both cross the wire because a screen that derived one from the other would be a second
 * place for the SCALE to be wrong — and the scale is exactly what the Syrian redenomination makes
 * easy to get wrong, by a factor of one hundred.
 *
 * `isStale` is reported rather than being an error, because a stale rate is a state a screen must
 * be able to explain: the rail is refusing deposits, here is the number it is refusing on, set a new
 * one. Only the deposit path treats staleness as a refusal.
 */
export const exchangeRateSchema = z.looseObject({
  quoteAsset: z.string(),
  currencyCode: z.string(),
  rate: z.string(),
  rateMinor: z.string(),
  source: z.string(),
  sourceNote: z.string().nullable(),
  setByAdminId: z.string().nullable(),
  effectiveFrom: isoDateTime,
  isStale: z.boolean(),
  maxAgeHours: z.number(),
});
export type ExchangeRate = z.infer<typeof exchangeRateSchema>;

/**
 * `PUT`. `confirmLargeChange` is a SECOND, separate act: the server refuses a rate more than 20%
 * from the one it replaces, which is what catches a misplaced decimal and the 100× denomination
 * confusion. Overriding it must never be something a form does on the operator's behalf.
 */
export interface SetExchangeRateBody {
  rate: string;
  sourceNote?: string;
  confirmLargeChange?: boolean;
}

/** USDT carries six decimals on both TRC20 and BEP20. */
export const USDT_SCALE = 6;

// ── What the chain says a payout wallet holds ──────────────────────────────────────────────────

/** The chains a USDT rail pays on. Mirrors `ChainNetwork` on the backend. */
export const chainNetworkSchema = z.enum(['TRC20', 'BEP20']);
export type ChainNetwork = z.infer<typeof chainNetworkSchema>;

/**
 * `GET /v1/admin/payment-destinations/:id/balance` — the on-chain balance of ONE payout wallet.
 *
 * ══ WHY EVERY FIGURE ON THIS SHAPE IS NULLABLE ════════════════════════════════════════════════
 * Reading it costs a call to a third-party chain explorer, which is rate-limited, occasionally slow
 * and occasionally down. So there are three answers, not two: a number, a refusal, and "the chain
 * did not tell us". The third is answered `200` with `balanceMinor: null` — it is not an error, the
 * request was fine, the ANSWER is missing.
 *
 * `balanceMinor` and `balance` are therefore nullable and MUST NOT be defaulted. A schema that
 * defaulted them to `'0'` would turn an outage into the sentence "this wallet is empty", which is
 * the most alarming false statement this console could make to somebody whose money is in it. Zero
 * is a real answer with real consequences and it has to stay distinguishable from silence.
 *
 * `problem` is the machine code and `detail` the one sentence a person reads; both are non-null
 * exactly when the balance could not be read.
 */
export const walletBalanceSchema = z.looseObject({
  /**
   * Null when the identifier this was asked about is not a chain address at all — the state every
   * freshly provisioned rail is in, holding `SEED-PLACEHOLDER-…` until somebody pastes a wallet.
   *
   * Nullable because the server sends it so: `DestinationBalanceService.read()` derives the network
   * from the ADDRESS with `detectWalletNetwork()` and answers 200 with `network: null` and a reason
   * rather than an error, since an unconfigured rail is an expected state and not a fault. A
   * non-nullable schema here would reject that response, and the console would show a parse failure
   * where the server had sent it a plain-English explanation. Nothing names a network it did not
   * detect just to satisfy a type — that invention is the bug this whole rail was rebuilt to undo.
   */
  network: chainNetworkSchema.nullable(),
  address: z.string(),
  /** `'USDT'` on every rail that exists today. A string, like `ExchangeRate.quoteAsset`. */
  asset: z.string(),
  /** Decimals the minor units carry — 6 for USDT on both chains. Sent, never assumed. */
  scale: z.number(),
  balanceMinor: z.string().nullable(),
  balance: z.string().nullable(),
  checkedAt: isoDateTime,
  problem: z.string().nullable(),
  detail: z.string().nullable(),
});
export type WalletBalance = z.infer<typeof walletBalanceSchema>;
