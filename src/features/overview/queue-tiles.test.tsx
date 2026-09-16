import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { config } from '@/config';
import { mockDeposits } from '@/mocks/fixtures';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/utils';

import { QueueTiles } from './queue-tiles';

const depositsUrl = `${config.apiBaseUrl}/v1/admin/deposits`;
const breaksUrl = `${config.apiBaseUrl}/v1/admin/reconciliation/breaks`;
const withdrawalsUrl = `${config.apiBaseUrl}/v1/admin/withdrawals`;

const envelope = (data: unknown, extra: Record<string, unknown>) => ({
  success: true,
  data,
  error: null,
  meta: { correlationId: 'test', timestamp: new Date().toISOString(), ...extra },
});

/** A fresh Response per call: a body can only be read once, and four tiles ask four times. */
const failure = () =>
  HttpResponse.json(
    {
      success: false,
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'The queue is down.' },
      meta: { correlationId: 'test', timestamp: new Date().toISOString() },
    },
    { status: 500 },
  );

/** Waits for the tile to stop loading, then hands back the link so its target can be read. */
const tileShowing = async (name: RegExp, value: string): Promise<HTMLElement> => {
  const link = await screen.findByRole('link', { name });
  expect(await within(link).findByText(value)).toBeInTheDocument();
  return link;
};

const target = (link: HTMLElement): string => decodeURIComponent(link.getAttribute('href') ?? '');

describe('QueueTiles', () => {
  it('counts what the fixtures say is waiting, and links each count to the filter behind it', async () => {
    renderWithProviders(<QueueTiles />, { auth: { role: 'REVIEWER' } });

    expect(target(await tileShowing(/waiting for review/i, '3'))).toContain('status=["SUBMITTED"]');

    const unclaimed = await tileShowing(/^unclaimed/i, '3');
    expect(target(unclaimed)).toContain('unclaimedOnly=true');

    expect(target(await tileShowing(/second approval/i, '1'))).toContain('PENDING_SECOND_APPROVAL');

    const stuck = target(await tileShowing(/stuck money/i, '2'));
    expect(stuck).toContain('CREDIT_FAILED');
    expect(stuck).toContain('NEEDS_RECONCILIATION');
  });

  it('counts the cash-outs a person owes something to, exactly, and links to that filter', async () => {
    renderWithProviders(<QueueTiles />, { auth: { role: 'REVIEWER' } });

    // One REQUESTED and one DEBITED in the fixtures; the offset list sends a real total.
    const tile = await tileShowing(/withdrawals waiting/i, '2');
    expect(target(tile)).toContain('/withdrawals');
    expect(target(tile)).toContain('REQUESTED');
    expect(target(tile)).toContain('DEBITED');
    expect(within(tile).getByText(/debited and not yet paid/i)).toBeInTheDocument();
  });

  it('hides the withdrawals tile from a role that cannot read the queue', async () => {
    renderWithProviders(<QueueTiles />, { auth: { role: 'VIEWER' } });

    await tileShowing(/waiting for review/i, '3');
    expect(screen.queryByRole('link', { name: /withdrawals waiting/i })).not.toBeInTheDocument();
  });

  it('breaks only the withdrawals tile when that list is down', async () => {
    server.use(http.get(withdrawalsUrl, failure));

    const { user } = renderWithProviders(<QueueTiles />, { auth: { role: 'REVIEWER' } });

    expect(await screen.findByText('The queue is down.')).toBeInTheDocument();
    await tileShowing(/waiting for review/i, '3');

    server.resetHandlers();
    await user.click(screen.getByRole('button', { name: /try again/i }));

    await tileShowing(/withdrawals waiting/i, '2');
  });

  it('counts the open breaks and points at the reconciliation screen', async () => {
    renderWithProviders(<QueueTiles />, { auth: { role: 'REVIEWER' } });

    expect(target(await tileShowing(/open breaks/i, '4'))).toContain('/reconciliation');
  });

  it('hides the breaks tile from a role with no reconciliation, and asks the API nothing about it', async () => {
    let breaksRequested = false;
    server.events.on('request:start', ({ request }) => {
      if (request.url.startsWith(breaksUrl)) breaksRequested = true;
    });

    renderWithProviders(<QueueTiles />, { auth: { role: 'SUPPORT' } });

    await tileShowing(/waiting for review/i, '3');
    expect(screen.queryByRole('link', { name: /open breaks/i })).not.toBeInTheDocument();
    expect(breaksRequested).toBe(false);
  });

  it('says "20+" rather than inventing a total the cursor page never sent', async () => {
    const first = mockDeposits[0];
    if (first === undefined) throw new Error('the fixtures lost their deposits');
    const page = Array.from({ length: 20 }, (_, index) => ({
      ...first,
      id: `${first.id}-${index}`,
    }));

    server.use(
      http.get(depositsUrl, () =>
        HttpResponse.json(envelope(page, { limit: 20, nextCursor: '20', hasMore: true })),
      ),
    );

    renderWithProviders(<QueueTiles />, { auth: { role: 'REVIEWER' } });

    const waiting = await tileShowing(/waiting for review/i, '20+');
    expect(within(waiting).getByText(/sends no total/i)).toBeInTheDocument();
  });

  it('breaks the tiles that failed rather than the whole row, and recovers on retry', async () => {
    server.use(http.get(depositsUrl, failure));

    const { user } = renderWithProviders(<QueueTiles />, { auth: { role: 'REVIEWER' } });

    await waitFor(() => {
      expect(screen.getAllByText('The queue is down.')).toHaveLength(4);
    });
    // The breaks tile reads a different endpoint, so it still answers.
    await tileShowing(/open breaks/i, '4');

    server.resetHandlers();
    const retries = screen.getAllByRole('button', { name: /try again/i });
    expect(retries).toHaveLength(4);
    const first = retries[0];
    if (first === undefined) throw new Error('no retry button to press');
    await user.click(first);

    await tileShowing(/waiting for review/i, '3');
  });

  it('breaks only the breaks tile when reconciliation is the thing that is down', async () => {
    server.use(http.get(breaksUrl, failure));

    const { user } = renderWithProviders(<QueueTiles />, { auth: { role: 'REVIEWER' } });

    expect(await screen.findByText('The queue is down.')).toBeInTheDocument();
    await tileShowing(/waiting for review/i, '3');

    server.resetHandlers();
    await user.click(screen.getByRole('button', { name: /try again/i }));

    await tileShowing(/open breaks/i, '4');
  });
});
