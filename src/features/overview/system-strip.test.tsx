import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { config } from '@/config';
import { mockRailAgeing } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/utils';

import { SystemStrip } from './system-strip';

const ageingUrl = `${config.apiBaseUrl}/v1/admin/reconciliation/rail-ageing`;

const report = (overrides: Partial<typeof mockRailAgeing>) => () =>
  HttpResponse.json({
    success: true,
    data: { ...mockRailAgeing, generatedAt: new Date().toISOString(), ...overrides },
    error: null,
    meta: { correlationId: 'test', timestamp: new Date().toISOString() },
  });

const broken = () =>
  HttpResponse.json(
    {
      success: false,
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Rail ageing could not be built.' },
      meta: { correlationId: 'corr-3', timestamp: new Date().toISOString() },
    },
    { status: 500 },
  );

describe('SystemStrip', () => {
  it('names the rail that has stopped settling', async () => {
    renderWithProviders(<SystemStrip />, { auth: { role: 'FINANCE_ADMIN' } });

    expect(await screen.findByText('Stale rails')).toBeInTheDocument();
    expect(screen.getByText('RAIL_CLEARING:BANK_SYR')).toBeInTheDocument();
    expect(screen.getByText(/1 of 2 rail accounts/i)).toBeInTheDocument();
  });

  it('leads to the full ageing report', async () => {
    renderWithProviders(<SystemStrip />, { auth: { role: 'FINANCE_ADMIN' } });

    const link = await screen.findByRole('link', { name: /rail ageing/i });
    expect(decodeURIComponent(link.getAttribute('href') ?? '')).toContain('tab=ageing');
  });

  it('says so in a word when every rail is settling', async () => {
    server.use(http.get(ageingUrl, report({ staleAccountCodes: [] })));

    renderWithProviders(<SystemStrip />, { auth: { role: 'FINANCE_ADMIN' } });

    expect(await screen.findByText('Rails settling')).toBeInTheDocument();
    expect(screen.queryByText('Stale rails')).not.toBeInTheDocument();
  });

  it('does not claim rails are healthy when there are no rails at all', async () => {
    server.use(http.get(ageingUrl, report({ rows: [], staleAccountCodes: [] })));

    renderWithProviders(<SystemStrip />, { auth: { role: 'FINANCE_ADMIN' } });

    expect(await screen.findByText('No rail accounts yet')).toBeInTheDocument();
    expect(screen.queryByText('Rails settling')).not.toBeInTheDocument();
  });

  it('shows a failed report as a failure, with a retry', async () => {
    server.use(http.get(ageingUrl, broken));

    renderWithProviders(<SystemStrip />, { auth: { role: 'FINANCE_ADMIN' } });

    expect(await screen.findByText('Rail ageing could not be built.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('fills itself in when the retry succeeds', async () => {
    server.use(http.get(ageingUrl, broken));

    const { user } = renderWithProviders(<SystemStrip />, { auth: { role: 'FINANCE_ADMIN' } });

    await screen.findByText('Rail ageing could not be built.');
    server.resetHandlers();
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText('Stale rails')).toBeInTheDocument();
  });
});
