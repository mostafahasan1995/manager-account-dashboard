import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { db, updateBotSettings } from '@/mocks/db';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/utils';
import type { AdminRole } from '@/types/enums';
import type { Locale } from '@/lib/i18n/locales';

import { BotConfigPage } from './bot-config-page';
import { BotSettingsCard } from './bot-settings-card';

/**
 * The settings card, driven against the mock the way an operator drives it against the bot.
 *
 *  - THE BODY IS A DIFF. An emptied URL goes out as `null` — an explicit clear — and an unchanged
 *    field is not on the wire at all, because the endpoint is a PATCH that leaves absent keys
 *    alone. Both are asserted on the captured JSON, not inferred from a toast.
 *  - THE MODE SAYS WHAT IT DOES. "Automatic" is the word most likely to be misread as "the money
 *    is sent by itself", so the sentence that corrects it is asserted beside the option.
 *  - A ROLE THAT MAY NOT WRITE FINDS NOTHING THAT WRITES, and can still read what is set.
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

const SETTINGS_URL = `${config.apiBaseUrl}/v1/admin/bot-menu/settings`;

const render = (role: AdminRole = 'SUPER_ADMIN', locale: Locale = 'en') =>
  renderWithProviders(<BotSettingsCard />, {
    route: '/bot-config',
    routePath: '/bot-config',
    auth: { role },
    locale,
  });

const envelope = (data: unknown, status = 200) =>
  HttpResponse.json(
    {
      success: status < 400,
      data: status < 400 ? data : null,
      error: null,
      meta: { correlationId: 'test', timestamp: '' },
    },
    { status },
  );

/** Captures the JSON the card actually put on the wire, and answers as the mock backend would. */
function capturePatch(): { body: () => Record<string, unknown>; calls: () => number } {
  const sent: Record<string, unknown>[] = [];
  server.use(
    http.patch(SETTINGS_URL, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      sent.push(body);
      return envelope(updateBotSettings(body));
    }),
  );
  return { body: () => sent.at(-1) ?? {}, calls: () => sent.length };
}

/**
 * Both fieldsets carry the same two option words ("Manual"/"Automatic", "يدوي"/"تلقائي"), so a bare
 * `getByRole('radio', { name: /^Manual/ })` is ambiguous once there are two of them. A `<fieldset>`
 * is an ARIA "group" named by its `<legend>`, so scoping to the group whose title matches the
 * setting under test is what disambiguates — and it is also the more honest test: it proves each
 * radio lives under the section that claims it, not merely that a radio with that word exists.
 */
// `find*`, not `get*`: the form (and so the group) does not exist until the settings query
// resolves, and a caller right after a click or a retry is often still mid-fetch.
const depositGroup = async (locale: 'en' | 'ar' = 'en') =>
  within(
    await screen.findByRole('group', {
      name: locale === 'ar' ? 'كيف يُتحقّق من الإيداع' : 'How a deposit is verified',
    }),
  );
const withdrawalGroup = async (locale: 'en' | 'ar' = 'en') =>
  within(
    await screen.findByRole('group', {
      name: locale === 'ar' ? 'كيف يُرَدّ على طلب السحب' : 'How a cash-out is answered',
    }),
  );

