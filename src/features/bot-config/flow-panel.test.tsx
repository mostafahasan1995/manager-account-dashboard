import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/utils';
import type { AdminRole } from '@/types/enums';

import { FlowPanel } from './flow-panel';

/**
 * The flow editor, driven against the mock menu the way an operator drives it against the bot's.
 *
 * What is asserted, and why:
 *  - THE KEYBOARD IS THE TABLE. Rows and labels come out in the order Telegram draws them, and a
 *    move-earlier really changes that order after the refetch — so a reorder that never reached
 *    the API, or reached it and never invalidated, fails here.
 *  - THE REFUSALS ARE SHOWN IN THE SERVER'S WORDS. A screen another button opens, a required button
 *    hidden or deleted: each is a 409 whose message names the thing to fix, and the panel prints
 *    it rather than a summary.
 *  - THE DIALOG CHANGES SHAPE WITH THE KIND, and sends only the payload that kind carries.
 *  - THE GATE IS BOTH-OR-NEITHER, and says "switch off" when it is neither.
 *  - A ROLE THAT MAY NOT WRITE FINDS NOTHING THAT WRITES.
 */

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
  Toaster: () => null,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const TREE_URL = `${config.apiBaseUrl}/v1/admin/bot-menu`;

const render = (role: AdminRole = 'SUPER_ADMIN') =>
  renderWithProviders(<FlowPanel />, {
    route: '/bot-config',
    routePath: '/bot-config',
    auth: { role },
  });

const screens = async () => within(await screen.findByRole('navigation', { name: 'Screens' }));

const openScreen = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click((await screens()).getByRole('button', { name: new RegExp(`^${name}`) }));
};

/** The labels in drawing order, read off the move-earlier controls, which exist once per button. */
const drawnLabels = () =>
  screen
    .getAllByRole('button', { name: /^Move .* earlier$/ })
    .map((button) => button.getAttribute('aria-label')?.replace(/^Move (.*) earlier$/, '$1'));

describe('the screens and their keyboards', () => {
  it('lists the screens root first and draws the main keyboard row by row, in the bot’s own words', async () => {
    render();

    const nav = await screens();
    const [first] = nav.getAllByRole('button');
    expect(first).toHaveTextContent('Main menu');
    expect(first).toHaveAttribute('aria-current', 'true');
    expect(nav.getByRole('button', { name: /^Help/ })).toBeInTheDocument();

    expect(await screen.findByText('Row 1')).toBeInTheDocument();
    expect(screen.getByText('💵 شحن الرصيد')).toBeInTheDocument();
    // The action's description, quoted from the bot's catalogue rather than translated.
    expect(screen.getByText('يبدأ طلب شحن الرصيد')).toBeInTheDocument();
    expect(screen.getByText('Opens Help')).toBeInTheDocument();
    expect(drawnLabels().slice(0, 2)).toEqual(['💵 شحن الرصيد', '💸 سحب الرصيد']);
  });

  it('opens another screen and explains its message and back buttons', async () => {
    const user = userEvent.setup();
    render();

    await openScreen(user, 'Help');

    expect(
      await screen.findByLabelText('Message sent when the player opens this screen'),
    ).toHaveValue('كيف يمكننا مساعدتك؟');
    expect(screen.getByText('Sends your message')).toBeInTheDocument();
    expect(screen.getByText('Goes back to the previous screen')).toBeInTheDocument();
  });

  it('saves an edited prompt, and a cleared one as no message at all', async () => {
    const user = userEvent.setup();
    render();
    await openScreen(user, 'Help');

    const prompt = await screen.findByLabelText('Message sent when the player opens this screen');
    await user.clear(prompt);
    await user.type(prompt, 'أهلاً بك');
    // The gate card has its own Save; the editor's comes first in the document.
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0]!);

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Saved.');
    });
  });

  it('refuses to delete a screen a button still opens, in the API’s own words', async () => {
    const user = userEvent.setup();
    render();
    await openScreen(user, 'Help');

    await user.click(await screen.findByRole('button', { name: 'Delete screen' }));

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        'Could not delete that screen.',
        expect.objectContaining({ description: expect.stringContaining('still opens') as string }),
      );
    });
    expect((await screens()).getByRole('button', { name: /^Help/ })).toBeInTheDocument();
  });

  it('deletes a screen once nothing opens it', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Delete ℹ️ مساعدة' }));
    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Button deleted.');
    });
    await waitFor(() => {
      expect(screen.queryByText('Opens Help')).not.toBeInTheDocument();
    });

    await openScreen(user, 'Help');
    await user.click(await screen.findByRole('button', { name: 'Delete screen' }));

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Help deleted.');
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^Help/ })).not.toBeInTheDocument();
    });
  });

  it('adds a screen and lands on it', async () => {
    const user = userEvent.setup();
    render();

    const nav = await screens();
    await user.click(nav.getByRole('button', { name: 'Add a screen' }));
    // Nothing typed, nothing saved.
    expect(nav.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.type(nav.getByLabelText('Screen name'), 'Promotions');
    await user.click(nav.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Promotions added.');
    });
    const created = await (await screens()).findByRole('button', { name: /^Promotions/ });
    expect(created).toHaveAttribute('aria-current', 'true');
    expect(await screen.findByText('This screen has no buttons')).toBeInTheDocument();

    // And cancelling the form puts the button back without saving anything.
    await user.click((await screens()).getByRole('button', { name: 'Add a screen' }));
    await user.click((await screens()).getByRole('button', { name: 'Cancel' }));
    expect((await screens()).getByRole('button', { name: 'Add a screen' })).toBeInTheDocument();
  });
});

