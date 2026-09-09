import { describe, expect, it } from 'vitest';

import { withdrawalSearchSchema } from '@/app/search-schemas';
import { WITHDRAWAL_IDS, mockWithdrawals } from '@/mocks/fixtures';
import type { AdminWithdrawal } from '@/types';
import { OPEN_WITHDRAWAL_STATUSES, WITHDRAWAL_STATUSES } from '@/types/enums';

import {
  DEFAULT_LIMIT,
  hasActiveFilters,
  hasAdvancedFilters,
  isInFlight,
  playerHandle,
  sameStatusSet,
  shouldPoll,
  timelineOf,
  toListQuery,
  walletAvailableAsMoney,
} from './withdrawal-model';

const fixture = (id: string): AdminWithdrawal => {
  const found = mockWithdrawals.find((row) => row.id === id);
  if (found === undefined) throw new Error(`fixture ${id} is missing`);
  return structuredClone(found);
};

const parse = (search: Record<string, unknown>) => withdrawalSearchSchema.parse(search);

describe('toListQuery', () => {
  it('opens on the open queue with the first page, and sends nothing it was not given', () => {
    expect(toListQuery(parse({}))).toEqual({
      status: [...OPEN_WITHDRAWAL_STATUSES],
      limit: DEFAULT_LIMIT,
      offset: 0,
    });
  });

  it('passes every filter through, and turns the day inputs into local-midnight instants', () => {
    const query = toListQuery(
      parse({
        status: 'PAID,REJECTED',
        playerId: 'p-1',
        shortId: 'wd7',
        sort: 'oldest',
        limit: 5,
        offset: 10,
        createdFrom: '2026-09-01',
        createdTo: '2026-09-03',
      }),
    );

    expect(query).toMatchObject({
      status: ['PAID', 'REJECTED'],
      playerId: 'p-1',
      shortId: 'wd7',
      sort: 'oldest',
      limit: 5,
      offset: 10,
    });
    expect(query.createdFrom).toBe(new Date('2026-09-01T00:00:00').toISOString());
    expect(query.createdTo).toBe(new Date('2026-09-03T23:59:59.999').toISOString());
  });

  it('drops a date it cannot read rather than sending garbage', () => {
    const query = toListQuery(parse({ createdFrom: 'yesterday' }));
    expect('createdFrom' in query).toBe(false);
  });
});

describe('the filter predicates', () => {
  it('sees no active filter on a bare URL, and one on any narrowing', () => {
    expect(hasActiveFilters(parse({}))).toBe(false);
    expect(hasActiveFilters(parse({ offset: 20 }))).toBe(false);
    expect(hasActiveFilters(parse({ sort: 'oldest' }))).toBe(true);
    expect(hasActiveFilters(parse({ shortId: 'x' }))).toBe(true);
  });

  it('opens the disclosure only for the filters that live behind it', () => {
    expect(hasAdvancedFilters(parse({ shortId: 'x', sort: 'oldest' }))).toBe(false);
    expect(hasAdvancedFilters(parse({ playerId: 'p' }))).toBe(true);
    expect(hasAdvancedFilters(parse({ status: 'PAID' }))).toBe(true);
    expect(hasAdvancedFilters(parse({ createdTo: '2026-09-01' }))).toBe(true);
  });

  it('compares status sets regardless of order, and never matches an absent one', () => {
    expect(sameStatusSet(['PAID', 'REJECTED'], ['REJECTED', 'PAID'])).toBe(true);
    expect(sameStatusSet(['PAID'], ['REJECTED', 'PAID'])).toBe(false);
    expect(sameStatusSet(undefined, [])).toBe(false);
  });
});

describe('shouldPoll', () => {
  it('polls while a loaded row is still moving', () => {
    expect(shouldPoll([{ status: 'DEBITED' }], ['PAID', 'DEBITED'])).toBe(true);
  });

  it('polls an empty open queue, because the next request is what it is waiting for', () => {
    expect(shouldPoll([], undefined)).toBe(true);
    expect(shouldPoll([], ['REQUESTED'])).toBe(true);
  });

  it('stops polling a view of rows nothing will move on its own', () => {
    expect(shouldPoll([{ status: 'PAID' }], ['PAID', 'REJECTED'])).toBe(false);
  });
});

describe('playerHandle', () => {
  it('prefers the Telegram handle, then the id, then the Ichancy login', () => {
    expect(
      playerHandle({
        playerTelegramUsername: 'karim',
        playerTelegramUserId: '1',
        playerIchancyLogin: 'k',
      }),
    ).toEqual({ kind: 'username', value: '@karim' });
    expect(
      playerHandle({
        playerTelegramUsername: null,
        playerTelegramUserId: '512',
        playerIchancyLogin: 'k',
      }),
    ).toEqual({ kind: 'telegramId', value: '512' });
    expect(
      playerHandle({
        playerTelegramUsername: null,
        playerTelegramUserId: null,
        playerIchancyLogin: 'samer1987',
      }),
    ).toEqual({ kind: 'login', value: 'samer1987' });
    expect(
      playerHandle({
        playerTelegramUsername: null,
        playerTelegramUserId: null,
        playerIchancyLogin: null,
      }),
    ).toEqual({ kind: 'none' });
  });
});

