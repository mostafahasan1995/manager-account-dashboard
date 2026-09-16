import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { configureApiClient } from '@/lib/api/client';
import { platformFinanceApi } from '@/lib/api/endpoints';
import { isApiError } from '@/lib/api/errors';
import type { Locale } from '@/lib/i18n/locales';
import type { AdminRole } from '@/types/enums';
import { renderWithProviders } from '@/test/utils';

import { PlatformFinancePage } from './platform-finance-page';

/**
 * The platform finance screen, and the one rule it exists to hold: a read that did not land renders
 * as WHAT IT IS — unavailable, not linked, expired, not loaded — never as a `0`. The fixtures carry
 * one of each failure on purpose, so the never-zero rule is on screen every time the page opens.
 */

const renderPage = (role: AdminRole = 'PLATFORM_ADMIN', locale: Locale = 'en') =>
  renderWithProviders(<PlatformFinancePage />, { auth: { role }, locale });

/** The `<tr>` an operator's slug sits in, so a cell can be asserted within its own row. */
const rowFor = (slug: string): HTMLElement => {
  const cell = screen.getByText(slug);
  const row = cell.closest('tr');
  if (row === null) throw new Error(`no row for ${slug}`);
  return row;
};

describe('PlatformFinancePage', () => {
  it('lists every operator the platform has, with a row each', async () => {
    renderPage();

    expect(await screen.findByText('tenant-zero')).toBeInTheDocument();
    expect(screen.getByText('northern-branch')).toBeInTheDocument();
    expect(screen.getByText('pilot-operator')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Operator finances' })).toBeInTheDocument();
  });

  it('renders a real agent float as a figure, and its low verdict beside it', async () => {
    renderPage();

    await screen.findByText('tenant-zero');

    // The healthy operator's float is a grouped figure, never a bare number.
    expect(within(rowFor('tenant-zero')).getByText(/4,437,500\.00 NSP/)).toBeInTheDocument();
    // The northern branch is genuinely low — a real figure with the server's "Low" verdict.
    const north = within(rowFor('northern-branch'));
    expect(north.getByText(/380,000\.00 NSP/)).toBeInTheDocument();
    expect(north.getByText('Low')).toBeInTheDocument();
  });

  it('shows a loaded USDT wallet as a figure and a broken one as unavailable, not 0', async () => {
    renderPage();

    await screen.findByText('tenant-zero');
    const zero = within(rowFor('tenant-zero'));

    // The healthy TRC20 wallet reads its balance at USDT's six decimals.
    expect(zero.getByText(/12,500\.000000 USDT/)).toBeInTheDocument();
    // The BEP20 wallet's node did not answer: rendered as unavailable, with no figure.
    expect(zero.getByText('Unavailable')).toBeInTheDocument();
    expect(zero.getByText(/node did not answer/i)).toBeInTheDocument();
  });

  /**
   * The core assertion of the whole feature. The pilot operator's three cells are all failures — an
   * agent float that is unavailable, and USDT and Sham Cash that have never been loaded — so NOT ONE
   * of them may render a money figure. `MoneyAmount` is the only thing that emits `data-testid=money`,
   * so its total absence in this row is the proof that no failed read became a number.
   */
  it('never renders a failed read as a 0 balance', async () => {
    renderPage();

    await screen.findByText('pilot-operator');
    const pilot = within(rowFor('pilot-operator'));

    // Every failed state shows its word, in the operator's own row.
    expect(pilot.getByText('Unavailable')).toBeInTheDocument(); // agent float
    expect(pilot.getAllByText('Not loaded')).toHaveLength(2); // USDT + Sham Cash

    // And nothing in the row is a money figure — no 0, no anything.
    expect(pilot.queryAllByTestId('money')).toHaveLength(0);
  });

  it('shows Sham Cash failures as what they are — no key, key rejected — never as 0', async () => {
    renderPage();

    await screen.findByText('tenant-zero');

    // tenant-zero has no Sham Cash API key; northern-branch's key is being refused.
    expect(within(rowFor('tenant-zero')).getByText('Not linked')).toBeInTheDocument();
    expect(within(rowFor('northern-branch')).getByText('Key rejected')).toBeInTheDocument();
    // None of these three is a wallet of zeros.
    expect(within(rowFor('tenant-zero')).queryByText(/^0(\.0+)?\s/)).not.toBeInTheDocument();
  });

  it("loads an operator's expensive columns on a per-row refresh", async () => {
    const { user } = renderPage();

    await screen.findByText('pilot-operator');
    // Starts entirely un-loaded.
    expect(within(rowFor('pilot-operator')).getAllByText('Not loaded')).toHaveLength(2);

    await user.click(
      within(rowFor('pilot-operator')).getByRole('button', {
        name: /refresh the usdt and sham cash columns for pilot-operator/i,
      }),
    );

    // After the refresh the overview re-reads and the two columns are filled in: a USDT figure and
    // a Sham Cash balance where the "Not loaded" notes were.
    await waitFor(() => {
      expect(within(rowFor('pilot-operator')).queryByText('Not loaded')).not.toBeInTheDocument();
    });
    const pilot = within(rowFor('pilot-operator'));
    expect(pilot.getByText(/12,500\.000000 USDT/)).toBeInTheDocument();
    expect(pilot.getByText(/250,000 SYP/)).toBeInTheDocument();
  });

  it('refreshes every operator from the header, dripping through the limiter', async () => {
    const { user } = renderPage();

    await screen.findByText('pilot-operator');

    await user.click(screen.getByRole('button', { name: 'Refresh all' }));

    await waitFor(() => {
      expect(within(rowFor('pilot-operator')).queryByText('Not loaded')).not.toBeInTheDocument();
    });
    // The suspended operator's float still cannot be read — a refresh loads the wallets, it does not
    // invent a float — so the never-zero rule still holds after a refresh.
    expect(within(rowFor('pilot-operator')).getByText('Unavailable')).toBeInTheDocument();
  });
});

/**
 * Access. The route guard keeps a non-PLATFORM_ADMIN off this screen; the backend enforces the same,
 * so the mock refuses any real role that is not a platform admin. Asserted at the endpoint, where the
 * role can be named through the bearer token exactly as a real access token carries it.
 */
describe('who may read the platform finance overview', () => {
  it('refuses a role that is not a platform admin with a 403', async () => {
    configureApiClient({ getToken: () => 'mock:REVIEWER:token' });

    const caught = await platformFinanceApi.balances().catch((error: unknown) => error);

    expect(isApiError(caught) && caught.status).toBe(403);
  });

  it('serves a platform admin every operator', async () => {
    configureApiClient({ getToken: () => 'mock:PLATFORM_ADMIN:token' });

    await expect(platformFinanceApi.balances()).resolves.toHaveLength(3);
  });
});

/** Arabic is compiler-enforced, and it keeps the wiring vocabulary — USDT, Sham Cash — in English. */
describe('PlatformFinancePage in Arabic', () => {
  it('renders its own strings in Arabic, wiring words left in English', async () => {
    renderPage('PLATFORM_ADMIN', 'ar');

    // The column header only renders once the table has data, so it doubles as the load wait. It
    // mixes Arabic with the English term the operators' own config uses.
    expect(await screen.findByText('محافظ USDT')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'أموال المشغّلين' })).toBeInTheDocument();
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });
});