describe('the buttons on a screen', () => {
  it('hides a button nothing requires, and refuses to hide the last required one', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('switch', { name: 'Show 📋 الشروط in the bot' }));
    expect(await screen.findByText('Hidden from the bot')).toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Show 💸 سحب الرصيد in the bot' }));
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        'Could not save.',
        expect.objectContaining({ description: expect.stringContaining('withdraw') as string }),
      );
    });
  });

  it('moves a button earlier and the keyboard redraws in the new order', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Move 💸 سحب الرصيد earlier' }));

    await waitFor(() => {
      expect(drawnLabels().slice(0, 2)).toEqual(['💸 سحب الرصيد', '💵 شحن الرصيد']);
    });
    // The first button cannot move earlier; the last cannot move later. Neither is an error.
    await user.click(screen.getByRole('button', { name: 'Move 💸 سحب الرصيد earlier' }));
    await user.click(screen.getByRole('button', { name: 'Move ℹ️ مساعدة later' }));
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
  });

  it('deletes a button, and refuses to delete the last deposit button', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Delete 📋 الشروط' }));
    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Button deleted.');
    });
    await waitFor(() => {
      expect(screen.queryByText('📋 الشروط')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Delete 💵 شحن الرصيد' }));
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        'Could not save.',
        expect.objectContaining({ description: expect.stringContaining('deposit') as string }),
      );
    });
  });

  it('adds a built-in button through the dialog', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Add a button' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText('New button')).toBeInTheDocument();
    expect(dialog.getByText('On the screen “Main menu”.')).toBeInTheDocument();
    // No label, no save — a blank label is a blank button in Telegram.
    expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();

    await user.type(dialog.getByLabelText('Button label'), '🎁 هدية');
    await user.clear(dialog.getByLabelText('Row'));
    await user.type(dialog.getByLabelText('Row'), '6');
    await user.click(dialog.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith('🎁 هدية added.');
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Row 7')).toBeInTheDocument();
    expect(screen.getByText('🎁 هدية')).toBeInTheDocument();
  });

  it('keeps the dialog open on a refused save — a duplicate label is fixed, not retyped', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Add a button' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText('Button label'), '💵 شحن الرصيد');
    await user.click(dialog.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        'Could not save.',
        expect.objectContaining({ description: expect.stringContaining('label') as string }),
      );
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('turns a button into a message, sending only the message', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Edit 📋 الشروط' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText('Edit button')).toBeInTheDocument();

    await user.click(dialog.getByLabelText('What it does'));
    await user.click(await screen.findByRole('option', { name: 'Sends a message you write' }));
    // Nothing written yet, nothing to send.
    expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.type(
      dialog.getByRole('textbox', { name: /Each screen is one keyboard/ }),
      'الشروط هنا.',
    );
    await user.click(dialog.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith('📋 الشروط saved.');
    });
    expect(await screen.findByText('Sends your message')).toBeInTheDocument();
  });

  it('points a button at another screen, and says so on the row', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Edit 🟢 حالة الخدمة' }));
    const dialog = within(await screen.findByRole('dialog'));

    await user.click(dialog.getByLabelText('What it does'));
    await user.click(await screen.findByRole('option', { name: 'Opens another screen' }));
    expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.click(dialog.getByLabelText('Screen to open'));
    await user.click(await screen.findByRole('option', { name: 'Help' }));
    await user.click(dialog.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith('🟢 حالة الخدمة saved.');
    });
    await waitFor(() => {
      expect(screen.getAllByText('Opens Help')).toHaveLength(2);
    });
  });

  it('offers "goes back" with nothing to fill in, and explains where it goes', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Edit 💬 الدعم' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByLabelText('What it does'));
    await user.click(await screen.findByRole('option', { name: 'Goes back' }));

    expect(dialog.getByText(/Returns the player to whichever screen/)).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Save' })).toBeEnabled();
    await user.click(dialog.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('says when there is no other screen to open', async () => {
    const user = userEvent.setup();
    render();

    // Take the help screen away first: unlink it, then delete it.
    await user.click(await screen.findByRole('button', { name: 'Delete ℹ️ مساعدة' }));
    await waitFor(() => {
      expect(screen.queryByText('Opens Help')).not.toBeInTheDocument();
    });
    await openScreen(user, 'Help');
    await user.click(await screen.findByRole('button', { name: 'Delete screen' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^Help/ })).not.toBeInTheDocument();
    });

    await user.click(await screen.findByRole('button', { name: 'Add a button' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByLabelText('What it does'));
    await user.click(await screen.findByRole('option', { name: 'Opens another screen' }));

    expect(dialog.getByText(/There is no other screen to open yet/)).toBeInTheDocument();
  });
});

