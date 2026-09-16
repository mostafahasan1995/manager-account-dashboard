import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/utils';

import { TelegramPage } from './telegram-page';

// Toasts are asserted through the mock rather than the DOM — the house convention here, and the
// reason is practical: the Toaster is mounted by the app shell, not by renderWithProviders, so a
// DOM assertion would be testing whether the test harness renders a toaster.
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
  Toaster: () => null,
}));

/**
 * What is worth asserting on this screen, and why:
 *
 *  - THE FAILING ROW IS VISIBLE. A destination that has quietly stopped delivering looks identical
 *    to a healthy one in every column except the one this screen adds. If that stops rendering, the
 *    screen has lost its entire reason to exist while still looking correct.
 *  - THE REFUSALS NAME THE FIX. Four ways of failing, four different people who fix them. A test
 *    that only checked "an error appeared" would pass against exactly the generic error this
 *    feature replaced.
 *  - READ-ONLY ROLES SEE NO CONTROLS. Hiding is not the security boundary — the server is — but a
 *    button that always 403s is a lie about what the operator can do.
 *  - NOTHING LEAKS A BOT TOKEN.
 */

const render = (role: 'SUPER_ADMIN' | 'FINANCE_ADMIN' = 'SUPER_ADMIN') =>
  renderWithProviders(<TelegramPage />, {
    route: '/telegram',
    routePath: '/telegram',
    auth: { role },
  });

describe('the destination list', () => {
  it('shows each destination by its group name, not its chat id', async () => {
    render();

    expect(await screen.findByText('Cashier ops')).toBeInTheDocument();
    expect(screen.getByText('Daily reports')).toBeInTheDocument();
    expect(screen.getByText('Old finance group')).toBeInTheDocument();
  });

  it('renders the categories a destination receives', async () => {
    render();

    const row = (await screen.findByText('Cashier ops')).closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('Deposits')).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText('Withdrawals')).toBeInTheDocument();
  });

  it('shows the last failure in Telegram’s own words on the row that is broken', async () => {
    render();

    // The whole point of the screen: this row looks healthy in every other column.
    expect(
      await screen.findByText('Forbidden: bot was kicked from the group chat'),
    ).toBeInTheDocument();
  });

  it('renders "never verified" as its own state, not as an error and not as a blank', async () => {
    render();

    const row = (await screen.findByText('Daily reports')).closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('Never verified')).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText('Nothing sent yet')).toBeInTheDocument();
  });
});

describe('adding a destination', () => {
  it('binds a group and shows it in the table', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Add a destination' }));
    await user.type(await screen.findByLabelText('Group or channel'), 'https://t.me/new_ops_room');
    await user.click(screen.getByRole('button', { name: 'Add destination' }));

    expect(await screen.findByText('new ops room')).toBeInTheDocument();
  });

  it.each([
    ['https://t.me/notamember_group', 'The bot is not in that group.'],
    ['https://t.me/notadmin_group', 'is not an administrator'],
    ['https://t.me/nopost_channel', 'Post messages'],
    ['https://t.me/+SecretInvite', 'not a Telegram group or channel'],
  ])('refuses %s with the sentence that names the fix', async (url, needle) => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Add a destination' }));
    await user.type(await screen.findByLabelText('Group or channel'), url);
    await user.click(screen.getByRole('button', { name: 'Add destination' }));

    expect(await screen.findByText(new RegExp(needle, 'i'))).toBeInTheDocument();
  });

  it('refuses a destination that receives nothing', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Add a destination' }));
    await user.type(await screen.findByLabelText('Group or channel'), 'https://t.me/some_group');

    // Untick everything the form pre-selected: a destination subscribed to nothing is a row that
    // silently does nothing, which is exactly what this screen exists to prevent.
    for (const box of screen.getAllByRole('checkbox')) {
      if ((box as HTMLInputElement).getAttribute('data-state') === 'checked') {
        await user.click(box);
      }
    }
    await user.click(screen.getByRole('button', { name: 'Add destination' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/at least one/i);
  });

  it('says which categories nothing publishes yet, instead of hiding them', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Add a destination' }));

    // PROFIT, the two Sham Cash and the two USDT categories, plus player status changes.
    expect(await screen.findAllByText('Nothing publishes this yet')).toHaveLength(6);
  });
});

