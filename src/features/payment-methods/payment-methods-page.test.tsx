import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { paymentMethodSearchSchema } from '@/app/search-schemas';
import { config } from '@/config';
import { METHOD_IDS } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/utils';

import { PaymentMethodsPage } from './payment-methods-page';

/**
 * The whole screen against the mock API: the two tables have to agree about which method is
 * selected, and the filters in the URL have to survive the round trip through the query.
 */

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const render = (
  route = '/payment-methods',
  options: Parameters<typeof renderWithProviders>[1] = {},
) =>
  renderWithProviders(<PaymentMethodsPage />, {
    route,
    routePath: '/payment-methods',
    validateSearch: (search) => paymentMethodSearchSchema.parse(search),
    ...options,
  });

describe('PaymentMethodsPage', () => {
  it('loads the rails and shows a method destinations once it is picked', async () => {
    const { user } = render();

    await user.click(await screen.findByRole('button', { name: /^BANK_SYR/ }));

    expect(await screen.findByText('Main branch account')).toBeInTheDocument();
    expect(screen.getByText('SY84 0000 0000 0001 2345')).toBeInTheDocument();
  });

  it('honours an inactive-only filter carried in the URL', async () => {
    render('/payment-methods?state=inactive');

    expect(await screen.findByRole('button', { name: /^OLD_CRYPTO/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^BANK_SYR/ })).toBeNull();
  });

  it('hides a retired rail from the default view — nothing in the URL asked to see it', async () => {
    // The bug this pins: an operator landing on this screen with no filter at all must not be shown
    // a rail that was deliberately taken off the menu, as though it were still on offer.
    render();

    await screen.findByRole('button', { name: /^BANK_SYR/ });
    expect(screen.queryByRole('button', { name: /^OLD_CRYPTO/ })).toBeNull();
  });

  it('shows a retired rail once the operator explicitly asks for everything', async () => {
    render('/payment-methods?state=all');

    expect(await screen.findByRole('button', { name: /^BANK_SYR/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^OLD_CRYPTO/ })).toBeInTheDocument();
  });

  it('explains a shared link whose method the filters hide', async () => {
    render(`/payment-methods?rail=CRYPTO&selected=${METHOD_IDS.bank}`);

    expect(await screen.findByText('That method is not in this list')).toBeInTheDocument();
    expect(screen.getByText('No method selected')).toBeInTheDocument();
  });

  it('opens straight onto the destinations of a method named in the URL', async () => {
    render(`/payment-methods?selected=${METHOD_IDS.wallet}`);

    expect(await screen.findByText('Primary wallet')).toBeInTheDocument();
  });

  it('reports a rail list that will not load', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/payment-methods`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'INTERNAL', message: 'The rails did not load.' },
            meta: { correlationId: 'test', timestamp: new Date().toISOString() },
          },
          { status: 500 },
        ),
      ),
    );
    const { user } = render();

    await waitFor(
      () => {
        expect(screen.getByText('The rails did not load.')).toBeInTheDocument();
      },
      { timeout: 3_000 },
    );

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('The rails did not load.')).toBeInTheDocument();
  });

  /**
   * The rate moved to /financial and was not copied. Two write forms over one stored value means
   * two places to read a stale number off, with nothing on either saying which was saved last.
   */
  it('leaves the rate form to the financial screen rather than keeping a second copy', async () => {
    render();

    await screen.findByRole('button', { name: /^BANK_SYR/ });
    expect(screen.queryByText('USDT rate')).toBeNull();
  });

  it('gives a REVIEWER the whole screen and none of the write actions', async () => {
    render(`/payment-methods?selected=${METHOD_IDS.bank}`, { auth: { role: 'REVIEWER' } });

    expect(await screen.findByText('Main branch account')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new method/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /add destination/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Edit / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Deactivate / })).toBeNull();
  });
});

/**
 * Arabic is not a skin over the English screen: the page mirrors, and every word a cashier reads
 * off it has to arrive translated — including the ones that come from a backend enum and the ones
 * that count. Asserting on real Arabic text rather than on "it rendered" is the point; a screen
 * showing `rails.field.limits` also renders.
 */
describe('PaymentMethodsPage in Arabic', () => {
  it('renders the rails screen in Arabic, headings and table alike', async () => {
    render('/payment-methods', { locale: 'ar' });

    expect(await screen.findByRole('heading', { name: 'قنوات الدفع' })).toBeInTheDocument();
    // A backend enum and a column header: proof the whole table came through, not just the header.
    expect(await screen.findByText('مطابقة المرجع')).toBeInTheDocument();
    expect(screen.getByText('الحدود')).toBeInTheDocument();
  });

  it('turns the document over to right-to-left, and back again for English', async () => {
    const arabic = render('/payment-methods', { locale: 'ar' });
    await screen.findByRole('heading', { name: 'قنوات الدفع' });
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.getAttribute('lang')).toBe('ar');
    arabic.unmount();

    render('/payment-methods', { locale: 'en' });
    await screen.findByRole('heading', { name: 'Payment rails' });
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  });

  it("counts two accounts with Arabic's dual, which English does not have", async () => {
    render(`/payment-methods?selected=${METHOD_IDS.bank}`, { locale: 'ar' });

    // The bank rail has exactly two live destinations, so this is صيغة المثنى, not "2 حساب".
    expect(await screen.findByText('حسابان')).toBeInTheDocument();
  });

  it('counts in English with the plural English actually has', async () => {
    render(`/payment-methods?selected=${METHOD_IDS.bank}`);

    expect(await screen.findByText('2 accounts')).toBeInTheDocument();
  });
});
