import { ATTENTION_DEPOSIT_STATUSES, REVIEWABLE_DEPOSIT_STATUSES } from '@/types/enums';
import type {
  BreakListQuery,
  DepositQueueQuery,
  ReconciliationBreak,
  WithdrawalListQuery,
} from '@/types';

/**
 * The queries and thresholds the overview is assembled from.
 *
 * They live here rather than inside the components because of one awkward fact about the contract:
 * the deposit queue and the break list are cursor paginated and send no total. Every number on this
 * screen is therefore a count of the rows that were actually loaded, and the sample size and the
 * queries themselves have to stay in step — the wording that admits it is a message key, and takes
 * the limit from here so the two cannot disagree. Two components sharing one query object also
 * means React Query serves one request for the tile and the panel under it.
 */

/** How many rows a tile loads to count. Exactly one page — nothing here ever pages further. */
export const COUNT_SAMPLE_LIMIT = 20;

/** How many rows each panel shows. A shift starts by working the top of a list, not all of it. */
export const PANEL_ROWS = 5;

/** Past this, a deposit has been waiting long enough that the wait is itself worth reading. */
export const LATE_WAIT_MINUTES = 15;

export const WAITING_QUERY: DepositQueueQuery = {
  status: ['SUBMITTED'],
  limit: COUNT_SAMPLE_LIMIT,
};

export const UNCLAIMED_QUERY: DepositQueueQuery = {
  status: ['SUBMITTED'],
  unclaimedOnly: true,
  limit: COUNT_SAMPLE_LIMIT,
};

export const SECOND_APPROVAL_QUERY: DepositQueueQuery = {
  status: ['PENDING_SECOND_APPROVAL'],
  limit: COUNT_SAMPLE_LIMIT,
};

export const STUCK_MONEY_QUERY: DepositQueueQuery = {
  status: [...ATTENTION_DEPOSIT_STATUSES],
  limit: COUNT_SAMPLE_LIMIT,
};

export const OLDEST_WAITING_QUERY: DepositQueueQuery = {
  status: [...REVIEWABLE_DEPOSIT_STATUSES],
  sort: 'oldest',
  limit: PANEL_ROWS,
};

/** The backend's own default for the break list, spelled out so the tile and the panel share it. */
export const OPEN_BREAKS_QUERY: BreakListQuery = {
  status: ['OPEN', 'INVESTIGATING'],
  limit: COUNT_SAMPLE_LIMIT,
};

/**
 * Cash-outs a person owes something to: waiting for a decision, or debited and not yet paid.
 *
 * The withdrawal list is offset paginated and sends a real `total`, so this tile is the one on the
 * row that counts exactly — and it asks for a single row, because the total is all it reads.
 */
export const WITHDRAWALS_WAITING_QUERY: WithdrawalListQuery = {
  status: ['REQUESTED', 'DEBITED'],
  limit: 1,
};

/** `20+` when there is another page behind the cursor, the exact number when there is not. */
export function sampleCountLabel(loaded: number, hasMore: boolean): string {
  return hasMore ? `${loaded}+` : String(loaded);
}

/**
 * When a deposit started waiting for a human. `submittedAt` is the honest answer; `createdAt` is
 * the fallback for a row the backend has not stamped, which would otherwise show no wait at all.
 */
export function waitingSince(deposit: { submittedAt: string | null; createdAt: string }): string {
  return deposit.submittedAt ?? deposit.createdAt;
}

/** Worst first, then oldest first — the order somebody would actually work them in. */
export function bySeverityThenAge(a: ReconciliationBreak, b: ReconciliationBreak): number {
  if (a.severity !== b.severity) return b.severity - a.severity;
  return Date.parse(a.detectedAt) - Date.parse(b.detectedAt);
}
