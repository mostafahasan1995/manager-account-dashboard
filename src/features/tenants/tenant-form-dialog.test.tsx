import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { mockPlatformDefaults, mockTenants } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';

import { TenantFormDialog } from './tenant-form-dialog';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const tenantZero = mockTenants[0]!;
const platformAdmin = { auth: { role: 'PLATFORM_ADMIN' as const } };

const VALID_BOT_TOKEN = '123456789:AAH-abcdefghijklmnopqrstuvwxyz012345';

/**
 * What a created operator gets for a staff group when the form names none: nothing (2026-09-15). It is
 * no longer the creating admin's Telegram id, and it stays suspended until a group is bound.
 */
const NO_STAFF_GROUP = null;

/**
 * The four fields the API cannot fill in for anybody: a name, the bot token from BotFather, and the
 * Ichancy login. Everything else on this form lives behind "Advanced" and has a server-side default.
 */
const REQUIRED_VALUES: Record<string, string> = {
  'Display name': 'Southern branch',
  'Bot token': VALID_BOT_TOKEN,
  'Ichancy username': 'agent_south',
  'Ichancy password': 'a-real-password',
};

/** The labels that must NOT be on screen until somebody opens the disclosure. */
const ADVANCED_LABELS = [
  'Slug',
  'Admin chat id',
  'Ichancy base URL',
  'Ichancy agent id',
  'Currency code',
  'Dual approval above',
  'Agent float low watermark',
  'Deposit expiry (minutes)',
  'Withdrawal mode',
  'Mini app URL (optional)',
];

/**
 * Fills the form by PASTING rather than typing.
 *
 * A field typed character by character is dozens of simulated keystrokes, each with a
 * react-hook-form re-render behind it — slow enough to blow the per-test timeout once the rest of
 * the suite is competing for the CPU. Pasting is also what a person actually does with a bot token
 * and a chat id, and it fires the same change events the form validates on. The one test that is
 * ABOUT typing — the live minor-unit conversion — still types.
 *
 * An override is applied only when its field is on screen, so a case that stays on the four
 * required fields never has to know the disclosure exists.
 */
async function fillCreateForm(user: UserEvent, overrides: Record<string, string> = {}) {
  for (const [label, value] of Object.entries({ ...REQUIRED_VALUES, ...overrides })) {
    const field = screen.queryByLabelText(label);
    if (field === null) continue;
    await user.clear(field);
    if (value === '') continue;
    await user.click(field);
    await user.paste(value);
  }
}

const openAdvanced = async (user: UserEvent) => {
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
};

/** Captures the JSON the form actually put on the wire, and answers as the API would. */
function captureCreateBody(): { body: () => Record<string, unknown> } {
  let sent: Record<string, unknown> = {};
  server.use(
    http.post(`${config.apiBaseUrl}/v1/admin/tenants`, async ({ request }) => {
      sent = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(
        {
          success: true,
          data: { ...tenantZero, id: 'created', slug: 'southern-branch' },
          error: null,
          meta: { correlationId: 'test', timestamp: '' },
        },
        { status: 201 },
      );
    }),
  );
  return { body: () => sent };
}

