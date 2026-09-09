import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import type { Locale } from '@/lib/i18n/locales';
import { PLAYER_IDS, mockPlayers } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';
import type { AdminPlayer } from '@/types/player';

import { BlockPlayerDialog } from './block-player-dialog';

/**
 * Locking a player out of the bot.
 *
 * Nothing is sent until a person has read the name and the reason back on the second screen, and
 * the reason that goes over the wire is the one they typed, trimmed and within the limit.
 */

const BLOCK_PATH = `${config.apiBaseUrl}/v1/admin/players/:id/block`;

const fixture = (id: string): AdminPlayer => {
  const player = mockPlayers.find((row) => row.id === id);
  if (player === undefined) throw new Error(`no player fixture ${id}`);
  return structuredClone(player);
};

const karim = fixture(PLAYER_IDS.linkedActive);

/** Records every body sent to the block endpoint, then lets the standard mock answer. */
function captureBlock(): string[] {
  const sent: string[] = [];
  server.use(
    http.post(BLOCK_PATH, async ({ request }) => {
      sent.push(await request.clone().text());
      return undefined;
    }),
  );
  return sent;
}

const renderDialog = (player: AdminPlayer = karim, locale: Locale = 'en') => {
  const onBlocked = vi.fn();
  const onOpenChange = vi.fn();
  const result = renderPlain(
    <BlockPlayerDialog player={player} open onOpenChange={onOpenChange} onBlocked={onBlocked} />,
    { locale },
  );
  return { ...result, onBlocked, onOpenChange };
};

describe('BlockPlayerDialog', () => {
  it('will not move to the confirmation without a reason', async () => {
    const { user } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Review this block' }));

    expect(screen.getByText(/Say why\. It is shown to whoever unblocks them/)).toBeInTheDocument();
    expect(screen.queryByText(/Block Karim Nasser from the bot\?/)).not.toBeInTheDocument();
  });

  it('refuses a reason longer than the backend accepts, and says by how much', async () => {
    const { user } = renderDialog();

    await user.click(screen.getByLabelText('Reason'));
    await user.paste('x'.repeat(281));
    await user.click(screen.getByRole('button', { name: 'Review this block' }));

    expect(screen.getByText('Keep it to 280 characters; this is 281.')).toBeInTheDocument();
  });

  it('sends nothing until the confirmation, then sends the reason and hands back the row', async () => {
    const sent = captureBlock();
    const success = vi.spyOn(toast, 'success');
    const { user, onBlocked } = renderDialog();

    await user.type(screen.getByLabelText('Reason'), '  Three accounts on one receipt  ');
    await user.click(screen.getByRole('button', { name: 'Review this block' }));

    // The confirmation reads the name and the reason back; nothing has gone anywhere yet.
    expect(await screen.findByText('Block Karim Nasser from the bot?')).toBeInTheDocument();
    expect(screen.getByText('Three accounts on one receipt')).toBeInTheDocument();
    expect(sent).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Block Karim Nasser' }));

    await waitFor(() => {
      expect(onBlocked).toHaveBeenCalledTimes(1);
    });
    expect(JSON.parse(sent[0] ?? '{}')).toEqual({ reason: 'Three accounts on one receipt' });
    const blocked = onBlocked.mock.calls[0]?.[0] as AdminPlayer;
    expect(blocked.status).toBe('BLOCKED');
    expect(blocked.blockedReason).toBe('Three accounts on one receipt');
    expect(success).toHaveBeenCalledWith('Blocked Karim Nasser', expect.anything());
  });

  it('goes back to the form from the confirmation without sending', async () => {
    const sent = captureBlock();
    const { user } = renderDialog();

    await user.type(screen.getByLabelText('Reason'), 'Chargeback');
    await user.click(screen.getByRole('button', { name: 'Review this block' }));
    await user.click(await screen.findByRole('button', { name: 'Back' }));

    expect(screen.getByLabelText('Reason')).toHaveValue('Chargeback');
    expect(sent).toHaveLength(0);
  });

  it('shows the refusal on the confirmation and lets the operator try again', async () => {
    server.use(
      http.post(BLOCK_PATH, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'PLAYER_ALREADY_BLOCKED', message: 'This player is already blocked.' },
            meta: { correlationId: 'test-block-1', timestamp: new Date().toISOString() },
          },
          { status: 409 },
        ),
      ),
    );
    const failed = vi.spyOn(toast, 'error');
    const { user, onBlocked } = renderDialog();

    await user.type(screen.getByLabelText('Reason'), 'Chargeback');
    await user.click(screen.getByRole('button', { name: 'Review this block' }));
    await user.click(await screen.findByRole('button', { name: 'Block Karim Nasser' }));

    expect(await screen.findByText('This player is already blocked.')).toBeInTheDocument();
    expect(
      screen.getByText('Nothing changed. Fix what the message says and try again.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Block Karim Nasser' })).toBeInTheDocument();
    expect(onBlocked).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledWith('Could not block the player', expect.anything());
  });

  it('cancels through the page', async () => {
    const { user, onOpenChange } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('reads in Arabic, both steps', async () => {
    const { user } = renderDialog(karim, 'ar');

    expect(screen.getByRole('heading', { name: 'حظر Karim Nasser' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('السبب'), 'سبب');
    await user.click(screen.getByRole('button', { name: 'مراجعة الحظر' }));

    expect(await screen.findByText('حظر Karim Nasser من البوت؟')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'حظر Karim Nasser' })).toBeInTheDocument();
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });
});
