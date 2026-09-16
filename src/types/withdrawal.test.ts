import { describe, expect, it } from 'vitest';

import { WITHDRAWAL_STATUSES, type WithdrawalStatus } from './enums';
import {
  canDecideWithdrawal,
  canMarkWithdrawalPaid,
  isWithdrawalOpen,
  isWithdrawalTerminal,
  withdrawalNeedsAttention,
} from './withdrawal';

/**
 * The status helpers, written out as the table the queue will render from. Each status belongs to
 * exactly one of open / attention / terminal, and the two actions are offered in exactly one
 * status each — because DEBITED offered as "approve" or REQUESTED offered as "mark paid" is a
 * button that either fails or moves money at the wrong moment.
 */

const OPEN: WithdrawalStatus[] = ['REQUESTED', 'APPROVED', 'DEBITING', 'DEBITED'];
const ATTENTION: WithdrawalStatus[] = ['DEBIT_FAILED', 'NEEDS_RECONCILIATION'];
const TERMINAL: WithdrawalStatus[] = ['PAID', 'REJECTED', 'CANCELLED'];

describe('every withdrawal status is open, needs attention, or is terminal — exactly one', () => {
  it.each(WITHDRAWAL_STATUSES)('%s', (status) => {
    const answers = [
      isWithdrawalOpen(status),
      withdrawalNeedsAttention(status),
      isWithdrawalTerminal(status),
    ];
    expect(answers.filter(Boolean)).toHaveLength(1);
  });

  it('sorts them the way the queue does', () => {
    expect(WITHDRAWAL_STATUSES.filter(isWithdrawalOpen)).toEqual(OPEN);
    expect(WITHDRAWAL_STATUSES.filter(withdrawalNeedsAttention)).toEqual(ATTENTION);
    expect(WITHDRAWAL_STATUSES.filter(isWithdrawalTerminal)).toEqual(TERMINAL);
  });
});

describe('the two decisions', () => {
  it('approve and reject are offered only while a human decision is pending', () => {
    expect(WITHDRAWAL_STATUSES.filter((status) => canDecideWithdrawal({ status }))).toEqual([
      'REQUESTED',
    ]);
  });

  it('mark paid is offered only once the player has been charged and nobody paid', () => {
    expect(WITHDRAWAL_STATUSES.filter((status) => canMarkWithdrawalPaid({ status }))).toEqual([
      'DEBITED',
    ]);
  });
});
