import { z } from 'zod';

import { breakMoneySchema, isoDateTime } from './api';
import {
  breakCategorySchema,
  breakStatusSchema,
  type BreakCategory,
  type BreakStatus,
  type TerminalBreakStatus,
} from './enums';

export const reconciliationBreakSchema = z.looseObject({
  id: z.string(),
  category: z.union([breakCategorySchema, z.string()]),
  status: z.union([breakStatusSchema, z.string()]),
  severity: z.number(),
  currencyCode: z.string(),
  expected: breakMoneySchema.nullable(),
  actual: breakMoneySchema.nullable(),
  delta: breakMoneySchema.nullable(),
  depositRequestId: z.string().nullable(),
  playerId: z.string().nullable(),
  ledgerAccountId: z.string().nullable(),
  ichancyCallId: z.string().nullable(),
  detail: z.unknown().nullable(),
  dedupeKey: z.string().nullable(),
  detectedAt: isoDateTime,
  assignedToAdminId: z.string().nullable(),
  resolvedAt: isoDateTime.nullable(),
  resolvedByAdminId: z.string().nullable(),
  resolutionNote: z.string().nullable(),
  resolutionTxId: z.string().nullable(),
});
export type ReconciliationBreak = z.infer<typeof reconciliationBreakSchema>;

export const floatSyncResultSchema = z.looseObject({
  currencyCode: z.string(),
  ledgerMinor: z.string(),
  /** null when Ichancy could not be read — that is itself the finding. */
  ichancyMinor: z.string().nullable(),
  deltaMinor: z.string().nullable(),
  breakId: z.string().nullable(),
  belowWatermark: z.boolean(),
  /**
   * True under ICHANCY_FAKE: the wallet was NOT read, so `ichancyMinor` is null for that reason and
   * not because Ichancy failed. The panel must say "fake mode" there, never "could not be read".
   */
  ichancyFake: z.boolean(),
});
export type FloatSyncResult = z.infer<typeof floatSyncResultSchema>;

export const floatCorrectionSchema = z.looseObject({
  ledgerTransactionId: z.string(),
  deltaMinor: z.string(),
});
export type FloatCorrection = z.infer<typeof floatCorrectionSchema>;

export const railAgeingBucketSchema = z.looseObject({
  label: z.string(),
  fromDays: z.number(),
  toDays: z.number().nullable(),
  debitMinor: z.string(),
  creditMinor: z.string(),
  netMinor: z.string(),
  entryCount: z.number(),
});
export type RailAgeingBucket = z.infer<typeof railAgeingBucketSchema>;

export const railAgeingRowSchema = z.looseObject({
  accountId: z.string(),
  accountCode: z.string(),
  currencyCode: z.string(),
  paymentMethodId: z.string().nullable(),
  balanceMinor: z.string(),
  oldestUnsettledAt: isoDateTime.nullable(),
  buckets: z.array(railAgeingBucketSchema),
});
export type RailAgeingRow = z.infer<typeof railAgeingRowSchema>;

export const railAgeingReportSchema = z.looseObject({
  generatedAt: isoDateTime,
  rows: z.array(railAgeingRowSchema),
  /** Accounts holding money older than the last bucket. These are the ones that cost real money. */
  staleAccountCodes: z.array(z.string()),
});
export type RailAgeingReport = z.infer<typeof railAgeingReportSchema>;

export const invariantViolationSchema = z.looseObject({
  invariant: z.string(),
  subject: z.string(),
  currencyCode: z.string(),
  expectedMinor: z.union([z.string(), z.number()]),
  actualMinor: z.union([z.string(), z.number()]),
  deltaMinor: z.union([z.string(), z.number()]),
  detail: z.string(),
});
export type InvariantViolation = z.infer<typeof invariantViolationSchema>;

export const invariantReportSchema = z.looseObject({
  ok: z.boolean(),
  checkedAt: isoDateTime,
  violations: z.array(invariantViolationSchema),
  /** A check hit its row cap: there may be more violations than are listed. */
  truncated: z.boolean(),
});
export type InvariantReport = z.infer<typeof invariantReportSchema>;

export const INVARIANT_LABELS: Record<string, string> = {
  I1_TRANSACTION_BALANCES: 'Every transaction balances to zero',
  I2_GLOBAL_BALANCE: 'The whole ledger balances per currency',
  I3_ACCOUNT_BALANCE_MATCHES_ENTRIES: 'Account balances match their entries',
};

export interface BreakListQuery {
  status?: BreakStatus[];
  category?: BreakCategory[];
  minSeverity?: number;
  limit?: number;
  cursor?: string;
}

export interface ResolveBreakBody {
  status: TerminalBreakStatus;
  note: string;
}