/**
 * THE PICK-LIST — and the case it exists for is the FIRST test here.
 *
 * A private group has no @username to resolve and no invite link a bot can follow, and there is no
 * Bot API call that lists a bot's chats. So before this list there was no value an operator could
 * put in the group field that the server was able to accept: they pasted the only link the group
 * had and were told, correctly, that it could not be used. Every other test in this block is about
 * not making that worse — a stale flag must not lock someone out, and a list that fails to load
 * must not take the paste-a-link path down with it.
 */
describe('picking a group the bot is already in', () => {
  /**
   * Scoped twice, and both scopes are load-bearing.
   *
   * To the DIALOG, because the table behind it lists destinations by the same group names — an
   * assertion that matched either would pass while the picker rendered nothing at all. Then to the
   * ROW, because several fixture chats are private and several are already bound, so a bare match
   * would keep passing if a label appeared on the wrong one.
   */
  const rowFor = (title: string) => {
    const row = within(screen.getByRole('dialog')).getByText(title).closest('li');
    expect(row).not.toBeNull();
    return within(row as HTMLElement);
  };

  /** Waits for the pick-list itself to have drawn, not for the table underneath to still be there. */
  const findChatRow = async (title: string) => {
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText(title);
  };

  it('lists a PRIVATE group, which has no link and cannot be bound any other way', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Add a destination' }));
    await findChatRow('Night shift (private)');

    // No @username at all — said out loud, because a blank there would read as a missing value.
    expect(rowFor('Night shift (private)').getByText('Private group')).toBeInTheDocument();
  });

  it('binds that private group from the list — the whole reason the list exists', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Add a destination' }));
    await user.click(
      await screen.findByRole('button', { name: 'Use this group: Night shift (private)' }),
    );

    // The chat id lands in the field the operator can see, rather than in hidden state: what is
    // about to be submitted stays visible.
    expect(await screen.findByLabelText('Group or channel')).toHaveValue('-1002233445566');

    await user.click(screen.getByRole('button', { name: 'Add destination' }));

    expect(
      await screen.findByRole('cell', { name: /night shift \(private\)/i }),
    ).toBeInTheDocument();
  });

  it('says the pick is still going to be checked, rather than implying it is already proved', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Add a destination' }));
    await user.click(
      await screen.findByRole('button', { name: 'Use this group: Night shift (private)' }),
    );

    expect(await screen.findByText(/checked again before anything is saved/i)).toBeInTheDocument();
  });

  it('marks a group that is already a destination instead of offering it again', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Add a destination' }));

    // Cashier ops is mockTelegramDestinations[0]. Offering it would earn a DUPLICATE the operator
    // could have been spared.
    await findChatRow('Cashier ops');
    expect(rowFor('Cashier ops').getByText('Already added')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Use this group: Cashier ops' }),
    ).not.toBeInTheDocument();

    // And a group the bot is in but has NOT been bound is still offered — otherwise this assertion
    // would pass just as well against a picker that offered nothing at all.
    expect(
      screen.getByRole('button', { name: 'Use this group: Night shift (private)' }),
    ).toBeInTheDocument();
  });

  it('fills the label from the group title, and leaves one the operator typed alone', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Add a destination' }));
    await user.type(await screen.findByLabelText('Label (optional)'), 'Overnight');
    await user.click(
      await screen.findByRole('button', { name: 'Use this group: Night shift (private)' }),
    );

    // A click on a row is not a request to discard something they meant.
    expect(screen.getByLabelText('Label (optional)')).toHaveValue('Overnight');
  });

  it('names what to fix for a group where the bot is only a member — without blocking the button', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Add a destination' }));

    expect(await screen.findByText(/member but not an administrator/i)).toBeInTheDocument();
    // Deliberately still pickable: the flag is a snapshot, and an operator who promoted the bot a
    // minute ago must not be locked out of a group that now works. The server decides.
    expect(
      screen.getByRole('button', { name: 'Use this group: Support escalations' }),
    ).toBeEnabled();
  });

  it('keeps a chat the bot was removed from, because that is the answer to the question', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Add a destination' }));

    expect(await screen.findByText(/was removed from this chat/i)).toBeInTheDocument();
  });

  it('tells an operator with no groups how to make one appear', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/telegram/chats`, () =>
        HttpResponse.json({
          success: true,
          data: [],
          error: null,
          meta: { correlationId: 'empty-chats', timestamp: new Date().toISOString() },
        }),
      ),
    );

    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Add a destination' }));

    expect(await screen.findByText('The bot is not in any group yet')).toBeInTheDocument();
    expect(screen.getByText(/make it an administrator/i)).toBeInTheDocument();
  });

  it('degrades to pasting a link when the list cannot be loaded, rather than blocking the dialog', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/telegram/chats`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'INTERNAL', message: 'boom' },
            meta: { correlationId: 'chats-down', timestamp: new Date().toISOString() },
          },
          { status: 500 },
        ),
      ),
    );

    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Add a destination' }));

    expect(await screen.findByText(/Paste a link instead/i)).toBeInTheDocument();

    // And the path that always worked still works.
    await user.type(await screen.findByLabelText('Group or channel'), 'https://t.me/fallback_room');
    await user.click(screen.getByRole('button', { name: 'Add destination' }));

    expect(await screen.findByText('fallback room')).toBeInTheDocument();
  });
});

