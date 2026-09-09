import { describe, expect, it } from 'vitest';

import { configureApiClient } from '@/lib/api/client';
import { withdrawalsApi } from '@/lib/api/endpoints';
import { isApiError } from '@/lib/api/errors';

import { db } from './db';
import { PLAYER_IDS, WITHDRAWAL_IDS, mockWithdrawals } from './fixtures';

/**
 * The withdrawal queue, tested for its state machine rather than its happy path.
 *
 * The screen above this is built against the mock before the real endpoint is reachable, so the
 * mock is the only thing telling it that DEBITED is not PAID, that approving a row somebody
 * already decided is a 409 and not a second decision, and that a player who spent the money in
 * between is refused rather than charged anyway. A mock that only ever paid would let every one
 * of those be wrong on the day it meets the backend.
 */

const asRole = (role: string): void => {
  configureApiClient({ getToken: () => `mock:${role}:token` });
};

describe('the withdrawal queue', () => {
  it('answers every status when none is asked for — the console narrows in the URL', async () => {
    const page = await withdrawalsApi.list();

    expect(page.meta.total).toBe(mockWithdrawals.length);
    expect(page.data.map((row) => row.status)).toEqual(
      expect.arrayContaining(['REQUESTED', 'APPROVED', 'DEBITED', 'PAID', 'REJECTED']),
    );
  });

  it('newest first by default, oldest first when asked', async () => {
    const newest = await withdrawalsApi.list();
    const oldest = await withdrawalsApi.list({ sort: 'oldest' });

    expect(newest.data[0]?.shortId).toBe('WD2MX8');
    expect(oldest.data[0]?.shortId).toBe('WD1NO9');
  });

  it('narrows by a status list, a player and a short id fragment', async () => {
    const open = await withdrawalsApi.list({ status: ['REQUESTED', 'DEBITED'] });
    expect(open.data.map((row) => row.status).sort()).toEqual(['DEBITED', 'REQUESTED']);

    const karim = await withdrawalsApi.list({ playerId: PLAYER_IDS.linkedActive });
    expect(karim.data.every((row) => row.playerId === PLAYER_IDS.linkedActive)).toBe(true);
    expect(karim.data.length).toBeGreaterThan(0);

    const fragment = await withdrawalsApi.list({ shortId: 'wd9' });
    expect(fragment.data.map((row) => row.shortId)).toEqual(['WD9TT1']);
  });

  it('pages with an offset, as the backend does', async () => {
    const page = await withdrawalsApi.list({ limit: 2, offset: 2 });

    expect(page.data).toHaveLength(2);
    expect(page.meta).toMatchObject({ limit: 2, offset: 2, total: 5, hasMore: true });
  });

  it('answers one row by id, and 404 for an id nobody has', async () => {
    const row = await withdrawalsApi.byId(WITHDRAWAL_IDS.debited);
    expect(row.status).toBe('DEBITED');
    // Debited, not paid: the player has been charged and the money has not left.
    expect(row.walletCheck?.status).toBe('ok');
    expect(row.paidAt).toBeNull();

    await expect(withdrawalsApi.byId('99999999-0000-4000-8000-000000000099')).rejects.toMatchObject(
      {
        status: 404,
        code: 'WITHDRAWAL_NOT_FOUND',
      },
    );
  });

  it('is readable by support and not by a viewer — the player reader set', async () => {
    asRole('SUPPORT');
    await expect(withdrawalsApi.list()).resolves.toBeTruthy();

    asRole('VIEWER');
    await expect(withdrawalsApi.list()).rejects.toMatchObject({ status: 403 });
  });
});

