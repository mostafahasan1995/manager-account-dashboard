import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { config } from '@/config';
import type { Locale } from '@/lib/i18n/locales';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/utils';

import { SettingsPage } from './settings-page';

const render = (role: 'SUPER_ADMIN' | 'REVIEWER' | 'VIEWER', locale?: Locale) =>
  renderWithProviders(<SettingsPage />, {
    route: '/settings',
    routePath: '/settings',
    auth: { role },
    ...(locale === undefined ? {} : { locale }),
  });

const sweepReturns = (report: { expired: number; released: number; reaped: number }) => {
  server.use(
    http.post(`${config.apiBaseUrl}/v1/admin/deposits/maintenance/sweep`, () =>
      HttpResponse.json({
        success: true,
        data: report,
        error: null,
        meta: { correlationId: 'test', timestamp: new Date().toISOString() },
      }),
    ),
  );
};

describe('SettingsPage', () => {
  it('gathers the session, the access list, appearance and the connection on one screen', async () => {
    render('SUPER_ADMIN');

    expect(
      await screen.findByRole('heading', { name: 'Settings', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'You' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your access' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Appearance' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Connection' })).toBeInTheDocument();
    expect(await screen.findByText('Ready')).toBeInTheDocument();
  });

  it('shows maintenance to a role that may sweep', async () => {
    render('SUPER_ADMIN');

    expect(await screen.findByRole('heading', { name: 'Maintenance' })).toBeInTheDocument();
  });

  it('hides maintenance from a role that may not, rather than disabling it', async () => {
    render('VIEWER');

    await screen.findByRole('heading', { name: 'Settings', level: 1 });

    expect(screen.queryByRole('heading', { name: 'Maintenance' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /run sweep/i })).not.toBeInTheDocument();
  });

  it('opens for every signed-in role, including one with almost no capabilities', async () => {
    render('VIEWER');

    expect(
      await screen.findByRole('heading', { name: 'Settings', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Viewer')).toBeInTheDocument();
  });
});

/**
 * Arabic is not a coat of paint on the English screen: the words change, the page mirrors, and a
 * count agrees with its number. Each of the three is asserted on the real thing rather than on the
 * fact that something rendered.
 */
describe('SettingsPage in Arabic', () => {
  it('says everything in Arabic, from the page heading down to the health badge', async () => {
    render('SUPER_ADMIN', 'ar');

    expect(
      await screen.findByRole('heading', { name: 'الإعدادات', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'حسابك' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'صلاحياتك' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'المظهر' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'الاتصال' })).toBeInTheDocument();
    expect(screen.getByText('تشغيل جولة صيانة الإيداعات')).toBeInTheDocument();
    expect(await screen.findByText('جاهز')).toBeInTheDocument();
  });

  it('turns the document right-to-left for Arabic and back again for English', async () => {
    const { unmount } = render('SUPER_ADMIN', 'ar');

    await screen.findByRole('heading', { name: 'الإعدادات', level: 1 });
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    unmount();

    render('SUPER_ADMIN', 'en');

    await screen.findByRole('heading', { name: 'Settings', level: 1 });
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  });

  it("reports a sweep of two with Arabic's dual, which English does not have", async () => {
    sweepReturns({ expired: 2, released: 0, reaped: 0 });
    const { user } = render('SUPER_ADMIN', 'ar');

    await user.click(await screen.findByRole('button', { name: /تشغيل الجولة/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /تشغيل الجولة/ }));

    expect(await screen.findByText('غيّرت هذه الجولة إيداعين.')).toBeInTheDocument();
  });
});
