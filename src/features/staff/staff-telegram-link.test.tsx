import { screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { db, redeemStaffLinkCode } from '@/mocks/db';
import { ADMIN_IDS } from '@/mocks/fixtures';
import { renderWithProviders } from '@/test/utils';
import type { AdminRole } from '@/types/enums';

import { StaffDetailPage } from './staff-detail-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/**
 * Linking a staff account to Telegram from its record (owner decision 4, 2026-09-15): the code, the
 * exact instruction, the moment the bot takes it, and who may link or unlink at all.
 */

const renderDetail = (adminId: string, role: AdminRole, locale?: 'ar') =>
  renderWithProviders(<StaffDetailPage />, {
    route: `/staff/${adminId}`,
    routePath: '/staff/$adminId',
    auth: { role },
    ...(locale === undefined ? {} : { locale }),
  });

const CODE_PATTERN = /^[A-Z2-9]{4}-[A-Z2-9]{4}$/;

describe('StaffTelegramLink', () => {
  it('shows a platform admin the code, the exact command and the bot, then notices the link', async () => {
    const { user } = renderDetail(ADMIN_IDS.noTelegram, 'PLATFORM_ADMIN');

    expect(await screen.findByText('Not linked')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Link Telegram' }));

    const dialog = within(await screen.findByRole('dialog', { name: 'Link Maya Console to Telegram' }));
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
    const { user } = renderDetail(ADMIN_IDS.deactivated, 'PLATFORM_ADMIN');
    // The fixture's deactivated reviewer carries an old Telegram id; unlinked here to reach the button.
    const row = db.admins.find((admin) => admin.id === ADMIN_IDS.deactivated)!;
    row.telegramLinked = false;
    row.telegramUserId = null;

    await user.click(await screen.findByRole('button', { name: 'Link Telegram' }));

    expect(await screen.findByText('Could not get a code')).toBeInTheDocument();
    expect(
      screen.getByText('This staff account is deactivated. Reactivate it before linking it to Telegram.'),
    ).toBeInTheDocument();
  });

  it('reads in Arabic', async () => {
    const { user } = renderDetail(ADMIN_IDS.noTelegram, 'PLATFORM_ADMIN', 'ar');

    await user.click(await screen.findByRole('button', { name: 'ربط تلغرام' }));

    expect(await screen.findByText('2. أرسل هذا حرفياً، في رسالة جديدة:')).toBeInTheDocument();
  });
});
