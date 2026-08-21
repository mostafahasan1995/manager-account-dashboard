import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { PLAYER_IDS, mockPlayers } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';
import type { AdminPlayer } from '@/types/player';

import { LinkIchancyDialog } from './link-ichancy-dialog';

const fixture = (id: string): AdminPlayer => {
  const found = mockPlayers.find((player) => player.id === id);
  if (found === undefined) throw new Error(`No player fixture for ${id}`);
  return found;
};

const pending = fixture(PLAYER_IDS.pendingLink);
const linked = fixture(PLAYER_IDS.linkedActive);

const renderDialog = (player: AdminPlayer) => {
  const onOpenChange = vi.fn();
  const onLinked = vi.fn();
  const rendered = renderPlain(
    <LinkIchancyDialog player={player} open onOpenChange={onOpenChange} onLinked={onLinked} />,
  );
  return { ...rendered, onOpenChange, onLinked };
};

describe('LinkIchancyDialog', () => {
  it('creates the account and reports the login it got back', async () => {
    const success = vi.spyOn(toast, 'success');
    const { user, onLinked, onOpenChange } = renderDialog(pending);

    await user.click(await screen.findByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(onLinked).toHaveBeenCalledWith(expect.objectContaining({ created: true }));
    });
    expect(success).toHaveBeenCalledWith(
      'Ichancy account created',
      expect.objectContaining({ description: expect.stringContaining('tg512340002') }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('says nothing was created when the player already had an account', async () => {
    const info = vi.spyOn(toast, 'info');
    const success = vi.spyOn(toast, 'success');
    const { user, onLinked } = renderDialog(linked);

    await user.click(await screen.findByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(onLinked).toHaveBeenCalledWith(expect.objectContaining({ created: false }));
    });
    expect(info).toHaveBeenCalledWith(
      'Already linked',
      expect.objectContaining({ description: expect.stringContaining('Nothing was created') }),
    );
    expect(success).not.toHaveBeenCalled();
  });

  it('keeps the dialog open and explains a failure', async () => {
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/players/:id/ichancy-account`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'ICHANCY_UNAVAILABLE', message: 'Ichancy did not answer.' },
            meta: { correlationId: 'test-corr-3', timestamp: new Date().toISOString() },
          },
          { status: 502 },
        ),
      ),
    );
    const error = vi.spyOn(toast, 'error');
    const { user, onOpenChange, onLinked } = renderDialog(pending);

    await user.click(await screen.findByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(error).toHaveBeenCalledWith(
        'Could not create the Ichancy account',
        expect.objectContaining({ description: 'Ichancy did not answer.' }),
      );
    });
    expect(onLinked).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('warns before creating an account for a player who is not waiting for one', async () => {
    renderDialog(linked);

    expect(
      await screen.findByText('This player is not waiting for an account'),
    ).toBeInTheDocument();
  });

  it('does not warn for a player whose status is exactly that', async () => {
    renderDialog(pending);

    expect(await screen.findByRole('button', { name: 'Create account' })).toBeInTheDocument();
    expect(
      screen.queryByText('This player is not waiting for an account'),
    ).not.toBeInTheDocument();
  });
});
