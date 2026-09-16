import { describe, expect, it } from 'vitest';

import { configureApiClient } from '@/lib/api/client';
import { playersApi, tenantsApi } from '@/lib/api/endpoints';
import { isApiError } from '@/lib/api/errors';

import { db } from './db';
import { PLAYER_IDS, TENANT_IDS, mockPlayers } from './fixtures';

/**
 * The player-administration routes: registering, blocking, attaching a Telegram id, importing.
 *
 * Tested for the refusals as much as the successes, because the refusals are what the dialogs
 * above are built around: a Telegram id somebody else holds, a row that cannot be blocked, a link
 * that failed while the registration succeeded. And for idempotence where it matters — an import
 * pressed twice must find everything `existing` the second time.
 */

const asRole = (role: string): void => {
  configureApiClient({ getToken: () => `mock:${role}:token` });
};

const NO_SUCH_PLAYER = 'bbbbbbbb-0000-4000-8000-000000000999';

describe('the directory, with its two new filters', () => {
  it('serves the imported row with no Telegram id, and finds it by source', async () => {
    const page = await playersApi.list({ source: 'ICHANCY_IMPORT' });

    expect(page.data.map((row) => row.id)).toEqual([PLAYER_IDS.imported]);
    expect(page.data[0]?.telegramUserId).toBeNull();
    expect(page.data[0]?.ichancyLogin).toBe('samer1987');
  });

  it('narrows to the blocked rows, and hides them with blocked=false', async () => {
    const blocked = await playersApi.list({ blocked: true });
    expect(blocked.data.map((row) => row.id)).toEqual([PLAYER_IDS.blocked]);
    expect(blocked.data[0]).toMatchObject({
      status: 'BLOCKED',
      blockedReason: 'Three accounts sharing one bank receipt.',
    });

    const unblocked = await playersApi.list({ blocked: false });
    expect(unblocked.meta.total).toBe(mockPlayers.length - 1);
    expect(unblocked.data.some((row) => row.status === 'BLOCKED')).toBe(false);
  });

  it('still searches a directory where some rows have no Telegram id', async () => {
    const page = await playersApi.list({ search: 'samer' });
    expect(page.data.map((row) => row.id)).toEqual([PLAYER_IDS.imported]);
  });
});

describe('registering a player', () => {
  it('creates a PENDING_ICHANCY row from the console, with nothing Telegram about it', async () => {
    const result = await playersApi.register({ firstName: 'Nadia', phone: '+963900000501' });

    expect(result.player).toMatchObject({
      source: 'ADMIN',
      status: 'PENDING_ICHANCY',
      telegramUserId: null,
      firstName: 'Nadia',
      lastName: null,
      phone: '+963900000501',
      ichancyLinked: false,
    });
    // Nobody asked for an account, so there is no link and no error.
    expect(result.ichancy).toBeNull();
    expect(result.ichancyError).toBeNull();

    const page = await playersApi.list({ source: 'ADMIN' });
    expect(page.data.map((row) => row.id)).toContain(result.player.id);
  });

  it('links an Ichancy account on the way out when asked, with a login for a row with no Telegram', async () => {
    const result = await playersApi.register({ firstName: 'Nadia', createIchancyAccount: true });

    expect(result.player.ichancyLinked).toBe(true);
    expect(result.player.status).toBe('ACTIVE');
    expect(result.ichancy).toMatchObject({ playerId: result.player.id, created: true });
    expect(result.ichancy?.ichancyLogin).toMatch(/^pa/);
    expect(result.ichancyError).toBeNull();
  });

  it('derives the login from the Telegram id when the row has one', async () => {
    const result = await playersApi.register({
      telegramUserId: '512340999',
      createIchancyAccount: true,
    });

    expect(result.ichancy?.ichancyLogin).toBe('tg512340999');
    expect(result.player.telegramUserId).toBe('512340999');
  });

  it('reports a failed link BESIDE a successful registration, never as a failed one', async () => {
    const result = await playersApi.register({
      firstName: 'Timeout',
      phone: '+963900000000',
      createIchancyAccount: true,
    });

    expect(result.player.ichancyLinked).toBe(false);
    expect(result.ichancy).toBeNull();
    expect(result.ichancyError).toContain('did not answer');
    // The row exists regardless.
    await expect(playersApi.byId(result.player.id)).resolves.toMatchObject({
      firstName: 'Timeout',
    });
  });

  it('refuses a Telegram id another player holds', async () => {
    await expect(playersApi.register({ telegramUserId: '512340001' })).rejects.toMatchObject({
      status: 409,
      code: 'PLAYER_TELEGRAM_ID_TAKEN',
    });
  });

  it('refuses a Telegram id that is not a number', async () => {
    const caught = await playersApi
      .register({ telegramUserId: '@karim' })
      .catch((error: unknown) => error);

    expect(isApiError(caught) && caught.status).toBe(400);
    expect(isApiError(caught) ? caught.fieldErrors.join(' ') : '').toContain('telegramUserId');
  });

  it('is refused to a reviewer and served to a finance admin', async () => {
    asRole('REVIEWER');
    await expect(playersApi.register({ firstName: 'X' })).rejects.toMatchObject({ status: 403 });

    asRole('FINANCE_ADMIN');
    await expect(playersApi.register({ firstName: 'X' })).resolves.toBeTruthy();
  });
});

