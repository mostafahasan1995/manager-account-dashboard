import {
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { isCurrentLimit } from '@/types';
import type {
  AdminDeposit,
  AdminListQuery,
  ApprovalLimit,
  ApproveDepositBody,
  BreakListQuery,
  CreateAdminBody,
  CreatePaymentDestinationBody,
  SetDeclaredBalanceBody,
  CreatePaymentMethodBody,
  CreateTenantBody,
  CreditPlayerBody,
  DebitPlayerBody,
  DepositQueueQuery,
  PaymentMethodListQuery,
  PlayerListQuery,
  RejectDepositBody,
  ResolveBreakBody,
  SetApprovalLimitBody,
  UpdateAdminBody,
  UpdatePaymentDestinationBody,
  UpdatePaymentMethodBody,
  UpdateTenantBody,
  UpdateTenantBotBody,
  UpdateTenantIchancyBody,
  UpdatePlatformDefaultsBody,
  SetExchangeRateBody,
  SetShamCashSessionBody,
  CreateTelegramDestinationBody,
  UpdateTelegramDestinationBody,
  PublishReportBody,
} from '@/types';

import {
  adminsApi,
  agentFloatApi,
  depositChainChecksApi,
  depositsApi,
  healthApi,
  paymentMethodsApi,
  platformFinanceApi,
  playersApi,
  reconciliationApi,
  tenantsApi,
  exchangeRatesApi,
  shamCashApi,
  platformDefaultsApi,
  walletBalancesApi,
  telegramChatsApi,
  telegramDestinationsApi,
  reportsApi,
} from './endpoints';
import { createLimiter } from '@/lib/concurrency';
import { isAbortError } from '@/lib/utils';

import {
  adminKeys,
  agentFloatKeys,
  depositChainCheckKeys,
  depositKeys,
  healthKeys,
  paymentMethodKeys,
  playerKeys,
  reconciliationKeys,
  tenantHealthKeys,
  tenantKeys,
  exchangeRateKeys,
  shamCashKeys,
  platformDefaultsKeys,
  platformFinanceKeys,
  walletBalanceKeys,
  telegramChatKeys,
  telegramDestinationKeys,
} from './query-keys';

/**
 * The React-facing half of the API layer: one hook per thing a screen needs.
 *
 * Three conventions worth knowing:
 *   - **Every mutation invalidates by prefix**, never by exact key, so a decision made from the
 *     detail page refreshes the queue behind it regardless of the filters that queue is holding.
 *   - **Coming back to the tab refetches.** That is the signal that actually correlates with a
 *     human being present, and it costs nothing while nobody is looking.
 *   - **Almost nothing polls**, and what does, polls slowly. See below.
 *
 * ══ WHY THE TIMERS WERE CUT ═══════════════════════════════════════════════════════════════════
 * The overview alone used to run FIVE deposit queries at 15s, a break list at 60s and two health
 * probes at 30s: about 25 requests a minute, per open tab, for ever. Measured on a real console
 * with an empty queue it was 475 requests and 714 kB, and every one of them re-answered the same
 * nine stuck deposits — rows that had not changed in days and could not change without somebody in
 * this console doing something, which already invalidates them.
 *
 * The root of it was `refetchOnWindowFocus: false` in the query client. With no signal for "a
 * person is looking", every surface compensated with a timer, and the timers had to be fast because
 * they were the only thing keeping the screen honest. Turning focus refetching ON is what makes the
 * timers removable: the expensive question is answered when it is actually asked.
 *
 * What still polls, and why it earns it:
 *   - the DEPOSIT QUEUE screen, at 30s. Two reviewers race for the same deposit, and a claim taken
 *     by a colleague has to appear without anybody pressing anything. This is the one genuinely
 *     contended surface in the product.
 *   - the OVERVIEW's two live tiles, at 120s, so a dashboard left open on a wall still moves.
 *   - HEALTH, at 120s. It is a status light.
 *
 * What no longer polls at all: stuck money, second approvals, open breaks, the oldest-waiting
 * panel. Every one of them changes only as a result of an action — a retry, a sweep, a resolve —
 * and every one of those actions already invalidates by prefix.
 */

/** The deposit QUEUE screen: the one surface two people genuinely compete over. */
export const QUEUE_POLL_MS = 30_000;

/**
 * The overview's two live tiles. Slow on purpose: this screen is read and left, or left open on a
 * wall, and neither wants a request every fifteen seconds.
 */
export const OVERVIEW_POLL_MS = 120_000;

/** A status light. It has never needed to be more current than this. */
export const HEALTH_POLL_MS = 120_000;

/**
 * The agent float in the top bar, which is open on EVERY screen.
 *
 * A timer is defensible here where it is not for `tenantsApi.health`: the answer is a local ledger
 * balance, not an Ichancy signin. But the reason it is as slow as the health light rather than as
 * fast as the queue is that it never buys anything to be quicker — the float moves when a deposit
 * is credited, and by the time it is close enough to the watermark to matter, being two minutes
 * behind changes nothing an operator would do differently.
 *
 * This is the RESTING rate, and it stays that. The one moment two minutes IS too slow is the few
 * seconds after somebody in this console moved money themselves, and that is a temporary burst on
 * top of this number rather than a change to it — see the catch-up section below.
 */
export const AGENT_FLOAT_POLL_MS = 120_000;

/**
 * How long an operator's health check stays fresh.
 *
 * Long, and never polled: each answer costs the server a real Ichancy signin — which, per
 * docs/TENANT-OPERATIONS.md section 3, kills the token pair any other process holds for that agent
 * — plus a Telegram `getMe`/`getWebhookInfo` pair against a rate-limited API. A timer here would
 * knock operators offline in the name of watching them. The screen refetches on demand.
 */
export const TENANT_HEALTH_STALE_MS = 5 * 60_000;

// ── The agent float's catch-up burst ───────────────────────────────────────────────────────────

/**
 * How fast the float is re-read while it is catching up, and for how long.
 *
 * Three seconds for thirty: at most ten extra reads of the cheapest handler in the API — one ledger
 * figure and a watermark, no Ichancy call, no pagination — and only ever after an action a person
 * deliberately took. Thirty seconds is sized for the slow half of what it is waiting on: the outbox
 * relay ticks every second, and the Ichancy round trip behind T2 is the part that actually varies.
 *
 * The window is a CEILING, not an estimate of when the answer arrives. See `refreshAgentFloat` for
 * why it has to be one.
 */
export const AGENT_FLOAT_CATCH_UP_POLL_MS = 3_000;
export const AGENT_FLOAT_CATCH_UP_WINDOW_MS = 30_000;

/**
 * A window during which one query polls faster than it normally would.
 *
 * Its own object rather than state inside `useAgentFloat` because two unrelated halves of this file
 * have to reach it: the mutations, which are spread across four sections and know that money moved,
 * and the pill's query, which knows how often to ask. A `useState` in the hook could not be started
 * from a mutation in another section, and a module-level `let` could not tell the hook to re-render
 * when the window closed.
 */
export interface FloatCatchUp {
  /** Open the window, or push back the deadline of one already open. */
  start: () => void;
  /** Close it now. It closes by itself; this is for teardown and for tests. */
  stop: () => void;
  /** The refetch interval to use at this instant — the burst rate while open, resting when not. */
  intervalMs: () => number;
  /** Notified when that number CHANGES, and not otherwise. Returns the unsubscribe. */
  subscribe: (listener: () => void) => () => void;
}

export function createFloatCatchUp(config: {
  restingMs: number;
  burstMs: number;
  windowMs: number;
}): FloatCatchUp {
  const listeners = new Set<() => void>();
  let deadline: ReturnType<typeof setTimeout> | null = null;

  const notify = (): void => {
    for (const listener of listeners) listener();
  };

  /** Cancels the pending deadline, and says whether there was one — i.e. whether this changed. */
  const cancel = (): boolean => {
    if (deadline === null) return false;
    clearTimeout(deadline);
    deadline = null;
    return true;
  };

  return {
    start: () => {
      const wasOpen = cancel();
      deadline = setTimeout(() => {
        deadline = null;
        notify();
      }, config.windowMs);
      // A second money action while the window is open moves the deadline and nothing else. The
      // interval is already the burst rate, and re-notifying would re-render every observer of the
      // pill to hand it back a number it is already using.
      if (!wasOpen) notify();
    },
    stop: () => {
      if (cancel()) notify();
    },
    intervalMs: () => (deadline === null ? config.restingMs : config.burstMs),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** One window for the whole console, because there is one float pill in one top bar. */
export const agentFloatCatchUp = createFloatCatchUp({
  restingMs: AGENT_FLOAT_POLL_MS,
  burstMs: AGENT_FLOAT_CATCH_UP_POLL_MS,
  windowMs: AGENT_FLOAT_CATCH_UP_WINDOW_MS,
});

/**
 * What every mutation that can move the float calls: re-read it, then keep re-reading it briefly.
 *
 * ── WHY INVALIDATING ON ITS OWN CANNOT WORK HERE ──────────────────────────────────────────────
 * THE FLOAT HAS NOT MOVED YET WHEN THE RESPONSE ARRIVES. `POST /v1/admin/deposits/manual` answers
 * 202 ACCEPTED, and approving posts only T1 — RAIL_CLEARING and PLAYER_LIABILITY, neither of which
 * is the agent float. The float is moved by T2, which a BullMQ worker posts after the outbox
 * relay's next tick and a real Ichancy round trip: seconds after this promise resolved. So an
 * invalidation at settle refetches the OLD ledger figure, marks it fresh, and the pill sits on it
 * until the 120s timer or a window focus — which is exactly the stale badge this code exists to
 * fix, arrived at by doing the obviously correct thing.
 *
 * Polling is the only mechanism there is. Neither repo has a websocket or an SSE channel to wait
 * on, and the 202 body carries the deposit's status, not a balance, so the post-credit figure is
 * not obtainable except by asking again.
 *
 * ── WHY THE WINDOW IS BOUNDED BY THE CLOCK AND NOT BY THE VALUE ───────────────────────────────
 * A credit above the four-eyes threshold answers PENDING_SECOND_APPROVAL and posts NOTHING. The
 * float legitimately never moves, and a burst that stopped when it saw a change would poll for
 * ever. So the window ends after `AGENT_FLOAT_CATCH_UP_WINDOW_MS` whatever happened, and the worst
 * case is ten cheap reads that all agreed.
 */
function refreshAgentFloat(queryClient: QueryClient): Promise<void> {
  // Before the invalidation, so the refetch it triggers is the burst's first read rather than a
  // read at the resting rate that the burst then repeats.
  agentFloatCatchUp.start();
  return queryClient.invalidateQueries({ queryKey: agentFloatKeys.all });
}

// ── Deposits ───────────────────────────────────────────────────────────────────────────────────

export function useDepositQueue(query: DepositQueueQuery, options?: { poll?: number | false }) {
  return useInfiniteQuery({
    queryKey: depositKeys.list(query),
    queryFn: ({ pageParam, signal }) =>
      depositsApi.queue(
        { ...query, ...(pageParam === undefined ? {} : { cursor: pageParam }) },
        signal,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    refetchInterval: options?.poll ?? QUEUE_POLL_MS,
    // A queue that reorders while somebody is reading it is worse than one that is 30s stale.
    refetchOnWindowFocus: true,
  });
}

export function useDeposit(id: string | undefined) {
  return useQuery({
    queryKey: depositKeys.detail(id ?? ''),
    queryFn: ({ signal }) => depositsApi.byId(id ?? '', signal),
    enabled: id !== undefined && id.length > 0,
  });
}

/**
 * Invalidating the whole deposit namespace is intentional — see the module header.
 *
 * `movesFloat` is required rather than defaulted, because the six actions below split three and
 * three and the split is not obvious: approving, retrying a credit and sweeping all end in a
 * player being credited, which is what debits the agent float; claiming, releasing and rejecting
 * move a row through the queue and touch no money at all. Making every call site answer is the
 * cheapest guard against the next money action being added here and quietly inheriting silence —
 * which is the bug this parameter was introduced to fix, in three places at once.
 */
function useDepositMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  { movesFloat }: { movesFloat: boolean },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: depositKeys.all }),
        movesFloat ? refreshAgentFloat(queryClient) : Promise.resolve(),
      ]);
    },
  });
}

