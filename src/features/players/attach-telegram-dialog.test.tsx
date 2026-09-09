import { screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import type { Locale } from '@/lib/i18n/locales';
import { PLAYER_IDS, mockPlayers } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';
import type { AdminPlayer } from '@/types/player';

import { AttachTelegramDialog } from './attach-telegram-dialog';

const ATTACH_PATH = `${config.apiBaseUrl}/v1/admin/players/:id/telegram`;

const fixture = (id: string): AdminPlayer => {
  const player = mockPlayers.find((row) => row.id === id);
  if (player === undefined) throw new Error(`no player fixture ${id}`);
  return structuredClone(player);
};

/** The old player: no Telegram at all, known only by their Ichancy login. */
const samer = fixture(PLAYER_IDS.imported);

/** Records every body sent to the attach endpoint, then lets the standard mock answer. */
function captureAttach(): string[] {
  const sent: string[] = [];
  server.use(
    http.patch(ATTACH_PATH, async ({ request }) => {
      sent.push(await request.clone().text());
      return undefined;
    }),
  );
  return sent;
}

const renderDialog = (player: AdminPlayer = samer, locale: Locale = 'en') => {
  const onAttached = vi.fn();
  const onOpenChange = vi.fn();
  const result = renderPlain(
    <AttachTelegramDialog
      player={player}
      open
      onOpenChange={onOpenChange}
      onAttached={onAttached}
    />,
    { locale },
  );
  return { ...result, onAttached, onOpenChange };
};

describe('AttachTelegramDialog', () => {
  it('names the player it is attaching to', () => {
    renderDialog();

    expect(
      screen.getByRole('heading', { name: 'Attach a Telegram account to samer1987' }),
    ).toBeInTheDocument();
  });

  it('refuses anything but digits, and sends nothing', async () => {
    const sent = captureAttach();
    const { user, onAttached } = renderDialog();

    await user.type(screen.getByLabelText('Telegram ID'), '@samer');
    await user.click(screen.getByRole('button', { name: 'Attach' }));

    expect(
      await screen.findByText('Enter the numeric Telegram id — digits only.'),
    ).toBeInTheDocument();
    expect(sent).toHaveLength(0);
    expect(onAttached).not.toHaveBeenCalled();
  });

  it('sends the id as a string and hands back the row with it attached', async () => {
    const sent = captureAttach();
    const success = vi.spyOn(toast, 'success');
    const { user, onAttached } = renderDialog();

    await user.type(screen.getByLabelText('Telegram ID'), ' 512340099 ');
    await user.click(screen.getByRole('button', { name: 'Attach' }));

    await waitFor(() => {
      expect(onAttached).toHaveBeenCalledTimes(1);
    });
    expect(JSON.parse(sent[0] ?? '{}')).toEqual({ telegramUserId: '512340099' });
    const attached = onAttached.mock.calls[0]?.[0] as AdminPlayer;
    expect(attached.telegramUserId).toBe('512340099');
    expect(success).toHaveBeenCalledWith(
      'Attached Telegram 512340099',
      expect.objectContaining({ description: 'The bot recognises samer1987 now.' }),
    );
  });

  it('shows the refusal for an id another player holds, and stays open', async () => {
    const failed = vi.spyOn(toast, 'error');
    const { user, onAttached } = renderDialog();

    await user.type(screen.getByLabelText('Telegram ID'), '512340001');
    await user.click(screen.getByRole('button', { name: 'Attach' }));

    expect(
      await screen.findByText('Another player in this operator already holds that Telegram id.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Attach' })).toBeInTheDocument();
    expect(onAttached).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledWith('Could not attach the Telegram account', expect.anything());
  });

  it('cancels through the page', async () => {
    const { user, onOpenChange } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('reads in Arabic', () => {
    renderDialog(samer, 'ar');

    expect(
      screen.getByRole('heading', { name: 'ربط حساب تلغرام بـ samer1987' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('معرّف تلغرام')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ربط' })).toBeInTheDocument();
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });
});