describe('TenantFormDialog — create', () => {
  it('states that the tenant will land suspended, and why', () => {
    renderPlain(
      <TenantFormDialog open tenant={null} onOpenChange={vi.fn()} onSaved={vi.fn()} />,
      platformAdmin,
    );

    expect(screen.getByText('This tenant will be created suspended')).toBeInTheDocument();
    expect(screen.getByText(/registers real players under another operator/i)).toBeInTheDocument();
  });

  it('asks for four fields, and hides every field that has a default', () => {
    renderPlain(
      <TenantFormDialog open tenant={null} onOpenChange={vi.fn()} onSaved={vi.fn()} />,
      platformAdmin,
    );

    for (const label of Object.keys(REQUIRED_VALUES)) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    for (const label of ADVANCED_LABELS) {
      expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Advanced' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('says what each hidden field would default to, once Advanced is opened', async () => {
    const { user } = renderPlain(
      <TenantFormDialog open tenant={null} onOpenChange={vi.fn()} onSaved={vi.fn()} />,
      platformAdmin,
    );

    await openAdvanced(user);

    for (const label of ADVANCED_LABELS) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByText(/made from the display name/i)).toBeInTheDocument();
    expect(screen.getByText(/Left blank: no staff group/i)).toBeInTheDocument();
    expect(screen.getByText(/the platform default Ichancy URL/i)).toBeInTheDocument();
    expect(screen.getByText(/or tenant zero’s if the platform has none/i)).toBeInTheDocument();
    expect(screen.getByText(/the platform default currency/i)).toBeInTheDocument();
    expect(screen.getByText('Left blank: the platform default threshold.')).toBeInTheDocument();
    expect(screen.getByText('Left blank: the platform default watermark.')).toBeInTheDocument();
    expect(
      screen.getByText(/Left blank: manual — a person approves every cash-out/),
    ).toBeInTheDocument();
    expect(screen.getByText(/no app button destination until one is set/)).toBeInTheDocument();
  });

  it('refuses a slug that is not a slug, without calling the API', async () => {
    const onSaved = vi.fn();
    const { user } = renderPlain(
      <TenantFormDialog open tenant={null} onOpenChange={vi.fn()} onSaved={onSaved} />,
      platformAdmin,
    );

    await openAdvanced(user);
    await fillCreateForm(user, { Slug: 'Northern Branch' });
    await user.click(screen.getByRole('button', { name: 'Create tenant' }));

    expect(await screen.findByText(/Lowercase letters, digits and hyphens/i)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('reopens Advanced when the value that failed is hidden inside it', async () => {
    const onSaved = vi.fn();
    const { user } = renderPlain(
      <TenantFormDialog open tenant={null} onOpenChange={vi.fn()} onSaved={onSaved} />,
      platformAdmin,
    );

    await openAdvanced(user);
    await fillCreateForm(user, { Slug: 'Northern Branch' });
    // Closed again with a bad value still in it: submitting must not fail silently.
    await user.click(screen.getByRole('button', { name: 'Advanced' }));
    expect(screen.queryByLabelText('Slug')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create tenant' }));

    expect(await screen.findByLabelText('Slug')).toBeInTheDocument();
    expect(screen.getByText(/Lowercase letters, digits and hyphens/i)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('refuses a display name longer than the API accepts', async () => {
    const onSaved = vi.fn();
    const { user } = renderPlain(
      <TenantFormDialog open tenant={null} onOpenChange={vi.fn()} onSaved={onSaved} />,
      platformAdmin,
    );

    await fillCreateForm(user, { 'Display name': 'N'.repeat(121) });
    await user.click(screen.getByRole('button', { name: 'Create tenant' }));

    expect(await screen.findByText('Keep it to 120 characters or fewer.')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('refuses a bot token that is not shaped like one', async () => {
    const onSaved = vi.fn();
    const { user } = renderPlain(
      <TenantFormDialog open tenant={null} onOpenChange={vi.fn()} onSaved={onSaved} />,
      platformAdmin,
    );

    await fillCreateForm(user, { 'Bot token': 'not-a-token' });
    await user.click(screen.getByRole('button', { name: 'Create tenant' }));

    expect(await screen.findByText(/A bot token looks like/i)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('reads minor units back as a decimal while they are typed', async () => {
    const { user } = renderPlain(
      <TenantFormDialog open tenant={null} onOpenChange={vi.fn()} onSaved={vi.fn()} />,
      platformAdmin,
    );

    await openAdvanced(user);
    await user.type(screen.getByLabelText('Currency code'), 'NSP');
    await user.type(screen.getByLabelText('Dual approval above'), '150000');

    expect(await screen.findByText('= 1,500.00 NSP')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Agent float low watermark'), '9007199254740993');
    // Past what a double can hold: the preview must still be exact.
    expect(await screen.findByText('= 90,071,992,547,409.93 NSP')).toBeInTheDocument();
  });

  it('keeps the bot token secret in the field and out of the form once it is saved', async () => {
    const { user } = renderPlain(
      <TenantFormDialog open tenant={null} onOpenChange={vi.fn()} onSaved={vi.fn()} />,
      platformAdmin,
    );

    expect(screen.getByLabelText('Bot token')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Ichancy password')).toHaveAttribute('type', 'password');

    await fillCreateForm(user);
    await user.click(screen.getByRole('button', { name: 'Create tenant' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Bot token')).toHaveValue('');
    });
    expect(screen.getByLabelText('Ichancy password')).toHaveValue('');
  });

  it('creates the tenant from four fields and hands back the row the server filled in', async () => {
    const onSaved = vi.fn();
    const { user } = renderPlain(
      <TenantFormDialog open tenant={null} onOpenChange={vi.fn()} onSaved={onSaved} />,
      platformAdmin,
    );

    await fillCreateForm(user);
    await user.click(screen.getByRole('button', { name: 'Create tenant' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'SUSPENDED',
          // Every one of these was resolved by the server, not sent by the form.
          slug: 'southern-branch',
          adminChatId: NO_STAFF_GROUP,
          feedChatId: null,
          ichancyBaseUrl: mockPlatformDefaults.ichancyBaseUrl,
          ichancyAgentId: mockPlatformDefaults.ichancyAgentId,
          currencyCode: mockPlatformDefaults.currencyCode,
          dualApprovalThresholdMinor: mockPlatformDefaults.dualApprovalThresholdMinor,
          agentFloatLowWatermarkMinor: mockPlatformDefaults.agentFloatLowWatermarkMinor,
          depositExpiryMinutes: mockPlatformDefaults.depositExpiryMinutes,
        }),
      );
    });
    expect(toast.success).toHaveBeenCalledWith(
      'Southern branch created',
      expect.objectContaining({ description: expect.stringContaining('suspended') }),
    );
  });

  it('sends the four required fields and nothing else when Advanced is left alone', async () => {
    const captured = captureCreateBody();
    const { user } = renderPlain(
      <TenantFormDialog open tenant={null} onOpenChange={vi.fn()} onSaved={vi.fn()} />,
      platformAdmin,
    );

    await fillCreateForm(user);
    await user.click(screen.getByRole('button', { name: 'Create tenant' }));

    await waitFor(() => {
      expect(Object.keys(captured.body())).toHaveLength(4);
    });
    expect(Object.keys(captured.body()).sort()).toEqual([
      'botToken',
      'displayName',
      'ichancyPassword',
      'ichancyUsername',
    ]);
    expect(captured.body()).toMatchObject({
      displayName: 'Southern branch',
      botToken: VALID_BOT_TOKEN,
      ichancyUsername: 'agent_south',
      ichancyPassword: 'a-real-password',
    });
  });

  it('omits an untouched optional field rather than sending it empty', async () => {
    const captured = captureCreateBody();
    const { user } = renderPlain(
      <TenantFormDialog open tenant={null} onOpenChange={vi.fn()} onSaved={vi.fn()} />,
      platformAdmin,
    );

    // Opened, read, and left alone — which is the case that would send nine empty strings if the
    // form serialised its own state instead of deciding field by field.
    await openAdvanced(user);
    await fillCreateForm(user);
    await user.click(screen.getByRole('button', { name: 'Create tenant' }));

    await waitFor(() => {
      expect(Object.keys(captured.body())).toHaveLength(4);
    });
    for (const field of [
      'slug',
      'adminChatId',
      'feedChatId',
      'ichancyBaseUrl',
      'ichancyAgentId',
      'currencyCode',
      'dualApprovalThresholdMinor',
      'agentFloatLowWatermarkMinor',
      'depositExpiryMinutes',
      'withdrawalMode',
      'miniAppUrl',
    ]) {
      expect(captured.body()).not.toHaveProperty(field);
    }
    // Not "no empty keys" by accident: nothing on the wire is an empty string or a null either.
    expect(Object.values(captured.body())).not.toContain('');
    expect(Object.values(captured.body())).not.toContain(null);
  });

  it('sends an Advanced value in place of the default it would have been given', async () => {
    const captured = captureCreateBody();
    const { user } = renderPlain(
      <TenantFormDialog open tenant={null} onOpenChange={vi.fn()} onSaved={vi.fn()} />,
      platformAdmin,
    );

    await openAdvanced(user);
    await fillCreateForm(user, {
      'Currency code': 'eur',
      'Deposit expiry (minutes)': '45',
      'Ichancy agent id': '10099',
    });
    await user.click(screen.getByRole('button', { name: 'Create tenant' }));

    await waitFor(() => {
      expect(Object.keys(captured.body())).toHaveLength(7);
    });
    expect(captured.body()).toMatchObject({
      // Upper-cased on the way out; the API stores a currency code, not what a keyboard produced.
      currencyCode: 'EUR',
      ichancyAgentId: '10099',
      // Minutes are the one value that goes as a number, because that is what they are.
      depositExpiryMinutes: 45,
    });
    expect(captured.body()).not.toHaveProperty('slug');
    expect(captured.body()).not.toHaveProperty('dualApprovalThresholdMinor');
  });

  it('takes the overridden values back from the server rather than showing what was typed', async () => {
    const onSaved = vi.fn();
    const { user } = renderPlain(
      <TenantFormDialog open tenant={null} onOpenChange={vi.fn()} onSaved={onSaved} />,
      platformAdmin,
    );

    await openAdvanced(user);
    await fillCreateForm(user, {
      Slug: 'southern-annex',
      'Currency code': 'eur',
      'Dual approval above': '30000000',
      'Deposit expiry (minutes)': '45',
    });
    await user.click(screen.getByRole('button', { name: 'Create tenant' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'southern-annex',
          currencyCode: 'EUR',
          dualApprovalThresholdMinor: '30000000',
          depositExpiryMinutes: 45,
          // Still defaulted: overriding one field does not opt the rest out.
          agentFloatLowWatermarkMinor: mockPlatformDefaults.agentFloatLowWatermarkMinor,
          adminChatId: NO_STAFF_GROUP,
        }),
      );
    });
  });

  it('reports a rejected create as the API worded it', async () => {
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/tenants`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'TENANT_SLUG_TAKEN', message: 'That slug is already in use.' },
            meta: { correlationId: 'test', timestamp: '' },
          },
          { status: 409 },
        ),
      ),
    );

    const onSaved = vi.fn();
    const { user } = renderPlain(
      <TenantFormDialog open tenant={null} onOpenChange={vi.fn()} onSaved={onSaved} />,
      platformAdmin,
    );

    await fillCreateForm(user);
    await user.click(screen.getByRole('button', { name: 'Create tenant' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Could not create the tenant',
        expect.objectContaining({ description: 'That slug is already in use.' }),
      );
    });
    expect(onSaved).not.toHaveBeenCalled();
  });
});

/**
 * The Arabic half of the same form. What is being checked is the wiring most likely to be missed:
 * the disclosure's own label, the sentence that tells an operator what a blank field will get, and
 * a validation message — all three added with this change, and all three useless in English only.
 */
describe('TenantFormDialog — create, in Arabic', () => {
  const arabicAdmin = { ...platformAdmin, locale: 'ar' as const };

  it('names the disclosure and every default in Arabic', async () => {
    const { user } = renderPlain(
      <TenantFormDialog open tenant={null} onOpenChange={vi.fn()} onSaved={vi.fn()} />,
      arabicAdmin,
    );

    expect(screen.getByLabelText('الاسم الظاهر')).toBeInTheDocument();
    const advanced = screen.getByRole('button', { name: 'إعدادات متقدمة' });
    expect(advanced).toHaveAttribute('aria-expanded', 'false');

    await user.click(advanced);

    expect(screen.getByText(/رابط Ichancy الافتراضي للمنصّة/)).toBeInTheDocument();
    // No staff group by default since 2026-09-15, said in Arabic too.
    expect(screen.getByText(/إن تُرك فارغاً: لا توجد مجموعة موظفين/)).toBeInTheDocument();
    // The one field with no default anywhere says so in Arabic too, agent id and all.
    expect(screen.getByText(/لا يمكن استنتاج معرّف الوكيل من بيانات الدخول/)).toBeInTheDocument();
  });

  it('refuses an over-long name in Arabic rather than falling back to English', async () => {
    const { user } = renderPlain(
      <TenantFormDialog open tenant={null} onOpenChange={vi.fn()} onSaved={vi.fn()} />,
      arabicAdmin,
    );

    await user.click(screen.getByLabelText('الاسم الظاهر'));
    await user.paste('ن'.repeat(121));
    await user.click(screen.getByRole('button', { name: 'إنشاء المشغّل' }));

    expect(await screen.findByText('أبقِه في حدود 120 خانة أو أقل.')).toBeInTheDocument();
  });
});

describe('TenantFormDialog — edit', () => {
  it('shows the slug and the currency read-only, with the reason each is frozen', () => {
    renderPlain(
      <TenantFormDialog open tenant={tenantZero} onOpenChange={vi.fn()} onSaved={vi.fn()} />,
      platformAdmin,
    );

    const slug = screen.getByLabelText('Slug');
    expect(slug).toHaveValue('tenant-zero');
    expect(slug).toHaveAttribute('readonly');
    expect(screen.getByText(/written into every log line/i)).toBeInTheDocument();

    const currency = screen.getByLabelText('Currency code');
    expect(currency).toHaveValue('NSP');
    expect(currency).toHaveAttribute('readonly');
    expect(
      screen.getByText(/every amount already recorded is denominated in it/i),
    ).toBeInTheDocument();
  });

  it('does not offer the secrets, which the API would not accept here anyway', () => {
    renderPlain(
      <TenantFormDialog open tenant={tenantZero} onOpenChange={vi.fn()} onSaved={vi.fn()} />,
      platformAdmin,
    );

    expect(screen.queryByLabelText('Bot token')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Ichancy password')).not.toBeInTheDocument();
  });

  it('sends only the changeable fields', async () => {
    let sent: Record<string, unknown> = {};
    server.use(
      http.patch(`${config.apiBaseUrl}/v1/admin/tenants/:id`, async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            success: true,
            data: { ...tenantZero, displayName: 'Main operation (east)' },
            error: null,
            meta: { correlationId: 'test', timestamp: '' },
          },
          { status: 200 },
        );
      }),
    );

    const onSaved = vi.fn();
    const { user } = renderPlain(
      <TenantFormDialog open tenant={tenantZero} onOpenChange={vi.fn()} onSaved={onSaved} />,
      platformAdmin,
    );

    const displayName = screen.getByLabelText('Display name');
    await user.clear(displayName);
    await user.type(displayName, 'Main operation (east)');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: 'Main operation (east)' }),
      );
    });
    expect(Object.keys(sent)).not.toContain('slug');
    expect(Object.keys(sent)).not.toContain('currencyCode');
    expect(sent.depositExpiryMinutes).toBe(30);
    expect(sent.dualApprovalThresholdMinor).toBe('50000000');
  });

  it('refuses a deposit expiry outside the range the backend accepts', async () => {
    const onSaved = vi.fn();
    const { user } = renderPlain(
      <TenantFormDialog open tenant={tenantZero} onOpenChange={vi.fn()} onSaved={onSaved} />,
      platformAdmin,
    );

    const expiry = screen.getByLabelText('Deposit expiry (minutes)');
    await user.clear(expiry);
    await user.type(expiry, '2000');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Between 5 and 1440 minutes.')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });
});

/**
 * The two bot settings on both forms, asserted on the wire.
 *
 * What matters is the SHAPE of what goes out, not that a save happened: an untouched setting must
 * be absent, a cleared URL must be `null` and only when the row held one, and a mode that did not
 * change must not be sent at all — each is a different key on the captured JSON.
 */
describe('TenantFormDialog — the withdrawal mode and the mini app URL', () => {
  const northern = mockTenants[1]!;

  function captureUpdateBody(tenant: typeof tenantZero): { body: () => Record<string, unknown> } {
    let sent: Record<string, unknown> = {};
    server.use(
      http.patch(`${config.apiBaseUrl}/v1/admin/tenants/:id`, async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            success: true,
            data: { ...tenant, ...sent },
            error: null,
            meta: { correlationId: 'test', timestamp: '' },
          },
          { status: 200 },
        );
      }),
    );
    return { body: () => sent };
  }

  it('on create, sends the mode and the URL only when they were chosen', async () => {
    const captured = captureCreateBody();
    const { user } = renderPlain(
      <TenantFormDialog open tenant={null} onOpenChange={vi.fn()} onSaved={vi.fn()} />,
      platformAdmin,
    );

    await openAdvanced(user);
    await fillCreateForm(user, { 'Mini app URL (optional)': 'https://harbour.example.app' });
    await user.selectOptions(screen.getByLabelText('Withdrawal mode'), 'AUTO');
    await user.click(screen.getByRole('button', { name: 'Create tenant' }));

    await waitFor(() => {
      expect(Object.keys(captured.body())).toHaveLength(6);
    });
    expect(captured.body()).toMatchObject({
      withdrawalMode: 'AUTO',
      miniAppUrl: 'https://harbour.example.app',
    });
  });

  it('on create, offers the server’s default as the blank option and explains what it is', async () => {
    const { user } = renderPlain(
      <TenantFormDialog open tenant={null} onOpenChange={vi.fn()} onSaved={vi.fn()} />,
      platformAdmin,
    );

    await openAdvanced(user);

    const mode = screen.getByLabelText('Withdrawal mode');
    expect(mode).toHaveValue('');
    expect(
      within(mode).getByRole('option', { name: 'Left to the server (manual)' }),
    ).toBeInTheDocument();
    expect(within(mode).getByRole('option', { name: 'Automatic' })).toBeInTheDocument();
    expect(within(mode).getByRole('option', { name: 'Manual' })).toBeInTheDocument();
  });

  it('refuses a mini app URL that is not https, on create, without calling the API', async () => {
    const onSaved = vi.fn();
    const { user } = renderPlain(
      <TenantFormDialog open tenant={null} onOpenChange={vi.fn()} onSaved={onSaved} />,
      platformAdmin,
    );

    await openAdvanced(user);
    await fillCreateForm(user, { 'Mini app URL (optional)': 'http://harbour.example.app' });
    await user.click(screen.getByRole('button', { name: 'Create tenant' }));

    expect(await screen.findByText('Must be an https URL.')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('on edit, starts from what the row holds, in words', () => {
    renderPlain(
      <TenantFormDialog open tenant={northern} onOpenChange={vi.fn()} onSaved={vi.fn()} />,
      platformAdmin,
    );

    expect(screen.getByLabelText('Withdrawal mode')).toHaveValue('AUTO');
    expect(screen.getByLabelText('Mini app URL (optional)')).toHaveValue(
      'https://northern-cashier.example.app',
    );
    expect(screen.getByText(/a person still sends the money/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Clear the field and save to remove the stored URL/),
    ).toBeInTheDocument();
  });

  it('on edit, leaves both settings off the wire when neither changed', async () => {
    const captured = captureUpdateBody(tenantZero);
    const onSaved = vi.fn();
    const { user } = renderPlain(
      <TenantFormDialog open tenant={tenantZero} onOpenChange={vi.fn()} onSaved={onSaved} />,
      platformAdmin,
    );

    // Tenant zero: manual, and no URL. Saving as-is must not invent either key — in particular
    // not `miniAppUrl: null`, which would be a "clear" of something that was never there.
    expect(screen.getByLabelText('Withdrawal mode')).toHaveValue('MANUAL');
    expect(screen.getByLabelText('Mini app URL (optional)')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(captured.body()).not.toHaveProperty('withdrawalMode');
    expect(captured.body()).not.toHaveProperty('miniAppUrl');
  });

  it('on edit, sends the mode when it changed and the URL when one was typed', async () => {
    const captured = captureUpdateBody(tenantZero);
    const onSaved = vi.fn();
    const { user } = renderPlain(
      <TenantFormDialog open tenant={tenantZero} onOpenChange={vi.fn()} onSaved={onSaved} />,
      platformAdmin,
    );

    await user.selectOptions(screen.getByLabelText('Withdrawal mode'), 'AUTO');
    await user.click(screen.getByLabelText('Mini app URL (optional)'));
    await user.paste('https://main.example.app');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({ withdrawalMode: 'AUTO', miniAppUrl: 'https://main.example.app' }),
      );
    });
    expect(captured.body()).toMatchObject({
      withdrawalMode: 'AUTO',
      miniAppUrl: 'https://main.example.app',
    });
  });

  it('on edit, clears a stored URL as an explicit null, never as an empty string', async () => {
    const captured = captureUpdateBody(northern);
    const onSaved = vi.fn();
    const { user } = renderPlain(
      <TenantFormDialog open tenant={northern} onOpenChange={vi.fn()} onSaved={onSaved} />,
      platformAdmin,
    );

    await user.clear(screen.getByLabelText('Mini app URL (optional)'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(captured.body()).toHaveProperty('miniAppUrl', null);
    expect(Object.values(captured.body())).not.toContain('');
    // The mode stayed automatic, so it was not mentioned.
    expect(captured.body()).not.toHaveProperty('withdrawalMode');
  });

  it('refuses a mini app URL that is not https, on edit', async () => {
    const onSaved = vi.fn();
    const { user } = renderPlain(
      <TenantFormDialog open tenant={northern} onOpenChange={vi.fn()} onSaved={onSaved} />,
      platformAdmin,
    );

    const url = screen.getByLabelText('Mini app URL (optional)');
    await user.clear(url);
    await user.click(url);
    await user.paste('ftp://northern.example.app');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Must be an https URL.')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('names both settings in Arabic on the edit form', () => {
    renderPlain(
      <TenantFormDialog open tenant={northern} onOpenChange={vi.fn()} onSaved={vi.fn()} />,
      { ...platformAdmin, locale: 'ar' as const },
    );

    const mode = screen.getByLabelText('طريقة السحب');
    expect(mode).toHaveValue('AUTO');
    expect(within(mode).getByRole('option', { name: 'تلقائي' })).toBeInTheDocument();
    expect(screen.getByLabelText('رابط التطبيق المصغّر (اختياري)')).toBeInTheDocument();
    expect(screen.getByText(/ويبقى إرسال المال عمل شخص/)).toBeInTheDocument();
  });
});

/**
 * The deposit mode's own field, added after the September batch — same wire rules as the
 * withdrawal mode above (blank on create is absent, unchanged on edit is unmentioned), proven on
 * its own field rather than assumed from the sibling setting's coverage.
 */
describe('TenantFormDialog — the deposit mode', () => {
  const northern = mockTenants[1]!;

  function captureUpdateBody(tenant: typeof tenantZero): { body: () => Record<string, unknown> } {
    let sent: Record<string, unknown> = {};
    server.use(
      http.patch(`${config.apiBaseUrl}/v1/admin/tenants/:id`, async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            success: true,
            data: { ...tenant, ...sent },
            error: null,
            meta: { correlationId: 'test', timestamp: '' },
          },
          { status: 200 },
        );
      }),
    );
    return { body: () => sent };
  }

  it('on create, sends it only when it was chosen', async () => {
    const captured = captureCreateBody();
    const { user } = renderPlain(
      <TenantFormDialog open tenant={null} onOpenChange={vi.fn()} onSaved={vi.fn()} />,
      platformAdmin,
    );

    await fillCreateForm(user);
    await openAdvanced(user);
    await user.selectOptions(screen.getByLabelText('Deposit mode'), 'AUTO');
    await user.click(screen.getByRole('button', { name: 'Create tenant' }));

    await waitFor(() => {
      expect(captured.body()).toMatchObject({ depositMode: 'AUTO' });
    });
  });

  it('on create, offers the server’s default as the blank option', async () => {
    const { user } = renderPlain(
      <TenantFormDialog open tenant={null} onOpenChange={vi.fn()} onSaved={vi.fn()} />,
      platformAdmin,
    );

    await openAdvanced(user);

    const mode = screen.getByLabelText('Deposit mode');
    expect(mode).toHaveValue('');
    expect(
      within(mode).getByRole('option', { name: 'Left to the server (manual)' }),
    ).toBeInTheDocument();
  });

  it('on edit, starts from what the row holds', () => {
    renderPlain(
      <TenantFormDialog open tenant={northern} onOpenChange={vi.fn()} onSaved={vi.fn()} />,
      platformAdmin,
    );

    expect(screen.getByLabelText('Deposit mode')).toHaveValue('AUTO');
    expect(
      screen.getByText(/checks the player’s claim against Sham Cash or the chain/),
    ).toBeInTheDocument();
  });

  it('on edit, leaves it off the wire when it did not change', async () => {
    const captured = captureUpdateBody(tenantZero);
    const onSaved = vi.fn();
    const { user } = renderPlain(
      <TenantFormDialog open tenant={tenantZero} onOpenChange={vi.fn()} onSaved={onSaved} />,
      platformAdmin,
    );

    // Tenant zero: manual. Saving as-is must not invent the key.
    expect(screen.getByLabelText('Deposit mode')).toHaveValue('MANUAL');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(captured.body()).not.toHaveProperty('depositMode');
  });

  it('on edit, sends it when it changed', async () => {
    const captured = captureUpdateBody(tenantZero);
    const onSaved = vi.fn();
    const { user } = renderPlain(
      <TenantFormDialog open tenant={tenantZero} onOpenChange={vi.fn()} onSaved={onSaved} />,
      platformAdmin,
    );

    await user.selectOptions(screen.getByLabelText('Deposit mode'), 'AUTO');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ depositMode: 'AUTO' }));
    });
    expect(captured.body()).toMatchObject({ depositMode: 'AUTO' });
  });

  it('names it in Arabic on the edit form', () => {
    renderPlain(
      <TenantFormDialog open tenant={northern} onOpenChange={vi.fn()} onSaved={vi.fn()} />,
      { ...platformAdmin, locale: 'ar' as const },
    );

    const mode = screen.getByLabelText('طريقة التحقق من الإيداع');
    expect(mode).toHaveValue('AUTO');
    expect(within(mode).getByRole('option', { name: 'تلقائي' })).toBeInTheDocument();
  });
});