describe('testing a destination', () => {
  it('reports a delivered test message', async () => {
    const user = userEvent.setup();
    render();

    const row = (await screen.findByText('Cashier ops')).closest('tr');
    await user.click(within(row as HTMLElement).getByRole('button', { name: /Send a test/ }));

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        'Test message delivered to Cashier ops.',
      );
    });
  });

  it('reports a failed test with the reason that names the fix', async () => {
    const user = userEvent.setup();
    render();

    const row = (await screen.findByText('Old finance group')).closest('tr');
    await user.click(within(row as HTMLElement).getByRole('button', { name: /Send a test/ }));

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        'The test message did not go through.',
        expect.objectContaining({
          description: expect.stringContaining('not in that group') as unknown as string,
        }),
      );
    });
  });
});

describe('permissions', () => {
  it('shows a read-only role the destinations and none of the controls', async () => {
    // FINANCE_ADMIN holds telegramDestinations.read but not .write.
    render('FINANCE_ADMIN');

    expect(await screen.findByText('Cashier ops')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a destination' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Send a test/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument();
    // But Re-check IS offered: it sends nothing, and "is this still working?" is exactly the
    // question a support user needs to answer without the authority to change anything.
    expect(screen.getAllByRole('button', { name: /^Re-check/ }).length).toBeGreaterThan(0);
  });
});

describe('publishing a report', () => {
  it('reports how many destinations received it', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Publish' }));

    // One seeded destination subscribes to REPORT.
    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        expect.stringMatching(/published to 1 destination/i),
      );
    });
  });
});

describe('the bot token', () => {
  it('never appears anywhere on the screen', async () => {
    render();

    await screen.findByText('Cashier ops');
    // A Telegram bot token is `<digits>:<35+ url-safe chars>`. Nothing on this screen may match it.
    expect(document.body.textContent).not.toMatch(/\d{6,}:[A-Za-z0-9_-]{30,}/);
  });
});

