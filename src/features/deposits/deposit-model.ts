import type { DepositSearch } from '@/app/search-schemas';
import { toDate } from '@/lib/format';
import { parseDecimalToMinor } from '@/lib/money';
import type { AdminDeposit, DepositQueueQuery } from '@/types';
import {
  ATTENTION_DEPOSIT_STATUSES,
  REVIEWABLE_DEPOSIT_STATUSES,
  type DepositStatus,
} from '@/types/enums';

/**
 * The rules the three deposit surfaces share.
 *
 * The queue, the review panel and the action bar all have to agree on who holds a deposit and what
 * may still be done to it. When that lived in each component they drifted, and a drifted answer
 * here is a deposit paid twice — so it lives once, in plain functions that a test can pin down.
 */

export type ClaimState = 'unclaimed' | 'you' | 'other';

/** A claim is `reviewStartedAt` plus the admin who took it; the backend keeps both on the row. */
export function claimStateOf(
  deposit: AdminDeposit,
  adminId: string | null | undefined,
): ClaimState {
  if (deposit.reviewStartedAt === null) return 'unclaimed';
  if (adminId != null && adminId.length > 0 && deposit.decidedByAdminId === adminId) return 'you';
  return 'other';
}

/** Mirrors the backend's DECIDABLE set: everything else has already been answered. */
export function isDecidable(status: DepositStatus): boolean {
  return REVIEWABLE_DEPOSIT_STATUSES.includes(status);
}

/** Only a credit that actually failed can be retried; re-crediting a CREDITED deposit pays twice. */
export function isRetryable(status: DepositStatus): boolean {
  return ATTENTION_DEPOSIT_STATUSES.includes(status);
}

export function sameStatusSet(
  a: readonly DepositStatus[] | undefined,
  b: readonly DepositStatus[],
): boolean {
  if (a === undefined) return false;
  return a.length === b.length && b.every((status) => a.includes(status));
}

const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The URL carries the plain `YYYY-MM-DD` a date input produces; the API wants an instant.
 *
 * The boundary is the reviewer's local midnight rather than UTC's, because "everything up to the
 * 21st" has to mean their 21st — in Damascus a UTC end-of-day would quietly include three hours of
 * the next morning.
 */
export function toIsoBoundary(value: string, endOfDay: boolean): string | undefined {
  const parsed = DAY_ONLY.test(value)
    ? new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}`)
    : toDate(value);
  if (parsed === null || Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

/** What an `<input type="date">` can hold, from whatever a shared link happens to carry. */
export function toDayInput(value: string | undefined): string {
  if (value === undefined) return '';
  if (DAY_ONLY.test(value)) return value;
  const parsed = toDate(value);
  if (parsed === null) return '';
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${parsed.getFullYear()}-${month}-${day}`;
}

/**
 * Amounts stay strings all the way to the query string; this only proves they are amounts.
 *
 * It answers yes or no rather than handing back a sentence: the sentence is different in Arabic, and
 * a module evaluated once at import time cannot know which language the reviewer is reading.
 */
export function isPlainAmount(value: string): boolean {
  if (value.trim().length === 0) return true;
  try {
    parseDecimalToMinor(value.trim());
    return true;
  } catch {
    return false;
  }
}

/**
 * The URL filters, as the queue endpoint's query.
 *
 * Keys are spread conditionally rather than set to `undefined`: the client drops undefined values,
 * but `exactOptionalPropertyTypes` will not let one be written in the first place.
 */
export function toQueueQuery(search: DepositSearch): DepositQueueQuery {
  const createdFrom =
    search.createdFrom === undefined ? undefined : toIsoBoundary(search.createdFrom, false);
  const createdTo =
    search.createdTo === undefined ? undefined : toIsoBoundary(search.createdTo, true);

  return {
    status: search.status ?? [...REVIEWABLE_DEPOSIT_STATUSES],
    ...(search.sort === undefined ? {} : { sort: search.sort }),
    ...(search.shortId === undefined ? {} : { shortId: search.shortId }),
    ...(search.playerId === undefined ? {} : { playerId: search.playerId }),
    ...(search.paymentMethodId === undefined ? {} : { paymentMethodId: search.paymentMethodId }),
    ...(search.externalReference === undefined
      ? {}
      : { externalReference: search.externalReference }),
    ...(createdFrom === undefined ? {} : { createdFrom }),
    ...(createdTo === undefined ? {} : { createdTo }),
    ...(search.minAmount === undefined ? {} : { minAmount: search.minAmount }),
    ...(search.maxAmount === undefined ? {} : { maxAmount: search.maxAmount }),
    ...(search.unclaimedOnly === true ? { unclaimedOnly: true } : {}),
    ...(search.limit === undefined ? {} : { limit: search.limit }),
  };
}

/** Whether anything is narrowing the queue — drives the "Clear filters" affordance. */
export function hasActiveFilters(search: DepositSearch): boolean {
  return (
    search.status !== undefined ||
    search.sort !== undefined ||
    search.shortId !== undefined ||
    search.externalReference !== undefined ||
    search.playerId !== undefined ||
    search.paymentMethodId !== undefined ||
    search.createdFrom !== undefined ||
    search.createdTo !== undefined ||
    search.minAmount !== undefined ||
    search.maxAmount !== undefined ||
    search.unclaimedOnly === true
  );
}

/** The filters that live behind the "More filters" disclosure, so a shared link opens it. */
export function hasAdvancedFilters(search: DepositSearch): boolean {
  return (
    search.status !== undefined ||
    search.createdFrom !== undefined ||
    search.createdTo !== undefined ||
    search.minAmount !== undefined ||
    search.maxAmount !== undefined
  );
}
