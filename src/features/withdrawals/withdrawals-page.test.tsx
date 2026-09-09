import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { withdrawalSearchSchema } from '@/app/search-schemas';
import { NAV_ITEMS, visibleNavItems } from '@/components/layout/nav-items';
import { config } from '@/config';
import { can } from '@/lib/auth/permissions';
import type { Locale } from '@/lib/i18n/locales';
import { WITHDRAWAL_IDS } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderWithProviders, type AuthOverrides } from '@/test/utils';
import type { AdminRole } from '@/types/enums';

import { WithdrawalsPage } from './withdrawals-page';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
  Toaster: () => null,
}));

const renderPage = (
  route = '/withdrawals',
  auth: AuthOverrides = { role: 'REVIEWER' },
  locale?: Locale,
) =>
  renderWithProviders(<WithdrawalsPage />, {
    route,
    routePath: '/withdrawals',
    validateSearch: withdrawalSearchSchema,
    auth,
    ...(locale === undefined ? {} : { locale }),
  });

const url = (location: () => string) => decodeURIComponent(location());

describe('WithdrawalsPage', () => {
  it('opens on what is still moving, and leaves the paid and rejected rows out', async () => {
    renderPage();

    expect(await screen.findByRole('button', { name: 'WD7Q42' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'WD2MX8' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'WD9TT1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'WD4OK5' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'WD1NO9' })).toBeNull();
  });

  it('honours the filters in the link it was opened with', async () => {
    renderPage('/withdrawals?status=PAID,REJECTED&sort=oldest');

    expect(await screen.findByRole('button', { name: 'WD1NO9' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'WD4OK5' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'WD7Q42' })).toBeNull();
  });

  it('writes a filter to the URL and refetches the queue behind it', async () => {
    const { user, location } = renderPage();

    await screen.findByRole('button', { name: 'WD7Q42' });
    await user.click(screen.getByRole('button', { name: 'Ready to pay' }));

    expect(url(location)).toContain('status=["DEBITED"]');
    expect(await screen.findByRole('button', { name: 'WD9TT1' })).toBeInTheDocument();
    await vi.waitFor(() => {
      expect(screen.queryByRole('button', { name: 'WD7Q42' })).toBeNull();
    });
  });

  it('says how fresh the queue is, and that it is live while something is moving', async () => {
    renderPage();

    await screen.findByRole('button', { name: 'WD7Q42' });
    expect(await screen.findByText(/Live · updated/)).toBeInTheDocument();
  });

  it('says a settled view is not being refreshed rather than letting it look broken', async () => {
    renderPage('/withdrawals?status=PAID');

    await screen.findByRole('button', { name: 'WD4OK5' });
    expect(await screen.findByText(/nothing here is still moving/)).toBeInTheDocument();
  });

  it('opens the panel from a row and puts the withdrawal in the URL', async () => {
    const { user, location } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'WD7Q42' }));

    expect(location()).toContain(`selected=${WITHDRAWAL_IDS.requested}`);
    expect(await screen.findByText('Withdrawal WD7Q42')).toBeInTheDocument();
  });

  it('opens the panel from a shared link, even for a row outside the current view', async () => {
    renderPage(`/withdrawals?selected=${WITHDRAWAL_IDS.paid}`);

    expect(await screen.findByText('Withdrawal WD4OK5')).toBeInTheDocument();
    // The open panel is modal, so the queue behind it is hidden from the accessibility tree.
    expect(await screen.findByRole('button', { name: 'WD7Q42', hidden: true })).toBeInTheDocument();
  });

  it('closes the panel and leaves the queue where it was', async () => {
    const { user, location } = renderPage(`/withdrawals?selected=${WITHDRAWAL_IDS.requested}`);

    expect(await screen.findByText('Withdrawal WD7Q42')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    expect(location()).not.toContain('selected=');
    expect(await screen.findByRole('button', { name: 'WD7Q42' })).toBeInTheDocument();
  });

  it('pages through the queue with the offset in the URL', async () => {
    const { user, location } = renderPage('/withdrawals?limit=2');

    expect(await screen.findByText('1–2 of 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(url(location)).toContain('offset=2');
    expect(await screen.findByText('3–3 of 3')).toBeInTheDocument();
  });

  it('offers a way out of a queue its filters emptied', async () => {
    const { user, location } = renderPage('/withdrawals?shortId=ZZZZZZ');

    expect(await screen.findByText('Nothing here')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show the open queue' }));

    expect(location()).not.toContain('shortId');
    expect(await screen.findByRole('button', { name: 'WD7Q42' })).toBeInTheDocument();
  });

  it('reports a queue that would not load, with a way to try again', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/withdrawals`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'INTERNAL', message: 'The queue could not be read.' },
            meta: { correlationId: 'test', timestamp: new Date().toISOString() },
          },
          { status: 500 },
        ),
      ),
    );

    renderPage();

    expect(await screen.findByText('The queue could not be read.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('approves from the panel and the row moves to ready to pay', async () => {
    const { user } = renderPage(`/withdrawals?selected=${WITHDRAWAL_IDS.requested}`);

    await user.click(await screen.findByRole('button', { name: 'Approve' }));
    await user.click(await screen.findByRole('button', { name: /approve and debit/i }));

    // The panel refetched: the DEBITED footer replaces the decision buttons.
    expect(await screen.findByRole('button', { name: 'Mark paid' })).toBeInTheDocument();
  });

  it('lets a reader open the panel but not decide', async () => {
    renderPage(`/withdrawals?selected=${WITHDRAWAL_IDS.requested}`, { role: 'SUPPORT' });

    expect(await screen.findByText('Withdrawal WD7Q42')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(
      screen.getByText('Your role can read withdrawals but not decide them.'),
    ).toBeInTheDocument();
  });
});

describe('WithdrawalsPage in Arabic', () => {
  it('renders the queue in Arabic, right to left', async () => {
    renderPage('/withdrawals', { role: 'REVIEWER' }, 'ar');

    expect(await screen.findByRole('heading', { name: 'السحوبات' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ما زال يتحرك' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'WD7Q42' })).toBeInTheDocument();
    expect(screen.getByText('جاهز للدفع', { selector: 'span' })).toBeInTheDocument();
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });
});

describe('the withdrawals nav item', () => {
  const item = NAV_ITEMS.find((entry) => entry.to === '/withdrawals');

  it('sits right after Deposits — money out beside money in', () => {
    const paths = NAV_ITEMS.map((entry) => entry.to);
    expect(paths.indexOf('/withdrawals')).toBe(paths.indexOf('/deposits') + 1);
    expect(item?.labelKey).toBe('nav.withdrawals');
    expect(item?.capability).toBe('withdrawals.read');
  });

  it.each<[AdminRole, boolean]>([
    ['SUPER_ADMIN', true],
    ['FINANCE_ADMIN', true],
    ['REVIEWER', true],
    ['SUPPORT', true],
    ['PLATFORM_ADMIN', true],
    ['VIEWER', false],
  ])('is offered to %s: %s', (role, offered) => {
    const shown = visibleNavItems((capability) => can(role, capability)).some(
      (entry) => entry.to === '/withdrawals',
    );
    expect(shown).toBe(offered);
  });
});
