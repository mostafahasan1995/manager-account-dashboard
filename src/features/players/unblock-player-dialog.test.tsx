import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import type { Locale } from '@/lib/i18n/locales';
import { ADMIN_IDS, PLAYER_IDS, mockPlayers } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';
import type { AdminPlayer } from '@/types/player';

import { UnblockPlayerDialog } from './unblock-player-dialog';

const UNBLOCK_PATH = `${config.apiBaseUrl}/v1/admin/players/:id/unblock`;

const fixture = (id: string): AdminPlayer => {
  const player = mockPlayers.find((row) => row.id === id);
  if (player === undefined) throw new Error(`no player fixture ${id}`);
  return structuredClone(player);
};

const bassel = fixture(PLAYER_IDS.blocked);

const renderDialog = (player: AdminPlayer = bassel, locale: Locale = 'en') => {
  const onUnblocked = vi.fn();
  const onOpenChange = vi.fn();
  const result = renderPlain(
    <UnblockPlayerDialog
      player={player}
      open
      onOpenChange={onOpenChange}
      onUnblocked={onUnblocked}
    />,
    { locale },
  );
  return { ...result, onUnblocked, onOpenChange };
};

describe('UnblockPlayerDialog', () => {
  it('shows why, when and by whom before asking', () => {
    renderDialog();

    expect(screen.getByRole('heading', { name: 'Unblock Bassel Khoury?' })).toBeInTheDocument();
    expect(screen.getByText('Three accounts sharing one bank receipt.')).toBeInTheDocument();
    expect(screen.getByText(ADMIN_IDS.financeAdmin)).toBeInTheDocument();
    expect(screen.getByText(/ago$/)).toBeInTheDocument();
  });

  it('says so when no reason was recorded', () => {
    renderDialog({ ...bassel, blockedReason: null, blockedByAdminId: null });

    expect(screen.getByText('No reason was recorded.')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('lifts the block and hands back the row with its new status', async () => {
    const success = vi.spyOn(toast, 'success');
    const { user, onUnblocked, onOpenChange } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Unblock' }));

    await waitFor(() => {
      expect(onUnblocked).toHaveBeenCalledTimes(1);
    });
    const unblocked = onUnblocked.mock.calls[0]?.[0] as AdminPlayer;
    // Linked, so back to ACTIVE rather than waiting for an account.
    expect(unblocked.status).toBe('ACTIVE');
    expect(unblocked.blockedReason).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(success).toHaveBeenCalledWith(
      'Unblocked Bassel Khoury',
      expect.objectContaining({ description: 'Their status is now “Active”.' }),
    );
  });

  it('reports a refusal and stays open', async () => {
    server.use(
      http.post(UNBLOCK_PATH, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'PLAYER_NOT_BLOCKED', message: 'This player is not blocked.' },
            meta: { correlationId: 'test-unblock-1', timestamp: new Date().toISOString() },
          },
          { status: 409 },
        ),
      ),
    );
    const failed = vi.spyOn(toast, 'error');
    const { user, onUnblocked, onOpenChange } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Unblock' }));

    await waitFor(() => {
      expect(failed).toHaveBeenCalledWith(
        'Could not unblock the player',
        expect.objectContaining({ description: 'This player is not blocked.' }),
      );
    });
    expect(onUnblocked).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('reads in Arabic', () => {
    renderDialog(bassel, 'ar');

    expect(
      screen.getByRole('heading', { name: 'رفع الحظر عن Bassel Khoury؟' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'رفع الحظر' })).toBeInTheDocument();
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });
});
