import type {
  AdminListQuery,
  BreakListQuery,
  DepositQueueQuery,
  PaymentMethodListQuery,
  PlayerListQuery,
} from '@/types';

/**
 * Query keys in one place, so an invalidation can never miss a cache by spelling its key slightly
 * differently. Approving a deposit invalidates `depositKeys.all` and every list under it goes stale
 * at once, whatever filters each one is holding.
 */

export const depositKeys = {
  all: ['deposits'] as const,
  lists: () => [...depositKeys.all, 'list'] as const,
  list: (query: DepositQueueQuery) => [...depositKeys.lists(), query] as const,
  details: () => [...depositKeys.all, 'detail'] as const,
  detail: (id: string) => [...depositKeys.details(), id] as const,
  proof: (depositId: string, proofId: string) =>
    [...depositKeys.all, 'proof', depositId, proofId] as const,
};

/**
 * The on-chain verdict for one deposit. OUTSIDE `depositKeys.all` on purpose, and this is the whole
 * reason it has a root of its own.
 *
 * `useDepositMutation` invalidates `depositKeys.all` after EVERY claim, release, approve, reject
 * and retry — see it in queries.ts. Nested under there, claiming a deposit you are about to read
 * would spend a chain call, and releasing it would spend another; a reviewer who claims, looks and
 * releases would bill three. The chain's answer about a transfer that already happened does not
 * change because somebody in this console pressed a button, so nothing about a review action should
 * refetch it. Same argument as `walletBalanceKeys` and `tenantHealthKeys`: related in meaning,
 * unrelated in cache lifetime.
 */
export const depositChainCheckKeys = {
  all: ['deposit-chain-checks'] as const,
  detail: (depositId: string) => [...depositChainCheckKeys.all, depositId] as const,
};

export const playerKeys = {
  all: ['players'] as const,
  lists: () => [...playerKeys.all, 'list'] as const,
  list: (query: PlayerListQuery) => [...playerKeys.lists(), query] as const,
  details: () => [...playerKeys.all, 'detail'] as const,
  detail: (id: string) => [...playerKeys.details(), id] as const,
  /**
   * Ichancy balances, one key per player.
   *
   * They sit under `players` so that moving money invalidates them along with everything else about
   * that player — a credit or a debit makes the number in the table wrong the instant it lands.
   * `balances()` is the prefix the page's own "refresh" control invalidates, which refetches the
   * rows currently on screen and nothing else: every entry under it costs an upstream call.
   */
  balances: () => [...playerKeys.all, 'balance'] as const,
  balance: (id: string) => [...playerKeys.balances(), id] as const,
};

export const paymentMethodKeys = {
  all: ['payment-methods'] as const,
  lists: () => [...paymentMethodKeys.all, 'list'] as const,
  list: (query: PaymentMethodListQuery) => [...paymentMethodKeys.lists(), query] as const,
  detail: (id: string) => [...paymentMethodKeys.all, 'detail', id] as const,
  destinations: (methodId: string, includeInactive: boolean) =>
    [...paymentMethodKeys.all, 'destinations', methodId, { includeInactive }] as const,
};

/**
 * A payout wallet's on-chain balance, one key per destination.
 *
 * OUTSIDE `paymentMethodKeys` on purpose, and for the same reason `tenantHealthKeys` sits outside
 * `tenantKeys`: every other key under payment methods reads this console's own database and is
 * invalidated by anything that edits a rail, while this one costs a round trip to a third-party
 * chain explorer that is rate-limited and answers the same number either way. Renaming a
 * destination must not spend a chain read, and a chain read must not look like reading a rail.
 */
export const walletBalanceKeys = {
  all: ['wallet-balances'] as const,
  detail: (destinationId: string) => [...walletBalanceKeys.all, destinationId] as const,
};

export const adminKeys = {
  all: ['admins'] as const,
  lists: () => [...adminKeys.all, 'list'] as const,
  list: (query: AdminListQuery) => [...adminKeys.lists(), query] as const,
  detail: (id: string) => [...adminKeys.all, 'detail', id] as const,
  approvalLimits: (adminUserId: string) =>
    [...adminKeys.all, 'approval-limits', adminUserId] as const,
};

export const reconciliationKeys = {
  all: ['reconciliation'] as const,
  breaks: () => [...reconciliationKeys.all, 'breaks'] as const,
  breakList: (query: BreakListQuery) => [...reconciliationKeys.breaks(), query] as const,
  breakDetail: (id: string) => [...reconciliationKeys.breaks(), 'detail', id] as const,
  railAgeing: () => [...reconciliationKeys.all, 'rail-ageing'] as const,
};

/**
 * The platform's own defaults. OUTSIDE `tenantKeys` on purpose: creating or editing an operator
 * must not invalidate this row, and editing this row must not refetch every operator. They are
 * related in meaning and unrelated in cache lifetime.
 */
/**
 * The crypto rate. Its own key: setting it must not refetch every payment method, and editing a
 * method must not refetch it. They are related in meaning and unrelated in cache lifetime.
 */
export const shamCashKeys = {
  all: ['shamcash'] as const,
  status: () => [...shamCashKeys.all, 'status'] as const,
};

export const exchangeRateKeys = {
  all: ['exchange-rates'] as const,
  usdt: () => [...exchangeRateKeys.all, 'usdt'] as const,
};

export const platformDefaultsKeys = {
  all: ['platform-defaults'] as const,
};

export const tenantKeys = {
  all: ['tenants'] as const,
  list: () => [...tenantKeys.all, 'list'] as const,
  detail: (id: string) => [...tenantKeys.all, 'detail', id] as const,
};

/**
 * An operator's health sits OUTSIDE `tenantKeys.all` on purpose.
 *
 * Answering it costs the server a real Ichancy signin and a Telegram round trip, so renaming an
 * operator must not drag a health check along behind it. The operations that genuinely change what
 * health reports — webhook, bot, Ichancy credentials — invalidate this key by name instead.
 */
export const tenantHealthKeys = {
  all: ['tenant-health'] as const,
  detail: (tenantId: string) => [...tenantHealthKeys.all, tenantId] as const,
};

export const healthKeys = {
  all: ['health'] as const,
  snapshot: () => [...healthKeys.all, 'snapshot'] as const,
};

/**
 * The agent float. Its own root, deliberately OUTSIDE `reconciliationKeys`.
 *
 * The top bar holds this query open on every screen in the console, so putting it under
 * reconciliation would make assigning a break — or any other prefix invalidation on that page —
 * refetch a piece of chrome for everybody. They are related in meaning and unrelated in cache
 * lifetime, the same argument `tenantHealthKeys` makes above.
 */
export const agentFloatKeys = {
  all: ['agent-float'] as const,
  current: () => [...agentFloatKeys.all, 'current'] as const,
};
