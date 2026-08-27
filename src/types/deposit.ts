import { z } from 'zod';

import { isoDateTime, moneyViewSchema } from './api';
import {
  creditVerifiedBySchema,
  type depositSortSchema,
  depositStatusSchema,
  proofSourceSchema,
  type rejectionCodeSchema,
  type DepositStatus,
} from './enums';
import { chainNetworkSchema } from './payment-method';

export const depositDestinationSchema = z.looseObject({
  methodCode: z.string(),
  methodName: z.string(),
  instructions: z.string().nullable(),
  requiresReference: z.boolean(),
  label: z.string().nullable(),
  accountIdentifier: z.string().nullable(),
  accountHolder: z.string().nullable(),
});
export type DepositDestination = z.infer<typeof depositDestinationSchema>;

export const depositProofSchema = z.looseObject({
  id: z.string(),
  source: z.union([proofSourceSchema, z.string()]),
  mimeType: z.string(),
  sizeBytes: z.number(),
  sha256: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  createdAt: isoDateTime,
});
export type DepositProof = z.infer<typeof depositProofSchema>;

export const adminDepositSchema = z.looseObject({
  id: z.string(),
  shortId: z.string(),
  status: depositStatusSchema,
  claimed: moneyViewSchema,
  verified: moneyViewSchema.nullable(),
  credited: moneyViewSchema.nullable(),
  fee: moneyViewSchema,
  externalReference: z.string().nullable(),
  senderAccount: z.string().nullable(),
  proofCount: z.number(),
  createdAt: isoDateTime,
  expiresAt: isoDateTime.nullable(),
  submittedAt: isoDateTime.nullable(),
  decidedAt: isoDateTime.nullable(),
  creditedAt: isoDateTime.nullable(),
  rejectionCode: z.string().nullable(),
  rejectionNote: z.string().nullable(),
  destination: depositDestinationSchema.nullable(),
  playerId: z.string(),
  playerTelegramUserId: z.string().nullable(),
  playerTelegramUsername: z.string().nullable(),
  paymentMethodId: z.string(),
  reviewStartedAt: isoDateTime.nullable(),
  decidedByAdminId: z.string().nullable(),
  secondApproverAdminId: z.string().nullable(),
  creditVerifiedBy: z.union([creditVerifiedBySchema, z.string()]).nullable(),
  creditAttempts: z.number(),
  creditKeyEpoch: z.number(),
  riskFlags: z.array(z.string()),
  requiresSecondApproval: z.boolean(),
  proofs: z.array(depositProofSchema),
});
export type AdminDeposit = z.infer<typeof adminDepositSchema>;

/**
 * The six answers a review action can give. `alreadyHandled` is NOT an error — it means a colleague
 * decided first, and the console says so rather than showing a failure.
 */
export const reviewOutcomeSchema = z.discriminatedUnion('kind', [
  z.looseObject({
    kind: z.literal('approved'),
    deposit: z.unknown(),
    ledgerTransactionId: z.string(),
  }),
  z.looseObject({ kind: z.literal('awaiting_second_approval'), deposit: z.unknown() }),
  z.looseObject({ kind: z.literal('rejected'), deposit: z.unknown() }),
  z.looseObject({ kind: z.literal('claimed'), deposit: z.unknown() }),
  z.looseObject({ kind: z.literal('released'), deposit: z.unknown() }),
  z.looseObject({ kind: z.literal('alreadyHandled'), status: depositStatusSchema.nullable() }),
]);
export type ReviewOutcome = z.infer<typeof reviewOutcomeSchema>;
export type ReviewOutcomeKind = ReviewOutcome['kind'];

export const retryCreditResultSchema = z.looseObject({
  requeued: z.boolean(),
  creditKeyEpoch: z.number(),
});
export type RetryCreditResult = z.infer<typeof retryCreditResultSchema>;

export const proofUrlSchema = z.looseObject({
  url: z.string().nullable(),
  streamPath: z.string(),
  expiresInSeconds: z.number(),
});
export type ProofUrl = z.infer<typeof proofUrlSchema>;

export const sweepReportSchema = z.looseObject({
  expired: z.number(),
  released: z.number(),
  reaped: z.number(),
});
export type SweepReport = z.infer<typeof sweepReportSchema>;

