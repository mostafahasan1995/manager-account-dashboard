import { z } from 'zod';

import { isoDateTime, moneyViewSchema } from './api';
import {
  walletCheckStatusSchema,
  withdrawalModeSchema,
  withdrawalStatusSchema,
  type WithdrawalSort,
  type WithdrawalStatus,
} from './enums';

/**
 * A player's cash-out, as the console sees it — `AdminWithdrawalView`.
 *
 * ══ WHAT MAKES THIS DIFFERENT FROM A DEPOSIT ══════════════════════════════════════════════════
 * A deposit is money coming IN that a reviewer verifies against a receipt. A withdrawal is money
 * going OUT, in two separate movements that this shape keeps apart on purpose:
 *
 *   1. the DEBIT — the player's casino balance is taken so it cannot be spent twice. That is what
 *      `playerDebitId` / `debitedAt` record, and `walletCheck` is what the payout wallet held at
 *      that moment.
 *   2. the PAYOUT — a person sends the money to `payoutAddress` and records `payoutReference`.
 *      That is `paidAt` / `paidByAdminId` / `ledgerPayoutTxId`.
 *
 * `DEBITED` sits between the two, and it is the state the queue exists for: the player has been
 * charged and nobody has been paid. Rendering it as "done" is the one mistake this screen must
 * never make.
 *
 * ══ WHY `walletCheck` IS NULLABLE, AND WHY ITS FIGURE IS TOO ══════════════════════════════════
 * It is taken once, after the debit, by asking the chain or Sham Cash what the operator's payout
 * wallet holds. Null means it has not been taken yet (nothing debited) — and inside it,
 * `availableMinor` is null for `unknown` and `not_configured`, because a wallet that did not answer
 * is not an empty wallet. The same never-0 rule every other balance on this console follows.
 */
export const walletCheckSchema = z.looseObject({
  status: walletCheckStatusSchema,
  /** Minor units of the wallet's OWN asset (USDT at scale 6 on a chain rail), as a string. */
  availableMinor: z.string().nullable(),
  currency: z.string().nullable(),
  checkedAt: isoDateTime,
});
export type WalletCheck = z.infer<typeof walletCheckSchema>;

export const adminWithdrawalSchema = z.looseObject({
  id: z.string(),
  shortId: z.string(),
  status: withdrawalStatusSchema,
  mode: withdrawalModeSchema,
  /** Where the request came from — the bot, the mini app — as the server labelled it. */
  source: z.string().nullable(),

  playerId: z.string(),
  playerTelegramUserId: z.string().nullable(),
  playerTelegramUsername: z.string().nullable(),
  playerIchancyLogin: z.string().nullable(),

  paymentMethodId: z.string(),
  methodCode: z.string(),
  methodName: z.string(),
  /** Where the player asked to be paid: a wallet address, an account number. Copied, never edited. */
  payoutAddress: z.string(),
  /** Detected from the address on a chain rail; null everywhere else. */
  payoutNetwork: z.string().nullable(),

  amount: moneyViewSchema,
  fee: moneyViewSchema,
  /** The casino balance read when the request was made — what `amount` was checked against. */
  balanceAtRequest: moneyViewSchema.nullable(),

  walletCheck: walletCheckSchema.nullable(),

  playerDebitId: z.string().nullable(),
  payoutReference: z.string().nullable(),
  ledgerPayoutTxId: z.string().nullable(),

  /** Null under AUTO: the platform approved, not a person. */
  decidedByAdminId: z.string().nullable(),
  paidByAdminId: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  failureCode: z.string().nullable(),
  failureMessage: z.string().nullable(),

  requestedAt: isoDateTime,
  decidedAt: isoDateTime.nullable(),
  debitedAt: isoDateTime.nullable(),
  paidAt: isoDateTime.nullable(),
  closedAt: isoDateTime.nullable(),
});
export type AdminWithdrawal = z.infer<typeof adminWithdrawalSchema>;

/** Query the withdrawal queue accepts. Offset-paginated, unlike the deposit queue. */
export interface WithdrawalListQuery {
  status?: WithdrawalStatus[];
  playerId?: string;
  shortId?: string;
  createdFrom?: string;
  createdTo?: string;
  sort?: WithdrawalSort;
  limit?: number;
  offset?: number;
}

/** The backend's own limit on a rejection reason — 1..280, like every other reason field. */
export const WITHDRAWAL_REJECTION_REASON_MAX_LENGTH = 280;

/** `POST /v1/admin/withdrawals/:id/reject`. */
export interface RejectWithdrawalBody {
  reason: string;
}

/** The transfer reference a person records when they mark a withdrawal paid — 1..128. */
export const PAYOUT_REFERENCE_MAX_LENGTH = 128;

/** `POST /v1/admin/withdrawals/:id/mark-paid`. */
export interface MarkPaidBody {
  payoutReference: string;
}

// ── Status helpers ─────────────────────────────────────────────────────────────────────────────

/** Approve and reject are the SAME gate: both are only offered while a human decision is pending. */
export function canDecideWithdrawal(withdrawal: Pick<AdminWithdrawal, 'status'>): boolean {
  return withdrawal.status === 'REQUESTED';
}

/** Marking paid is offered exactly once the player has been charged and nobody has been paid. */
export function canMarkWithdrawalPaid(withdrawal: Pick<AdminWithdrawal, 'status'>): boolean {
  return withdrawal.status === 'DEBITED';
}

/** Still moving — somebody, or the worker, has something left to do. */
export function isWithdrawalOpen(status: WithdrawalStatus): boolean {
  return (
    status === 'REQUESTED' || status === 'APPROVED' || status === 'DEBITING' || status === 'DEBITED'
  );
}

/** Money was taken, or may have been, and nobody was paid. Somebody has to look. */
export function withdrawalNeedsAttention(status: WithdrawalStatus): boolean {
  return status === 'DEBIT_FAILED' || status === 'NEEDS_RECONCILIATION';
}

/** Nothing more will happen to it. */
export function isWithdrawalTerminal(status: WithdrawalStatus): boolean {
  return status === 'PAID' || status === 'REJECTED' || status === 'CANCELLED';
}
