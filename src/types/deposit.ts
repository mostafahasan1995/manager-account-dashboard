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