export const useClaimDeposit = () =>
  useDepositMutation((id: string) => depositsApi.claim(id), { movesFloat: false });

export const useReleaseDeposit = () =>
  useDepositMutation((id: string) => depositsApi.release(id), { movesFloat: false });

/** Approval is what starts the credit, and the credit is what T2 debits the float for. */
export const useApproveDeposit = () =>
  useDepositMutation(
    (input: { id: string; body?: ApproveDepositBody }) =>
      depositsApi.approve(input.id, input.body ?? {}),
    { movesFloat: true },
  );

export const useRejectDeposit = () =>
  useDepositMutation(
    (input: { id: string; body: RejectDepositBody }) => depositsApi.reject(input.id, input.body),
    { movesFloat: false },
  );

/** Re-queues a credit that failed. If this one lands, it lands out of the float. */
export const useRetryCredit = () =>
  useDepositMutation(
    (input: { id: string; reason?: string }) => depositsApi.retryCredit(input.id, input.reason),
    { movesFloat: true },
  );

/** The maintenance sweep releases and reaps rows, and credits can come out the far side of it. */
export const useSweepDeposits = () =>
  useDepositMutation(() => depositsApi.sweep(), { movesFloat: true });

/**
 * How long a chain verdict is worth showing before it is worth paying for again.
 *
 * Five minutes, longer than a wallet balance, because it is a stronger claim: a wallet's balance
 * moves whenever anyone touches it, while a verdict is about ONE transfer that has already
 * happened. The only part of it that genuinely ages is `pending`, and a reviewer who wants to know
 * whether a transfer confirmed presses the button rather than waiting for a timer.
 */
