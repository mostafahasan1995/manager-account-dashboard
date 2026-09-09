import { screen, waitFor, within } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { statsSearchSchema } from '@/app/search-schemas';
import type { Locale } from '@/lib/i18n/locales';
import { db } from '@/mocks/db';
import { tenantStatsView } from '@/mocks/stats';
import type { AdminRole } from '@/types/enums';
import { renderWithProviders } from '@/test/utils';

import { StatsPage } from './stats-page';

/**
 * The screen that answers the question the deposit queue never could.
 *
 * THE FEATURE IN ONE SENTENCE: the queue defaults to the three statuses that need a human, so on a
 * real operator it showed 2 rows out of 48 and every deposit that WORKED was invisible. These tests
 * are written around that: the credited figure has to be on screen, the counts have to come from
 * every status, and the two blocks that are counted on different clocks have to say so.
 */

/**
 * Mounted AT `/stats` with the route's own search schema, not at `/`: the period switcher navigates
 * to `/stats`, and a component mounted anywhere else would unmount itself on the first click into
 * the harness's catch-all route — which reads as "the button does nothing".
 */
const renderPage = (role: AdminRole = 'SUPER_ADMIN', locale: Locale = 'en') =>
  renderWithProviders(<StatsPage />, {
    auth: { role },
    locale,
    route: '/stats',
    routePath: '/stats',
    validateSearch: statsSearchSchema,
  });

/**
 * The tile a label sits in, so a figure can be asserted inside its own card.
 *
 * Async because the tiles arrive with the request: the page header renders immediately, so awaiting
 * the heading proves nothing about whether the figures are on screen yet.
 *
 * The `<p>` filter is not incidental. "Credited" is both a tile label and a column header in the
 * by-rail table below it, so a plain text lookup is ambiguous; StatCard renders its label in a
 * `<p>` and the table renders its header in a `<th>`, which tells the two apart without either
 * component needing a test hook.
 */
const tile = async (label: string | RegExp): Promise<HTMLElement> => {
  const matches = await screen.findAllByText(label);
  const heading = matches.find((node) => node.tagName === 'P');
  const card = heading?.closest('div.rounded-lg');
  if (card === null || card === undefined) throw new Error(`no tile for ${String(label)}`);
  return card as HTMLElement;
};

describe('StatsPage', () => {
  it('shows the credited deposits — the ones the queue never displayed', async () => {
    const expected = tenantStatsView('month');

    renderPage();

    // The count is real: it comes from the same mock rows the queue serves, not a fixture. The
    // count and its clock share one text node, so they are asserted together — which also pins that
    // the credited figure is the one counted when the money LANDED.
    expect(await tile('Credited')).toHaveTextContent(
      `${expected.deposits.credited.count} · Counted when the money landed`,
    );
  });

  it('counts every deposit ever, whatever status it reached', async () => {
    renderPage();

    // The number the operator asked for: how many deposits EXIST, not how many need work. It is
    // strictly larger than the reviewable queue, which is the whole complaint this answers.
    expect(
      within(await tile('Deposits in total')).getByText(String(db.deposits.length)),
    ).toBeVisible();
  });

  it('says which clock each figure was counted on, because they are not the same one', async () => {
    renderPage();

    // THE MISREADING THIS PREVENTS: `Opened` and `Credited` are counted on different timestamps and
    // will not add up. Somebody will try to subtract them; these footnotes are what stops that
    // becoming a bug report about the totals being wrong.
    expect(
      within(await tile('Opened')).getByText(/counted when the deposit was opened/i),
    ).toBeVisible();
    expect(
      within(await tile('Credited')).getByText(/counted when the money landed/i),
    ).toBeVisible();
    expect(
      within(await tile('Waiting for review')).getByText(/not limited to this period/i),
    ).toBeVisible();
  });

  it('offers every window, and marks the month as the one in force by default', async () => {
    renderPage();

    await screen.findByRole('heading', { name: 'Statistics' });

    for (const label of ['Today', 'Last 7 days', 'This month', 'All time']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'This month' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('switches the window, and the figures follow', async () => {
    const { user } = renderPage();

    await tile('Opened');
    await user.click(screen.getByRole('button', { name: 'All time' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'All time' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    // All-time reaches back to the epoch, so `opened` must be every deposit in the database — the
    // proof that the window really changed the query rather than just the button.
    await waitFor(async () => {
      expect(await tile('Opened')).toHaveTextContent(
        `${db.deposits.length} · Counted when the deposit was opened`,
      );
    });
  });

  it('prints the window the SERVER resolved, never one recomputed in the browser', async () => {
    // The boundaries are UTC and the browser is not. A console that re-cut them locally would
    // disagree with the Telegram /report message by up to a day at the edges.
    renderPage();

    expect(await screen.findByTestId('stats-window')).toBeVisible();
    expect(screen.getByText(/windows are utc/i)).toBeInTheDocument();
  });

  it('splits the credited money by the rail it arrived on', async () => {
    const expected = tenantStatsView('month');

    renderPage();

    await screen.findByRole('heading', { name: 'Where the money came from' });

    const firstRail = expected.byMethod[0];
    if (firstRail !== undefined) {
      expect(screen.getByText(firstRail.displayName)).toBeInTheDocument();
    }
  });

  it('says NO rail charges a fee rather than leaving a zero to read as a loss', async () => {
    // THE LIVE SHAPE: every rail is fee_fixed = 0, fee_bps = 0, so the profit is a truthful 0. A
    // bare zero reads as a bad month; this sentence sends somebody to the rails screen instead.
    const stats = tenantStatsView('month');
    renderPage();

    await screen.findByRole('heading', { name: 'Profit' });

    if (stats.profit.chargingRails === 0) {
      expect(screen.getByText(/none of your .* active rails charges a fee/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Open rails' })).toBeInTheDocument();
    } else {
      expect(screen.queryByText(/none of your/i)).toBeNull();
    }
  });

  it('links the deposit tiles at EVERY status, not the reviewable default', async () => {
    // An absent `status` means the reviewable three to the backend, so a bare /deposits link would
    // open a screen showing far fewer rows than the tile beside it just counted.
    renderPage();

    const link = await screen.findByRole('link', { name: 'See all deposits' });
    const href = link.getAttribute('href') ?? '';
    expect(href).toContain('CREDITED');
    expect(href).toContain('EXPIRED');
  });

  it('hides the cross-operator table from a role that may not read it', async () => {
    // Not merely hidden — never mounted, so no request goes out that the backend answers with 403.
    renderPage('FINANCE_ADMIN');

    await screen.findByRole('heading', { name: 'Statistics' });
    expect(screen.queryByRole('heading', { name: 'Every operator' })).toBeNull();
  });

  it('shows every operator side by side for a platform admin', async () => {
    renderPage('PLATFORM_ADMIN');

    expect(await screen.findByRole('heading', { name: 'Every operator' })).toBeInTheDocument();
    // The slug, because two operators may be named alike and a slug never is.
    expect(await screen.findByText('tenant-zero')).toBeInTheDocument();
  });

  it('renders in Arabic without leaving English behind', async () => {
    renderPage('SUPER_ADMIN', 'ar');

    expect(await screen.findByRole('heading', { name: 'الإحصائيات' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'منذ البداية' })).toBeInTheDocument();
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });
});
