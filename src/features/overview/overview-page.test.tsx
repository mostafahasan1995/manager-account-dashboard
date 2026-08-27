import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { config } from '@/config';
import { mockRailAgeing } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/utils';

import { OverviewPage } from './overview-page';

const ageingUrl = `${config.apiBaseUrl}/v1/admin/reconciliation/rail-ageing`;

/** The strip's own count: two stale accounts out of two, which is a dual in Arabic. */
const twoStaleRails = () =>
  HttpResponse.json({
    success: true,
    data: {
      ...mockRailAgeing,
      generatedAt: new Date().toISOString(),
      staleAccountCodes: ['RAIL_CLEARING:BANK_SYR', 'RAIL_CLEARING:MOBILE_WALLET'],
    },
    error: null,
    meta: { correlationId: 'test', timestamp: new Date().toISOString() },
  });

describe('OverviewPage', () => {
  it('opens on the whole picture for a role that can see all of it', async () => {
    renderWithProviders(<OverviewPage />, { auth: { role: 'FINANCE_ADMIN' } });

    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();

    expect(await screen.findByRole('link', { name: /waiting for review/i })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /open breaks/i })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /open deposit X8ZZ01/i })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /duplicate credit/i })).toBeInTheDocument();
    expect(await screen.findByText('Stale rails')).toBeInTheDocument();
  });

  it('leaves a SUPPORT user a coherent page with no reconciliation in it', async () => {
    const reconciliationCalls: string[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.url.includes('/reconciliation')) reconciliationCalls.push(request.url);
    });

    renderWithProviders(<OverviewPage />, { auth: { role: 'SUPPORT' } });

    expect(await screen.findByRole('link', { name: /open deposit X8ZZ01/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /waiting for review/i })).toBeInTheDocument();

    expect(screen.queryByRole('link', { name: /open breaks/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/needs a decision that is not a deposit/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Stale rails')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(reconciliationCalls).toEqual([]);
    });
  });
});

describe('in Arabic', () => {
  it('opens on the same shift, in the language the cashier reads', async () => {
    renderWithProviders(<OverviewPage />, { auth: { role: 'FINANCE_ADMIN' }, locale: 'ar' });

    expect(await screen.findByRole('heading', { level: 1, name: 'نظرة عامة' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /بانتظار المراجعة/ })).toBeInTheDocument();
    expect(await screen.findByText('الأطول انتظاراً')).toBeInTheDocument();
    // A backend enum, through the shared bundle rather than through a label map.
    expect(await screen.findByRole('link', { name: 'إضافة مكررة' })).toBeInTheDocument();
  });

  it('mirrors the whole document, which is what every logical utility resolves off', async () => {
    renderWithProviders(<OverviewPage />, { auth: { role: 'FINANCE_ADMIN' }, locale: 'ar' });

    await screen.findByRole('heading', { level: 1, name: 'نظرة عامة' });
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.getAttribute('lang')).toBe('ar');
  });

  it('leaves the document reading left to right in English', async () => {
    renderWithProviders(<OverviewPage />, { auth: { role: 'FINANCE_ADMIN' }, locale: 'en' });

    await screen.findByRole('heading', { level: 1, name: 'Overview' });
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  });

  it('counts two stale rails as a dual, not as a plural', async () => {
    server.use(http.get(ageingUrl, twoStaleRails));

    renderWithProviders(<OverviewPage />, { auth: { role: 'FINANCE_ADMIN' }, locale: 'ar' });

    // «حسابان» is the form English has no word for; «حسابات» here would be the giveaway that the
    // strip was translated by copying English's one/other.
    expect(await screen.findByText(/حسابان من 2/)).toBeInTheDocument();
    expect(screen.queryByText(/2 حسابات/)).not.toBeInTheDocument();
  });
});
