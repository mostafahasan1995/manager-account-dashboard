import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NAV_ITEMS } from '@/components/layout/nav-items';
import { config } from '@/config';
import { can } from '@/lib/auth/permissions';
import { mockPaymentMethods } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/utils';
import type { AdminRole } from '@/types/enums';

import { BotConfigPage } from './bot-config-page';

/**
 * What is worth asserting on this screen, and why:
 *
 *  - THE MARKERS ARE THE FEATURE, so they are asserted PER SECTION against a table written out
 *    below. This screen exists to say which half of itself is real; a suite that counted badges in
 *    aggregate would stay green while one card flipped from "Reading only" to "Live" and started
 *    telling an operator that typing a new bot name saves it. That is the exact lie the page was
 *    built to prevent, so it is the one thing here checked card by card.
 *  - THE LIVE PART IS REALLY LIVE. The payment buttons are the only editable surface here, so a
 *    test that only rendered them would not prove the thing the screen claims. The edit is driven
 *    through the form and then read back out of the PREVIEW, which is fed by a refetch — so it
 *    fails if the save never reached the API or the cache was never invalidated.
 *  - THE PREVIEW OBEYS THE BOT'S RULES. Especially the surprising one: exactly one qualifying
 *    method means NO keyboard at all. If that silently stops being mirrored, the screen starts
 *    telling operators their player will see a button that never appears.
 *  - THE ABSENCES ARE ASSERTED, not merely described in a test name. "No editor for the commands"
 *    and "no save button on the draft" are claims about what is NOT rendered, and a name promising
 *    an absence over a body that never looks for it is worth nothing.
 *  - A ROLE THAT MAY NOT WRITE FINDS NOTHING THAT WRITES. Hiding is not the boundary — the server
 *    is — but a save button that always 403s is a lie about what the operator can do.
 *  - THE ARABIC CONSOLE KEEPS THE BOT'S OWN DIRECTION. The strings quoted here are the bot's, in
 *    the bot's language, and the ones a person retypes into Telegram are Latin. Both have to
 *    survive the mirror, or the screen prints commands nobody can type.
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

const render = (role: AdminRole = 'SUPER_ADMIN') =>
  renderWithProviders(<BotConfigPage />, {
    route: '/bot-config',
    routePath: '/bot-config',
    auth: { role },
  });

/** The block for one payment method, found by the one field on it nobody can edit. */
const rowFor = (code: string) => within(screen.getByRole('region', { name: code }));