export const DEPOSIT_CHAIN_CHECK_STALE_MS = 5 * 60_000;

/**
 * What the chain says about ONE deposit — the one being reviewed.
 *
 * ── NEVER CALL THIS FROM A LIST ───────────────────────────────────────────────────────────────
 * One call per row is the failure this endpoint was shaped to avoid; that is why the verdict is its
 * own resource instead of a field on the deposit view. A queue of twenty rows would open twenty
 * chain reads on every render of a screen that also polls itself every 30 seconds.
 *
 * ── NO TIMER, AND ITS OWN KEY ROOT ────────────────────────────────────────────────────────────
 * `refetchInterval: false` says out loud what a default could quietly change. The key sits outside
 * `depositKeys.all` so that claiming or releasing the deposit — which invalidates that whole
 * namespace — does not re-bill the chain; see the note in query-keys.ts.
 *
 * `retry: false` for the reason `useWalletBalance` gives: a verdict that failed to arrive is a
 * panel saying so, and retrying triples the load on the rate limit that most likely caused it. The
 * screen renders that failure as OUR outage, never as anything about the deposit.
 */
export function useDepositChainCheck(depositId: string | undefined) {
  return useQuery({
    queryKey: depositChainCheckKeys.detail(depositId ?? ''),
    queryFn: ({ signal }) => depositChainChecksApi.read(depositId ?? '', signal),
    enabled: depositId !== undefined && depositId.length > 0,
    staleTime: DEPOSIT_CHAIN_CHECK_STALE_MS,
    // Matched to the staleTime so closing the review panel and reopening it — which a reviewer does
    // constantly — does not re-read a chain that answered a moment ago.
    gcTime: DEPOSIT_CHAIN_CHECK_STALE_MS,
    refetchInterval: false,
    retry: false,
  });
}

export interface ProofObjectUrl {
  url: string | null;
  error: unknown;
  loading: boolean;
  reload: () => void;
}

/**
 * A bearer-protected proof image, as an object URL an image element can actually load.
 *
 * Deliberately not a cached query: an object URL is a browser resource with an owner, not cacheable
 * server state. Whoever creates it must revoke it, and a cache entry that outlives the element
 * using it either leaks the blob or hands the next reader a URL that has already been revoked. So
 * this creates exactly one URL per mount and revokes it on the way out — including when the proof
 * changes underneath it, and when a slow response lands after the caller has gone.
 */
export function useProofObjectUrl(
  depositId: string | undefined,
  proofId: string | undefined,
): ProofObjectUrl {
  const [attempt, setAttempt] = useState(0);
  const request = `${depositId ?? ''}|${proofId ?? ''}|${attempt}`;
  const [answer, setAnswer] = useState<{
    request: string | null;
    url: string | null;
    error: unknown;
  }>({ request: null, url: null, error: null });

  useEffect(() => {
    if (depositId === undefined || proofId === undefined) return;

    const controller = new AbortController();
    let created: string | null = null;

    void depositsApi
      .proofBlobUrl(depositId, proofId, controller.signal)
      .then((url) => {
        if (controller.signal.aborted) {
          URL.revokeObjectURL(url);
          return;
        }
        created = url;
        setAnswer({ request, url, error: null });
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        setAnswer({ request, url: null, error });
      });

    return () => {
      controller.abort();
      if (created !== null) URL.revokeObjectURL(created);
    };
  }, [depositId, proofId, request]);

  // Derived rather than reset from inside the effect: while the answer on hand belongs to an older
  // request, this proof is loading, and the URL that came back for the previous one has already
  // been revoked by that effect's cleanup.
  const settled = answer.request === request;

  const reload = useCallback(() => {
    setAttempt((previous) => previous + 1);
  }, []);

  return {
    url: settled ? answer.url : null,
    error: settled ? answer.error : null,
    loading: depositId !== undefined && proofId !== undefined && !settled,
    reload,
  };
}

