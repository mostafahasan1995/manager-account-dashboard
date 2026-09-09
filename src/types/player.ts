import { z } from 'zod';

import { isoDateTime, moneyViewSchema } from './api';
import {
  creditVerifiedBySchema,
  playerDebitStatusSchema,
  playerSourceSchema,
  playerStatusSchema,
  type PlayerSource,
  type PlayerStatus,
} from './enums';

/**
 * `AdminPlayerView`.
 *
 * ══ WHY `telegramUserId` IS NULLABLE ══════════════════════════════════════════════════════════
 * It used to be the one thing every player had, because a player used to BE a Telegram account
 * that pressed Start. Two other doors exist now: a row imported from the operator's Ichancy agent
 * (`source: ICHANCY_IMPORT`) and a row registered from this console (`source: ADMIN`), and neither
 * has a Telegram id until somebody attaches one. Every screen that prints the id has to be able to
 * print an em dash instead, and `playerDisplayName` below no longer ends at "Telegram <id>".
 */
export const adminPlayerSchema = z.looseObject({
  id: z.string(),
  telegramUserId: z.string().nullable(),
  telegramUsername: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  languageCode: z.string().nullable(),
  status: playerStatusSchema,
  source: playerSourceSchema,
  currencyCode: z.string(),
  ichancyLinked: z.boolean(),
  createdAt: isoDateTime,
  lastSeenAt: isoDateTime.nullable(),
  // Present on the admin views; the player's own view omits them.
  ichancyPlayerId: z.string().nullable().optional(),
  ichancyLogin: z.string().nullable().optional(),
  ichancyRegisteredAt: isoDateTime.nullable().optional(),
  phone: z.string().nullable().optional(),
  /** All three set together while `status` is BLOCKED, and all three null otherwise. */
  blockedAt: isoDateTime.nullable(),
  blockedReason: z.string().nullable(),
  blockedByAdminId: z.string().nullable(),
});
export type AdminPlayer = z.infer<typeof adminPlayerSchema>;

/** The operator's own lock — see `PLAYER_STATUSES`. */
export function isPlayerBlocked(player: Pick<AdminPlayer, 'status'>): boolean {
  return player.status === 'BLOCKED';
}

/** An "old player": one that existed under the Ichancy agent before the bot did. */
export function isImportedPlayer(player: Pick<AdminPlayer, 'source'>): boolean {
  return player.source === 'ICHANCY_IMPORT';
}

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
  /** `ICHANCY_IMPORT` is the "old players" view. */
  source?: PlayerSource;
  /** `true` narrows to BLOCKED rows; `false` hides them. Absent means no opinion. */
  blocked?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * `firstName lastName`, then the @username, then the Telegram id, then the Ichancy login.
 *
 * The last fallback exists for imported rows: an account pulled in from the Ichancy agent has no
 * name and no Telegram, and its login is the only handle the operator knows it by. The id-slice at
 * the very end is for a row with nothing at all, which the backend can produce and a screen must
 * still be able to name.
 */
export function playerDisplayName(player: AdminPlayer): string {
  const name = [player.firstName, player.lastName].filter(Boolean).join(' ').trim();
  if (name.length > 0) return name;
  if (player.telegramUsername != null && player.telegramUsername.length > 0) {
    return `@${player.telegramUsername}`;
  }
  if (player.telegramUserId !== null) return `Telegram ${player.telegramUserId}`;
  if (player.ichancyLogin != null && player.ichancyLogin.length > 0) return player.ichancyLogin;
  return `Player ${player.id.slice(0, 8)}`;
}

// ── Registering, blocking and attaching ──────────────────────────────────────────────────────────

/**
 * `POST /v1/admin/players` — a row registered from this console rather than by a Telegram Start.
 *
 * Every field is optional in the STRICT sense: an omitted one must be absent from the JSON, never
 * sent as `""`. `createIchancyAccount` asks the server to link the new row on the way out, which is
 * an Ichancy call it reports separately — see `registerPlayerResultSchema`.
 */
export interface RegisterPlayerBody {
  telegramUserId?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  createIchancyAccount?: boolean;
}

/**
 * What registering answers. The row is created inside a transaction; the Ichancy link happens AFTER
 * it (an outside call is never made inside one), so it can fail on its own — and when it does the
 * player still exists, `ichancy` is null and `ichancyError` says why. A dialog must read all three:
 * a null `ichancy` with a null error means nobody asked for an account.
 */
export const registerPlayerResultSchema = z.looseObject({
  player: adminPlayerSchema,
  ichancy: ichancyAccountSchema.nullable(),
  ichancyError: z.string().nullable(),
});
export type RegisterPlayerResult = z.infer<typeof registerPlayerResultSchema>;

/** The backend's own limit on a block reason — the same 1..280 every reason field carries. */
export const BLOCK_REASON_MAX_LENGTH = 280;

/** `POST /v1/admin/players/:id/block`. Unblocking takes no body. */
export interface BlockPlayerBody {
  reason: string;
}

/**
 * `PATCH /v1/admin/players/:id/telegram` — gives an imported or admin-registered row the Telegram id
 * it was missing. A Telegram id is a 64-bit number and travels as a decimal string.
 */
export interface AttachTelegramBody {
  telegramUserId: string;
}

/**
 * `POST /v1/admin/players/import` and `POST /v1/admin/tenants/:id/import-players`.
 *
 * `error` is a string rather than a thrown failure on purpose: an Ichancy outage halfway through a
 * page leaves the rows already written in place, and the summary reports how far it got beside what
 * stopped it. `created` counts new rows; `existing` the ones already known by Ichancy id or login.
 */
export const playerImportSummarySchema = z.looseObject({
  scanned: z.number(),
  created: z.number(),
  existing: z.number(),
  error: z.string().nullable(),
  startedAt: isoDateTime,
  finishedAt: isoDateTime,
});
export type PlayerImportSummary = z.infer<typeof playerImportSummarySchema>;

/** `POST /v1/admin/players/import`. `limit` caps how many agent rows one run scans. */
export interface ImportPlayersBody {
  limit?: number;
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
