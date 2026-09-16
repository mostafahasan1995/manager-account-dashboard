import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { config } from '@/config';
import { BREAK_IDS } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/utils';

import { OpenBreaks } from './open-breaks';

const breaksUrl = `${config.apiBaseUrl}/v1/admin/reconciliation/breaks`;

const emptyPage = () =>
  HttpResponse.json({
    success: true,
    data: [],
    error: null,
    meta: {
      correlationId: 'test',
      timestamp: new Date().toISOString(),
      limit: 20,
      nextCursor: null,
      hasMore: false,
    },
  });

const brokenList = () =>
  HttpResponse.json(
    {
      success: false,
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Reconciliation is unavailable.' },
      meta: { correlationId: 'corr-9', timestamp: new Date().toISOString() },
    },
    { status: 500 },
  );

const rowFor = async (name: RegExp): Promise<HTMLElement> => {
  const link = await screen.findByRole('link', { name });
  const row = link.closest('tr');
  if (row === null) throw new Error('the break link is not in a table row');
  return row;
};

describe('OpenBreaks', () => {
  it('orders the breaks the way somebody would work them: worst first, then oldest', async () => {
    renderWithProviders(<OpenBreaks />, { auth: { role: 'FINANCE_ADMIN' } });

    await screen.findByRole('link', { name: /duplicate credit/i });

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getByRole('link').textContent)).toEqual([
      'Duplicate credit',
      'Missing credit',
      'Agent float mismatch',
      'Stuck deposit',
    ]);
  });

  it('shows the difference signed, so a surplus does not read like a shortfall', async () => {
    renderWithProviders(<OpenBreaks />, { auth: { role: 'FINANCE_ADMIN' } });

    expect(
      within(await rowFor(/duplicate credit/i)).getByText('+30,000.00 NSP'),
    ).toBeInTheDocument();
    expect(
      within(await rowFor(/missing credit/i)).getByText('-200,000.00 NSP'),
    ).toBeInTheDocument();
  });

  it('states the severity and the status as words', async () => {
    renderWithProviders(<OpenBreaks />, { auth: { role: 'FINANCE_ADMIN' } });

    const row = await rowFor(/missing credit/i);
    expect(within(row).getByText('Severity 5')).toBeInTheDocument();
    expect(within(row).getByText('Investigating')).toBeInTheDocument();
  });

  it('links each break to the break itself, not just to the screen', async () => {
    renderWithProviders(<OpenBreaks />, { auth: { role: 'FINANCE_ADMIN' } });

    const link = await screen.findByRole('link', { name: /duplicate credit/i });
    const href = decodeURIComponent(link.getAttribute('href') ?? '');
    expect(href).toContain('/reconciliation');
    expect(href).toContain(BREAK_IDS.duplicateCredit);
    expect(href).toContain('tab=breaks');
  });

  it('says the books agree when there is nothing open', async () => {
    server.use(http.get(breaksUrl, emptyPage));

    renderWithProviders(<OpenBreaks />, { auth: { role: 'FINANCE_ADMIN' } });

    expect(await screen.findByText('The books agree')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows a failed break list as a failure, with a retry', async () => {
    server.use(http.get(breaksUrl, brokenList));

    renderWithProviders(<OpenBreaks />, { auth: { role: 'FINANCE_ADMIN' } });

    expect(await screen.findByText('Reconciliation is unavailable.')).toBeInTheDocument();
    expect(screen.getByText(/corr-9/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('fills itself in when the retry succeeds', async () => {
    server.use(http.get(breaksUrl, brokenList));

    const { user } = renderWithProviders(<OpenBreaks />, { auth: { role: 'FINANCE_ADMIN' } });

    await screen.findByText('Reconciliation is unavailable.');
    server.resetHandlers();
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByRole('link', { name: /duplicate credit/i })).toBeInTheDocument();
  });
});