// ── Players ────────────────────────────────────────────────────────────────────────────────────

export function usePlayers(query: PlayerListQuery) {
  return useQuery({
    queryKey: playerKeys.list(query),
    queryFn: ({ signal }) => playersApi.list(query, signal),
    placeholderData: (previous) => previous,
  });
}

export function usePlayer(id: string | undefined) {
  return useQuery({
    queryKey: playerKeys.detail(id ?? ''),
    queryFn: ({ signal }) => playersApi.byId(id ?? '', signal),
    enabled: id !== undefined && id.length > 0,
  });
}

export function useCreateIchancyAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (playerId: string) => playersApi.createIchancyAccount(playerId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: playerKeys.all });
    },
  });
}

/**
 * A manual debit: money taken back out of the player's Ichancy account.
 *
 * Invalidates the whole player namespace on ANY outcome, not only a successful one — a refusal and
 * an unconfirmed debit both mean the console's picture of that account is now older than the
 * account is, and the screen that fired it re-reads the player rather than keeping what it had.
 *
 * It refreshes the float for the same reason, and it is easy to read this the wrong way round: a
 * debit takes points OUT of the player and hands them back to the agent, so the pill goes UP. The
 * float is one side of every movement a credit is the other side of, and this hook used to be the
 * one money mutation that never mentioned it.
 *
 * There is no retry here and there must never be one. Mutations already default to `retry: false`
 * (see `createQueryClient`), and this is the endpoint that default exists for: Ichancy has no
 * idempotency key, so an automatic second attempt is a second debit of a real person's money.
 */
export function useDebitPlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { playerId: string; body: DebitPlayerBody }) =>
      playersApi.debit(input.playerId, input.body),
    retry: false,
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: playerKeys.all }),
        refreshAgentFloat(queryClient),
      ]);
    },
  });
}

/**
 * A manual credit: points given to a player, recorded as a manual deposit.
 *
 * Unlike the debit this is safe to retry after a 4xx (nothing moved) but not after a 5xx (a credit
 * may have been queued), so it keeps `retry: false` and leaves the "maybe it landed" judgement to
 * the dialog. On settle it invalidates the player namespace (the balance will change), the
 * agent-float pill (the float drops when the credit worker posts T2), AND the deposit lists — a
 * manual credit IS a deposit, so the queue and the player's deposits panel would otherwise show it
 * only on their next poll (and a large one, routed to a second approver, is a queue item that needs
 * to appear now).
 *
 * The float goes through `refreshAgentFloat` rather than a plain invalidation, and the parenthesis
 * above is the reason: the drop happens when the worker posts T2, which is AFTER this settled.
 */
export function useCreditPlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { playerId: string; body: CreditPlayerBody }) =>
      playersApi.credit(input.playerId, input.body),
    retry: false,
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: playerKeys.all }),
        refreshAgentFloat(queryClient),
        queryClient.invalidateQueries({ queryKey: depositKeys.all }),
      ]);
    },
  });
}

/**
 * How long a balance is worth showing before it is worth paying for again.
 *
 * Sixty seconds. Long enough that paging back and forth, opening a dialog, or re-rendering the
 * table costs nothing; short enough that a number an operator is about to act on was measured
 * within the last minute. The `gcTime` matches so the answer survives the round trip to the next
 * page and back — dropping it there would make a page-turn cost a full page of upstream calls.
 */
export const PLAYER_BALANCE_STALE_MS = 60_000;

/**
 * ONE player's Ichancy balance, with its own loading, error and retry.
 *
 * Per player rather than per page on purpose. There is no bulk endpoint, so a page of balances is a
 * page of independent requests: one row failing must leave the other nine showing their numbers,
 * and the row that failed must be retryable on its own without re-reading the nine that worked.
 * `useQueries` with a combined result would collapse all of that into one status.
 *
 * `retry: false` for the same reason: a failed balance is one line of the table saying "unknown",
 * not a broken screen, and silently retrying it three times triples the load on the rate limit that
 * probably caused it.
 */
export function usePlayerBalance(playerId: string, options: { enabled: boolean }) {
  return useQuery({
    queryKey: playerKeys.balance(playerId),
    queryFn: ({ signal }) => playersApi.balance(playerId, signal),
    enabled: options.enabled && playerId.length > 0,
    staleTime: PLAYER_BALANCE_STALE_MS,
    gcTime: PLAYER_BALANCE_STALE_MS,
    retry: false,
    /*
     * A tab-switch is not a reason to spend a page of upstream calls. This was already here before
     * focus refetching was turned on globally, and it is the one query that must keep opting out:
     * every other surface costs the backend a cheap read, while a table of balances is one
     * Cloudflare-fronted Ichancy call PER ROW — the exact burst src/lib/concurrency.ts exists for.
     */
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/**
 * Re-reads the balances that are ON SCREEN, and only those.
 *
 * `invalidateQueries` refetches active observers and merely marks the rest stale, which is exactly
 * the behaviour wanted here: the rows the operator is looking at are re-measured, and the fifty
 * rows they scrolled past on earlier pages are not silently re-billed to the rate limit.
 */
export function useRefreshPlayerBalances(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: playerKeys.balances() });
  }, [queryClient]);
}

// ── Payment methods ────────────────────────────────────────────────────────────────────────────

export function usePaymentMethods(query: PaymentMethodListQuery = {}) {
  return useQuery({
    queryKey: paymentMethodKeys.list(query),
    queryFn: ({ signal }) => paymentMethodsApi.list(query, signal),
  });
}

export function usePaymentDestinations(methodId: string | undefined, includeInactive: boolean) {
  return useQuery({
    queryKey: paymentMethodKeys.destinations(methodId ?? '', includeInactive),
    queryFn: () => paymentMethodsApi.destinations(methodId ?? '', includeInactive),
    enabled: methodId !== undefined && methodId.length > 0,
  });
}

function usePaymentMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: paymentMethodKeys.all });
    },
  });
}

export const useCreatePaymentMethod = () =>
  usePaymentMutation((body: CreatePaymentMethodBody) => paymentMethodsApi.create(body));

export const useUpdatePaymentMethod = () =>
  usePaymentMutation((input: { id: string; body: UpdatePaymentMethodBody }) =>
    paymentMethodsApi.update(input.id, input.body),
  );

export const useDeactivatePaymentMethod = () =>
  usePaymentMutation((id: string) => paymentMethodsApi.deactivate(id));

export const useCreateDestination = () =>
  usePaymentMutation((input: { methodId: string; body: CreatePaymentDestinationBody }) =>
    paymentMethodsApi.createDestination(input.methodId, input.body),
  );

export const useUpdateDestination = () =>
  usePaymentMutation((input: { id: string; body: UpdatePaymentDestinationBody }) =>
    paymentMethodsApi.updateDestination(input.id, input.body),
  );

export const useDeactivateDestination = () =>
  usePaymentMutation((id: string) => paymentMethodsApi.deactivateDestination(id));

/**
 * Set or clear an account's hand-typed balance. Reuses usePaymentMutation, so a save invalidates
 * the whole payment-method namespace and the account card refreshes with the new figure.
 */
export const useSetDeclaredBalance = () =>
  usePaymentMutation((input: { id: string; body: SetDeclaredBalanceBody }) =>
    paymentMethodsApi.setDeclaredBalance(input.id, input.body),
  );

// ── What the chain says a payout wallet holds ──────────────────────────────────────────────────

/**
 * How long a wallet balance is worth showing before it is worth paying for again.
 *
 * Two minutes. A chain balance changes only when somebody moves coins, and the operator reading it
 * is deciding whether to sweep — a question two minutes of age does not change the answer to. What
 * this number is really bounding is the FOCUS refetch: without it, every tab-switch would spend a
 * call on a third-party explorer to re-answer the same figure.
 */
export const WALLET_BALANCE_STALE_MS = 120_000;

/**
 * ONE payout wallet's on-chain balance.
 *
 * ── NO TIMER, ON PURPOSE ──────────────────────────────────────────────────────────────────────
 * Read the module header first: the polling in this console was cut roughly ten to one, and this is
 * exactly the kind of query that put it back if nobody is careful. Every answer costs a call to a
 * third-party chain explorer — rate-limited, metered, and outside this system's control — to
 * re-report a number that only moves when a player actually sends money. So it fetches on mount and
 * when the operator presses refresh, and `refetchInterval: false` says so out loud rather than
 * leaving it to a default that could change.
 *
 * `retry: false` for the reason `usePlayerBalance` gives: a balance that failed is a card saying so
 * with a button next to it, not a broken screen — and retrying three times triples the load on the
 * rate limit that probably caused the failure. The retry is the operator's, and it is one press.
 */
export function useWalletBalance(destinationId: string) {
  return useQuery({
    queryKey: walletBalanceKeys.detail(destinationId),
    queryFn: ({ signal }) => walletBalancesApi.read(destinationId, signal),
    enabled: destinationId.length > 0,
    staleTime: WALLET_BALANCE_STALE_MS,
    // Matched to the staleTime so moving between the rails and the financial screen and back does
    // not re-bill a read that is still current.
    gcTime: WALLET_BALANCE_STALE_MS,
    refetchInterval: false,
    retry: false,
  });
}

// ── The rate that prices a crypto deposit ──────────────────────────────────────────────────────

/**
 * The operator's current USDT rate, or null when nobody has set one.
 *
 * Never polled. A rate changes when a person changes it, and this console is where they do it — so
 * a timer here would only ever re-answer a number it had just written. Coming back to the tab
 * refetches it, which covers the one case that matters: somebody set it on another machine.
 */
export function useUsdtRate(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: exchangeRateKeys.usdt(),
    queryFn: ({ signal }) => exchangeRatesApi.getUsdt(signal),
    enabled: options.enabled ?? true,
  });
}

/**
 * Setting it.
 *
 * `retry: false`, like every mutation that prices or moves money. A retried PUT would record a
 * second VERSION of the same rate — harmless to the number, and noise in the history somebody will
 * one day read to justify a credit.
 */
export function useSetUsdtRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SetExchangeRateBody) => exchangeRatesApi.setUsdt(body),
    retry: false,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: exchangeRateKeys.all });
    },
  });
}

/** Whether a Sham Cash session is linked, and when. The cookies are never returned. */
export function useShamCashStatus(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: shamCashKeys.status(),
    queryFn: ({ signal }) => shamCashApi.getStatus(signal),
    enabled: options.enabled ?? true,
  });
}

/** Link a Sham Cash session by pasting its cookies. */
export function useSetShamCashSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SetShamCashSessionBody) => shamCashApi.setSession(body),
    retry: false,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: shamCashKeys.all });
    },
  });
}

/** Read the live balance by replaying the session in a headless browser. A POST because it
 *  launches a browser and hits a third party — an action, not a cheap read. */
export function useCheckShamCashBalance() {
  return useMutation({
    mutationFn: () => shamCashApi.checkBalance(),
    retry: false,
  });
}

/** Unlink it — clears the sealed session on the backend. */
export function useClearShamCashSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => shamCashApi.clearSession(),
    retry: false,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: shamCashKeys.all });
    },
  });
}

// ── Admin directory ────────────────────────────────────────────────────────────────────────────

export function useAdmins(query: AdminListQuery) {
  return useQuery({
    queryKey: adminKeys.list(query),
    queryFn: ({ signal }) => adminsApi.list(query, signal),
    placeholderData: (previous) => previous,
  });
}

export function useAdmin(id: string | undefined) {
  return useQuery({
    queryKey: adminKeys.detail(id ?? ''),
    queryFn: () => adminsApi.byId(id ?? ''),
    enabled: id !== undefined && id.length > 0,
  });
}

