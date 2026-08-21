import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { reconciliationSearchSchema } from '@/app/search-schemas';
import { config } from '@/config';
import { server } from '@/test/msw-server';
import { renderWithProviders, type AuthOverrides } from '@/test/utils';

import { BreakList } from './break-list';

const validateSearch = (search: Record<string, unknown>) =>
  reconciliationSearchSchema.parse(search);

const render = (route: string, auth?: AuthOverrides) =>
  renderWithProviders(<BreakList />, {
    route,
    routePath: '/reconciliation',
    validateSearch,
    ...(auth === undefined ? {} : { auth }),
  });

const rowFor = (name: RegExp) => screen.getByRole('button', { name }).closest('tr');

const breaksReturn = (rows: Record<string, unknown>[]) => {
  server.use(
    http.get(`${config.apiBaseUrl}/v1/admin/reconciliation/breaks`, () =>
      HttpResponse.json({
        success: true,
        data: rows,
        error: null,
        meta: {
          correlationId: 'test-breaks',
          timestamp: new Date().toISOString(),
          limit: 20,
          nextCursor: null,
          hasMore: false,
        },
      }),
    ),
  );
};

const breakRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'ffffffff-0000-4000-8000-000000000099',
  category: 'MISSING_CREDIT',
  status: 'OPEN',
  severity: 3,
  currencyCode: 'NSP',
  expected: { minor: '100000', amount: '1000.00' },
  actual: { minor: '0', amount: '0.00' },
  delta: { minor: '-100000', amount: '-1000.00' },
  depositRequestId: null,
  playerId: null,
  ledgerAccountId: null,
  ichancyCallId: null,
  detail: null,
  dedupeKey: null,
  detectedAt: new Date().toISOString(),
  assignedToAdminId: null,
  resolvedAt: null,
  resolvedByAdminId: null,
  resolutionNote: null,
  resolutionTxId: null,
  ...overrides,
});