describe('approving', () => {
  it('debits the player and hands the chips back to the float, then checks the wallet', async () => {
    const balanceBefore = BigInt(db.playerBalances[PLAYER_IDS.linkedActive] ?? '0');
    const floatBefore = db.agentFloatLedgerMinor;

    const row = await withdrawalsApi.approve(WITHDRAWAL_IDS.requested);

    expect(row.status).toBe('DEBITED');
    expect(row.playerDebitId).not.toBeNull();
    expect(row.debitedAt).not.toBeNull();
    expect(row.decidedAt).not.toBeNull();
    // DEBITED, not PAID: nobody has sent anything yet.
    expect(row.paidAt).toBeNull();
    expect(row.payoutReference).toBeNull();

    const amount = BigInt(row.amount.minor);
    expect(BigInt(db.playerBalances[PLAYER_IDS.linkedActive] ?? '0')).toBe(balanceBefore - amount);
    // ICHANCY_AGENT_FLOAT +A — the same posting as a manual debit.
    expect(db.agentFloatLedgerMinor - floatBefore).toBe(amount);

    // The mobile-wallet rail has a hand-typed balance, so the check has a figure and a verdict.
    expect(row.walletCheck).toMatchObject({ status: 'insufficient', currency: 'USD' });
    expect(row.walletCheck?.availableMinor).not.toBeNull();
  });

  it('refuses the debit when the player no longer holds the money, and charges nobody', async () => {
    db.playerBalances[PLAYER_IDS.linkedActive] = '1000';
    const floatBefore = db.agentFloatLedgerMinor;

    const row = await withdrawalsApi.approve(WITHDRAWAL_IDS.requested);

    expect(row.status).toBe('DEBIT_FAILED');
    expect(row.failureCode).toBe('WITHDRAWAL_INSUFFICIENT_BALANCE');
    expect(row.failureMessage).toContain('less than');
    expect(row.closedAt).not.toBeNull();
    expect(db.playerBalances[PLAYER_IDS.linkedActive]).toBe('1000');
    expect(db.agentFloatLedgerMinor).toBe(floatBefore);
  });

  it('is a 409, not a second decision, once the row has left REQUESTED', async () => {
    await withdrawalsApi.approve(WITHDRAWAL_IDS.requested);

    const caught = await withdrawalsApi
      .approve(WITHDRAWAL_IDS.requested)
      .catch((error: unknown) => error);

    expect(isApiError(caught) && caught.status).toBe(409);
    expect(isApiError(caught) && caught.code).toBe('WITHDRAWAL_INVALID_STATE');
  });

  it('is refused to support and served to a reviewer — the debit decide set', async () => {
    asRole('SUPPORT');
    await expect(withdrawalsApi.approve(WITHDRAWAL_IDS.requested)).rejects.toMatchObject({
      status: 403,
    });

    asRole('REVIEWER');
    await expect(withdrawalsApi.approve(WITHDRAWAL_IDS.requested)).resolves.toMatchObject({
      status: 'DEBITED',
    });
  });
});

describe('rejecting', () => {
  it('closes the row with the reason and moves no money', async () => {
    const balanceBefore = db.playerBalances[PLAYER_IDS.linkedActive];
    const floatBefore = db.agentFloatLedgerMinor;

    const row = await withdrawalsApi.reject(WITHDRAWAL_IDS.requested, {
      reason: 'Payout address belongs to somebody else.',
    });

    expect(row.status).toBe('REJECTED');
    expect(row.rejectionReason).toBe('Payout address belongs to somebody else.');
    expect(row.decidedByAdminId).toBe(db.currentAdmin.id);
    expect(row.closedAt).not.toBeNull();
    expect(db.playerBalances[PLAYER_IDS.linkedActive]).toBe(balanceBefore);
    expect(db.agentFloatLedgerMinor).toBe(floatBefore);
  });

  it('refuses a rejection nobody explained', async () => {
    const caught = await withdrawalsApi
      .reject(WITHDRAWAL_IDS.requested, { reason: '   ' })
      .catch((error: unknown) => error);

    expect(isApiError(caught) && caught.status).toBe(400);
    expect(isApiError(caught) ? caught.fieldErrors.join(' ') : '').toContain('reason');
  });

  it('cannot reject a row that is already past a decision', async () => {
    await expect(
      withdrawalsApi.reject(WITHDRAWAL_IDS.paid, { reason: 'Too late.' }),
    ).rejects.toMatchObject({ status: 409, code: 'WITHDRAWAL_INVALID_STATE' });
  });
});

describe('marking paid', () => {
  it('closes a DEBITED row with the reference, the ledger posting and who paid', async () => {
    const row = await withdrawalsApi.markPaid(WITHDRAWAL_IDS.debited, {
      payoutReference: 'tron:6f1c…e2a9',
    });

    expect(row.status).toBe('PAID');
    expect(row.payoutReference).toBe('tron:6f1c…e2a9');
    expect(row.ledgerPayoutTxId).not.toBeNull();
    expect(row.paidByAdminId).toBe(db.currentAdmin.id);
    expect(row.paidAt).not.toBeNull();
    expect(row.closedAt).not.toBeNull();
  });

  it('is only offered once the player has been charged: a REQUESTED row is a 409', async () => {
    await expect(
      withdrawalsApi.markPaid(WITHDRAWAL_IDS.requested, { payoutReference: 'early' }),
    ).rejects.toMatchObject({ status: 409, code: 'WITHDRAWAL_INVALID_STATE' });
  });

  it('refuses an empty reference — the transfer must be traceable', async () => {
    const caught = await withdrawalsApi
      .markPaid(WITHDRAWAL_IDS.debited, { payoutReference: '' })
      .catch((error: unknown) => error);

    expect(isApiError(caught) && caught.status).toBe(400);
    expect(isApiError(caught) ? caught.fieldErrors.join(' ') : '').toContain('payoutReference');
  });

  it('cannot be marked paid twice', async () => {
    await withdrawalsApi.markPaid(WITHDRAWAL_IDS.debited, { payoutReference: 'once' });

    await expect(
      withdrawalsApi.markPaid(WITHDRAWAL_IDS.debited, { payoutReference: 'twice' }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