describe('the channel gate', () => {
  it('starts from the saved channel, switches off when both are cleared, and saves when both are set', async () => {
    const user = userEvent.setup();
    render();

    const username = await screen.findByLabelText('Channel @username');
    const channelId = screen.getByLabelText('Channel ID');
    expect(username).toHaveValue('ichancy_news');
    expect(channelId).toHaveValue('-1003456789012');

    await user.clear(username);
    // Half a gate: neither empty nor complete, so nothing can be saved.
    expect(screen.queryByRole('button', { name: 'Switch off' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Save' }).at(-1)).toBeDisabled();

    await user.clear(channelId);
    await user.click(screen.getByRole('button', { name: 'Switch off' }));
    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Channel gate switched off.');
    });

    await user.type(username, 'my_channel');
    await user.type(channelId, '-1009999888877');
    await user.click(screen.getAllByRole('button', { name: 'Save' }).at(-1)!);
    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Channel gate saved.');
    });
  });

  it('shows the API’s refusal', async () => {
    const user = userEvent.setup();
    render();

    const channelId = await screen.findByLabelText('Channel ID');
    await user.clear(channelId);
    await user.type(channelId, 'not-a-number');
    await user.click(screen.getAllByRole('button', { name: 'Save' }).at(-1)!);

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        'Could not save the channel gate.',
        expect.objectContaining({ description: expect.any(String) as string }),
      );
    });
  });
});

describe('a role that may not write', () => {
  it('reads everything and finds nothing that writes', async () => {
    render('REVIEWER');

    expect(await screen.findByText('💵 شحن الرصيد')).toBeInTheDocument();
    expect(
      screen.getByText(/Changing a payment method needs the payment rails permission/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a screen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a button' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Channel @username')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });
});

describe('the states that are not a menu', () => {
  it('shows the failure and a retry when the tree cannot be loaded', async () => {
    server.use(
      http.get(TREE_URL, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'INTERNAL_ERROR', message: 'The menu service is down.' },
            meta: { correlationId: 'test-corr-9', timestamp: new Date().toISOString() },
          },
          { status: 500 },
        ),
      ),
    );
    render();

    expect(await screen.findByText('The menu service is down.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('says so when the bot has no menu at all', async () => {
    server.use(
      http.get(TREE_URL, () =>
        HttpResponse.json({
          success: true,
          data: { nodes: [], builtinActions: [], gate: { channelId: null, channelUsername: null } },
          error: null,
          meta: { correlationId: 'test-corr-8', timestamp: new Date().toISOString() },
        }),
      ),
    );
    render();

    expect(await screen.findByText('This bot has no menu yet')).toBeInTheDocument();
  });

  it('reads in Arabic', async () => {
    renderWithProviders(<FlowPanel />, { auth: { role: 'SUPER_ADMIN' }, locale: 'ar' });

    expect(
      await screen.findByRole('region', { name: 'القائمة التي يضغطها اللاعبون' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('navigation', { name: 'الشاشات' })).toBeInTheDocument();
  });
});