describe('walletAvailableAsMoney', () => {
  it('reads USDT at six decimals, not two', () => {
    expect(
      walletAvailableAsMoney({
        status: 'ok',
        availableMinor: '12500000000',
        currency: 'USDT',
        checkedAt: '2026-09-04T10:00:00.000Z',
      }),
    ).toEqual({ minor: '12500000000', amount: '12500.000000', currency: 'USDT' });
  });

  it('reads every other asset at the console default', () => {
    expect(
      walletAvailableAsMoney({
        status: 'ok',
        availableMinor: '25000000',
        currency: 'SYP',
        checkedAt: '2026-09-04T10:00:00.000Z',
      }),
    ).toEqual({ minor: '25000000', amount: '250000.00', currency: 'SYP' });
  });

  it('is null — never zero — for a wallet that did not answer, and for one nobody checked', () => {
    expect(walletAvailableAsMoney(null)).toBeNull();
    expect(
      walletAvailableAsMoney({
        status: 'unknown',
        availableMinor: null,
        currency: null,
        checkedAt: '2026-09-04T10:00:00.000Z',
      }),
    ).toBeNull();
  });

  it('is null for minor units it cannot parse rather than a guess', () => {
    expect(
      walletAvailableAsMoney({
        status: 'ok',
        availableMinor: 'lots',
        currency: 'USDT',
        checkedAt: '2026-09-04T10:00:00.000Z',
      }),
    ).toBeNull();
  });
});

describe('timelineOf', () => {
  const states = (row: AdminWithdrawal) => timelineOf(row).map((step) => step.state);
  const details = (row: AdminWithdrawal) => timelineOf(row).map((step) => step.detail);

  it('waits at the decision for a REQUESTED row', () => {
    const row = fixture(WITHDRAWAL_IDS.requested);
    expect(states(row)).toEqual(['done', 'current', 'pending', 'pending']);
    expect(details(row)).toEqual(['requested', 'awaitingDecision', 'notReached', 'notReached']);
  });

  it('credits the platform for an AUTO approval and shows the debit queued', () => {
    const row = fixture(WITHDRAWAL_IDS.approvedAuto);
    expect(states(row)).toEqual(['done', 'done', 'current', 'pending']);
    expect(details(row)[1]).toBe('approvedByPlatform');
    expect(details(row)[2]).toBe('debitQueued');
  });

  it('marks DEBITED as debited and still waiting to be paid — never as finished', () => {
    const row = fixture(WITHDRAWAL_IDS.debited);
    expect(states(row)).toEqual(['done', 'done', 'done', 'current']);
    expect(details(row)[3]).toBe('awaitingPayout');
  });

  it('completes every step for a PAID row, naming the admin who approved it', () => {
    const row = fixture(WITHDRAWAL_IDS.paid);
    expect(states(row)).toEqual(['done', 'done', 'done', 'done']);
    expect(details(row)).toEqual(['requested', 'approvedByAdmin', 'debited', 'paid']);
  });

  it('keeps the later steps on a rejected row, marked not reached', () => {
    const row = fixture(WITHDRAWAL_IDS.rejected);
    expect(states(row)).toEqual(['done', 'failed', 'skipped', 'skipped']);
    expect(details(row)).toEqual(['requested', 'rejected', 'notReached', 'notReached']);
  });

  it('shows a cancelled row as closed by the player', () => {
    const row = fixture(WITHDRAWAL_IDS.rejected);
    row.status = 'CANCELLED';
    expect(timelineOf(row)[1]).toMatchObject({ state: 'skipped', detail: 'cancelled' });
  });

  it('marks the debit step failed for a refused debit and for an unclear one', () => {
    const refused = fixture(WITHDRAWAL_IDS.approvedAuto);
    refused.status = 'DEBIT_FAILED';
    expect(timelineOf(refused)[2]).toMatchObject({ state: 'failed', detail: 'debitFailed' });
    expect(timelineOf(refused)[3]).toMatchObject({ state: 'skipped' });

    const unclear = fixture(WITHDRAWAL_IDS.approvedAuto);
    unclear.status = 'NEEDS_RECONCILIATION';
    expect(timelineOf(unclear)[2]).toMatchObject({
      state: 'failed',
      detail: 'needsReconciliation',
    });
  });

  it('shows the worker at work for DEBITING', () => {
    const row = fixture(WITHDRAWAL_IDS.approvedAuto);
    row.status = 'DEBITING';
    expect(timelineOf(row)[2]).toMatchObject({ state: 'current', detail: 'debiting' });
  });

  it('has an answer for every status the backend can send', () => {
    for (const status of WITHDRAWAL_STATUSES) {
      const row = fixture(WITHDRAWAL_IDS.requested);
      row.status = status;
      expect(timelineOf(row)).toHaveLength(4);
    }
  });
});

describe('isInFlight', () => {
  it('is the two states the worker owns', () => {
    expect(isInFlight('APPROVED')).toBe(true);
    expect(isInFlight('DEBITING')).toBe(true);
    expect(isInFlight('DEBITED')).toBe(false);
    expect(isInFlight('REQUESTED')).toBe(false);
  });
});
