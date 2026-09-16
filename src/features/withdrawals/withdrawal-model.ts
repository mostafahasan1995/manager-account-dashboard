import type { WithdrawalSearch } from '@/app/search-schemas';
import { toDayInput, toIsoBoundary } from '@/features/deposits/deposit-model';
import { formatMinorToDecimal, minorFromString } from '@/lib/money';
import type { AdminWithdrawal, MoneyView, WalletCheck, WithdrawalListQuery } from '@/types';
import { isWithdrawalOpen, withdrawalNeedsAttention } from '@/types/withdrawal';
import {
  ATTENTION_WITHDRAWAL_STATUSES,
  OPEN_WITHDRAWAL_STATUSES,
  WITHDRAWAL_STATUSES,
  type WithdrawalStatus,
} from '@/types/enums';

/**
 * The rules the withdrawal queue, its detail panel and its three dialogs share.
 *
 * Same shape as `deposit-model.ts`, for the same reason: when "what may still be done to this row"
 * lived in each component they drifted, and a drifted answer here is a player paid twice or a
 * player charged and never paid. Plain functions, pinned by tests.
 */

export { toDayInput, toIsoBoundary };

/** One page of the queue. Twenty is what fits on a cashier's screen without scrolling. */
export const DEFAULT_LIMIT = 20;

/** The view the queue opens on when the URL says nothing: everything still moving. */
export const DEFAULT_STATUSES: readonly WithdrawalStatus[] = OPEN_WITHDRAWAL_STATUSES;

export function sameStatusSet(
  a: readonly WithdrawalStatus[] | undefined,
  b: readonly WithdrawalStatus[],
): boolean {
  if (a === undefined) return false;
  return a.length === b.length && b.every((status) => a.includes(status));
}

/**
 * The URL filters, as the list endpoint's query.
 *
 * Keys are spread conditionally rather than set to `undefined`: the client drops undefined values,
 * but `exactOptionalPropertyTypes` will not let one be written in the first place. The absent
 * status filter becomes the OPEN set explicitly, because the backend's own absent-means-everything
 * default would open the queue on months of paid rows.
 */
export function toListQuery(search: WithdrawalSearch): WithdrawalListQuery {
  const createdFrom =
    search.createdFrom === undefined ? undefined : toIsoBoundary(search.createdFrom, false);
  const createdTo =
    search.createdTo === undefined ? undefined : toIsoBoundary(search.createdTo, true);

  return {
    status: search.status ?? [...DEFAULT_STATUSES],
    limit: search.limit ?? DEFAULT_LIMIT,
    offset: search.offset ?? 0,
    ...(search.sort === undefined ? {} : { sort: search.sort }),
    ...(search.shortId === undefined ? {} : { shortId: search.shortId }),
    ...(search.playerId === undefined ? {} : { playerId: search.playerId }),
    ...(createdFrom === undefined ? {} : { createdFrom }),
    ...(createdTo === undefined ? {} : { createdTo }),
  };
}

/** Whether anything is narrowing the queue — drives the "Clear filters" affordance. */
export function hasActiveFilters(search: WithdrawalSearch): boolean {
  return (
    search.status !== undefined ||
    search.sort !== undefined ||
    search.shortId !== undefined ||
    search.playerId !== undefined ||
    search.createdFrom !== undefined ||
    search.createdTo !== undefined
  );
}

/** The filters that live behind the "More filters" disclosure, so a shared link opens it. */
export function hasAdvancedFilters(search: WithdrawalSearch): boolean {
  return (
    search.status !== undefined ||
    search.createdFrom !== undefined ||
    search.createdTo !== undefined ||
    search.playerId !== undefined
  );
}

/**
 * Whether the queue should keep polling.
 *
 * "While open items exist" is read generously: a page that holds an open row polls so its status
 * moves under the reader, and a view that is LOOKING for open rows polls too, because the arrival
 * of the next request is exactly what somebody watching an empty open queue is waiting for. A view
 * of paid or rejected rows changes only when a person acts, and that already invalidates it.
 */
export function shouldPoll(
  rows: readonly Pick<AdminWithdrawal, 'status'>[],
  statuses: readonly WithdrawalStatus[] | undefined,
): boolean {
  if (rows.some((row) => isWithdrawalOpen(row.status))) return true;
  return (statuses ?? DEFAULT_STATUSES).some((status) => isWithdrawalOpen(status));
}

export const ALL_STATUSES: readonly WithdrawalStatus[] = WITHDRAWAL_STATUSES;
export const READY_TO_PAY_STATUSES: readonly WithdrawalStatus[] = ['DEBITED'];
export const ATTENTION_STATUSES: readonly WithdrawalStatus[] = ATTENTION_WITHDRAWAL_STATUSES;

// ── The player, in one line ────────────────────────────────────────────────────────────────────

export type PlayerHandle =
  | { kind: 'username'; value: string }
  | { kind: 'telegramId'; value: string }
  | { kind: 'login'; value: string }
  | { kind: 'none' };

/**
 * What to call the player on a row: the Telegram handle when there is one, the Telegram id when
 * there is not, the Ichancy login for an imported account that has neither. Falls all the way to
 * "none" rather than to the uuid — the uuid is a link target, not a name.
 */
