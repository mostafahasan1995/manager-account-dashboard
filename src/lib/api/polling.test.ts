import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/app/query-client';

import { ApiError } from './errors';

import { AGENT_FLOAT_POLL_MS, HEALTH_POLL_MS, OVERVIEW_POLL_MS, QUEUE_POLL_MS } from './queries';

/**
 * How hard this console is allowed to hit the backend while nobody is doing anything.
 *
 * ── WHAT WENT WRONG ───────────────────────────────────────────────────────────────────────────
 * The overview ran five deposit queries at 15s, a break list at 60s and two health probes at 30s:
 * about 25 requests a minute, per open tab, for ever. Measured on a real console with an EMPTY
 * queue it came to 475 requests and 714 kB, and most of them re-answered the same nine stuck
 * deposits — rows that had not changed in days and could not change without somebody in this
 * console acting, which already invalidates them.
 *
 * ── WHY IT IS A TEST AND NOT A COMMENT ────────────────────────────────────────────────────────
 * Every one of those intervals was a reasonable-looking number on its own. Nothing added them up,
 * and nothing ever will unless something does it here. These numbers are cheap to "just tune" back
 * down while chasing a screen that feels stale, and the cost of doing so is invisible until
 * somebody opens the network tab a month later.
 *
 * The fix that made the cuts possible is `refetchOnWindowFocus`, which is why it is pinned too:
 * with it off, no surface can tell that a person came back, so every surface needs a timer and the
 * timers have to be fast. It is the cheaper and more accurate signal, and turning it off again
 * would quietly re-create the need for all of this.
 */

/**
 * What the overview costs per minute at rest, counting a health tick as its two probes.
 *
 * The agent float belongs in this sum even though it is not part of the overview: it lives in the
 * top bar, so it is on this screen and on every other one. A timer added to the chrome is a timer
 * added to every screen at once, which is exactly the kind of thing nothing was adding up.
 */
const overviewRequestsPerMinute = (): number => {
  const perMinute = (intervalMs: number): number => 60_000 / intervalMs;
  const liveTiles = 2;
  const healthProbesPerTick = 2;
  return (
    liveTiles * perMinute(OVERVIEW_POLL_MS) +
    healthProbesPerTick * perMinute(HEALTH_POLL_MS) +
    perMinute(AGENT_FLOAT_POLL_MS)
  );
};

describe('what polls, and how slowly', () => {
  it('keeps a timer on the deposit queue, which is the one contended surface', () => {
    // Two reviewers race for the same deposit; a claim taken by a colleague has to appear without
    // anybody pressing anything. This is the only screen where that is true.
    expect(QUEUE_POLL_MS).toBe(30_000);
  });

  it('leaves the overview slow enough to leave open on a wall', () => {
    expect(OVERVIEW_POLL_MS).toBe(120_000);
    expect(OVERVIEW_POLL_MS).toBeGreaterThanOrEqual(QUEUE_POLL_MS);
  });

  it('treats health as the status light it is', () => {
    expect(HEALTH_POLL_MS).toBe(120_000);
  });

  it('keeps the agent float no faster than health, because it runs on every screen', () => {
    // A cheap ledger read, so a timer is defensible — but this one is mounted in the top bar above
    // every route. Making it "feel live" multiplies by every screen and every open tab, and buys
    // nothing: a float two minutes stale changes no decision an operator would make differently.
    expect(AGENT_FLOAT_POLL_MS).toBeGreaterThanOrEqual(HEALTH_POLL_MS);
  });

  it('costs a handful of requests a minute at rest, not dozens', () => {
    // The number that actually matters, and the one nothing else was computing. It was ~25.
    expect(overviewRequestsPerMinute()).toBeLessThanOrEqual(5);
  });
});

describe('the signal that replaced the timers', () => {
  it('refetches when somebody comes back to the tab', () => {
    // Load-bearing. Turn this off and every surface needs a fast timer again, which is exactly how
    // the console got to 25 requests a minute.
    const options = createQueryClient().getDefaultOptions().queries;

    expect(options?.refetchOnWindowFocus).toBe(true);
  });

  it('still bounds that with a stale time, so returning to a tab is not a thundering herd', () => {
    const options = createQueryClient().getDefaultOptions().queries;

    expect(options?.staleTime).toBeGreaterThan(0);
  });
});

/**
 * The retry policy, which is the other half of "how hard this console hits the backend".
 *
 * It had no test at all. Every branch of it is a decision that costs somebody something when it is
 * wrong: retrying a 403 delays telling an operator their role cannot do this, and NOT retrying a
 * 502 turns a one-second backend blip into a broken screen.
 */
describe('what is worth retrying', () => {
  const retry = (): ((failureCount: number, error: Error) => boolean) => {
    const option = createQueryClient().getDefaultOptions().queries?.retry;
    if (typeof option !== 'function') throw new Error('retry is not a predicate');
    return option;
  };

  it.each([400, 401, 403, 404, 409, 422])(
    'never retries a %i, which will fail identically',
    (status) => {
      expect(retry()(0, new ApiError({ status, code: 'X', message: 'no' }))).toBe(false);
    },
  );

  it.each([500, 502, 503])('retries a %i, which is usually a blip', (status) => {
    expect(retry()(0, new ApiError({ status, code: 'X', message: 'oops' }))).toBe(true);
  });

  it('retries a rate limit and a network failure', () => {
    expect(retry()(0, new ApiError({ status: 429, code: 'RATE_LIMITED', message: 'slow' }))).toBe(
      true,
    );
    expect(
      retry()(0, new ApiError({ status: 0, code: 'NETWORK_UNREACHABLE', message: 'off' })),
    ).toBe(true);
  });

  it('gives up after two attempts rather than hammering a backend that is down', () => {
    const server = new ApiError({ status: 503, code: 'X', message: 'down' });

    expect(retry()(1, server)).toBe(true);
    expect(retry()(2, server)).toBe(false);
  });

  it('backs off, and caps the wait so a screen is never wedged behind it', () => {
    const delay = createQueryClient().getDefaultOptions().queries?.retryDelay;
    if (typeof delay !== 'function') throw new Error('retryDelay is not a function');

    const at = (attempt: number) => delay(attempt, new Error('x'));

    expect(at(0)).toBeLessThan(at(1));
    expect(at(1)).toBeLessThan(at(2));
    expect(at(10)).toBeLessThanOrEqual(8_000);
  });
});