/** The phone's keyboard, scoped away from every other list on the page. */
const previewButtons = () =>
  within(screen.getByRole('list', { name: 'What the player sees' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent);

const openTab = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(await screen.findByRole('tab', { name }));
};

describe('the payment buttons, which are the live part', () => {
  it('shows each method’s bot label, its order and whether it appears at all', async () => {
    render();

    const bank = rowFor(await waitForCode('BANK_SYR'));
    expect(bank.getByLabelText('Button label')).toHaveValue('Bank transfer');
    expect(bank.getByLabelText('Order')).toHaveValue('1');
    expect(bank.getByLabelText('Shown in the bot')).toBeChecked();
  });

  it('marks a method the bot does not show, rather than leaving it out of the list', async () => {
    render();
    await openPaymentButtonsTab();

    // OLD_CRYPTO is inactive in the fixtures. Hiding it here would leave an operator with no way to
    // turn a button back on — the state this screen is most likely to be opened to fix.
    expect(await screen.findByRole('region', { name: 'OLD_CRYPTO' })).toBeInTheDocument();
    expect(rowFor('OLD_CRYPTO').getByText('Hidden from the bot')).toBeInTheDocument();
  });

  it('says out loud that a label’s emoji cost nothing, and prints what the payload measures', async () => {
    render();
    await openPaymentButtonsTab();

    expect(await screen.findByText('Emoji in a label are safe')).toBeInTheDocument();
    expect(
      rowFor(await waitForCode('BANK_SYR')).getByText(/Hidden payload \d+ of 64 bytes/),
    ).toBeInTheDocument();
  });

  it('renames a button and the change reaches the bot’s keyboard', async () => {
    const user = userEvent.setup();
    render();

    const bank = rowFor(await waitForCode('BANK_SYR'));
    const label = bank.getByLabelText('Button label');
    await user.clear(label);
    await user.type(label, '🏦 Bank transfer');

    // Said before it is true, and only while it is untrue.
    expect(bank.getByText('Not saved')).toBeInTheDocument();

    await user.click(bank.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        expect.stringContaining('🏦 Bank transfer'),
      );
    });
    // Read back out of the preview, which is drawn from a refetch: this fails if the PATCH never
    // happened, or happened and never invalidated anything.
    await waitFor(() => {
      expect(previewButtons()).toContain('🏦 Bank transfer');
    });
    expect(rowFor('BANK_SYR').queryByText('Not saved')).not.toBeInTheDocument();
  });

  it('refuses to save a button with no label at all', async () => {
    const user = userEvent.setup();
    render();

    const bank = rowFor(await waitForCode('BANK_SYR'));
    await user.clear(bank.getByLabelText('Button label'));

    // A blank label is a blank button in Telegram, which is a row a player cannot read.
    expect(bank.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('surfaces a refused save instead of leaving the row looking saved', async () => {
    server.use(
      http.patch(`${config.apiBaseUrl}/v1/admin/payment-methods/:id`, () =>
        HttpResponse.json(
          { success: false, data: null, error: { code: 'BOOM', message: 'Rail is locked.' } },
          { status: 500 },
        ),
      ),
    );
    const user = userEvent.setup();
    render();

    const bank = rowFor(await waitForCode('BANK_SYR'));
    await user.type(bank.getByLabelText('Button label'), '!');
    await user.click(bank.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        expect.stringContaining('Bank transfer'),
        expect.objectContaining({
          description: expect.stringContaining('Rail is locked') as unknown as string,
        }),
      );
    });
    expect(rowFor('BANK_SYR').getByText('Not saved')).toBeInTheDocument();
  });
});

