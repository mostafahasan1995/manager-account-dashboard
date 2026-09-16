import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureApiClient } from '@/lib/api/client';
import { BREAK_IDS, DEPOSIT_IDS, PLAYER_IDS } from '@/mocks/fixtures';

import {
  AGENT_FLOAT_CATCH_UP_POLL_MS,
  AGENT_FLOAT_CATCH_UP_WINDOW_MS,
  AGENT_FLOAT_POLL_MS,
  agentFloatCatchUp,
  createFloatCatchUp,
  useAgentFloat,
  useClaimDeposit,
  useCorrectFloat,
  useCreditPlayer,
  useDebitPlayer,
  useRetryCredit,
  useSweepDeposits,
  useSyncFloat,
} from './queries';
import { agentFloatKeys } from './query-keys';

/**
 * The float pill, and the two ways it went stale.
 *
 * ── THE FIRST WAY: NOBODY TOLD IT ─────────────────────────────────────────────────────────────
 * `agentFloatKeys` sits outside every other prefix on purpose — see query-keys.ts — which means no
 * mutation invalidates it by accident. Three families moved the float and said nothing: a debit
 * (which pushes the float UP), the deposit actions that end in a credit, and the float correction.
 * Each fix is one line, and the reason each was missing is that nothing failed when it was.
 *
 * ── THE SECOND WAY: IT WAS TOLD TOO EARLY ─────────────────────────────────────────────────────
 * The manual credit already invalidated the key, and the pill was stale anyway. That endpoint
 * answers 202 and approval posts only T1; the float is moved by T2, which a worker posts seconds
 * later. Refetching at settle re-reads the figure from BEFORE the credit and marks it fresh. That
 * is why the catch-up window exists, and why the cases below check that it opens, that the pill
 * reads it, and — the part that matters most — that it shuts by itself.
 */

const FLOAT_KEY = agentFloatKeys.current();

/**
 * Not `createTestQueryClient`: that one sets `gcTime: 0`, which collects a query the moment it has
 * no observers. These cases seed the float cache entry WITHOUT mounting the pill, so that an
 * invalidation marks it rather than refetching it — and a zero gcTime removes the entry before the
 * mutation being tested has settled.
 */
const testClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 0, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

