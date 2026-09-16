import { describe, expect, it } from 'vitest';

import type { DepositSearch } from '@/app/search-schemas';
import { DEPOSIT_IDS, mockDeposits } from '@/mocks/fixtures';
import type { AdminDeposit } from '@/types';

import {
  claimStateOf,
  hasActiveFilters,
  hasAdvancedFilters,
  isDecidable,
  isPlainAmount,
  isRetryable,
  sameStatusSet,
  toDayInput,
  toIsoBoundary,
  toQueueQuery,
} from './deposit-model';

const deposit = (id: string): AdminDeposit => {
  const found = mockDeposits.find((row) => row.id === id);
  if (found === undefined) throw new Error(`fixture ${id} is missing`);
  return found;
};

const ME = 'aaaaaaaa-0000-4000-8000-000000000001';

/** `status` is a required key on the search type even when it holds nothing; spell it out once. */
const search = (patch: Partial<DepositSearch> = {}): DepositSearch => ({
  status: undefined,
  ...patch,
});

describe('claimStateOf', () => {
  it('reads an untouched deposit as unclaimed', () => {
    expect(claimStateOf(deposit(DEPOSIT_IDS.awaitingReview), ME)).toBe('unclaimed');
  });

  it('recognises the signed-in admin holding the claim', () => {
    const mine = {
      ...deposit(DEPOSIT_IDS.awaitingReview),
      reviewStartedAt: '2026-08-21T09:00:00Z',
      decidedByAdminId: ME,
    };
    expect(claimStateOf(mine, ME)).toBe('you');
  });

  it('treats a claim held by anyone else as someone else, including when nobody is signed in', () => {
    expect(claimStateOf(deposit(DEPOSIT_IDS.claimedByOther), ME)).toBe('other');
    expect(claimStateOf(deposit(DEPOSIT_IDS.claimedByOther), null)).toBe('other');
    expect(claimStateOf(deposit(DEPOSIT_IDS.claimedByOther), '')).toBe('other');
  });
});

describe('what may still be done to a deposit', () => {
  it('lets the three reviewable statuses be decided and nothing else', () => {
    expect(isDecidable('SUBMITTED')).toBe(true);
    expect(isDecidable('UNDER_REVIEW')).toBe(true);
    expect(isDecidable('PENDING_SECOND_APPROVAL')).toBe(true);
    expect(isDecidable('CREDITED')).toBe(false);
    expect(isDecidable('REJECTED')).toBe(false);
  });

  it('only offers a retry where a credit actually failed', () => {
    expect(isRetryable('CREDIT_FAILED')).toBe(true);
    expect(isRetryable('NEEDS_RECONCILIATION')).toBe(true);
    // Retrying a credited deposit would pay the player twice.
    expect(isRetryable('CREDITED')).toBe(false);
    expect(isRetryable('SUBMITTED')).toBe(false);
  });
});

describe('sameStatusSet', () => {
  it('ignores order but not membership', () => {
    expect(sameStatusSet(['UNDER_REVIEW', 'SUBMITTED'], ['SUBMITTED', 'UNDER_REVIEW'])).toBe(true);
    expect(sameStatusSet(['SUBMITTED'], ['SUBMITTED', 'UNDER_REVIEW'])).toBe(false);
    expect(sameStatusSet(undefined, ['SUBMITTED'])).toBe(false);
  });
});

describe('date boundaries', () => {
  it('turns a day into local midnight and local end of day', () => {
    const from = toIsoBoundary('2026-08-21', false);
    const to = toIsoBoundary('2026-08-21', true);
    expect(from).toBeDefined();
    expect(to).toBeDefined();
    expect(new Date(from ?? '').getHours()).toBe(0);
    expect(new Date(to ?? '').getHours()).toBe(23);
    expect(new Date(to ?? '').getMinutes()).toBe(59);
  });

  it('passes a full instant through untouched', () => {
    const iso = '2026-08-21T09:30:00.000Z';
    expect(toIsoBoundary(iso, false)).toBe(iso);
  });

  it('drops a value it cannot read rather than sending nonsense to the API', () => {
    expect(toIsoBoundary('not a date', false)).toBeUndefined();
  });

  it('gives a date input something it can hold', () => {
    expect(toDayInput(undefined)).toBe('');
    expect(toDayInput('2026-08-21')).toBe('2026-08-21');
    expect(toDayInput('nonsense')).toBe('');
    expect(toDayInput(new Date(2026, 7, 21, 15, 0).toISOString())).toBe('2026-08-21');
  });
});

