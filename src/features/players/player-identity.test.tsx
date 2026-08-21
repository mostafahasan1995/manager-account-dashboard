import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PLAYER_IDS, mockPlayers } from '@/mocks/fixtures';
import { renderPlain } from '@/test/utils';
import type { AdminPlayer } from '@/types/player';

import { PlayerIdentity } from './player-identity';

const fixture = (id: string): AdminPlayer => {
  const found = mockPlayers.find((player) => player.id === id);
  if (found === undefined) throw new Error(`No player fixture for ${id}`);
  return found;
};

/** The value cell that belongs to a labelled row. */
const rowValue = (label: string): string => {
  const term = screen.getByText(label, { selector: 'dt' });
  const value = term.nextElementSibling;
  if (value === null) throw new Error(`No value rendered for "${label}"`);
  return value.textContent;
};

describe('PlayerIdentity', () => {
  it('shows every field of a linked player', () => {
    const player = fixture(PLAYER_IDS.linkedActive);
    renderPlain(<PlayerIdentity player={player} />);

    expect(rowValue('Player id')).toBe(player.id);
    expect(rowValue('Telegram ID')).toBe('512340001');
    expect(rowValue('Username')).toBe('@karim_play');
    expect(rowValue('First name')).toBe('Karim');
    expect(rowValue('Last name')).toBe('Nasser');
    expect(rowValue('Phone')).toBe('+963900000001');
    expect(rowValue('Language')).toBe('ar');
    expect(rowValue('Currency')).toBe('NSP');
    expect(rowValue('Ichancy player id')).toBe('99001');
    expect(rowValue('Ichancy login')).toBe('tg512340001');
    expect(rowValue('Linked')).toBe('Linked');
    expect(rowValue('Registered')).not.toBe('—');
    expect(rowValue('Created')).not.toBe('—');
    expect(rowValue('Last seen')).not.toBe('—');
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders what the backend does not know as an em dash rather than as nothing', () => {
    renderPlain(<PlayerIdentity player={fixture(PLAYER_IDS.pendingLink)} />);

    expect(rowValue('Username')).toBe('—');
    expect(rowValue('Last name')).toBe('—');
    expect(rowValue('Phone')).toBe('—');
    expect(rowValue('Ichancy player id')).toBe('—');
    expect(rowValue('Ichancy login')).toBe('—');
    expect(rowValue('Registered')).toBe('—');
    expect(rowValue('Linked')).toBe('Not linked');
    expect(screen.getByText('Pending Ichancy')).toBeInTheDocument();
  });
});
