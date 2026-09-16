import type { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { config } from '@/config';
import { db, redeemStaffLinkCode } from '@/mocks/db';
import { ADMIN_IDS, TENANT_IDS } from '@/mocks/fixtures';
import { renderWithProviders } from '@/test/utils';
import type { AdminRole } from '@/types/enums';

import { StaffDetailPage } from './staff-detail-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/**
 * Linking a staff account to Telegram from its record (owner decision 4, 2026-09-15): the code, the
 * exact instruction, the moment the bot takes it, and who may link or unlink at all.
 */

/**
 * `tenantId` is the operator the console is working IN, which is what decides whether a code can be
 * issued at all: a platform admin with nothing selected is in tenant zero, where every code is
 * refused. It only reaches the backend when this deployment sends `X-Tenant-Id`, so the flag is
 * part of the question and is spied on here rather than left at its compiled default.
 */
const renderDetail = (
  adminId: string,
  role: AdminRole,
  options: { locale?: 'ar'; tenantId?: string; tenantHeaderEnabled?: boolean } = {},
) => {
  vi.spyOn(config, 'tenantHeaderEnabled', 'get').mockReturnValue(
    options.tenantHeaderEnabled ?? true,
  );
  return renderWithProviders(<StaffDetailPage />, {
    route: `/staff/${adminId}`,
    routePath: '/staff/$adminId',
    auth: { role, ...(options.tenantId === undefined ? {} : { tenantId: options.tenantId }) },
    ...(options.locale === undefined ? {} : { locale: options.locale }),
  });
};

const CODE_PATTERN = /^[A-Z2-9]{4}-[A-Z2-9]{4}$/;

/** An operator's agent principal: its sign-in finds it by the reserved Telegram id "0". */
const AGENT_PRINCIPAL_ID = 'aaaaaaaa-0000-4000-8000-000000000099';

/** Link codes still held in TanStack's mutation cache. */
const heldCodes = (queryClient: QueryClient) =>
  queryClient
    .getMutationCache()
    .getAll()
    .map((mutation) => mutation.state.data)
    .filter((data) => data !== undefined);

describe('StaffTelegramLink', () => {
  it('shows a platform admin the code, the exact command and the bot, then notices the link', async () => {
    // With an operator selected, because in tenant zero the backend refuses every code and there
    // would be no button to click. WHICH operator's bot the code names is settled in the mock's own
    // tests: a component test's token carries no role, so the mock cannot honour X-Tenant-Id and
    // resolves the bot to the home tenant.
    const { user } = renderDetail(ADMIN_IDS.noTelegram, 'PLATFORM_ADMIN', {
      tenantId: TENANT_IDS.second,
    });

    expect(await screen.findByText('Not linked')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Link Telegram' }));

    const dialog = within(
      await screen.findByRole('dialog', { name: 'Link Maya Console to Telegram' }),
    );
    const code = await dialog.findByText(CODE_PATTERN);
    const value = code.textContent;
    expect(dialog.getByText(`/link ${value}`)).toBeInTheDocument();
    expect(dialog.getByText('1. Open @main_cashier_bot in a private chat.')).toBeInTheDocument();
    expect(dialog.getByRole('link', { name: 'Open @main_cashier_bot' })).toHaveAttribute(
      'href',
      'https://t.me/main_cashier_bot',
    );
    expect(dialog.getByText(/Never post the code in a group/)).toBeInTheDocument();

    // What the bot does when Maya sends `/link <code>` from her own Telegram.
    expect(redeemStaffLinkCode(value, '700000099')).toBe(true);

    expect(
      await dialog.findByText('Maya Console is linked to Telegram', {}, { timeout: 9000 }),
    ).toBeInTheDocument();
    expect(dialog.queryByText(CODE_PATTERN)).not.toBeInTheDocument();
  }, 20_000);

  it('never offers a super admin a code for somebody else, but lets them unlink', async () => {
    const { user } = renderDetail(ADMIN_IDS.reviewer, 'SUPER_ADMIN');

    expect(await screen.findByText('Linked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Link Telegram' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Unlink' }));
    const confirm = within(
      await screen.findByRole('dialog', { name: 'Unlink Lina Farah from Telegram?' }),
    );
    expect(confirm.getByText(/refused from this moment/)).toBeInTheDocument();
    await user.click(confirm.getByRole('button', { name: 'Unlink' }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Lina Farah is no longer linked to Telegram.');
    });
    expect(await screen.findByText('Not linked')).toBeInTheDocument();
    expect(db.admins.find((row) => row.id === ADMIN_IDS.reviewer)?.telegramLinked).toBe(false);
  });

  it('gives a finance admin the state and neither control', async () => {
    renderDetail(ADMIN_IDS.reviewer, 'FINANCE_ADMIN');

    expect(await screen.findByText('Linked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Link Telegram' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unlink' })).not.toBeInTheDocument();
  });

  it('shows the refusal when the account cannot be linked', async () => {
    const { user } = renderDetail(ADMIN_IDS.deactivated, 'PLATFORM_ADMIN', {
      tenantId: TENANT_IDS.second,
    });
    // The fixture's deactivated reviewer carries an old Telegram id; unlinked here to reach the button.
    const row = db.admins.find((admin) => admin.id === ADMIN_IDS.deactivated)!;
    row.telegramLinked = false;
    row.telegramUserId = null;

    await user.click(await screen.findByRole('button', { name: 'Link Telegram' }));

    expect(await screen.findByText('Could not get a code')).toBeInTheDocument();
    expect(
      screen.getByText(
        'This staff account is deactivated. Reactivate it before linking it to Telegram.',
      ),
    ).toBeInTheDocument();
  });

  it('never offers to link or unlink the agent principal, whose reserved id is not a person', async () => {
    db.admins.push({
      ...db.admins.find((row) => row.id === ADMIN_IDS.superAdmin)!,
      id: AGENT_PRINCIPAL_ID,
      telegramUserId: '0',
      telegramLinked: false,
      username: null,
      displayName: 'Main operation agent',
    });

    renderDetail(AGENT_PRINCIPAL_ID, 'PLATFORM_ADMIN', { tenantId: TENANT_IDS.second });

    expect(await screen.findByText('Not linked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Link Telegram' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unlink' })).not.toBeInTheDocument();
  });

  it('never offers a super admin Unlink on a platform admin row', async () => {
    renderDetail(ADMIN_IDS.platformAdmin, 'SUPER_ADMIN');

    expect(await screen.findByText('Linked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unlink' })).not.toBeInTheDocument();
  });

  it('offers a platform admin Unlink on a platform admin row', async () => {
    renderDetail(ADMIN_IDS.platformAdmin, 'PLATFORM_ADMIN');

    expect(await screen.findByText('Linked')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unlink' })).toBeInTheDocument();
  });

  it('drops the code from memory when the page goes away, not five minutes later', async () => {
    const { user, queryClient, unmount } = renderDetail(ADMIN_IDS.noTelegram, 'PLATFORM_ADMIN', {
      tenantId: TENANT_IDS.second,
    });

    await user.click(await screen.findByRole('button', { name: 'Link Telegram' }));
    const dialog = within(
      await screen.findByRole('dialog', { name: 'Link Maya Console to Telegram' }),
    );
    const code = (await dialog.findByText(CODE_PATTERN)).textContent;
    expect(heldCodes(queryClient)).toEqual([expect.objectContaining({ code })]);

    unmount();

    await waitFor(() => {
      expect(heldCodes(queryClient)).toEqual([]);
    });
  });

  it('reads in Arabic', async () => {
    const { user } = renderDetail(ADMIN_IDS.noTelegram, 'PLATFORM_ADMIN', {
      locale: 'ar',
      tenantId: TENANT_IDS.second,
    });

    await user.click(await screen.findByRole('button', { name: 'ربط تلغرام' }));

    expect(await screen.findByText('2. أرسل هذا حرفياً، في رسالة جديدة:')).toBeInTheDocument();
  });
});

/**
 * The platform has no bot, so the backend refuses a code for EVERY row while the console is working
 * in tenant zero (422 ADMIN_TELEGRAM_LINK_NOT_ALLOWED, reason PLATFORM) — decided before it even
 * reads the account. An unlink there is NOT refused, so that button stays exactly as it is.
 */
describe('StaffTelegramLink in tenant zero', () => {
  it('offers no Link, and says why rather than leaving the row looking broken', async () => {
    renderDetail(ADMIN_IDS.noTelegram, 'PLATFORM_ADMIN');

    expect(await screen.findByText('Not linked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Link Telegram' })).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'The platform has no bot and no staff group, so its accounts are not linked to Telegram.',
      ),
    ).toBeInTheDocument();
    // The operator sentence would be a dead end here: it names a fix that does not exist.
    expect(
      screen.queryByText('Their taps in the staff group are refused until this account is linked.'),
    ).not.toBeInTheDocument();
  });

  it('keeps Unlink, because the backend does not refuse that for the platform', async () => {
    renderDetail(ADMIN_IDS.reviewer, 'PLATFORM_ADMIN');

    expect(await screen.findByText('Linked')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unlink' })).toBeInTheDocument();
  });

  it('hides Link with an operator picked too, when no tenant header is sent', async () => {
    // The backend then reads every request in the caller's home — tenant zero — and refuses the
    // code whatever the switcher is showing.
    renderDetail(ADMIN_IDS.noTelegram, 'PLATFORM_ADMIN', {
      tenantId: TENANT_IDS.second,
      tenantHeaderEnabled: false,
    });

    expect(await screen.findByText('Not linked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Link Telegram' })).not.toBeInTheDocument();
  });

  it('says why in Arabic', async () => {
    renderDetail(ADMIN_IDS.noTelegram, 'PLATFORM_ADMIN', { locale: 'ar' });

    expect(
      await screen.findByText(
        'المنصة ليس لها بوت ولا مجموعة موظفين، لذلك لا تُربط حساباتها بتلغرام.',
      ),
    ).toBeInTheDocument();
  });
});