describe('the preview, which mirrors what the bot would actually send', () => {
  it('draws one button per method whose limits take the amount', async () => {
    render();

    await waitForCode('BANK_SYR');
    await waitFor(() => {
      expect(previewButtons()).toEqual(['Bank transfer', 'Mobile wallet', 'Cash office']);
    });
  });

  it('sends no keyboard when exactly one method qualifies, and says why', async () => {
    const user = userEvent.setup();
    render();
    await openPaymentButtonsTab();

    const amount = await screen.findByLabelText('Deposit amount');
    await user.clear(amount);
    await user.type(amount, '3000000');

    // Only the bank rail reaches three million. The bot opens the deposit instead of asking.
    expect(await screen.findByText(/sends no buttons at all/i)).toBeInTheDocument();
  });

  it('answers with limits, not a keyboard, when nothing takes the amount', async () => {
    const user = userEvent.setup();
    render();
    await openPaymentButtonsTab();

    const amount = await screen.findByLabelText('Deposit amount');
    await user.clear(amount);
    await user.type(amount, '5000');

    expect(await screen.findByText(/No active method takes this amount/i)).toBeInTheDocument();
    // And it names the rails that were skipped, because "why is mine missing" is the question.
    expect(screen.getByText(/Outside its limits at this amount/)).toBeInTheDocument();
  });

  it('warns about the one thing that really does drop a button: an oversized payload', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/payment-methods`, () =>
        HttpResponse.json({
          success: true,
          data: [
            { ...mockPaymentMethods[0]!, id: 'x'.repeat(70), code: 'HUGE_ID' },
            mockPaymentMethods[1]!,
          ],
          error: null,
          meta: {},
        }),
      ),
    );
    render();
    await openPaymentButtonsTab();

    expect(await screen.findAllByText(/Over Telegram/)).not.toHaveLength(0);
    // The bot leaves it out of the keyboard, so the preview does too.
    await waitFor(() => {
      expect(previewButtons()).toEqual(['Mobile wallet']);
    });
  });

  it('quotes the bot’s own Arabic rather than translating it into the console’s language', async () => {
    render();
    await openPaymentButtonsTab();

    expect(await screen.findByText('اختر طريقة الدفع:')).toBeInTheDocument();
    expect(screen.getByText(/answers every player in Arabic/i)).toBeInTheDocument();
  });
});

/*
 * ── THE HONESTY MARKERS, SECTION BY SECTION ───────────────────────────────────────────────────
 *
 * Every line of this table was read off the panel that renders it — the `state=` on each
 * `SectionHeader` in command-menu-panel, message-surfaces-panel, identity-panel and
 * payment-buttons-panel, plus the hand-built routing header in bot-config-page. Two of them are
 * easy to get wrong from memory, and both are wrong in the same direction: the deposit PREVIEW is
 * "Reading only" however live the data feeding it is, and the deposit NOTIFICATIONS are "Reading
 * only" however really they are sent. When this table and a panel disagree, the panel is the
 * source and this is the copy.
 *
 * Written out rather than counted, because an aggregate over badges survives exactly the failure
 * this screen exists to prevent: one section quietly changing what it promises about itself.
 */
type Marker = 'Live' | 'Reading only' | 'Draft only';

const ANY_MARKER = /^(Live|Reading only|Draft only)$/;

interface Section {
  readonly title: string;
  readonly marker: Marker;
}

/** Outside the tabs, so it is on screen whichever tab is open. */
const ALWAYS: readonly Section[] = [
  { title: 'Where the bot posts your notifications', marker: 'Live' },
];

const TABS: readonly { readonly tab: string; readonly sections: readonly Section[] }[] = [
  {
    tab: 'Payment buttons',
    sections: [
      { title: 'The buttons a player taps to pay', marker: 'Live' },
      { title: 'What the player sees', marker: 'Reading only' },
      { title: 'The buttons under the text box', marker: 'Reading only' },
    ],
  },
  {
    tab: 'Commands',
    sections: [
      { title: 'What your bot advertises', marker: 'Reading only' },
      { title: 'Why the staff commands are not in the public menu', marker: 'Reading only' },
      { title: 'Pushing this menu to Telegram', marker: 'Reading only' },
    ],
  },
  {
    tab: 'Messages',
    sections: [
      { title: 'Replies to a tap or a command', marker: 'Reading only' },
      { title: 'Deposit notifications', marker: 'Reading only' },
      { title: 'The admin bot', marker: 'Reading only' },
      { title: 'Literals in the handlers', marker: 'Reading only' },
      { title: 'Draft a rewrite', marker: 'Draft only' },
    ],
  },
  {
    tab: 'Name and profile',
    sections: [{ title: 'The name, the profile texts and the language', marker: 'Draft only' }],
  },
];

describe.each(TABS)('the marker every section carries — $tab', ({ tab, sections }) => {
  it('says of each section whether editing it changes the bot', async () => {
    const user = userEvent.setup();
    render();
    // The rails settle first: three of these sections are drawn around a pending query, and
    // switching tabs mid-flight is a race this test has no reason to run.
    await waitForCode('BANK_SYR');
    await openTab(user, tab);

    const expected = [...ALWAYS, ...sections];
    for (const { title, marker } of expected) {
      const section = within(await screen.findByRole('region', { name: title }));

      expect(section.getByText(marker)).toBeInTheDocument();
      // Exactly one: a section carrying two markers is a section making two claims.
      expect(section.getAllByText(ANY_MARKER)).toHaveLength(1);
      if (marker !== 'Live') {
        // The assertion this whole block exists for. "Live" is the strongest badge on the page and
        // its tooltip reads "Saved here" — it may not appear over anything this console cannot
        // write, which is every section on the screen but two.
        expect(section.queryByText('Live')).not.toBeInTheDocument();
      }
    }

    // And nothing is unaccounted for: a card that declares a state nobody listed fails here rather
    // than shipping unread.
    expect(screen.getAllByText(ANY_MARKER)).toHaveLength(expected.length);
  });
});

describe('what a marker means when you ask it', () => {
  it('puts the whole explanation of “draft only” behind the badge', async () => {
    const user = userEvent.setup();
    render();
    await openTab(user, 'Name and profile');

    // Two words on a badge are not the claim. This sentence is, and on a section that is not live
    // it carries the entire reason why.
    const identity = within(
      await screen.findByRole('region', { name: 'The name, the profile texts and the language' }),
    );
    await user.hover(identity.getByText('Draft only'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Nothing reads this. What you type is not saved, not sent, and gone when the page reloads.',
    );
  });

  it('leaves that sentence reachable without a pointer', async () => {
    const user = userEvent.setup();
    render();
    await openTab(user, 'Messages');

    const draft = within(await screen.findByRole('region', { name: 'Draft a rewrite' }));
    expect(draft.getByText('Draft only')).toHaveAttribute('tabindex', '0');
  });
});

describe('the parts that are not live', () => {
  it('marks the command list as a reading and refuses to offer an editor for it', async () => {
    const user = userEvent.setup();
    render();
    await openTab(user, 'Commands');

    expect(await screen.findByText('What your bot advertises')).toBeInTheDocument();
    expect(screen.getByText(/no “add a command” here/i)).toBeInTheDocument();

    // "Refuses to offer an editor" is a claim about what is NOT there, so it is checked where an
    // editor would have to be: nothing in the table to type into, and nothing to press.
    const table = within(screen.getByRole('table'));
    expect(table.queryAllByRole('textbox')).toHaveLength(0);
    expect(table.queryAllByRole('button', { name: /Save|Add/ })).toHaveLength(0);

    // Fifteen commands, each with the audience that decides whether it is a security property.
    expect(screen.getByText('/queue')).toBeInTheDocument();
    expect(screen.getAllByText('Staff chats only')).toHaveLength(5);
    expect(screen.getAllByText('Everyone')).toHaveLength(10);
  });

  it('admits the command list is a copy that can go stale', async () => {
    const user = userEvent.setup();
    render();
    await openTab(user, 'Commands');

    expect(await screen.findByText('This list is a copy')).toBeInTheDocument();
  });

  it('does not duplicate the push action that already exists on the operators screen', async () => {
    const user = userEvent.setup();
    render();
    await openTab(user, 'Commands');

    expect(await screen.findByText(/deliberately no button for it here/i)).toBeInTheDocument();
  });

  it('names the message surfaces it can point at, and refuses to call them all of them', async () => {
    const user = userEvent.setup();
    render();
    await openTab(user, 'Messages');

    expect(await screen.findByText(/is not one list/)).toBeInTheDocument();
    expect(screen.getByText('Replies to a tap or a command')).toBeInTheDocument();
    expect(screen.getByText('Deposit notifications')).toBeInTheDocument();
    expect(screen.getByText('The admin bot')).toBeInTheDocument();
    expect(screen.getByText('Literals in the handlers')).toBeInTheDocument();
    // The sentence that stops four cards being read as an inventory of the bot's text.
    expect(screen.getByText(/not a complete one either/i)).toBeInTheDocument();
    // The mismatch a single editable list would have hidden.
    expect(screen.getByText(/written in English/i)).toBeInTheDocument();
  });

  it('gives the message draft no save button, and says that is deliberate', async () => {
    const user = userEvent.setup();
    render();
    await openTab(user, 'Messages');

    const draft = await screen.findByLabelText('The welcome');
    await user.type(draft, 'x');

    expect(
      within(screen.getByRole('region', { name: 'Draft a rewrite' })).getByText('Draft only'),
    ).toBeInTheDocument();
    expect(screen.getByText(/There is no save button/i)).toBeInTheDocument();
    // The absence itself, and not only the paragraph explaining it: a box that accepts typing and
    // then offers to save it is the one control this screen was written to leave out.
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    // The one control a draft may have: putting the bot's own words back.
    await user.click(screen.getByRole('button', { name: /Put the bot’s own words back/ }));
    expect(screen.getByLabelText('The welcome')).not.toHaveValue('x');
  });

  it('lets the name be typed, saves nothing, and names the change that would make it real', async () => {
    const user = userEvent.setup();
    render();
    await openTab(user, 'Name and profile');

    const name = await screen.findByLabelText('The name the bot calls itself');
    expect(name).toHaveValue('Ichancy Cashier');
    await user.clear(name);
    await user.type(name, 'Damascus Cashier');
    expect(name).toHaveValue('Damascus Cashier');

    expect(screen.getByText(/no bot handler reads it/i)).toBeInTheDocument();
    expect(screen.getByText(/no save button on this card/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('counts a profile text against Telegram’s real cap', async () => {
    const user = userEvent.setup();
    render();
    await openTab(user, 'Name and profile');

    const bio = await screen.findByLabelText('Short bio');
    await user.clear(bio);
    await user.type(bio, 'a'.repeat(20));

    expect(screen.getByText('20 of 120 characters')).toBeInTheDocument();
  });
});

describe('who may open this at all', () => {
  it('keeps the nav entry to the roles that may configure their own bot', () => {
    const item = NAV_ITEMS.find((row) => row.to === '/bot-config');

    expect(item?.capability).toBe('telegramDestinations.write');
    expect(can('SUPER_ADMIN', 'telegramDestinations.write')).toBe(true);
    expect(can('PLATFORM_ADMIN', 'telegramDestinations.write')).toBe(true);
    // The roles the route sends elsewhere rather than showing a screen of disabled fields.
    expect(can('FINANCE_ADMIN', 'telegramDestinations.write')).toBe(false);
    expect(can('SUPPORT', 'telegramDestinations.write')).toBe(false);
  });

  it('offers a role without the rails permission nothing that writes', async () => {
    // SUPPORT holds paymentMethods.read and not .write — the capability the PATCH behind the save
    // button is enforced on, which is a different question from who may open the screen.
    render('SUPPORT');

    await waitForCode('BANK_SYR');
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(rowFor('BANK_SYR').getByLabelText('Button label')).toBeDisabled();
    expect(screen.getByText(/needs the payment rails permission/i)).toBeInTheDocument();
  });
});

describe('the four states of the live section', () => {
  it('renders an error with a retry rather than an empty keyboard', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/payment-methods`, () =>
        HttpResponse.json(
          { success: false, data: null, error: { code: 'BOOM', message: 'Upstream is down.' } },
          { status: 500 },
        ),
      ),
    );
    render();
    await openPaymentButtonsTab();

    expect(await screen.findByText(/Upstream is down/)).toBeInTheDocument();
  });

  it('tells an operator with no rails where buttons come from', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/payment-methods`, () =>
        HttpResponse.json({ success: true, data: [], error: null, meta: {} }),
      ),
    );
    render();
    await openPaymentButtonsTab();

    expect(await screen.findByText('No payment methods yet')).toBeInTheDocument();
    expect(
      screen.getByText(/no active payment method to build a preview from/i),
    ).toBeInTheDocument();
  });
});

/*
 * ── THE SAME SCREEN, MIRRORED ─────────────────────────────────────────────────────────────────
 *
 * The console flips to RTL in Arabic and the bot does not flip with it. Three runs on this page
 * are Latin sitting inside Arabic prose — the command in the menu table, the `/deposit` a player
 * retypes into Telegram, and the deposit notification the bot generates in English — and a leading
 * slash is bidi-neutral, so a run without a direction of its own takes the paragraph's and prints
 * `start/`, which is not a command anyone can type. The mirror image matters just as much: the
 * bot's Arabic must not be dragged the other way on the English console, which is the same bug
 * seen from the other side.
 */
describe('the same screen in Arabic', () => {
  const renderAr = () =>
    renderWithProviders(<BotConfigPage />, {
      route: '/bot-config',
      routePath: '/bot-config',
      auth: { role: 'SUPER_ADMIN' },
      locale: 'ar',
    });

  it('mirrors the console and still prints the player’s command left to right', async () => {
    renderAr();
    await openPaymentButtonsTab();

    expect(await screen.findByRole('region', { name: 'ما يراه اللاعب' })).toBeInTheDocument();
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    // The one string on this screen an operator retypes into Telegram character for character.
    expect(await screen.findByText(/^\/deposit/)).toHaveAttribute('dir', 'ltr');
  });

  it('keeps the slash in front of the word in the command table', async () => {
    const user = userEvent.setup();
    renderAr();
    await openTab(user, 'الأوامر');

    expect(await screen.findByText('/deposit')).toHaveAttribute('dir', 'ltr');
    // The column beside it is what Telegram shows an Arabic player, and stays Arabic.
    expect(screen.getByText('💰 شحن الرصيد')).toHaveAttribute('dir', 'rtl');
  });

  it('lays the English notification out left to right, beside an Arabic one that is not', async () => {
    const user = userEvent.setup();
    renderAr();
    await openTab(user, 'الرسائل');

    // The pair is the case a direction has to be carried for: same card, same component, opposite
    // directions, because the bot writes one in Arabic and generates the other in English.
    // Inheriting the console's RTL here lays the English out backwards.
    expect(await screen.findByLabelText('تمت إضافة الإيداع')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByLabelText('رسالة الترحيب')).toHaveAttribute('dir', 'rtl');
  });

  it('writes the bot’s Arabic profile texts right to left and quotes its Latin name unchanged', async () => {
    const user = userEvent.setup();
    renderAr();
    await openTab(user, 'الاسم والملف');

    expect(await screen.findByLabelText('الوصف')).toHaveAttribute('dir', 'rtl');
    expect(screen.getByLabelText('النبذة القصيرة')).toHaveAttribute('dir', 'rtl');
    // The name is a Latin literal in the bot, so it reads the same on either console — quoted,
    // never translated, exactly like the command in the table. Which means it needs the table's
    // direction too: unmarked, the field holds a Latin run in an RTL box, and the value surviving
    // is only half of reading the same. Asserting the value alone passed while it did not.
    const botName = screen.getByLabelText('الاسم الذي يسمّي به البوت نفسه');
    expect(botName).toHaveValue('Ichancy Cashier');
    expect(botName).toHaveAttribute('dir', 'ltr');
  });

  it('carries the markers into Arabic rather than leaving the honest half in English', async () => {
    renderAr();
    await openPaymentButtonsTab();

    const routing = within(await screen.findByRole('region', { name: 'أين ينشر البوت إشعاراتك' }));
    expect(routing.getByText('فعّال')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'ما يراه اللاعب' })).getByText('للقراءة فقط'),
    ).toBeInTheDocument();
  });
});

/**
 * Opens the payment-buttons tab, waits for the rails to have landed, and hands the code back so a
 * row lookup can chain off it.
 *
 * IT OPENS THE TAB because the page now lands on the menu-flow editor — that is the tab an operator
 * came for, and the one that changes the bot's own keyboard. Every assertion below this line is
 * about the payment buttons, so the navigation belongs here rather than repeated in each test.
 */
async function waitForCode(code: string): Promise<string> {
  await openPaymentButtonsTab();
  await screen.findByRole('region', { name: code });
  return code;
}

/** The payment-buttons tab, in either language. Idempotent — clicking an open tab does nothing. */
async function openPaymentButtonsTab(): Promise<void> {
  const tab = await screen.findByRole('tab', { name: /Payment buttons|أزرار الدفع/ });
  await userEvent.setup().click(tab);
}