export function useApprovalLimits(adminUserId: string | undefined) {
  return useQuery({
    queryKey: adminKeys.approvalLimits(adminUserId ?? ''),
    queryFn: () => adminsApi.approvalLimits(adminUserId ?? ''),
    enabled: adminUserId !== undefined && adminUserId.length > 0,
  });
}

/**
 * The limit version currently in force for each of several admins, keyed by admin id.
 *
 * The directory has to show who cannot approve anything, and the backend offers no bulk read for
 * limits — so this is one request per admin and callers pass the page they are rendering rather
 * than the whole directory. Admins with no open version are simply absent from the map.
 */
export function useOpenApprovalLimits(adminUserIds: readonly string[]) {
  return useQueries({
    queries: adminUserIds.map((adminUserId) => ({
      queryKey: adminKeys.approvalLimits(adminUserId),
      queryFn: () => adminsApi.approvalLimits(adminUserId),
    })),
    combine: (results) => ({
      isPending: results.some((result) => result.isPending),
      openByAdminId: new Map(
        results.flatMap((result) =>
          (result.data ?? [])
            .filter(isCurrentLimit)
            .map((limit): [string, ApprovalLimit] => [limit.adminUserId, limit]),
        ),
      ),
    }),
  });
}

function useAdminMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.all });
    },
  });
}

export const useCreateAdmin = () =>
  useAdminMutation((body: CreateAdminBody) => adminsApi.create(body));

export const useUpdateAdmin = () =>
  useAdminMutation((input: { id: string; body: UpdateAdminBody }) =>
    adminsApi.update(input.id, input.body),
  );

export const useDeactivateAdmin = () => useAdminMutation((id: string) => adminsApi.deactivate(id));

export const useSetApprovalLimit = () =>
  useAdminMutation((input: { adminUserId: string; body: SetApprovalLimitBody }) =>
    adminsApi.setApprovalLimit(input.adminUserId, input.body),
  );

export const useEndApprovalLimit = () =>
  useAdminMutation((limitId: string) => adminsApi.endApprovalLimit(limitId));

// ── Reconciliation ─────────────────────────────────────────────────────────────────────────────

export function useBreaks(query: BreakListQuery, options?: { poll?: number | false }) {
  return useInfiniteQuery({
    queryKey: reconciliationKeys.breakList(query),
    queryFn: ({ pageParam, signal }) =>
      reconciliationApi.breaks(
        { ...query, ...(pageParam === undefined ? {} : { cursor: pageParam }) },
        signal,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    /*
     * No timer by default. A break is opened by a detector and closed by a person in this console,
     * and closing one already invalidates this key by prefix — so a poll here only ever re-answered
     * a list that had not moved. Coming back to the tab refetches it.
     */
    refetchInterval: options?.poll ?? false,
  });
}

export function useBreak(id: string | undefined) {
  return useQuery({
    queryKey: reconciliationKeys.breakDetail(id ?? ''),
    queryFn: () => reconciliationApi.breakById(id ?? ''),
    enabled: id !== undefined && id.length > 0,
  });
}

export function useRailAgeing() {
  return useQuery({
    queryKey: reconciliationKeys.railAgeing(),
    queryFn: ({ signal }) => reconciliationApi.railAgeing(signal),
  });
}

function useReconciliationMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reconciliationKeys.all });
    },
  });
}

export const useAssignBreak = () =>
  useReconciliationMutation((id: string) => reconciliationApi.assignBreak(id));

export const useResolveBreak = () =>
  useReconciliationMutation((input: { id: string; body: ResolveBreakBody }) =>
    reconciliationApi.resolveBreak(input.id, input.body),
  );

/**
 * Writing the ledger float back to what Ichancy says it is.
 *
 * The one action on this screen that leaves the shared hook, because it is the one that POSTS A
 * LEDGER TRANSACTION. `reconciliationKeys.all` does not reach the pill — `agentFloatKeys` is
 * deliberately outside that prefix, see query-keys.ts — and a correction is precisely a change to
 * the number the pill shows, so it has to name that key itself.
 *
 * It goes through `refreshAgentFloat` like every other money mutation. The transaction here is
 * written synchronously rather than by a worker, so the burst usually converges on its first read;
 * paying for a shared, bounded mechanism is still cheaper than a second way of doing this.
 */
export function useCorrectFloat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { breakId: string; note: string }) =>
      reconciliationApi.correctFloat(input.breakId, input.note),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: reconciliationKeys.all }),
        refreshAgentFloat(queryClient),
      ]);
    },
  });
}

/**
 * Detecting the drift, which is a different thing from correcting it.
 *
 * It compares the two figures and opens a break; it writes NO ledger entry. The float it reports is
 * the float that was already there, so invalidating the pill would spend a read to be told the same
 * number. Left out on purpose, not by omission — this is the one float action that correctly has
 * nothing to say to `agentFloatKeys`.
 */
export const useSyncFloat = () => useReconciliationMutation(() => reconciliationApi.syncFloat());

/** Read-only check: it writes nothing, so it invalidates nothing. */
export function useRunInvariants() {
  return useMutation({ mutationFn: () => reconciliationApi.runInvariants() });
}

// ── Tenants ────────────────────────────────────────────────────────────────────────────────────

export function useTenants(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: tenantKeys.list(),
    queryFn: ({ signal }) => tenantsApi.list(signal),
    enabled: options?.enabled ?? true,
  });
}

export function useTenant(id: string | undefined) {
  return useQuery({
    queryKey: tenantKeys.detail(id ?? ''),
    queryFn: () => tenantsApi.byId(id ?? ''),
    enabled: id !== undefined && id.length > 0,
  });
}

function useTenantMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: tenantKeys.all });
    },
  });
}

/**
 * What a new operator would inherit right now.
 *
 * `PLATFORM_ADMIN` only — the endpoint answers 403 to anybody else — so every caller passes
 * `enabled`, exactly as the operator list does. Asking as the wrong role would put a 403 in the
 * console for a screen the role cannot open anyway.
 */
