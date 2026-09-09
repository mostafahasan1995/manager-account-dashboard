import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ADMIN_IDS, PLAYER_IDS, mockPlayers } from '@/mocks/fixtures';
import { renderPlain } from '@/test/utils';
import type { AdminPlayer } from '@/types/player';

import { PlayerBlockedAlert } from './player-blocked-alert';

const fixture = (id: string): AdminPlayer => {
  const player = mockPlayers.find((row) => row.id === id);
  if (player === undefined) throw new Error(`no player fixture ${id}`);
  return structuredClone(player);
};

describe('PlayerBlockedAlert', () => {
  it('says why, when and by whom', () => {
    renderPlain(<PlayerBlockedAlert player={fixture(PLAYER_IDS.blocked)} />);

    const alert = screen.getByTestId('player-blocked-alert');
    expect(alert).toHaveTextContent('Blocked from the bot');
    expect(alert).toHaveTextContent('Three accounts sharing one bank receipt.');
    expect(alert).toHaveTextContent(ADMIN_IDS.financeAdmin);
    expect(alert).toHaveTextContent(/ago/);
  });

  it('renders nothing at all for a player who is not blocked', () => {
    renderPlain(<PlayerBlockedAlert player={fixture(PLAYER_IDS.linkedActive)} />);

    expect(screen.queryByTestId('player-blocked-alert')).not.toBeInTheDocument();
  });

  it('says when the backend recorded no reason, rather than showing an empty row', () => {
    const player = fixture(PLAYER_IDS.blocked);
    renderPlain(
      <PlayerBlockedAlert player={{ ...player, blockedReason: '  ', blockedByAdminId: null }} />,
    );

    const alert = screen.getByTestId('player-blocked-alert');
    expect(alert).toHaveTextContent('No reason was recorded.');
    expect(alert).toHaveTextContent('—');
  });

  it('reads in Arabic', () => {
    renderPlain(<PlayerBlockedAlert player={fixture(PLAYER_IDS.blocked)} />, { locale: 'ar' });

    expect(screen.getByText('محظور من البوت')).toBeInTheDocument();
    expect(screen.getByText('السبب')).toBeInTheDocument();
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });
});