describe('blocking and unblocking', () => {
  it('locks the row with the reason, who and when — and unlocking clears all three', async () => {
    const blocked = await playersApi.block(PLAYER_IDS.linkedActive, {
      reason: 'Chargeback dispute open.',
    });

    expect(blocked).toMatchObject({
      status: 'BLOCKED',
      blockedReason: 'Chargeback dispute open.',
      blockedByAdminId: db.currentAdmin.id,
    });
    expect(blocked.blockedAt).not.toBeNull();

    const unblocked = await playersApi.unblock(PLAYER_IDS.linkedActive);
    expect(unblocked).toMatchObject({
      status: 'ACTIVE',
      blockedAt: null,
      blockedReason: null,
      blockedByAdminId: null,
    });
  });

  it('returns an unlinked row to PENDING_ICHANCY, not to ACTIVE', async () => {
    await playersApi.block(PLAYER_IDS.pendingLink, { reason: 'Suspicious sign-up.' });
    const unblocked = await playersApi.unblock(PLAYER_IDS.pendingLink);

    expect(unblocked.status).toBe('PENDING_ICHANCY');
  });

  it('refuses a block nobody explained', async () => {
    const caught = await playersApi
      .block(PLAYER_IDS.linkedActive, { reason: '' })
      .catch((error: unknown) => error);

    expect(isApiError(caught) && caught.status).toBe(400);
    expect(isApiError(caught) ? caught.fieldErrors.join(' ') : '').toContain('reason');
  });

  it('refuses to block twice, to block a closed account, or to unblock what is not blocked', async () => {
    await expect(playersApi.block(PLAYER_IDS.blocked, { reason: 'again' })).rejects.toMatchObject({
      status: 409,
      code: 'PLAYER_ALREADY_BLOCKED',
    });

    await expect(
      playersApi.block(PLAYER_IDS.closed, { reason: 'closed anyway' }),
    ).rejects.toMatchObject({ status: 409, code: 'PLAYER_NOT_ACTIVE' });

    await expect(playersApi.unblock(PLAYER_IDS.linkedActive)).rejects.toMatchObject({
      status: 409,
      code: 'PLAYER_NOT_BLOCKED',
    });
  });

  it('answers 404 for a player nobody has, and 403 to support', async () => {
    await expect(playersApi.block(NO_SUCH_PLAYER, { reason: 'x' })).rejects.toMatchObject({
      status: 404,
    });

    asRole('SUPPORT');
    await expect(playersApi.block(PLAYER_IDS.linkedActive, { reason: 'x' })).rejects.toMatchObject({
      status: 403,
    });
    await expect(playersApi.unblock(PLAYER_IDS.blocked)).rejects.toMatchObject({ status: 403 });
  });
});