const providerFor = (client: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

/** A float already in cache, so "was it invalidated" is a question the cache itself can answer. */
const seedFloat = (client: QueryClient): void => {
  client.setQueryData(FLOAT_KEY, { balanceMinor: '443750000' });
};

const floatWasInvalidated = (client: QueryClient): boolean =>
  client.getQueryState(FLOAT_KEY)?.isInvalidated === true;

/** Runs one mutation to completion and hands back the client, for its cache to be inspected. */
async function fire<TVariables>(
  useHook: () => {
    mutate: (variables: TVariables) => void;
    isPending: boolean;
    isIdle: boolean;
  },
  variables: TVariables,
): Promise<QueryClient> {
  const client = testClient();
  seedFloat(client);
  const { result } = renderHook(useHook, { wrapper: providerFor(client) });

  act(() => {
    result.current.mutate(variables);
  });
  await waitFor(() => {
    expect(result.current.isPending).toBe(false);
    expect(result.current.isIdle).toBe(false);
  });

  return client;
}

beforeEach(() => {
  // Without a token every request in this file goes out unauthenticated; the mock reads the caller's
  // role out of the bearer token exactly as the real API does.
  configureApiClient({
    getToken: () => 'test-token',
    getTenantId: () => null,
    onUnauthorized: () => undefined,
  });
});

afterEach(() => {
  // The window is a module singleton with a real timer behind it. Left open it would leak a burst
  // into the next case — which is one of the two things `stop()` exists for.
  agentFloatCatchUp.stop();
  vi.useRealTimers();
});

describe('the mutations that move the float', () => {
  it('refreshes it after a manual credit', async () => {
    const client = await fire(useCreditPlayer, {
      playerId: PLAYER_IDS.linkedActive,
      body: { amountMinor: '2500000', reason: 'Counter deposit, receipt 4471' },
    });

    expect(floatWasInvalidated(client)).toBe(true);
  });

  it('refreshes it after a manual DEBIT, which is the direction that was missing', async () => {
    // Easy to read the wrong way round: a debit takes points out of the player and hands them back
    // to the agent, so the pill goes UP. This hook used to invalidate only the player namespace.
    const client = await fire(useDebitPlayer, {
      playerId: PLAYER_IDS.linkedActive,
      body: { amountMinor: '1000', reason: 'Duplicate credit, taken back' },
    });

    expect(floatWasInvalidated(client)).toBe(true);
  });

  it('refreshes it after a deposit action that ends in a credit', async () => {
    // The shared deposit hook invalidated only `depositKeys.all`, and three of the six actions
    // under it lead to T2.
    const client = await fire(useRetryCredit, { id: DEPOSIT_IDS.creditFailed });

    expect(floatWasInvalidated(client)).toBe(true);
  });

  it('refreshes it after a maintenance sweep', async () => {
    const client = await fire(useSweepDeposits, undefined);

    expect(floatWasInvalidated(client)).toBe(true);
  });

  it('refreshes it after a float correction, which writes a ledger transaction', async () => {
    // `reconciliationKeys.all` does not reach the pill: the float key is outside that prefix by
    // design, so this correction has to name it.
    const client = await fire(useCorrectFloat, {
      breakId: BREAK_IDS.floatMismatch,
      note: 'Corrected against the Ichancy figure',
    });

    expect(floatWasInvalidated(client)).toBe(true);
  });
});

describe('the mutations that do not', () => {
  it('leaves the float alone when a deposit is only claimed', async () => {
    // The most frequent action on the busiest screen. A burst here would be exactly the polling
    // regression the module header of queries.ts exists to prevent, bought for a figure that did
    // not move.
    const client = await fire(useClaimDeposit, DEPOSIT_IDS.awaitingReview);

    expect(floatWasInvalidated(client)).toBe(false);
    expect(agentFloatCatchUp.intervalMs()).toBe(AGENT_FLOAT_POLL_MS);
  });

  it('leaves the float alone when the sync merely DETECTS a drift', async () => {
    // agent-float/sync opens a break and writes no ledger entry. The number it reports is the
    // number that was already there, so refetching would spend a read to be told the same thing.
    const client = await fire(useSyncFloat, undefined);

    expect(floatWasInvalidated(client)).toBe(false);
    expect(agentFloatCatchUp.intervalMs()).toBe(AGENT_FLOAT_POLL_MS);
  });
});

describe('the catch-up window', () => {
  it('opens when money moves, because the ledger has not moved yet', async () => {
    await fire(useCreditPlayer, {
      playerId: PLAYER_IDS.linkedActive,
      body: { amountMinor: '2500000', reason: 'Counter deposit, receipt 4472' },
    });

    expect(agentFloatCatchUp.intervalMs()).toBe(AGENT_FLOAT_CATCH_UP_POLL_MS);
  });

  it('shuts by itself even when nothing was ever going to change', () => {
    // The four-eyes case: a credit over the threshold answers PENDING_SECOND_APPROVAL and posts
    // nothing at all. A window that waited for the figure to move would poll for ever, so this is
    // the assertion that keeps the burst honest.
    vi.useFakeTimers();
    agentFloatCatchUp.start();

    expect(agentFloatCatchUp.intervalMs()).toBe(AGENT_FLOAT_CATCH_UP_POLL_MS);

    vi.advanceTimersByTime(AGENT_FLOAT_CATCH_UP_WINDOW_MS);

    expect(agentFloatCatchUp.intervalMs()).toBe(AGENT_FLOAT_POLL_MS);
  });

  it('bursts at a rate the resting one would never reach, and stays a burst', () => {
    // Pinned as a pair. The design is "temporarily faster, permanently slow", and either number
    // drifting into the other's territory quietly turns this into a change to the resting rate.
    expect(AGENT_FLOAT_CATCH_UP_POLL_MS).toBeLessThan(AGENT_FLOAT_POLL_MS);
    expect(AGENT_FLOAT_CATCH_UP_WINDOW_MS).toBeLessThanOrEqual(AGENT_FLOAT_POLL_MS);
    // At most ten extra reads per action, and worth stating: the ceiling on what a burst costs is
    // a division nobody performs while tuning either constant on its own.
    expect(AGENT_FLOAT_CATCH_UP_WINDOW_MS / AGENT_FLOAT_CATCH_UP_POLL_MS).toBeLessThanOrEqual(10);
  });
});

describe('createFloatCatchUp', () => {
  const config = { restingMs: 120_000, burstMs: 3_000, windowMs: 30_000 };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('rests until somebody moves money', () => {
    expect(createFloatCatchUp(config).intervalMs()).toBe(config.restingMs);
  });

  it('tells its subscribers when the rate changes, and only then', () => {
    const catchUp = createFloatCatchUp(config);
    const listener = vi.fn();
    catchUp.subscribe(listener);

    catchUp.start();

    expect(catchUp.intervalMs()).toBe(config.burstMs);
    expect(listener).toHaveBeenCalledTimes(1);

    // A second money action while the window is open. The interval is already the burst rate, so
    // re-rendering every observer of the pill to hand it the same number would be pure churn.
    catchUp.start();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('closes on its own and says so', () => {
    const catchUp = createFloatCatchUp(config);
    const listener = vi.fn();
    catchUp.subscribe(listener);

    catchUp.start();
    vi.advanceTimersByTime(config.windowMs);

    expect(catchUp.intervalMs()).toBe(config.restingMs);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('pushes the deadline back when money moves again, and still closes', () => {
    const catchUp = createFloatCatchUp(config);

    catchUp.start();
    vi.advanceTimersByTime(config.windowMs - 1_000);
    catchUp.start();
    vi.advanceTimersByTime(config.windowMs - 1_000);

    // The first deadline is long past and the second is not. An extension that left the old timer
    // behind would close the window early, halfway through the burst it just restarted.
    expect(catchUp.intervalMs()).toBe(config.burstMs);

    vi.advanceTimersByTime(1_000);

    expect(catchUp.intervalMs()).toBe(config.restingMs);
  });

  it('can be closed early, and closing a closed window is not an event', () => {
    const catchUp = createFloatCatchUp(config);
    const listener = vi.fn();
    catchUp.subscribe(listener);

    catchUp.start();
    catchUp.stop();

    expect(catchUp.intervalMs()).toBe(config.restingMs);
    expect(listener).toHaveBeenCalledTimes(2);

    catchUp.stop();

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('stops talking to a subscriber that has gone away', () => {
    const catchUp = createFloatCatchUp(config);
    const listener = vi.fn();

    catchUp.subscribe(listener)();
    catchUp.start();

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('the pill', () => {
  it('reads its interval from the window, in both directions', async () => {
    const client = testClient();
    const { result } = renderHook(useAgentFloat, { wrapper: providerFor(client) });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const interval = () =>
      client.getQueryCache().find({ queryKey: FLOAT_KEY })?.observers[0]?.options.refetchInterval;

    // Two minutes at rest, which is the number this change was not allowed to touch.
    expect(interval()).toBe(AGENT_FLOAT_POLL_MS);

    act(() => {
      agentFloatCatchUp.start();
    });

    expect(interval()).toBe(AGENT_FLOAT_CATCH_UP_POLL_MS);

    act(() => {
      agentFloatCatchUp.stop();
    });

    // Back to the resting rate. Without this the "temporary" burst is a permanent one.
    expect(interval()).toBe(AGENT_FLOAT_POLL_MS);
  });
});
