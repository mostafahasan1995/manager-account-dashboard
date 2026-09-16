import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { config } from '@/config';
import { server } from '@/test/msw-server';

import { BALANCE_CONCURRENCY, playersApi } from './endpoints';

/**
 * The balance gate, tested where it actually lives.
 *
 * `src/lib/concurrency.test.ts` proves the limiter keeps its ceiling. This proves the ceiling is
 * WIRED — that `playersApi.balance` goes through it and that the shared gate is shared, four across
 * the whole console rather than four per component. A limiter nobody routed through would pass
 * every test in that file and change nothing about the burst it exists to prevent.
 *
 * The second case is the abort check, which is easy to write in the wrong order and impossible to
 * notice: the signal is examined AFTER the wait, not before it. A row that scrolled away, a page
 * that was turned, or a filter retyped while a read sat in the queue must not spend a slot on an
 * answer nobody is waiting for — and checking on the way in would let it, because the abort had not
 * happened yet when the call was made.
 */

const balanceUrl = `${config.apiBaseUrl}/v1/admin/players/:id/balance`;

const envelope = (data: unknown) => ({
  success: true,
  data,
  error: null,
  meta: { correlationId: 'test-correlation', timestamp: '2026-08-25T10:00:00.000Z' },
});

const balanceBody = (playerId: string) => ({
  playerId,
  balanceMinor: '1000',
  currencyCode: 'NSP',
  readAt: '2026-08-25T10:00:00.000Z',
});

interface Gate {
  release: () => void;
  released: Promise<void>;
}

const gate = (): Gate => {
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { release, released };
};

describe('playersApi.balance', () => {
  it('never has more than BALANCE_CONCURRENCY reads in flight at once', async () => {
    const held = gate();
    let inFlight = 0;
    let peak = 0;

    server.use(
      http.get(balanceUrl, async ({ params }) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await held.released;
        inFlight -= 1;
        return HttpResponse.json(envelope(balanceBody(String(params.id))));
      }),
    );

    // Ten rows' worth, which is a realistic page and more than double the ceiling.
    const reads = Array.from({ length: 10 }, (_unused, index) =>
      playersApi.balance(`player-${String(index)}`),
    );

    // Let every request that is going to start, start. The gate holds them all open meanwhile, so
    // the peak observed here is the real simultaneous maximum rather than a scheduling artefact.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(peak).toBe(BALANCE_CONCURRENCY);

    held.release();
    await expect(Promise.all(reads)).resolves.toHaveLength(10);
  });

  it('gives a queued read its slot back to somebody else when its caller has gone', async () => {
    /*
     * The signal is checked after the wait. Filling the gate first is what makes this test the real
     * one: the eleventh read is aborted while QUEUED, and the assertion is both that it rejects and
     * that it never reached the network — a slot spent on it is a slot the visible rows wanted.
     */
    const held = gate();
    let requests = 0;

    server.use(
      http.get(balanceUrl, async ({ params }) => {
        requests += 1;
        await held.released;
        return HttpResponse.json(envelope(balanceBody(String(params.id))));
      }),
    );

    const holders = Array.from({ length: BALANCE_CONCURRENCY }, (_unused, index) =>
      playersApi.balance(`holding-${String(index)}`),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(requests).toBe(BALANCE_CONCURRENCY);

    const controller = new AbortController();
    const queued = playersApi.balance('abandoned', controller.signal);
    controller.abort();

    held.release();
    await expect(queued).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.all(holders);

    // The abandoned read never became a request, so the ceiling was never spent on it.
    expect(requests).toBe(BALANCE_CONCURRENCY);
  });

  it('reads four at a time, which is the number the comment in endpoints.ts argues for', () => {
    // Pinned so a "quick tune" of the constant is a deliberate edit to a test that says why.
    expect(BALANCE_CONCURRENCY).toBe(4);
  });
});