describe('isPlainAmount', () => {
  it('accepts a plain amount and an empty field', () => {
    expect(isPlainAmount('1500.00')).toBe(true);
    expect(isPlainAmount('  ')).toBe(true);
  });

  it('rejects anything that is not a plain decimal', () => {
    expect(isPlainAmount('1,500.00')).toBe(false);
    expect(isPlainAmount('1e3')).toBe(false);
    expect(isPlainAmount('1500.0000')).toBe(false);
  });
});

describe('toQueueQuery', () => {
  it('defaults to the reviewable statuses and sends nothing else', () => {
    const query = toQueueQuery(search());
    expect(query.status).toEqual(['SUBMITTED', 'UNDER_REVIEW', 'PENDING_SECOND_APPROVAL']);
    expect(Object.keys(query)).toEqual(['status']);
  });

  it('carries every filter through, converting the day range to instants', () => {
    const filters: DepositSearch = {
      status: ['CREDIT_FAILED'],
      sort: 'amount_desc',
      shortId: 'K7QP42',
      playerId: 'player-1',
      paymentMethodId: 'method-1',
      externalReference: '884512309',
      createdFrom: '2026-08-20',
      createdTo: '2026-08-21',
      minAmount: '1500.00',
      maxAmount: '90000.00',
      unclaimedOnly: true,
      limit: 50,
      selected: 'deposit-1',
    };

    const query = toQueueQuery(filters);
    expect(query.status).toEqual(['CREDIT_FAILED']);
    expect(query.sort).toBe('amount_desc');
    expect(query.shortId).toBe('K7QP42');
    expect(query.playerId).toBe('player-1');
    expect(query.paymentMethodId).toBe('method-1');
    expect(query.externalReference).toBe('884512309');
    expect(query.minAmount).toBe('1500.00');
    expect(query.maxAmount).toBe('90000.00');
    expect(query.unclaimedOnly).toBe(true);
    expect(query.limit).toBe(50);
    expect(new Date(query.createdFrom ?? '').getDate()).toBe(20);
    expect(new Date(query.createdTo ?? '').getDate()).toBe(21);
    // `selected` is which panel is open, not a filter — it must never reach the queue endpoint.
    expect('selected' in query).toBe(false);
  });

  it('leaves unclaimedOnly out when it is off', () => {
    expect('unclaimedOnly' in toQueueQuery(search({ unclaimedOnly: false }))).toBe(false);
  });
});

describe('filter awareness', () => {
  it('does not call a bare queue filtered', () => {
    expect(hasActiveFilters(search())).toBe(false);
    expect(hasActiveFilters(search({ selected: 'deposit-1' }))).toBe(false);
    expect(hasAdvancedFilters(search({ shortId: 'K7QP42' }))).toBe(false);
  });

  it('notices each kind of filter', () => {
    expect(hasActiveFilters(search({ shortId: 'K7QP42' }))).toBe(true);
    expect(hasActiveFilters(search({ unclaimedOnly: true }))).toBe(true);
    expect(hasActiveFilters(search({ sort: 'oldest' }))).toBe(true);
    expect(hasActiveFilters(search({ externalReference: '884' }))).toBe(true);
    expect(hasActiveFilters(search({ playerId: 'p' }))).toBe(true);
    expect(hasActiveFilters(search({ paymentMethodId: 'm' }))).toBe(true);
    expect(hasAdvancedFilters(search({ status: ['CREDIT_FAILED'] }))).toBe(true);
    expect(hasAdvancedFilters(search({ minAmount: '10.00' }))).toBe(true);
    expect(hasAdvancedFilters(search({ maxAmount: '10.00' }))).toBe(true);
    expect(hasAdvancedFilters(search({ createdFrom: '2026-08-20' }))).toBe(true);
    expect(hasAdvancedFilters(search({ createdTo: '2026-08-21' }))).toBe(true);
  });
});
