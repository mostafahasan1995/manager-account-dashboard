import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { depositSearchSchema } from '@/app/search-schemas';
import { config } from '@/config';
import type { Locale } from '@/lib/i18n/locales';
import { DEPOSIT_IDS } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderWithProviders, type AuthOverrides } from '@/test/utils';

import { DepositsPage } from './deposits-page';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
  Toaster: () => null,
}));

const validateSearch = (search: Record<string, unknown>) => depositSearchSchema.parse(search);

const renderPage = (
  route = '/deposits',
  auth: AuthOverrides = { role: 'REVIEWER' },
  locale?: Locale,
) =>
  renderWithProviders(<DepositsPage />, {
    route,
    routePath: '/deposits',
    validateSearch,
    auth,
    ...(locale === undefined ? {} : { locale }),
  });

describe('DepositsPage', () => {
  it('loads the review queue and nothing that has already been decided', async () => {
    renderPage();

    expect(await screen.findByRole('button', { name: 'K7QP42' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'M2WX88' })).toBeInTheDocument();
    // CREDITED is outside the default reviewable set.
    expect(screen.queryByRole('button', { name: 'D3OK55' })).toBeNull();
  });

  it('honours the filters in the link it was opened with', async () => {
    renderPage('/deposits?status=CREDIT_FAILED');

    expect(await screen.findByRole('button', { name: 'C1FF77' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'K7QP42' })).toBeNull();
  });

  it('says how fresh the queue is, so a quiet morning is not mistaken for a broken feed', async () => {
    renderPage();

    await screen.findByRole('button', { name: 'K7QP42' });
    expect(await screen.findByText(/Live · updated/)).toBeInTheDocument();
  });

  it('moves the selection with j and opens it with Enter', async () => {
    const { user, location } = renderPage();

    await screen.findByRole('button', { name: 'K7QP42' });
    await user.keyboard('j');
    await user.keyboard('{Enter}');

    expect(location()).toContain(`selected=${DEPOSIT_IDS.awaitingReview}`);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('steps back up the queue with k', async () => {
    const { user, location } = renderPage();

    await screen.findByRole('button', { name: 'K7QP42' });
    await user.keyboard('jj');
    await user.keyboard('k');
    await user.keyboard('{Enter}');

    expect(location()).toContain(`selected=${DEPOSIT_IDS.awaitingReview}`);
  });

  it('never opens a deposit from a keystroke typed into a filter', async () => {
    const { user, location } = renderPage();

    await user.type(await screen.findByLabelText('Short ID'), 'jjj');

    expect(location()).not.toContain('selected=');
  });

  it('closes the panel on Escape and leaves the queue where it was', async () => {
    const { user, location } = renderPage(`/deposits?selected=${DEPOSIT_IDS.awaitingReview}`);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    expect(location()).not.toContain('selected=');
    expect(await screen.findByRole('button', { name: 'K7QP42' })).toBeInTheDocument();
  });

  it('opens the panel from a shared link', async () => {
    renderPage(`/deposits?selected=${DEPOSIT_IDS.duplicateProof}`);

    expect(await screen.findByText('Deposit M2WX88')).toBeInTheDocument();
  });

  it('shows the shortcuts, and says which of them can move money', async () => {
    renderPage();

    expect(
      await screen.findByText(/Approving and rejecting always take a click/),
    ).toBeInTheDocument();
  });

  it('offers a way out of a queue its filters emptied', async () => {
    const { user, location } = renderPage('/deposits?shortId=ZZZZZZ');

    expect(await screen.findByText('Nothing here')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show the whole queue' }));

    expect(location()).not.toContain('shortId');
    expect(await screen.findByRole('button', { name: 'K7QP42' })).toBeInTheDocument();
  });

  it('reports a queue that would not load, with a way to try again', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/deposits`, () =>
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

  it('keeps the maintenance sweep away from a reviewer', async () => {
    renderPage();

    await screen.findByRole('button', { name: 'K7QP42' });
    expect(screen.queryByRole('button', { name: /maintenance sweep/i })).toBeNull();
  });

  it('runs the sweep after a confirmation and reports what it did', async () => {
    const { user } = renderPage('/deposits', { role: 'SUPER_ADMIN' });

    await user.click(await screen.findByRole('button', { name: /run maintenance sweep/i }));
    await user.click(await screen.findByRole('button', { name: 'Run sweep' }));

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      'Maintenance sweep finished',
      expect.objectContaining({ description: expect.stringContaining('expired') }),
    );
  });

  it('says so when the sweep fails', async () => {
    server.use(
      http.post(`${config.apiBaseUrl}/v1/admin/deposits/maintenance/sweep`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'INTERNAL', message: 'The sweep worker is not running.' },
            meta: { correlationId: 'test', timestamp: new Date().toISOString() },
          },
          { status: 503 },
        ),
      ),
    );

    const { user } = renderPage('/deposits', { role: 'SUPER_ADMIN' });

    await user.click(await screen.findByRole('button', { name: /run maintenance sweep/i }));
    await user.click(await screen.findByRole('button', { name: 'Run sweep' }));

    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      'The maintenance sweep failed',
      expect.objectContaining({ description: 'The sweep worker is not running.' }),
    );
  });
});

/**
 * Arabic is not a translated copy of this screen, it is the same screen mirrored — so what is worth
 * pinning is the part a glance at a screenshot misses: that the queue really renders in Arabic
 * rather than falling back to English, that the document itself flips, and that a count of two
 * reads as Arabic's dual. Two is the number this queue shows more often than any other.
 */
describe('DepositsPage in Arabic', () => {
  it('renders the queue in Arabic, not in English with Arabic chrome', async () => {
    renderPage('/deposits', { role: 'REVIEWER' }, 'ar');

    expect(await screen.findByRole('heading', { name: 'الإيداعات' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'يحتاج مراجعة' })).toBeInTheDocument();
    // The short id is data, not language: it reads the same either way.
    expect(await screen.findByRole('button', { name: 'K7QP42' })).toBeInTheDocument();
  });

  it('turns the document right-to-left for Arabic and back for English', async () => {
    const { unmount } = renderPage();

    await screen.findByRole('button', { name: 'K7QP42' });
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    unmount();

    renderPage('/deposits', { role: 'REVIEWER' }, 'ar');

    await screen.findByRole('heading', { name: 'الإيداعات' });
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });

  it('counts two proofs with the dual form English does not have', async () => {
    renderPage(`/deposits?selected=${DEPOSIT_IDS.duplicateProof}`, { role: 'REVIEWER' }, 'ar');

    // «إثباتان», not «2 إثبات» — the whole point of carrying six plural categories. The «·» keeps
    // this off the section heading, which spells the same dual out as «الإثباتان».
    expect(await screen.findByText(/· إثباتان$/)).toBeInTheDocument();
  });
});
