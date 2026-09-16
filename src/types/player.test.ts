import { describe, expect, it } from 'vitest';

import { mockPlayers, PLAYER_IDS } from '@/mocks/fixtures';

import { isImportedPlayer, isPlayerBlocked, playerDisplayName, type AdminPlayer } from './player';
import { tenantWithdrawalMode } from './tenant';

/**
 * The fallbacks a row with no Telegram made necessary. `playerDisplayName` used to end at
 * "Telegram <id>", which for an imported account is "Telegram null" — a name that reads as a bug in
 * the one column support uses to find somebody on the phone.
 */

const find = (id: string): AdminPlayer => {
  const player = mockPlayers.find((row) => row.id === id);
  if (player === undefined) throw new Error(`no fixture ${id}`);
  return player;
};

describe('playerDisplayName', () => {
  it('prefers the name, then the @username', () => {
    expect(playerDisplayName(find(PLAYER_IDS.linkedActive))).toBe('Karim Nasser');
    expect(
      playerDisplayName({ ...find(PLAYER_IDS.linkedActive), firstName: null, lastName: null }),
    ).toBe('@karim_play');
  });

  it('falls back to the Telegram id for a row with neither', () => {
    expect(
      playerDisplayName({
        ...find(PLAYER_IDS.linkedActive),
        firstName: null,
        lastName: null,
        telegramUsername: null,
      }),
    ).toBe('Telegram 512340001');
  });

  it('names an imported row by its Ichancy login, never "Telegram null"', () => {
    expect(playerDisplayName(find(PLAYER_IDS.imported))).toBe('samer1987');
  });

  it('still names a row that has nothing at all', () => {
    const bare = { ...find(PLAYER_IDS.imported), ichancyLogin: null };
    expect(playerDisplayName(bare)).toBe(`Player ${bare.id.slice(0, 8)}`);
  });
});

describe('the source and lock helpers', () => {
  it('know an imported row and a blocked row apart from the rest', () => {
    expect(isImportedPlayer(find(PLAYER_IDS.imported))).toBe(true);
    expect(isImportedPlayer(find(PLAYER_IDS.linkedActive))).toBe(false);
    expect(isPlayerBlocked(find(PLAYER_IDS.blocked))).toBe(true);
    expect(isPlayerBlocked(find(PLAYER_IDS.suspended))).toBe(false);
  });
});

describe('tenantWithdrawalMode', () => {
  it('reads an absent mode — an older backend — as MANUAL, never as auto-approving money', () => {
    expect(tenantWithdrawalMode({})).toBe('MANUAL');
    expect(tenantWithdrawalMode({ withdrawalMode: 'AUTO' })).toBe('AUTO');
  });
});