/** Query the deposit queue accepts. Mirrors AdminDepositQueueQueryDto field for field. */
export interface DepositQueueQuery {
  status?: DepositStatus[];
  playerId?: string;
  paymentMethodId?: string;
  shortId?: string;
  externalReference?: string;
  createdFrom?: string;
  createdTo?: string;
  minAmount?: string;
  maxAmount?: string;
  unclaimedOnly?: boolean;
  sort?: z.infer<typeof depositSortSchema>;
  limit?: number;
  cursor?: string;
}

export interface ApproveDepositBody {
  verifiedAmount?: { amount: string; currencyCode: string };
  note?: string;
}

export interface RejectDepositBody {
  rejectionCode: z.infer<typeof rejectionCodeSchema>;
  rejectionNote?: string;
}

// ── What the chain says about ONE deposit ──────────────────────────────────────────────────────

/**
 * The seven answers `GET /v1/admin/deposits/:id/chain-check` can give.
 *
 * Two of them are the reason the whole shape exists, and they are the two most likely to be
 * collapsed into "not verified" by somebody skimming:
 *
 *   - `suspect` — the transfer is REAL, CONFIRMED, and paid somebody else. Everything a reviewer
 *     normally looks for is present, which is exactly what makes it convincing.
 *   - `unavailable` — OUR node did not answer. It says nothing whatsoever about the deposit, and a
 *     screen that renders it alongside the refusals turns an outage into an accusation.
 */
export const chainCheckOutcomeSchema = z.enum([
  'verified',
  'pending',
  'mismatch',
  'suspect',
  'missing',
  'unavailable',
  'skipped',
]);
export type ChainCheckOutcome = z.infer<typeof chainCheckOutcomeSchema>;

/**
 * What actually landed on chain — USDT, at SIX decimals.
 *
 * ══ THIS IS NOT A `MoneyView`, AND MUST NEVER BECOME ONE ══════════════════════════════════════
 * Every money helper in this console defaults to scale 2, because every currency it has ever
 * carried is minor-unit hundredths. USDT is millionths. Run `99500000` through the default scale
 * and the screen reads `995,000.00` — ten thousand times the truth, in the exact number a reviewer
 * is about to decide somebody's deposit on.
 *
 * The defence is structural rather than careful: the field is called `asset`, not `currency`, so
 * this object is NOT assignable to `MoneyView` and `formatMoney(arrived)` does not compile. Render
 * it by parsing `minor` at the `scale` the response carries — see `arrivedAsMoney` in
 * `src/features/deposits/chain-verdict.tsx`.
 *
 * `scale` travels rather than being assumed for the reason the backend learned the hard way: BSC's
 * USDT contract reports 18 decimals, not 6, and a scale taken on faith credited 10¹² times the
 * value. The server canonicalises to 6 and says so here.
 */
export const chainArrivalSchema = z.looseObject({
  /** `'USDT'` on every rail that exists today. A string, not an enum — the next asset is not this
   *  console's to predict. */
  asset: z.string(),
  scale: z.number(),
  minor: z.string(),
  /** The same figure the server already formatted, kept for comparison rather than for display. */
  amount: z.string(),
});
export type ChainArrival = z.infer<typeof chainArrivalSchema>;

/**
 * The on-chain verdict for one deposit, as its own resource.
 *
 * A resource and not a field on `AdminDeposit` on purpose: answering it costs a call to a chain
 * explorer, and hanging it off the deposit view would make the QUEUE endpoint do that once per row.
 *
 * `creditable` IS tenant currency at the normal scale — it is what the arrived USDT is worth at the
 * operator's rate, ready to be approved. `arrived` is the chain's own figure and is a different
 * kind of number; the two are deliberately different types so neither can be rendered as the other.
 */
export const depositChainCheckSchema = z.looseObject({
  outcome: chainCheckOutcomeSchema,
  network: chainNetworkSchema.nullable(),
  /** The server's one sentence about what it found. Shown as it arrived: it names the specifics. */
  summary: z.string(),
  arrived: chainArrivalSchema.nullable(),
  creditable: moneyViewSchema.nullable(),
  txHash: z.string().nullable(),
  /** The wallet the transfer came FROM — the only thing tying a transfer to a person. */
  fromAddress: z.string().nullable(),
  confirmations: z.number().nullable(),
  requiredConfirmations: z.number().nullable(),
  checkedAt: isoDateTime,
});
export type DepositChainCheck = z.infer<typeof depositChainCheckSchema>;