export function usePlatformDefaults(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: platformDefaultsKeys.all,
    queryFn: ({ signal }) => platformDefaultsApi.get(signal),
    enabled: options.enabled ?? true,
  });
}

/**
 * Editing them.
 *
 * Invalidates ONLY its own key. A default is copied onto an operator's row at creation and never
 * read again, so no operator's data changed and refetching the list would be a request that cannot
 * return anything different.
 */
export function useUpdatePlatformDefaults() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdatePlatformDefaultsBody) => platformDefaultsApi.update(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: platformDefaultsKeys.all });
    },
  });
}

export const useCreateTenant = () =>
  useTenantMutation((body: CreateTenantBody) => tenantsApi.create(body));

export const useUpdateTenant = () =>
  useTenantMutation((input: { id: string; body: UpdateTenantBody }) =>
    tenantsApi.update(input.id, input.body),
  );

export const useActivateTenant = () => useTenantMutation((id: string) => tenantsApi.activate(id));

export const useSuspendTenant = () => useTenantMutation((id: string) => tenantsApi.suspend(id));

// ── Operator operations: webhook, bot, Ichancy, health ─────────────────────────────────────────

/**
 * One operator's bot, webhook, Ichancy agent and float.
 *
 * Deliberately not polled and slow to go stale — see `TENANT_HEALTH_STALE_MS`. Refetching is the
 * caller's decision: give the panel a "check again" control and call `refetch()` from it.
 */
export function useTenantHealth(id: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: tenantHealthKeys.detail(id ?? ''),
    queryFn: ({ signal }) => tenantsApi.health(id ?? '', signal),
    enabled: id !== undefined && id.length > 0 && (options?.enabled ?? true),
    staleTime: TENANT_HEALTH_STALE_MS,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/**
 * Every operator operation changes both the tenant row and what a health check would say, so each
 * one invalidates the tenant caches and that operator's health — and only that operator's.
 */
function useOperatorMutation<TVariables extends { id: string }, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (_data: TData, variables: TVariables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: tenantKeys.all }),
        queryClient.invalidateQueries({ queryKey: tenantHealthKeys.detail(variables.id) }),
      ]);
    },
  });
}

export const useRegisterTenantWebhook = () =>
  useOperatorMutation((input: { id: string }) => tenantsApi.registerWebhook(input.id));

export const useRemoveTenantWebhook = () =>
  useOperatorMutation((input: { id: string }) => tenantsApi.removeWebhook(input.id));

export const useSetupTenantBot = () =>
  useOperatorMutation((input: { id: string }) => tenantsApi.setupBot(input.id));

export const useUpdateTenantIchancy = () =>
  useOperatorMutation((input: { id: string; body: UpdateTenantIchancyBody }) =>
    tenantsApi.updateIchancy(input.id, input.body),
  );

/** Replacing the token clears the webhook server-side; the screen must offer to register again. */
export const useUpdateTenantBot = () =>
  useOperatorMutation((input: { id: string; body: UpdateTenantBotBody }) =>
    tenantsApi.updateBot(input.id, input.body),
  );

// ── Platform finance overview (PLATFORM_ADMIN) ─────────────────────────────────────────────────

/**
 * Every operator's finance balances.
 *
 * `PLATFORM_ADMIN` only — the endpoint answers 403 to anybody else — so callers pass `enabled`,
 * exactly as the operator list and the platform defaults do. Cheap by contract (a ledger float plus
 * load-state flags), so it keeps the default focus-refetch and does NOT poll: the expensive USDT and
 * Sham Cash reads are pulled in per operator by a refresh, never on a timer.
 *
 * `retry: false` because a failed overview is a table saying so with a retry button, not three
 * silent attempts — the same reasoning `useWalletBalance` and the float pill give.
 */
export function usePlatformFinanceBalances(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: platformFinanceKeys.overview(),
    queryFn: ({ signal }) => platformFinanceApi.balances(signal),
    enabled: options.enabled ?? true,
    retry: false,
  });
}

/**
 * Refreshing ONE operator's expensive columns.
 *
 * The POST loads that operator's USDT wallets and Sham Cash server-side and returns the freshened
 * row; on settle we invalidate the overview so the cheap list re-reads the now-loaded figures. It
 * invalidates on SETTLE, not just success — a refresh that failed still means the row on screen is
 * older than the attempt, and the overview is the honest thing to re-read. `retry: false`: a
 * refresh that failed is one row to press again, not three silent chain calls.
 */
export function useRefreshTenantFinance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tenantId: string) => platformFinanceApi.refresh(tenantId),
    retry: false,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: platformFinanceKeys.overview() });
    },
  });
}

/**
 * How many operators' expensive refreshes may be in flight at once, for a "refresh all".
 *
 * Two. Each refresh is a per-wallet chain call and a headless-browser session replay behind it, and
 * a platform with a dozen operators firing them all at once is a burst on the same rate-limited
 * third parties `src/lib/concurrency.ts` exists to protect. A "refresh all" is therefore a CLIENT
 * fan-out through this gate — not one server call that refreshes everything, which would move the
 * same burst behind the backend where nothing here could pace it.
 */
export const FINANCE_REFRESH_CONCURRENCY = 2;

const financeRefreshLimiter = createLimiter(FINANCE_REFRESH_CONCURRENCY);

/**
 * Refreshing EVERY operator, dripped two at a time through the shared limiter.
 *
 * `allSettled`, not `all`: one operator whose chain node is down must not throw away the dozen that
 * refreshed cleanly. Either way it invalidates the overview once on settle, which re-reads the whole
 * cheap list rather than trusting the individual rows this returned.
 */
export function useRefreshAllTenantFinance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tenantIds: readonly string[]) =>
      Promise.allSettled(
        tenantIds.map((id) => financeRefreshLimiter.run(() => platformFinanceApi.refresh(id))),
      ),
    retry: false,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: platformFinanceKeys.overview() });
    },
  });
}

