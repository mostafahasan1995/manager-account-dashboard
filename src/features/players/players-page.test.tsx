import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { playerSearchSchema } from '@/app/search-schemas';
import { config } from '@/config';
import type { Locale } from '@/lib/i18n/locales';
import { mockPlayers } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/utils';
import type { AdminRole } from '@/types/enums';

import { PlayersPage } from './players-page';

const PLAYERS_URL = `${config.apiBaseUrl}/v1/admin/players`;

const renderPage = (route = '/players', role: AdminRole = 'SUPER_ADMIN', locale: Locale = 'en') =>
  renderWithProviders(<PlayersPage />, {
    route,
    routePath: '/players',
    validateSearch: playerSearchSchema,
    auth: { role },
    locale,
  });

describe('PlayersPage', () => {
  it('lists the players with the Ichancy state that decides whether they can be credited', async () => {
    renderPage();

    expect(await screen.findByRole('link', { name: 'Karim Nasser' })).toBeInTheDocument();
    expect(screen.getByText('tg512340001')).toBeInTheDocument();
    // Maya is PENDING_ICHANCY: her deposits cannot be credited until an account exists.
    expect(screen.getByRole('link', { name: 'Maya' })).toBeInTheDocument();
    expect(screen.getByText('Cannot be credited')).toBeInTheDocument();
  });

  it('holds the table shape with a skeleton until the first page arrives', async () => {
    server.use(
      http.get(PLAYERS_URL, async () => {
        await delay(60);
        return HttpResponse.json({
          success: true,
          data: [mockPlayers[0]],
          error: null,
          meta: {
            correlationId: 'test-corr-2',
            timestamp: new Date().toISOString(),
            total: 1,
            limit: 20,
            offset: 0,
            hasMore: false,
          },
        });
      }),
    );
    renderPage();

    expect(await screen.findByTestId('table-skeleton')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Karim Nasser' })).toBeInTheDocument();
    expect(screen.queryByTestId('table-skeleton')).not.toBeInTheDocument();
  });

  it('applies the status filter it was opened with', async () => {
    renderPage('/players?status=PENDING_ICHANCY');

    expect(await screen.findByRole('link', { name: 'Maya' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Karim Nasser' })).not.toBeInTheDocument();
  });

  it('says so when nothing matches instead of showing an empty table', async () => {
    renderPage('/players?search=nobody-by-that-name');

    expect(await screen.findByText('No players match these filters')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the failure and offers a retry when the list cannot be loaded', async () => {
    server.use(
      http.get(PLAYERS_URL, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'INTERNAL_ERROR', message: 'The player directory is unavailable.' },
            meta: { correlationId: 'test-corr-1', timestamp: new Date().toISOString() },
          },
          { status: 500 },
        ),
      ),
    );
    renderPage();

    expect(await screen.findByText('The player directory is unavailable.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByText('test-corr-1', { exact: false })).toBeInTheDocument();
  });

  it('loads the list on the second attempt when the first one failed', async () => {
    let attempts = 0;
    server.use(
      http.get(PLAYERS_URL, () => {
        attempts += 1;
        // Anything after the first attempt falls through to the standard mock API.
        if (attempts > 1) return undefined;
        return HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'INTERNAL_ERROR', message: 'The player directory is unavailable.' },
            meta: { correlationId: 'test-corr-5', timestamp: new Date().toISOString() },
          },
          { status: 500 },
        );
      }),
    );
    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: /try again/i }));

    expect(await screen.findByRole('link', { name: 'Karim Nasser' })).toBeInTheDocument();
  });

  it('pages through the directory by writing the offset to the URL', async () => {
    const { user, location } = renderPage('/players?limit=2');

    expect(await screen.findByText('1–2 of 6')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(location()).toContain('offset=2');
    });
    expect(await screen.findByText('3–4 of 6')).toBeInTheDocument();
  });

  it('never offers the link action to a role that cannot hold it', async () => {
    renderPage('/players', 'SUPPORT');

    expect(await screen.findByRole('link', { name: 'Maya' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /create ichancy account/i }),
    ).not.toBeInTheDocument();
  });

  it('creates the missing Ichancy account from the row', async () => {
    const success = vi.spyOn(toast, 'success');
    const { user } = renderPage();

    await user.click(
      await screen.findByRole('button', { name: /create ichancy account for maya/i }),
    );
    await user.click(await screen.findByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(success).toHaveBeenCalledWith(
        'Ichancy account created',
        expect.objectContaining({ description: expect.stringContaining('tg512340002') }),
      );
    });
    // The row is refetched, so the operator sees the new login rather than a stale "Not linked".
    expect(await screen.findByText('tg512340002')).toBeInTheDocument();
  });
});

