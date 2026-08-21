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

export const playerKeys = {
  all: ['players'] as const,
  lists: () => [...playerKeys.all, 'list'] as const,
  list: (query: PlayerListQuery) => [...playerKeys.lists(), query] as const,
  details: () => [...playerKeys.all, 'detail'] as const,
  detail: (id: string) => [...playerKeys.details(), id] as const,
};

export const paymentMethodKeys = {
  all: ['payment-methods'] as const,
  lists: () => [...paymentMethodKeys.all, 'list'] as const,
  list: (query: PaymentMethodListQuery) => [...paymentMethodKeys.lists(), query] as const,
  detail: (id: string) => [...paymentMethodKeys.all, 'detail', id] as const,
  destinations: (methodId: string, includeInactive: boolean) =>
    [...paymentMethodKeys.all, 'destinations', methodId, { includeInactive }] as const,
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
