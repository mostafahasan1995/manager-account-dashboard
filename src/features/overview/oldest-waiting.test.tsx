import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { config } from '@/config';
import { DEPOSIT_IDS } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/utils';

import { OldestWaiting } from './oldest-waiting';

const depositsUrl = `${config.apiBaseUrl}/v1/admin/deposits`;

const emptyPage = () =>
  HttpResponse.json({
    success: true,
    data: [],
    error: null,
    meta: {
      correlationId: 'test',
      timestamp: new Date().toISOString(),
      limit: 5,
      nextCursor: null,
      hasMore: false,
    },
  });

const brokenQueue = () =>
  HttpResponse.json(
    {
      success: false,
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'The queue is down.' },
      meta: { correlationId: 'corr-7', timestamp: new Date().toISOString() },
    },
    { status: 500 },
  );

describe('OldestWaiting', () => {
  it('lists the five that have waited longest, oldest first', async () => {
    renderWithProviders(<OldestWaiting />, { auth: { role: 'REVIEWER' } });

    expect(await screen.findByRole('link', { name: /open deposit X8ZZ01/i })).toBeInTheDocument();

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(5);
    expect(rows.map((row) => within(row).getByRole('link').textContent)).toEqual([
      'X8ZZ01',
      'P0BB31',
      'B4LM63',
      'R9TT10',
      'M2WX88',
    ]);
  });

  it('shows the claimed amount exactly as the backend sent it', async () => {
    renderWithProviders(<OldestWaiting />, { auth: { role: 'REVIEWER' } });

    const link = await screen.findByRole('link', { name: /open deposit X8ZZ01/i });
    const row = link.closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByTestId('money')).toHaveTextContent('850,000.00 NSP');
  });

  it('opens the deposit it names', async () => {
    renderWithProviders(<OldestWaiting />, { auth: { role: 'REVIEWER' } });

    const link = await screen.findByRole('link', { name: /open deposit X8ZZ01/i });
    const href = decodeURIComponent(link.getAttribute('href') ?? '');
    expect(href).toContain('/deposits');
    expect(href).toContain(DEPOSIT_IDS.secondApproval);
  });

  it('calls a long wait late in words, not only in colour', async () => {
    renderWithProviders(<OldestWaiting />, { auth: { role: 'REVIEWER' } });

    await screen.findByRole('link', { name: /open deposit X8ZZ01/i });
    // Four of the five have waited past the late mark; the newest, M2WX88, has not.
    expect(screen.getAllByText('Late')).toHaveLength(4);

    const newest = screen.getByRole('link', { name: /open deposit M2WX88/i }).closest('tr');
    expect(newest).not.toBeNull();
    expect(within(newest as HTMLElement).queryByText('Late')).not.toBeInTheDocument();
  });

  it('says so plainly when nothing is waiting', async () => {
    server.use(http.get(depositsUrl, emptyPage));

    renderWithProviders(<OldestWaiting />, { auth: { role: 'REVIEWER' } });

    expect(await screen.findByText('Nothing is waiting')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the failure with its correlation id and a way to retry', async () => {
    server.use(http.get(depositsUrl, brokenQueue));

    renderWithProviders(<OldestWaiting />, { auth: { role: 'REVIEWER' } });

    expect(await screen.findByText('The queue is down.')).toBeInTheDocument();
    expect(screen.getByText(/corr-7/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('fills itself in when the retry succeeds', async () => {
    server.use(http.get(depositsUrl, brokenQueue));

    const { user } = renderWithProviders(<OldestWaiting />, { auth: { role: 'REVIEWER' } });

    await screen.findByText('The queue is down.');
    server.resetHandlers();
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByRole('link', { name: /open deposit X8ZZ01/i })).toBeInTheDocument();
  });

  it('always offers the full queue, whatever the panel is showing', async () => {
    renderWithProviders(<OldestWaiting />, { auth: { role: 'REVIEWER' } });

    const link = await screen.findByRole('link', { name: /open the queue/i });
    expect(decodeURIComponent(link.getAttribute('href') ?? '')).toContain('sort=oldest');
  });
});