describe('attaching a Telegram id', () => {
  it('gives an imported row the id it never had', async () => {
    const player = await playersApi.attachTelegram(PLAYER_IDS.imported, {
      telegramUserId: '512340777',
    });

    expect(player.telegramUserId).toBe('512340777');
    // And the directory finds it by that id from now on.
    const page = await playersApi.list({ telegramUserId: '512340777' });
    expect(page.data.map((row) => row.id)).toEqual([PLAYER_IDS.imported]);
  });

  it('refuses to repoint a row that already has one', async () => {
    await expect(
      playersApi.attachTelegram(PLAYER_IDS.linkedActive, { telegramUserId: '512340777' }),
    ).rejects.toMatchObject({ status: 409, code: 'PLAYER_HAS_TELEGRAM' });
  });

  it('refuses an id another player holds, and one that is not a number', async () => {
    await expect(
      playersApi.attachTelegram(PLAYER_IDS.imported, { telegramUserId: '512340001' }),
    ).rejects.toMatchObject({ status: 409, code: 'PLAYER_TELEGRAM_ID_TAKEN' });

    await expect(
      playersApi.attachTelegram(PLAYER_IDS.imported, { telegramUserId: 'abc' }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
  });

  it('is refused to a reviewer', async () => {
    asRole('REVIEWER');
    await expect(
      playersApi.attachTelegram(PLAYER_IDS.imported, { telegramUserId: '512340777' }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe('importing the old players', () => {
  it('creates the row the agent knows and we do not, and counts the rest as existing', async () => {
    const before = db.players.length;

    const summary = await playersApi.import();

    expect(summary.created).toBe(1);
    expect(summary.existing).toBeGreaterThan(0);
    expect(summary.scanned).toBe(summary.created + summary.existing);
    expect(summary.error).toBeNull();
    expect(db.players).toHaveLength(before + 1);

    const imported = await playersApi.list({ source: 'ICHANCY_IMPORT' });
    expect(imported.data.map((row) => row.ichancyLogin)).toContain('rami_2020');
    expect(imported.data.every((row) => row.telegramUserId === null)).toBe(true);
  });

  it('is idempotent: a second run creates nothing', async () => {
    await playersApi.import();
    const again = await playersApi.import();

    expect(again.created).toBe(0);
    expect(again.existing).toBe(again.scanned);
  });

  it('honours the limit, and refuses one below 1', async () => {
    const one = await playersApi.import({ limit: 1 });
    expect(one.scanned).toBe(1);

    await expect(playersApi.import({ limit: 0 })).rejects.toMatchObject({ status: 400 });
  });

  it('is refused to a reviewer', async () => {
    asRole('REVIEWER');
    await expect(playersApi.import()).rejects.toMatchObject({ status: 403 });
  });
});

describe('importing from the platform side', () => {
  it('refuses the platform itself, which has no Ichancy agent to import from', async () => {
    asRole('PLATFORM_ADMIN');

    await expect(tenantsApi.importPlayers(TENANT_IDS.zero)).rejects.toMatchObject({
      status: 422,
      code: 'TENANT_PLATFORM_LOCKED',
    });
  });

  it('moves another operator’s player count, and reports the agent that does not answer', async () => {
    asRole('PLATFORM_ADMIN');
    const before = (await tenantsApi.byId(TENANT_IDS.second)).counts?.players ?? 0;

    const summary = await tenantsApi.importPlayers(TENANT_IDS.second);
    expect(summary).toMatchObject({ scanned: 3, created: 2, existing: 1, error: null });
    expect((await tenantsApi.byId(TENANT_IDS.second)).counts?.players).toBe(before + 2);

    // Reported, not thrown: the summary says what stopped it.
    const stalled = await tenantsApi.importPlayers(TENANT_IDS.suspended);
    expect(stalled.created).toBe(0);
    expect(stalled.error).toContain('did not answer');
  });

  it('is a platform route: 403 to a tenant super admin, 404 for no such operator', async () => {
    asRole('SUPER_ADMIN');
    await expect(tenantsApi.importPlayers(TENANT_IDS.zero)).rejects.toMatchObject({ status: 403 });

    asRole('PLATFORM_ADMIN');
    await expect(
      tenantsApi.importPlayers('11111111-0000-4000-8000-000000000999'),
    ).rejects.toMatchObject({ status: 404, code: 'TENANT_NOT_FOUND' });
  });
});