describe('editing a destination', () => {
  it('opens with the row’s own values and cannot repoint the chat', async () => {
    const user = userEvent.setup();
    render();

    const row = (await screen.findByText('Daily reports')).closest('tr');
    await user.click(within(row as HTMLElement).getByRole('button', { name: /^Edit/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Label (optional)')).toHaveValue('Daily reports');
    // The URL field is absent BY DESIGN: the row means "the bot proved it can post here", and
    // letting the chat change would carry that proof to a chat it was never made about.
    expect(within(dialog).queryByLabelText('Group or channel')).not.toBeInTheDocument();
    // It names the chat it is editing, read-only, so nobody edits the wrong group's categories.
    expect(within(dialog).getByText('Cashier reports')).toBeInTheDocument();
  });

  it('saves a changed label', async () => {
    const user = userEvent.setup();
    render();

    const row = (await screen.findByText('Daily reports')).closest('tr');
    await user.click(within(row as HTMLElement).getByRole('button', { name: /^Edit/ }));

    const field = await screen.findByLabelText('Label (optional)');
    await user.clear(field);
    await user.type(field, 'Reports channel');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Reports channel')).toBeInTheDocument();
  });
});

describe('removing a destination', () => {
  it('asks first, and says the removal is reversible', async () => {
    const user = userEvent.setup();
    render();

    const row = (await screen.findByText('Cashier ops')).closest('tr');
    await user.click(within(row as HTMLElement).getByRole('button', { name: /^Remove/ }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/Remove this destination\?/);
    // Nothing is deleted — the operator needs to know that before they hesitate over it.
    expect(dialog).toHaveTextContent(/Nothing is deleted/);
  });

  it('deactivates the row rather than dropping it from the table', async () => {
    const user = userEvent.setup();
    render();

    const row = (await screen.findByText('Cashier ops')).closest('tr');
    await user.click(within(row as HTMLElement).getByRole('button', { name: /^Remove/ }));
    await user.click(await screen.findByRole('button', { name: 'Remove' }));

    // Still listed, now marked disabled: DELETE deactivates, which is what makes it restorable.
    await waitFor(() => {
      expect(screen.getByText('Disabled')).toBeInTheDocument();
    });
    expect(screen.getByText('Cashier ops')).toBeInTheDocument();
  });
});

describe('the four states', () => {
  it('renders the empty state when the operator has no destinations', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/telegram/destinations`, () =>
        HttpResponse.json({ success: true, data: [], error: null, meta: {} }),
      ),
    );
    render();

    expect(await screen.findByText('No destinations yet')).toBeInTheDocument();
  });

  it('renders an error state with a retry', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/telegram/destinations`, () =>
        HttpResponse.json(
          { success: false, data: null, error: { code: 'BOOM', message: 'Upstream is down.' } },
          { status: 500 },
        ),
      ),
    );
    render();

    expect(await screen.findByText(/Upstream is down/)).toBeInTheDocument();
  });
});

describe('publishing when nothing is subscribed', () => {
  it('says nothing was sent rather than reporting a successful send of nothing', async () => {
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/reports/activity/publish`, () =>
        HttpResponse.json({
          success: true,
          data: { title: 'This month', considered: 0, delivered: 0, failed: 0 },
          error: null,
          meta: {},
        }),
      ),
    );
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(vi.mocked(toast.warning)).toHaveBeenCalledWith(
        expect.stringMatching(/no destination is subscribed to Reports/i),
      );
    });
  });

  it('reports a partial delivery as partial', async () => {
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/reports/activity/publish`, () =>
        HttpResponse.json({
          success: true,
          data: { title: 'Today', considered: 3, delivered: 2, failed: 1 },
          error: null,
          meta: {},
        }),
      ),
    );
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(vi.mocked(toast.warning)).toHaveBeenCalledWith(
        expect.stringMatching(/delivered to 2 of 3/i),
      );
    });
  });
});

describe('when the server refuses an action outright', () => {
  it('surfaces a failed publish rather than swallowing it', async () => {
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/reports/activity/publish`, () =>
        HttpResponse.json(
          { success: false, data: null, error: { code: 'BOOM', message: 'Report build failed.' } },
          { status: 500 },
        ),
      ),
    );
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          description: expect.stringContaining('Report build failed'),
        }),
      );
    });
  });

  it('surfaces a failed removal and leaves the row alone', async () => {
    server.use(
      http.delete(`${config.apiBaseUrl}/v1/admin/telegram/destinations/:id`, () =>
        HttpResponse.json(
          { success: false, data: null, error: { code: 'BOOM', message: 'Could not remove it.' } },
          { status: 500 },
        ),
      ),
    );
    const user = userEvent.setup();
    render();

    const row = (await screen.findByText('Cashier ops')).closest('tr');
    await user.click(within(row as HTMLElement).getByRole('button', { name: /^Remove/ }));
    await user.click(await screen.findByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          description: expect.stringContaining('Could not remove it'),
        }),
      );
    });
    // Still enabled: a failed removal must not look like a successful one.
    expect(screen.getByText('Cashier ops')).toBeInTheDocument();
  });
});

describe('re-checking without posting', () => {
  it('confirms a reachable destination without sending a message', async () => {
    const user = userEvent.setup();
    render();

    const row = (await screen.findByText('Cashier ops')).closest('tr');
    await user.click(within(row as HTMLElement).getByRole('button', { name: /^Re-check/ }));

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Cashier ops is reachable.');
    });
  });

  it('reports an unreachable one with the sentence that names the fix', async () => {
    const user = userEvent.setup();
    render();

    const row = (await screen.findByText('Old finance group')).closest('tr');
    await user.click(within(row as HTMLElement).getByRole('button', { name: /^Re-check/ }));

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        'The test message did not go through.',
        expect.objectContaining({
          description: expect.stringContaining('not in that group'),
        }),
      );
    });
  });
});