/**
 * Arabic is a mirrored console, not an English one with a font swap: the strings come out of the
 * bundle and the document itself reads right to left, which is what every logical `start`/`end`
 * utility on this screen resolves against.
 */
describe('in Arabic', () => {
  it('renders the directory in Arabic, warnings included', async () => {
    renderPage('/players', 'SUPER_ADMIN', 'ar');

    expect(await screen.findByRole('heading', { name: 'اللاعبون' })).toBeInTheDocument();
    // Maya is PENDING_ICHANCY, and the reason her deposits are stuck reads in Arabic too.
    expect(await screen.findByText('لا يمكن إضافة الرصيد')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'بانتظار Ichancy' })).toBeInTheDocument();
    // Amounts and ids stay in Western digits in both languages; see locales.ts.
    expect(screen.getByText('tg512340001')).toBeInTheDocument();
  });

  it('flips the document for Arabic and leaves it alone for English', async () => {
    const { unmount } = renderPage('/players', 'SUPER_ADMIN', 'ar');

    expect(await screen.findByRole('heading', { name: 'اللاعبون' })).toBeInTheDocument();
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    unmount();

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Players' })).toBeInTheDocument();
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  });
});

describe('the deposit and withdrawal actions on a row', () => {
  it('opens the deposit form for the player whose row was pressed', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Deposit to Karim Nasser' }));

    // The dialog names the player, so an operator cannot credit the wrong one from a long list.
    expect(await screen.findByRole('dialog')).toHaveTextContent(/Karim Nasser/);
    expect(screen.getByLabelText(/Amount/)).toBeInTheDocument();
    expect(screen.getByLabelText(/reason/i)).toBeInTheDocument();
  });

  it('opens the withdrawal form for the player whose row was pressed', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Withdraw from Karim Nasser' }));

    expect(await screen.findByRole('dialog')).toHaveTextContent(/Karim Nasser/);
  });

  it('asks for both required fields before it will go on', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Deposit to Karim Nasser' }));
    // Straight to the confirm step with nothing typed: both fields must object.
    await user.click(await screen.findByRole('button', { name: /review/i }));

    const errors = await screen.findAllByRole('alert');
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps the deposit receipt on the page after the dialog closes', async () => {
    // A list screen has nowhere else to put it. Without this, the outcome of a money action fired
    // from a row would vanish with the dialog that raised it.
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Deposit to Karim Nasser' }));
    // Above the 25,000.00 casino minimum the mock enforces, exactly as the backend does — a
    // smaller figure is refused with a 422 and the dialog rightly stays open on the error.
    await user.type(await screen.findByLabelText(/Amount/), '30000');
    await user.type(screen.getByLabelText(/reason/i), 'cash in office');
    await user.click(screen.getByRole('button', { name: /review/i }));
    await user.click(await screen.findByRole('button', { name: /^Credit /i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    // The receipt names the player — which the detail page never has to, because there the player
    // is the whole screen. On a list, "which one was that?" is a real question.
    expect(
      await screen.findByText(/Ichancy credits Karim Nasser with .* in a moment/),
    ).toBeInTheDocument();
  });

  it('does not offer either action to a role that may not decide money', async () => {
    renderPage('/players', 'SUPPORT');

    await screen.findByText('Karim Nasser');
    expect(screen.queryByRole('button', { name: /^Deposit to/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Withdraw from/ })).not.toBeInTheDocument();
  });
});