describe('loading what is set', () => {
  it('starts from the saved values and says the app has no chat menu button while there is no URL', async () => {
    render();

    const url = await screen.findByLabelText('Mini app URL');
    expect(url).toHaveValue('');
    const deposit = await depositGroup();
    expect(deposit.getByRole('radio', { name: /^Manual/ })).toBeChecked();
    expect(deposit.getByRole('radio', { name: /^Automatic/ })).not.toBeChecked();
    const withdrawal = await withdrawalGroup();
    expect(withdrawal.getByRole('radio', { name: /^Manual/ })).toBeChecked();
    expect(withdrawal.getByRole('radio', { name: /^Automatic/ })).not.toBeChecked();
    expect(screen.getByText('No URL, so there is no chat menu button.')).toBeInTheDocument();
    // Nothing changed, so there is nothing to save.
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('explains both cash-out modes honestly: automatic still needs a person to send the money', async () => {
    render();

    expect(
      await screen.findByText(/A person still sends the money and marks the request paid/),
    ).toBeInTheDocument();
    expect(screen.getByText(/nothing here can transfer funds/)).toBeInTheDocument();
    expect(
      screen.getByText(/Nothing happens until an admin approves the request/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/An ngrok URL changes every time the tunnel restarts/),
    ).toBeInTheDocument();
  });

  it('explains both deposit modes honestly: automatic still falls back to a person on anything unmatched', async () => {
    render();

    expect(
      await screen.findByText(/approves it ONLY when the amount and reference match/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/An admin decides every submitted deposit in the deposits queue/),
    ).toBeInTheDocument();
  });

  it('reports the chat menu button as set once the URL is, and as missing when Telegram was not told', async () => {
    db.tenants[0]!.miniAppUrl = 'https://cashier.example.app';
    db.chatMenuButtonSet = true;
    const { unmount } = render();

    expect(await screen.findByLabelText('Mini app URL')).toHaveValue('https://cashier.example.app');
    expect(
      screen.getByText('The chat menu button under the text box points at this app.'),
    ).toBeInTheDocument();
    unmount();

    db.chatMenuButtonSet = false;
    render();

    expect(await screen.findByText(/The chat menu button is not set/)).toBeInTheDocument();
  });

  it('shows the failure and a retry when the settings cannot be read', async () => {
    let calls = 0;
    server.use(
      http.get(SETTINGS_URL, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              {
                success: false,
                data: null,
                error: { code: 'INTERNAL_ERROR', message: 'The bot database is unreachable.' },
                meta: { correlationId: 'test', timestamp: '' },
              },
              { status: 500 },
            )
          : envelope({
              miniAppUrl: null,
              depositMode: 'MANUAL',
              withdrawalMode: 'AUTO',
              chatMenuButtonSet: false,
            });
      }),
    );

    const { user } = render();

    expect(await screen.findByText('The bot database is unreachable.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect((await withdrawalGroup()).getByRole('radio', { name: /^Automatic/ })).toBeChecked();
  });
});

describe('editing', () => {
  it('sends only the URL when only the URL changed, and re-seeds from the answer', async () => {
    const captured = capturePatch();
    const { user } = render();

    const url = await screen.findByLabelText('Mini app URL');
    await user.click(url);
    await user.paste('https://abc123.ngrok-free.app');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(captured.calls()).toBe(1);
    });
    expect(captured.body()).toEqual({ miniAppUrl: 'https://abc123.ngrok-free.app' });
    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Bot settings saved.');
    });
    // The mock points Telegram's menu button at the URL as it saves; the card reads that back.
    expect(
      await screen.findByText('The chat menu button under the text box points at this app.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('sends only the withdrawal mode when only it changed', async () => {
    const captured = capturePatch();
    const { user } = render();
    await screen.findByLabelText('Mini app URL');

    await user.click((await withdrawalGroup()).getByRole('radio', { name: /^Automatic/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(captured.calls()).toBe(1);
    });
    expect(captured.body()).toEqual({ withdrawalMode: 'AUTO' });
    expect((await withdrawalGroup()).getByRole('radio', { name: /^Automatic/ })).toBeChecked();
  });

  it('sends only the deposit mode when only it changed', async () => {
    const captured = capturePatch();
    const { user } = render();
    await screen.findByLabelText('Mini app URL');

    await user.click((await depositGroup()).getByRole('radio', { name: /^Automatic/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(captured.calls()).toBe(1);
    });
    expect(captured.body()).toEqual({ depositMode: 'AUTO' });
    expect((await depositGroup()).getByRole('radio', { name: /^Automatic/ })).toBeChecked();
  });

  it('clears the URL as an explicit null, never as an empty string', async () => {
    db.tenants[0]!.miniAppUrl = 'https://cashier.example.app';
    db.chatMenuButtonSet = true;
    const captured = capturePatch();
    const { user } = render();

    const url = await screen.findByLabelText('Mini app URL');
    expect(url).toHaveValue('https://cashier.example.app');
    await user.clear(url);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(captured.calls()).toBe(1);
    });
    expect(captured.body()).toEqual({ miniAppUrl: null });
    expect(await screen.findByText('No URL, so there is no chat menu button.')).toBeInTheDocument();
  });

  it('refuses a URL that is not https before asking the server', async () => {
    const captured = capturePatch();
    const { user } = render();

    const url = await screen.findByLabelText('Mini app URL');
    await user.click(url);
    await user.paste('http://abc123.ngrok-free.app');

    expect(await screen.findByText('Must be an https:// URL.')).toBeInTheDocument();
    expect(url).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(captured.calls()).toBe(0);
  });

  it('shows the API’s refusal in its own words and keeps what was typed', async () => {
    server.use(
      http.patch(SETTINGS_URL, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'TELEGRAM_REJECTED',
              message: 'Telegram refused the menu button: URL host is not reachable.',
            },
            meta: { correlationId: 'test', timestamp: '' },
          },
          { status: 400 },
        ),
      ),
    );
    const { user } = render();

    const url = await screen.findByLabelText('Mini app URL');
    await user.click(url);
    await user.paste('https://dead.example');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        'Could not save the bot settings.',
        expect.objectContaining({
          description: 'Telegram refused the menu button: URL host is not reachable.',
        }),
      );
    });
    expect(screen.getByLabelText('Mini app URL')).toHaveValue('https://dead.example');
  });
});

