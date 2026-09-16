import { screen, waitFor, within } from '@testing-library/react';
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

    expect(await screen.findByText('1–2 of 8')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(location()).toContain('offset=2');
    });
    expect(await screen.findByText('3–4 of 8')).toBeInTheDocument();
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

/**
 * The three doors into the directory that are not a Telegram Start: registering a player here,
 * importing the agent's old players, and the segmented view that shows them.
 */
describe('registering, importing and the segmented view', () => {
  it('offers Register and Import to a finance admin and hides both from support', async () => {
    const { unmount } = renderPage('/players', 'FINANCE_ADMIN');

    expect(await screen.findByRole('button', { name: 'Register player' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import from Ichancy' })).toBeInTheDocument();
    unmount();

    renderPage('/players', 'SUPPORT');

    await screen.findByRole('link', { name: 'Karim Nasser' });
    expect(screen.queryByRole('button', { name: 'Register player' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import from Ichancy' })).not.toBeInTheDocument();
  });

  it('registers a player and keeps the outcome on the page after the dialog closes', async () => {
    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Register player' }));
    await user.type(await screen.findByLabelText('First name'), 'Nour');
    await user.type(screen.getByLabelText('Last name'), 'Haddad');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Registered Nour Haddad')).toBeInTheDocument();
    expect(screen.getByText(/No Ichancy account was asked for/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Nour Haddad' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/players\//),
    );
    // The list is refetched, so the new row is in it.
    expect(await screen.findByRole('link', { name: 'Nour Haddad' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Registered Nour Haddad')).not.toBeInTheDocument();
  });

  it('keeps a registration whose Ichancy account failed on the page as a warning', async () => {
    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Register player' }));
    await user.type(await screen.findByLabelText('First name'), 'Rami');
    await user.type(screen.getByLabelText('Phone'), '+963900001000');
    await user.click(screen.getByRole('checkbox', { name: 'Create the Ichancy account now' }));
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(
      await screen.findByText('Registered Rami, but the Ichancy account failed'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Ichancy said: Ichancy did not answer/)).toBeInTheDocument();
  });

  it('says what the Ichancy account got when the registration asked for one', async () => {
    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Register player' }));
    await user.type(await screen.findByLabelText('First name'), 'Lina');
    await user.click(screen.getByRole('checkbox', { name: 'Create the Ichancy account now' }));
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByText('Registered Lina')).toBeInTheDocument();
    expect(screen.getByText(/Ichancy account created: login .* on agent /)).toBeInTheDocument();
  });

  it('imports the old players and shows the summary', async () => {
    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Import from Ichancy' }));

    expect(await screen.findByText('Import finished')).toBeInTheDocument();
    // One agent row the mock has never told us about; everyone else is already known.
    expect(screen.getByText(/Scanned \d+ · created 1 · already known \d+\./)).toBeInTheDocument();
    // The new row is in the list.
    expect(await screen.findByRole('link', { name: 'rami_2020' })).toBeInTheDocument();
  });

  it('reports an import that stopped early beside how far it got', async () => {
    server.use(
      http.post(`${PLAYERS_URL}/import`, () =>
        HttpResponse.json({
          success: true,
          data: {
            scanned: 40,
            created: 12,
            existing: 28,
            error: 'Ichancy did not answer page 2',
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
          },
          error: null,
          meta: { correlationId: 'test-import-1', timestamp: new Date().toISOString() },
        }),
      ),
    );
    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Import from Ichancy' }));

    expect(await screen.findByText('Import stopped early')).toBeInTheDocument();
    expect(screen.getByText('Scanned 40 · created 12 · already known 28.')).toBeInTheDocument();
    expect(screen.getByText(/Ichancy said: Ichancy did not answer page 2/)).toBeInTheDocument();
  });

  it('says so when the import request itself fails', async () => {
    server.use(
      http.post(`${PLAYERS_URL}/import`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'INTERNAL_ERROR', message: 'The import worker is down.' },
            meta: { correlationId: 'test-import-2', timestamp: new Date().toISOString() },
          },
          { status: 500 },
        ),
      ),
    );
    const failed = vi.spyOn(toast, 'error');
    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Import from Ichancy' }));

    await waitFor(() => {
      expect(failed).toHaveBeenCalledWith(
        'Could not import players',
        expect.objectContaining({ description: 'The import worker is down.' }),
      );
    });
    expect(screen.queryByText('Import finished')).not.toBeInTheDocument();
  });

  it('shows the old players through the URL when their segment is pressed', async () => {
    const { user, location } = renderPage();

    await screen.findByRole('link', { name: 'Karim Nasser' });
    await user.click(screen.getByRole('tab', { name: 'Old players' }));

    await waitFor(() => {
      expect(location()).toContain('source=ICHANCY_IMPORT');
    });
    expect(await screen.findByRole('link', { name: 'samer1987' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Karim Nasser' })).not.toBeInTheDocument();
    });
  });

  it('opens on the blocked view when the URL says so', async () => {
    renderPage('/players?blocked=true');

    expect(await screen.findByRole('link', { name: 'Bassel Khoury' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Karim Nasser' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Blocked' })).toHaveAttribute('aria-selected', 'true');
  });

  it('clears the segment along with the other filters', async () => {
    const { user, location } = renderPage('/players?source=ICHANCY_IMPORT&search=samer');

    await screen.findByRole('link', { name: 'samer1987' });
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => {
      expect(location()).not.toContain('source=');
    });
    expect(await screen.findByRole('link', { name: 'Karim Nasser' })).toBeInTheDocument();
  });
});

describe('blocking, unblocking and attaching from a row', () => {
  const rowOf = (name: string) => {
    const row = screen.getByRole('link', { name }).closest('tr');
    if (row === null) throw new Error(`no row for ${name}`);
    return row;
  };

  it('blocks a player from the row and the row says so', async () => {
    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Block Karim Nasser' }));
    await user.type(await screen.findByLabelText('Reason'), 'Chargeback on two receipts');
    await user.click(screen.getByRole('button', { name: 'Review this block' }));
    await user.click(await screen.findByRole('button', { name: 'Block Karim Nasser' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(within(rowOf('Karim Nasser')).getByText('Blocked')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Unblock Karim Nasser' })).toBeInTheDocument();
  });

  it('unblocks a player from the blocked view, which then empties', async () => {
    const { user } = renderPage('/players?blocked=true');

    await user.click(await screen.findByRole('button', { name: 'Unblock Bassel Khoury' }));
    expect(await screen.findByText('Three accounts sharing one bank receipt.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Unblock' }));

    expect(await screen.findByText('No players match these filters')).toBeInTheDocument();
  });

  it('attaches a Telegram account to an old player and the row shows it', async () => {
    const { user } = renderPage('/players?source=ICHANCY_IMPORT');

    await user.click(await screen.findByRole('button', { name: 'Attach Telegram to samer1987' }));
    await user.type(await screen.findByLabelText('Telegram ID'), '512340099');
    await user.click(screen.getByRole('button', { name: 'Attach' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('512340099')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Attach Telegram to samer1987' }),
    ).not.toBeInTheDocument();
  });

  it('reads the new actions in Arabic', async () => {
    renderPage('/players', 'SUPER_ADMIN', 'ar');

    expect(await screen.findByRole('button', { name: 'تسجيل لاعب' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'استيراد من Ichancy' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'اللاعبون القدامى' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'حظر Karim Nasser' })).toBeInTheDocument();
  });
});