describe('BreakList', () => {
  it('lists the open and investigating breaks by default and leaves the resolved one out', async () => {
    render('/reconciliation');

    expect(await screen.findByRole('button', { name: /agent float mismatch/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /missing credit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /duplicate credit/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /unidentified receipt/i })).not.toBeInTheDocument();
  });

  it('shows a shortfall as negative and an overcredit as positive, to the cent', async () => {
    render('/reconciliation');
    await screen.findByRole('button', { name: /agent float mismatch/i });

    const floatCells = within(rowFor(/agent float mismatch/i) as HTMLElement).getAllByRole('cell');
    expect(floatCells[3]).toHaveTextContent('+4,500,000.00 NSP');
    expect(floatCells[4]).toHaveTextContent('+4,437,500.00 NSP');
    expect(floatCells[5]).toHaveTextContent('-62,500.00 NSP');

    const duplicateCells = within(rowFor(/duplicate credit/i) as HTMLElement).getAllByRole('cell');
    expect(duplicateCells[5]).toHaveTextContent('+30,000.00 NSP');
  });

  it('renders a missing side of the comparison as a dash rather than as zero', async () => {
    render('/reconciliation?status=RESOLVED');

    const row = await screen.findByRole('button', { name: /unidentified receipt/i });
    const cells = within(row.closest('tr') as HTMLElement).getAllByRole('cell');
    expect(cells[3]).toHaveTextContent('—');
  });

  it('selects a break into the URL when its row is opened', async () => {
    const { user, location } = render('/reconciliation');

    await user.click(await screen.findByRole('button', { name: /agent float mismatch/i }));

    expect(location()).toContain('selected=ffffffff-0000-4000-8000-000000000001');
  });

  it('selects a break when the row itself is clicked', async () => {
    const { user, location } = render('/reconciliation');

    const row = (await screen.findByRole('button', { name: /stuck deposit/i })).closest('tr');
    await user.click(row as HTMLElement);

    expect(location()).toContain('selected=');
  });

  it('says so plainly when no break matches the filters', async () => {
    render('/reconciliation?status=RESOLVED&minSeverity=5');

    expect(await screen.findByText(/nothing is out of balance here/i)).toBeInTheDocument();
  });

  it('shows the failure rather than an empty table when the list cannot load', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/v1/admin/reconciliation/breaks`, () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'INTERNAL_ERROR', message: 'The breaks query failed.' },
            meta: { correlationId: 'test-1', timestamp: new Date().toISOString() },
          },
          { status: 500 },
        ),
      ),
    );

    render('/reconciliation');

    expect(await screen.findByRole('alert')).toHaveTextContent('The breaks query failed.');
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('links to the deposit and the player a break points at', async () => {
    render('/reconciliation');
    await screen.findByRole('button', { name: /missing credit/i });

    const row = within(rowFor(/missing credit/i) as HTMLElement);
    expect(row.getByRole('link', { name: /^deposit/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/deposits'),
    );
    expect(row.getByRole('link', { name: /^player/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/players/'),
    );
  });

  it('gives a viewer the ids as plain text, since it cannot open the player screen', async () => {
    render('/reconciliation', { role: 'VIEWER' });

    await screen.findByRole('button', { name: /missing credit/i });
    const row = within(rowFor(/missing credit/i) as HTMLElement);
    expect(row.queryByRole('link', { name: /^player/i })).not.toBeInTheDocument();
    expect(row.getByText(/^Player /)).toBeInTheDocument();
  });

  it('shows an unassigned break as unassigned', async () => {
    render('/reconciliation');

    await screen.findByRole('button', { name: /agent float mismatch/i });
    expect(within(rowFor(/agent float mismatch/i) as HTMLElement).getByText('Unassigned')).toBeInTheDocument();
  });

  it('marks a break assigned to the signed-in admin as theirs', async () => {
    breaksReturn([breakRow({ assignedToAdminId: 'aaaaaaaa-0000-4000-8000-000000000001' })]);

    render('/reconciliation');

    await screen.findByRole('button', { name: /missing credit/i });
    expect(within(rowFor(/missing credit/i) as HTMLElement).getByText('You')).toBeInTheDocument();
  });

  it('shows an assignment to somebody else as the id it actually knows', async () => {
    breaksReturn([breakRow({ assignedToAdminId: 'aaaaaaaa-0000-4000-8000-000000000002' })]);

    render('/reconciliation');

    await screen.findByRole('button', { name: /missing credit/i });
    expect(within(rowFor(/missing credit/i) as HTMLElement).getByText('aaaaaaaa…')).toBeInTheDocument();
  });

  it('says a break points at nothing rather than leaving the cell blank', async () => {
    breaksReturn([breakRow()]);

    render('/reconciliation');

    expect(await screen.findByText('Nothing linked')).toBeInTheDocument();
  });

  it('renders a ledger account and an Ichancy call the console cannot link to', async () => {
    breaksReturn([
      breakRow({
        ledgerAccountId: '44444444-0000-4000-8000-000000000001',
        ichancyCallId: '55555555-0000-4000-8000-000000000001',
      }),
    ]);

    render('/reconciliation');

    expect(await screen.findByText(/^Ledger /)).toBeInTheDocument();
    expect(screen.getByText(/^Call /)).toBeInTheDocument();
  });

  it('renders a category this build has never heard of as itself', async () => {
    breaksReturn([breakRow({ category: 'FUTURE_CATEGORY' })]);

    render('/reconciliation');

    expect(await screen.findByRole('button', { name: /future category/i })).toBeInTheDocument();
  });

  it('reports the end of the list rather than a page number', async () => {
    render('/reconciliation');

    expect(await screen.findByText('End of list')).toBeInTheDocument();
    expect(screen.getByText(/4 breaks loaded/)).toBeInTheDocument();
  });
});
