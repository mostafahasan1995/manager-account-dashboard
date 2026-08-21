import { screen, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { mockTenants } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';

import { TenantFormDialog } from './tenant-form-dialog';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const tenantZero = mockTenants[0]!;
const platformAdmin = { auth: { role: 'PLATFORM_ADMIN' as const } };

const VALID_BOT_TOKEN = '123456789:AAH-abcdefghijklmnopqrstuvwxyz012345';

const CREATE_VALUES: Record<string, string> = {
  Slug: 'southern-branch',
  'Display name': 'Southern branch',
  'Bot token': VALID_BOT_TOKEN,
  'Admin chat id': '-1001111111111',
  'Ichancy base URL': 'https://agent.ichancy.example',
  'Ichancy username': 'agent_south',
  'Ichancy password': 'a-real-password',
  'Ichancy agent id': '10099',
  'Currency code': 'NSP',
  'Dual approval above': '30000000',
  'Agent float low watermark': '50000000',
  'Deposit expiry (minutes)': '45',
};

/**
 * Fills the whole form by PASTING rather than typing.
 *
 * Thirteen fields typed character by character is several hundred simulated keystrokes, each with a
 * react-hook-form re-render behind it — slow enough on its own to blow the per-test timeout once the
 * rest of the suite is competing for the CPU. Pasting is also what a person actually does with a bot
 * token, an IBAN and a chat id, and it fires the same change events the form validates on. The one
 * test that is ABOUT typing — the live minor-unit conversion — still types.
 */
async function fillCreateForm(user: UserEvent, overrides: Record<string, string> = {}) {
  for (const [label, value] of Object.entries({ ...CREATE_VALUES, ...overrides })) {
    const field = screen.getByLabelText(label);
    await user.clear(field);
    if (value === '') continue;
    await user.click(field);
    await user.paste(value);
  }
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

  it('refuses a slug that is not a slug, without calling the API', async () => {
    const onSaved = vi.fn();
    const { user } = renderPlain(
      <TenantFormDialog open tenant={null} onOpenChange={vi.fn()} onSaved={onSaved} />,
      platformAdmin,
    );

    await fillCreateForm(user, { Slug: 'Northern Branch' });
    await user.click(screen.getByRole('button', { name: 'Create tenant' }));

    expect(await screen.findByText(/Lowercase letters, digits and hyphens/i)).toBeInTheDocument();
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

  it('creates the tenant and hands back the suspended row the backend answered with', async () => {
    const onSaved = vi.fn();
    const { user } = renderPlain(
      <TenantFormDialog open tenant={null} onOpenChange={vi.fn()} onSaved={onSaved} />,
      platformAdmin,
    );

    await fillCreateForm(user);
    await user.click(screen.getByRole('button', { name: 'Create tenant' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'southern-branch', status: 'SUSPENDED' }),
      );
    });
    expect(toast.success).toHaveBeenCalledWith(
      'Southern branch created',
      expect.objectContaining({ description: expect.stringContaining('suspended') }),
    );
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
    expect(screen.getByText(/every amount already recorded is denominated in it/i)).toBeInTheDocument();
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
