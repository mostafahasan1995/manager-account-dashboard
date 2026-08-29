import { z } from 'zod';

import { isoDateTime, moneyViewSchema } from './api';
import {
  creditVerifiedBySchema,
  playerDebitStatusSchema,
  playerStatusSchema,
  type PlayerStatus,
} from './enums';

export const adminPlayerSchema = z.looseObject({
  id: z.string(),
  telegramUserId: z.string(),
  telegramUsername: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  languageCode: z.string().nullable(),
  status: playerStatusSchema,
  currencyCode: z.string(),
  ichancyLinked: z.boolean(),
  createdAt: isoDateTime,
  lastSeenAt: isoDateTime.nullable(),
  // Present on the admin views; the player's own view omits them.
  ichancyPlayerId: z.string().nullable().optional(),
  ichancyLogin: z.string().nullable().optional(),
  ichancyRegisteredAt: isoDateTime.nullable().optional(),
  phone: z.string().nullable().optional(),
});
export type AdminPlayer = z.infer<typeof adminPlayerSchema>;

export const ichancyAccountSchema = z.looseObject({
  playerId: z.string(),
  ichancyPlayerId: z.string(),
  ichancyLogin: z.string(),
  /** false = the player already had an account; the call was a no-op, not a failure. */
  created: z.boolean(),
  agentId: z.string(),
});
export type IchancyAccount = z.infer<typeof ichancyAccountSchema>;

export interface PlayerListQuery {
  status?: PlayerStatus;
  telegramUserId?: string;
  linked?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

/** `firstName lastName`, falling back to the @username and then to the Telegram id. */
export function playerDisplayName(player: AdminPlayer): string {
  const name = [player.firstName, player.lastName].filter(Boolean).join(' ').trim();
  if (name.length > 0) return name;
  if (player.telegramUsername != null && player.telegramUsername.length > 0) {
    return `@${player.telegramUsername}`;
  }
  return `Telegram ${player.telegramUserId}`;
}

// ── Manual adjustments: debits out, credits in ─────────────────────────────────────────────────

/**
 * The backend's own limit on the reason field, shared by both directions.
 *
 * One constant rather than two, because the two routes are one rule: `reason: string 1..280`. Two
 * copies would let a future 500 on one side pass a form that the other side still refuses.
 */
export const MANUAL_ADJUSTMENT_REASON_MAX_LENGTH = 280;

/** The debit route's name for it. Kept so the older call sites read as they always did. */
export const DEBIT_REASON_MAX_LENGTH = MANUAL_ADJUSTMENT_REASON_MAX_LENGTH;

/**
 * `POST /v1/admin/players/:id/debit` — money taken back OUT of a player's Ichancy account.
 *
 * The amount is `amountMinor`, a STRING of minor units, in both directions. An NSP figure outruns
 * `Number.MAX_SAFE_INTEGER` long before it outruns a cashier's day, and a debit rounded by a
 * float is a debit for the wrong amount of somebody else's money.
 *
 * `status` and `verifiedBy` are unions with `string` on purpose, exactly as the deposit schemas
 * are: a value the backend adds tomorrow must render as itself rather than blank the panel that is
 * telling an operator whether a live account was just emptied.
 */
export const playerDebitSchema = z.looseObject({
  debitId: z.string(),
  playerId: z.string(),
  amountMinor: z.string(),
  status: z.union([playerDebitStatusSchema, z.string()]),
  /** What Ichancy held before the call, and what it held after. Minor units, as strings. */
  playerBalanceBeforeMinor: z.string(),
  playerBalanceAfterMinor: z.string(),
  /** Null until something proves it: an unconfirmed debit has verified nothing. */
  verifiedBy: z.union([creditVerifiedBySchema, z.string()]).nullable(),
  reason: z.string(),
  decidedBy: z.string(),
  createdAt: isoDateTime,
});
export type PlayerDebit = z.infer<typeof playerDebitSchema>;

/** The request body. `amountMinor` is minor units as a decimal string — never a JS number. */
export interface DebitPlayerBody {
  amountMinor: string;
  reason: string;
}

// ── Manual credit (a hand-recorded deposit) ──────────────────────────────────────────────────────

/** Shared with the debit direction: one number so a 500 on one side cannot pass a form the other refuses. */
export const CREDIT_REASON_MAX_LENGTH = MANUAL_ADJUSTMENT_REASON_MAX_LENGTH;

/**
 * `POST /v1/admin/deposits/manual` — crediting a player by recording a MANUAL DEPOSIT.
 *
 * Unlike a debit, this is ASYNC and reuses the whole deposit spine: the admin's action creates an
 * already-approved deposit, and the player is credited SECONDS later by the same credit worker that
 * finishes a real deposit (with its Ichancy verify-by-delta and float guard). So the result says
 * "queued" / "awaiting a second approval", not "done" — `status` and `outcome` are unions with
 * `string` for the same reason the deposit schemas are: a value the backend adds tomorrow renders as
 * itself rather than blanking the panel.
 */
export const manualCreditSchema = z.looseObject({
  /** The Crockford short id of the deposit the credit was recorded as — the operator's handle on it. */
  shortId: z.string(),
  /** APPROVED (credit queued) or PENDING_SECOND_APPROVAL (a large credit needs another admin). */
  status: z.string(),
  amount: moneyViewSchema,
  /** The review outcome discriminant, e.g. 'approved' / 'awaiting_second_approval'. */
  outcome: z.string(),
});
export type ManualCredit = z.infer<typeof manualCreditSchema>;

/** The request body. `amountMinor` is minor units as a decimal string — never a JS number. */
export interface CreditPlayerBody {
  amountMinor: string;
  reason: string;
}

// ── Balances ───────────────────────────────────────────────────────────────────────────────────

/**
 * `GET /v1/admin/players/:id/balance` — what Ichancy holds for ONE player, right now.
 *
 * One player, because there is no bulk read to have. Verified against a real logged response:
 * `getPlayersForCurrentAgent` answers with `playerId, username, currency, affiliateId,
 * phoneNumber, registerDate` and no balance at all, so every balance on a screen is its own
 * upstream call through Cloudflare — seconds each, and rate-limited. Any screen that shows a column
 * of these has to be built around that cost rather than around the convenience of a list.
 *
 * `readAt` is when the upstream read happened, not when this response was serialised: a balance is
 * a measurement with a timestamp, and an operator deciding whether to send money needs to know
 * whether they are looking at a number from a second ago or from a minute ago.
 */
export const playerBalanceSchema = z.looseObject({
  playerId: z.string(),
  /** Minor units as a string. A balance can outrun a double as easily as an amount can. */
  balanceMinor: z.string(),
  currencyCode: z.string(),
  readAt: isoDateTime,
});
export type PlayerBalance = z.infer<typeof playerBalanceSchema>;