// ── Health ─────────────────────────────────────────────────────────────────────────────────────

export function useHealth() {
  return useQuery({
    queryKey: healthKeys.snapshot(),
    queryFn: async () => {
      const [live, ready] = await Promise.allSettled([healthApi.live(), healthApi.ready()]);
      return {
        live: live.status === 'fulfilled' ? live.value : null,
        ready: ready.status === 'fulfilled' ? ready.value : null,
        reachable: live.status === 'fulfilled' || ready.status === 'fulfilled',
      };
    },
    refetchInterval: HEALTH_POLL_MS,
    // The health strip is a status light. It must never make a screen look broken.
    retry: false,
  });
}

// ── The agent float ────────────────────────────────────────────────────────────────────────────

/**
 * The float behind the top-bar pill.
 *
 * `retry: false` for the same reason health has it, and one more: the backend endpoint does not
 * exist yet. Until it ships this query answers 404 on every screen, and two retries plus a backoff
 * would turn one dead request into three, forever, in every open tab.
 *
 * The interval is READ FROM the catch-up window rather than fixed, which is what lets a mutation in
 * a different section of this file speed this query up for a few seconds and then let it go. Two
 * minutes is still where it lives; see `AGENT_FLOAT_POLL_MS` and `refreshAgentFloat`.
 */
export function useAgentFloat() {
  const refetchInterval = useSyncExternalStore(
    agentFloatCatchUp.subscribe,
    agentFloatCatchUp.intervalMs,
  );

  return useQuery({
    queryKey: agentFloatKeys.current(),
    queryFn: ({ signal }) => agentFloatApi.get(signal),
    refetchInterval,
    retry: false,
  });
}

// -------------------------------------------------------------------------------------------------
// Telegram destinations
// -------------------------------------------------------------------------------------------------

/**
 * Where this operator's bot publishes.
 *
 * No polling. The list only changes when somebody on this screen changes it, and a Telegram binding
 * is not a queue — a refetch on a timer would cost a request per open tab to learn nothing.
 */
export function useTelegramDestinations() {
  return useQuery({
    queryKey: telegramDestinationKeys.list(),
    queryFn: ({ signal }) => telegramDestinationsApi.list(signal),
  });
}

/**
 * Bind a group or channel.
 *
 * `retry: false`, like every mutation here, and it matters more than usual: a create that timed out
 * may still have resolved and written the row, and an automatic second attempt would come back with
 * `DUPLICATE` — an error about the console's own retry, shown to an operator as though they had
 * done something wrong.
 */
export function useCreateTelegramDestination() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTelegramDestinationBody) => telegramDestinationsApi.create(body),
    retry: false,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: telegramDestinationKeys.all });
      // The pick-list carries `alreadyBound`, which this call just changed. Without this the group
      // stays offered as though it were still free, and picking it again earns a DUPLICATE.
      await queryClient.invalidateQueries({ queryKey: telegramChatKeys.all });
    },
  });
}

export function useUpdateTelegramDestination() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; body: UpdateTelegramDestinationBody }) =>
      telegramDestinationsApi.update(input.id, input.body),
    retry: false,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: telegramDestinationKeys.all });
    },
  });
}

export function useRemoveTelegramDestination() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => telegramDestinationsApi.remove(id),
    retry: false,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: telegramDestinationKeys.all });
      // Removing frees the chat, so the pick-list must offer it again. Same reason as create.
      await queryClient.invalidateQueries({ queryKey: telegramChatKeys.all });
    },
  });
}

/**
 * The groups and channels the bot has been added to.
 *
 * ── WHY THIS IS A QUERY THE ADD DIALOG DEPENDS ON ─────────────────────────────────────────────
 * It is the only route by which a PRIVATE group can be bound. A private group has no @username to
 * resolve and no invite link a bot can follow, so until this list existed there was no value an
 * operator could put in the group field that the server was able to accept. Picking a row fills
 * that field with the chat id Telegram itself gave us.
 *
 * ── WHY IT IS FETCHED ONLY WHILE THE DIALOG IS OPEN ───────────────────────────────────────────
 * `enabled` is passed by the caller. The list is read by one dialog, changes only when somebody
 * adds the bot to a group inside Telegram, and is worthless on the table behind it — fetching it on
 * every page load would be a request per visit for a screen that mostly never opens the dialog.
 */
export function useDiscoveredTelegramChats(enabled = true) {
  return useQuery({
    queryKey: telegramChatKeys.list(),
    queryFn: ({ signal }) => telegramChatsApi.list(signal),
    enabled,
  });
}

/**
 * Post a real test message.
 *
 * Invalidates the list on settle because the server stamps `lastVerifiedAt`, `lastPublishedAt` and
 * `lastError` on the row as a side effect — so the table's freshness column is only honest if it
 * re-reads afterwards.
 */
export function useTestTelegramDestination() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => telegramDestinationsApi.test(id),
    retry: false,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: telegramDestinationKeys.all });
    },
  });
}

/** The silent re-check. Same invalidation, for the same reason: it writes freshness to the row. */
export function useCheckTelegramDestination() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => telegramDestinationsApi.check(id),
    retry: false,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: telegramDestinationKeys.all });
    },
  });
}

/**
 * Publish the activity report to the operator's REPORT destinations.
 *
 * Invalidates the destination list because a publish stamps `lastPublishedAt` on every row it
 * reached — which is exactly how an operator sees that a destination has gone quiet.
 */
export function usePublishActivityReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: PublishReportBody) => reportsApi.publishActivity(body),
    retry: false,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: telegramDestinationKeys.all });
    },
  });
}

/** Flattens the pages of an infinite query into one array for a table. */
export function flattenPages<T>(pages: readonly { data: T[] }[] | undefined): T[] {
  return (pages ?? []).flatMap((page) => page.data);
}

export type { AdminDeposit };
