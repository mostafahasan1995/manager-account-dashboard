import {
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { isCurrentLimit } from '@/types';
import type {
  AdminDeposit,
  AdminListQuery,
  ApprovalLimit,
  ApproveDepositBody,
  BreakListQuery,
  CreateAdminBody,
  CreatePaymentDestinationBody,
  CreatePaymentMethodBody,
  CreateTenantBody,
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
} from '@/types';

import {
  adminsApi,
  depositsApi,
  healthApi,
  paymentMethodsApi,
  playersApi,
  reconciliationApi,
  tenantsApi,
} from './endpoints';
import { isAbortError } from '@/lib/utils';

import {
  adminKeys,
  depositKeys,
  healthKeys,
  paymentMethodKeys,
  playerKeys,
  reconciliationKeys,
  tenantHealthKeys,
  tenantKeys,
} from './query-keys';

/**
 * The React-facing half of the API layer: one hook per thing a screen needs.
 *
 * Two conventions worth knowing:
 *   - **Lists that change under you** (the deposit queue, open breaks) poll. A reviewer must not
 *     spend a minute on a deposit a colleague already took.
 *   - **Every mutation invalidates by prefix**, never by exact key, so a decision made from the
 *     detail page refreshes the queue behind it regardless of the filters that queue is holding.
 */

/** How often the two live surfaces refetch. Slow enough to be cheap, fast enough to feel live. */
export const QUEUE_POLL_MS = 15_000;
export const BREAKS_POLL_MS = 60_000;
export const HEALTH_POLL_MS = 30_000;

/**
 * How long an operator's health check stays fresh.
 *
 * Long, and never polled: each answer costs the server a real Ichancy signin — which, per
 * docs/TENANT-OPERATIONS.md section 3, kills the token pair any other process holds for that agent
 * — plus a Telegram `getMe`/`getWebhookInfo` pair against a rate-limited API. A timer here would
 * knock operators offline in the name of watching them. The screen refetches on demand.
 */
export const TENANT_HEALTH_STALE_MS = 5 * 60_000;

// ── Deposits ───────────────────────────────────────────────────────────────────────────────────

export function useDepositQueue(query: DepositQueueQuery, options?: { poll?: boolean }) {
  return useInfiniteQuery({
    queryKey: depositKeys.list(query),
    queryFn: ({ pageParam, signal }) =>
      depositsApi.queue(
        { ...query, ...(pageParam === undefined ? {} : { cursor: pageParam }) },
        signal,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    refetchInterval: options?.poll === false ? false : QUEUE_POLL_MS,
    // A queue that reorders while somebody is reading it is worse than one that is 15s stale.
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

/** Invalidating the whole deposit namespace is intentional — see the module header. */
function useDepositMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: depositKeys.all });
    },
  });
}

export const useClaimDeposit = () => useDepositMutation((id: string) => depositsApi.claim(id));

export const useReleaseDeposit = () => useDepositMutation((id: string) => depositsApi.release(id));

export const useApproveDeposit = () =>
  useDepositMutation((input: { id: string; body?: ApproveDepositBody }) =>
    depositsApi.approve(input.id, input.body ?? {}),
  );

export const useRejectDeposit = () =>
  useDepositMutation((input: { id: string; body: RejectDepositBody }) =>
    depositsApi.reject(input.id, input.body),
  );

export const useRetryCredit = () =>
  useDepositMutation((input: { id: string; reason?: string }) =>
    depositsApi.retryCredit(input.id, input.reason),
  );

export const useSweepDeposits = () => useDepositMutation(() => depositsApi.sweep());

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

export function useBreaks(query: BreakListQuery, options?: { poll?: boolean }) {
  return useInfiniteQuery({
    queryKey: reconciliationKeys.breakList(query),
    queryFn: ({ pageParam, signal }) =>
      reconciliationApi.breaks(
        { ...query, ...(pageParam === undefined ? {} : { cursor: pageParam }) },
        signal,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    refetchInterval: options?.poll === false ? false : BREAKS_POLL_MS,
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

export const useCorrectFloat = () =>
  useReconciliationMutation((input: { breakId: string; note: string }) =>
    reconciliationApi.correctFloat(input.breakId, input.note),
  );

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

/** Replacing the token clears the webhook server-side; the screen must offer to register it again. */
export const useUpdateTenantBot = () =>
  useOperatorMutation((input: { id: string; body: UpdateTenantBotBody }) =>
    tenantsApi.updateBot(input.id, input.body),
  );

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

/** Flattens the pages of an infinite query into one array for a table. */
export function flattenPages<T>(pages: readonly { data: T[] }[] | undefined): T[] {
  return (pages ?? []).flatMap((page) => page.data);
}

export type { AdminDeposit };