describe('a role that may not write', () => {
  it('reads the settings and finds nothing that writes', async () => {
    render('REVIEWER');

    expect(await screen.findByLabelText('Mini app URL')).toBeDisabled();
    for (const group of [await depositGroup(), await withdrawalGroup()]) {
      expect(group.getByRole('radio', { name: /^Manual/ })).toBeDisabled();
      expect(group.getByRole('radio', { name: /^Automatic/ })).toBeDisabled();
    }
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(
      screen.getByText('Changing these needs the bot settings permission.'),
    ).toBeInTheDocument();
  });
});

describe('on the page', () => {
  it('sits on its own tab, marked live', async () => {
    const { user } = renderWithProviders(<BotConfigPage />, {
      route: '/bot-config',
      routePath: '/bot-config',
      auth: { role: 'SUPER_ADMIN' },
    });

    await user.click(await screen.findByRole('tab', { name: 'Settings' }));

    const region = await screen.findByRole('region', {
      name: 'The mini app, and how deposits and cash-outs are answered',
    });
    expect(region).toHaveTextContent('Live');
    expect(await screen.findByLabelText('Mini app URL')).toBeInTheDocument();
  });
});

describe('in Arabic', () => {
  it('reads right to left, with the mode explained in the cashier’s register', async () => {
    const { user } = render('SUPER_ADMIN', 'ar');

    expect(await screen.findByLabelText('رابط التطبيق المصغّر')).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    const withdrawalAr = await withdrawalGroup('ar');
    expect(withdrawalAr.getByRole('radio', { name: /^يدوي/ })).toBeChecked();
    expect(screen.getByText(/لا شيء هنا يستطيع تحويل الأموال/)).toBeInTheDocument();
    expect(screen.getByText(/رابط ngrok يتغيّر/)).toBeInTheDocument();
    const depositAr = await depositGroup('ar');
    expect(depositAr.getByRole('radio', { name: /^يدوي/ })).toBeChecked();
    expect(screen.getByText(/يتطابق المبلغ والمرجع/)).toBeInTheDocument();

    await user.click(withdrawalAr.getByRole('radio', { name: /^تلقائي/ }));
    await user.click(screen.getByRole('button', { name: 'حفظ' }));

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith('تم حفظ إعدادات البوت.');
    });
  });
});