export function playerHandle(
  withdrawal: Pick<
    AdminWithdrawal,
    'playerTelegramUsername' | 'playerTelegramUserId' | 'playerIchancyLogin'
  >,
): PlayerHandle {
  if (withdrawal.playerTelegramUsername !== null) {
    return { kind: 'username', value: `@${withdrawal.playerTelegramUsername}` };
  }
  if (withdrawal.playerTelegramUserId !== null) {
    return { kind: 'telegramId', value: withdrawal.playerTelegramUserId };
  }
  if (withdrawal.playerIchancyLogin !== null) {
    return { kind: 'login', value: withdrawal.playerIchancyLogin };
  }
  return { kind: 'none' };
}

// ── The payout wallet ──────────────────────────────────────────────────────────────────────────

/**
 * `availableMinor` is in the wallet's OWN asset, and the check carries no scale of its own.
 *
 * USDT on a chain rail is six decimals; everything else this console pays out of — a Sham Cash
 * balance, a bank float — is the two the money helpers default to. Hand `12500000000` to the
 * default scale and the screen says the wallet holds 125,000,000.00, ten thousand times the truth,
 * on the figure a person is about to send somebody's money against. So the scale is looked up by
 * asset here, in one place, and an asset this table does not know falls back to two rather than
 * to a guess dressed up as a number.
 */
const WALLET_ASSET_SCALES: Readonly<Record<string, number>> = { USDT: 6, USDC: 6 };

/** The wallet's balance as money, or null when it did not answer — never a zero. */
export function walletAvailableAsMoney(check: WalletCheck | null): MoneyView | null {
  if (check?.availableMinor == null) return null;
  const currency = check.currency ?? '';
  try {
    const minor = minorFromString(check.availableMinor);
    return {
      minor: check.availableMinor,
      amount: formatMinorToDecimal(minor, WALLET_ASSET_SCALES[currency]),
      currency,
    };
  } catch {
    return null;
  }
}

// ── The timeline ───────────────────────────────────────────────────────────────────────────────

export type TimelineStepKey = 'requested' | 'decided' | 'debited' | 'paid';

export type TimelineStepState = 'done' | 'current' | 'pending' | 'skipped' | 'failed';

export interface TimelineStep {
  key: TimelineStepKey;
  state: TimelineStepState;
  /** When the step happened, when it did. */
  at: string | null;
  /** Which sentence describes the step in THIS row's story — a message key suffix. */
  detail:
    | 'requested'
    | 'awaitingDecision'
    | 'approvedByAdmin'
    | 'approvedByPlatform'
    | 'rejected'
    | 'cancelled'
    | 'debitQueued'
    | 'debiting'
    | 'debited'
    | 'debitFailed'
    | 'needsReconciliation'
    | 'notReached'
    | 'awaitingPayout'
    | 'paid';
}

/**
 * The four movements of a cash-out, each marked with what became of it on this row.
 *
 * A row that ended without money (rejected, cancelled, debit refused) still lists the later steps,
 * marked "not reached", because a timeline that shrinks as things go wrong hides exactly the part
 * a person reading a complaint needs to see was never done.
 */
export function timelineOf(withdrawal: AdminWithdrawal): TimelineStep[] {
  const { status } = withdrawal;

  const requested: TimelineStep = {
    key: 'requested',
    state: 'done',
    at: withdrawal.requestedAt,
    detail: 'requested',
  };

  const decided: TimelineStep =
    status === 'REQUESTED'
      ? { key: 'decided', state: 'current', at: null, detail: 'awaitingDecision' }
      : status === 'REJECTED'
        ? { key: 'decided', state: 'failed', at: withdrawal.decidedAt, detail: 'rejected' }
        : status === 'CANCELLED'
          ? { key: 'decided', state: 'skipped', at: withdrawal.closedAt, detail: 'cancelled' }
          : {
              key: 'decided',
              state: 'done',
              at: withdrawal.decidedAt,
              detail:
                withdrawal.decidedByAdminId === null ? 'approvedByPlatform' : 'approvedByAdmin',
            };

  const debited: TimelineStep =
    status === 'REQUESTED' || status === 'REJECTED' || status === 'CANCELLED'
      ? {
          key: 'debited',
          state: status === 'REQUESTED' ? 'pending' : 'skipped',
          at: null,
          detail: 'notReached',
        }
      : status === 'APPROVED'
        ? { key: 'debited', state: 'current', at: null, detail: 'debitQueued' }
        : status === 'DEBITING'
          ? { key: 'debited', state: 'current', at: null, detail: 'debiting' }
          : status === 'DEBIT_FAILED'
            ? { key: 'debited', state: 'failed', at: withdrawal.closedAt, detail: 'debitFailed' }
            : status === 'NEEDS_RECONCILIATION'
              ? { key: 'debited', state: 'failed', at: null, detail: 'needsReconciliation' }
              : { key: 'debited', state: 'done', at: withdrawal.debitedAt, detail: 'debited' };

  const paid: TimelineStep =
    status === 'PAID'
      ? { key: 'paid', state: 'done', at: withdrawal.paidAt, detail: 'paid' }
      : status === 'DEBITED'
        ? { key: 'paid', state: 'current', at: null, detail: 'awaitingPayout' }
        : {
            key: 'paid',
            state: isWithdrawalOpen(status) ? 'pending' : 'skipped',
            at: null,
            detail: 'notReached',
          };

  return [requested, decided, debited, paid];
}

/** The worker owns it: nothing a person can do until it lands. */
export function isInFlight(status: WithdrawalStatus): boolean {
  return status === 'APPROVED' || status === 'DEBITING';
}

export { isWithdrawalOpen, withdrawalNeedsAttention };
