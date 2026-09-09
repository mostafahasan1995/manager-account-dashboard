import { screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import type { Locale } from '@/lib/i18n/locales';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';
import type { AdminPlayer } from '@/types/player';

import { registeredPlayerName, toRegisterBody } from './register-player-body';
import { RegisterPlayerDialog } from './register-player-dialog';

/**
 * Registering a player from the console.
 *
 * What is defended here: a blank field never reaches the wire as `""`, the Telegram id is digits
 * or nothing, and the three endings — account created, no account asked for, account FAILED but
 * player made — are all handed back to the page rather than collapsed into one "done".
 */

const REGISTER_URL = `${config.apiBaseUrl}/v1/admin/players`;

/** Records every body sent to the register endpoint, then lets the standard mock answer. */
function captureRegister(): string[] {
  const sent: string[] = [];
  server.use(
    http.post(REGISTER_URL, async ({ request }) => {
      sent.push(await request.clone().text());
      return undefined;
    }),
  );
  return sent;
}

const renderDialog = (locale: Locale = 'en') => {
  const onRegistered = vi.fn();
  const onOpenChange = vi.fn();
  const result = renderPlain(
    <RegisterPlayerDialog open onOpenChange={onOpenChange} onRegistered={onRegistered} />,
    { locale },
  );
  return { ...result, onRegistered, onOpenChange };
};

describe('RegisterPlayerDialog', () => {
  it('will not register a player nobody could ever find again', async () => {
    const { user, onRegistered } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(
      await screen.findByText(/Give at least one of a Telegram id, a name or a phone number/),
    ).toBeInTheDocument();
    expect(onRegistered).not.toHaveBeenCalled();
  });

  it('refuses a Telegram id that is not digits, rather than sending a @username as one', async () => {
    const { user, onRegistered } = renderDialog();

    await user.type(screen.getByLabelText('Telegram ID'), '@karim_play');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByText('Digits only — the numeric Telegram id.')).toBeInTheDocument();
    expect(onRegistered).not.toHaveBeenCalled();
  });

  it('sends only the fields that were filled in, never an empty string', async () => {
    const sent = captureRegister();
    const { user, onRegistered } = renderDialog();

    await user.type(screen.getByLabelText('First name'), 'Nour');
    await user.type(screen.getByLabelText('Phone'), '+963900000999');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(onRegistered).toHaveBeenCalledTimes(1);
    });
    expect(sent).toHaveLength(1);
    // No telegramUserId, no lastName, no createIchancyAccount: absent, not "" or false.
    expect(JSON.parse(sent[0] ?? '{}')).toEqual({ firstName: 'Nour', phone: '+963900000999' });

    const result = onRegistered.mock.calls[0]?.[0] as { ichancy: unknown; ichancyError: unknown };
    // Nobody asked for an Ichancy account, and the answer says so rather than claiming one.
    expect(result.ichancy).toBeNull();
    expect(result.ichancyError).toBeNull();
  });

  it('asks for the Ichancy account when the box is ticked and hands back what it got', async () => {
    const sent = captureRegister();
    const success = vi.spyOn(toast, 'success');
    const { user, onRegistered } = renderDialog();

    await user.type(screen.getByLabelText('First name'), 'Nour');
    await user.type(screen.getByLabelText('Last name'), 'Haddad');
    await user.click(screen.getByRole('checkbox', { name: 'Create the Ichancy account now' }));
    await user.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(onRegistered).toHaveBeenCalledTimes(1);
    });
    expect(JSON.parse(sent[0] ?? '{}')).toEqual({
      firstName: 'Nour',
      lastName: 'Haddad',
      createIchancyAccount: true,
    });
    const result = onRegistered.mock.calls[0]?.[0] as {
      ichancy: { created: boolean; ichancyLogin: string } | null;
      ichancyError: string | null;
    };
    expect(result.ichancy?.created).toBe(true);
    expect(result.ichancyError).toBeNull();
    expect(success).toHaveBeenCalledWith('Registered Nour Haddad');
  });

  it('hands back a player whose Ichancy account failed, instead of calling the registration a failure', async () => {
    const { user, onRegistered } = renderDialog();

    // The mock's one failing link: a phone ending in 000.
    await user.type(screen.getByLabelText('First name'), 'Rami');
    await user.type(screen.getByLabelText('Phone'), '+963900001000');
    await user.click(screen.getByRole('checkbox', { name: 'Create the Ichancy account now' }));
    await user.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(onRegistered).toHaveBeenCalledTimes(1);
    });
    const result = onRegistered.mock.calls[0]?.[0] as {
      player: { firstName: string | null };
      ichancy: unknown;
      ichancyError: string | null;
    };
    expect(result.player.firstName).toBe('Rami');
    expect(result.ichancy).toBeNull();
    expect(result.ichancyError).toMatch(/Ichancy did not answer/);
  });

  it('shows the refusal for a Telegram id another player holds, and stays open', async () => {
    const failed = vi.spyOn(toast, 'error');
    const { user, onRegistered } = renderDialog();

    await user.type(screen.getByLabelText('Telegram ID'), '512340001');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(
      await screen.findByText('Another player in this operator already holds that Telegram id.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();
    expect(onRegistered).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledWith('Could not register the player', expect.anything());
  });

  it('cancels through the page rather than by itself', async () => {
    const { user, onOpenChange } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('reads in Arabic', () => {
    renderDialog('ar');

    expect(screen.getByRole('heading', { name: 'تسجيل لاعب جديد' })).toBeInTheDocument();
    expect(screen.getByLabelText('معرّف تلغرام')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'إنشاء حساب Ichancy الآن' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تسجيل' })).toBeInTheDocument();
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });
});

describe('toRegisterBody', () => {
  it('drops every blank field and the false checkbox', () => {
    expect(
      toRegisterBody({
        telegramUserId: '  ',
        firstName: '',
        lastName: ' Nasser ',
        phone: '',
        createIchancyAccount: false,
      }),
    ).toEqual({ lastName: 'Nasser' });
  });

  it('keeps the Telegram id a string', () => {
    const body = toRegisterBody({
      telegramUserId: '9007199254740993',
      firstName: '',
      lastName: '',
      phone: '',
      createIchancyAccount: true,
    });
    expect(body).toEqual({ telegramUserId: '9007199254740993', createIchancyAccount: true });
    expect(typeof body.telegramUserId).toBe('string');
  });
});

describe('registeredPlayerName', () => {
  const base: AdminPlayer = {
    id: 'bbbbbbbb-0000-4000-8000-000000000099',
    telegramUserId: null,
    telegramUsername: null,
    firstName: null,
    lastName: null,
    languageCode: null,
    status: 'ACTIVE' as const,
    source: 'ADMIN' as const,
    currencyCode: 'NSP',
    ichancyLinked: false,
    createdAt: new Date().toISOString(),
    lastSeenAt: null,
    phone: null,
    blockedAt: null,
    blockedReason: null,
    blockedByAdminId: null,
  };

  it('falls back from the name, to the Telegram id, to the phone, to the id', () => {
    const result = (player: Partial<AdminPlayer>) => ({
      player: { ...base, ...player },
      ichancy: null,
      ichancyError: null,
    });
    expect(registeredPlayerName(result({ firstName: 'Nour', lastName: 'Haddad' }))).toBe(
      'Nour Haddad',
    );
    expect(registeredPlayerName(result({ telegramUserId: '5' }))).toBe('Telegram 5');
    expect(registeredPlayerName(result({ phone: '+963900000999' }))).toBe('+963900000999');
    expect(registeredPlayerName(result({}))).toBe('Player bbbbbbbb');
  });
});
