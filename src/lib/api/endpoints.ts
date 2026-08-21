import { z } from 'zod';

import type {
  AdminListQuery,
  AdminSession,
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
  adminDepositSchema,
  adminPlayerSchema,
  adminSessionSchema,
  adminUserSchema,
  approvalLimitSchema,
  floatCorrectionSchema,
  floatSyncResultSchema,
  ichancyAccountSchema,
  invariantReportSchema,
  livenessSchema,
  paymentDestinationSchema,
  paymentMethodSchema,
  proofUrlSchema,
  railAgeingReportSchema,
  readinessSchema,
  reconciliationBreakSchema,
  retryCreditResultSchema,
  reviewOutcomeSchema,
  sweepReportSchema,
  tenantBotSetupSchema,
  tenantHealthSchema,
  tenantListSchema,
  tenantSchema,
  tenantWebhookSchema,
} from '@/types';

import { api, type QueryValue } from './client';

/**
 * Every backend call the console can make, as a plain function.
 *
 * These are deliberately free of React: they take arguments and return promises, so they can be
 * called from a query hook, from a test, or from a script. The query keys and caching rules live
 * next door in `queries.ts`.
 */

const asQuery = (value: Record<string, QueryValue | undefined>): Record<string, QueryValue> =>
  value;

// ── Auth ───────────────────────────────────────────────────────────────────────────────────────

export const authApi = {
  /** Exchanges the one-time code from the Telegram bot for an access token. */
  exchangeBotCode: (code: string): Promise<AdminSession> =>
    api.post(adminSessionSchema, '/v1/admin/auth/bot-code', {
      body: { code },
      anonymous: true,
    }),
};

// ── Health ─────────────────────────────────────────────────────────────────────────────────────

export const healthApi = {
  live: () => api.get(livenessSchema, '/health/live', { anonymous: true }),
  /** Answers 503 with a real body when a dependency is down; that body is the useful part. */
  ready: () =>
    api.get(readinessSchema, '/health/ready', { anonymous: true, acceptErrorBody: true }),
};

// ── Deposits ───────────────────────────────────────────────────────────────────────────────────

export const depositsApi = {
  queue: (query: DepositQueueQuery = {}, signal?: AbortSignal) =>
    api.cursorPage(adminDepositSchema, '/v1/admin/deposits', {
      query: asQuery({ ...query }),
      ...(signal === undefined ? {} : { signal }),
    }),

  byId: (id: string, signal?: AbortSignal) =>
    api.get(adminDepositSchema, `/v1/admin/deposits/${id}`, {
      ...(signal === undefined ? {} : { signal }),
    }),

  claim: (id: string) => api.post(reviewOutcomeSchema, `/v1/admin/deposits/${id}/claim`),

  release: (id: string) => api.post(reviewOutcomeSchema, `/v1/admin/deposits/${id}/release`),

  approve: (id: string, body: ApproveDepositBody = {}) =>
    api.post(reviewOutcomeSchema, `/v1/admin/deposits/${id}/approve`, { body }),

  reject: (id: string, body: RejectDepositBody) =>
    api.post(reviewOutcomeSchema, `/v1/admin/deposits/${id}/reject`, { body }),

  retryCredit: (id: string, reason?: string) =>
    api.post(retryCreditResultSchema, `/v1/admin/deposits/${id}/retry-credit`, {
      body: reason === undefined ? {} : { reason },
    }),

  proofUrl: (depositId: string, proofId: string) =>
    api.get(proofUrlSchema, `/v1/admin/deposits/${depositId}/proofs/${proofId}/url`),

  /** The bytes themselves, as a blob URL. The caller revokes it. */
  proofBlobUrl: (depositId: string, proofId: string, signal?: AbortSignal) =>
    api.blobUrl(`/v1/admin/deposits/${depositId}/proofs/${proofId}/content`, signal),

  sweep: () => api.post(sweepReportSchema, '/v1/admin/deposits/maintenance/sweep'),
};

// ── Players ────────────────────────────────────────────────────────────────────────────────────

export const playersApi = {
  list: (query: PlayerListQuery = {}, signal?: AbortSignal) =>
    api.page(adminPlayerSchema, '/v1/admin/players', {
      query: asQuery({ ...query }),
      ...(signal === undefined ? {} : { signal }),
    }),

  byId: (id: string, signal?: AbortSignal) =>
    api.get(adminPlayerSchema, `/v1/admin/players/${id}`, {
      ...(signal === undefined ? {} : { signal }),
    }),

  /** Safe to repeat: `created:false` means the player already had an Ichancy account. */
  createIchancyAccount: (id: string) =>
    api.post(ichancyAccountSchema, `/v1/admin/players/${id}/ichancy-account`),
};

// ── Payment methods and destinations ───────────────────────────────────────────────────────────

export const paymentMethodsApi = {
  list: (query: PaymentMethodListQuery = {}, signal?: AbortSignal) =>
    api.get(z.array(paymentMethodSchema), '/v1/admin/payment-methods', {
      query: asQuery({ ...query }),
      ...(signal === undefined ? {} : { signal }),
    }),

  byId: (id: string) => api.get(paymentMethodSchema, `/v1/admin/payment-methods/${id}`),

  create: (body: CreatePaymentMethodBody) =>
    api.post(paymentMethodSchema, '/v1/admin/payment-methods', { body }),

  update: (id: string, body: UpdatePaymentMethodBody) =>
    api.patch(paymentMethodSchema, `/v1/admin/payment-methods/${id}`, { body }),

  /** Deactivates. Nothing on the money path is ever really deleted. */
  deactivate: (id: string) =>
    api.delete(paymentMethodSchema, `/v1/admin/payment-methods/${id}`),

  destinations: (methodId: string, includeInactive = false) =>
    api.get(z.array(paymentDestinationSchema), `/v1/admin/payment-methods/${methodId}/destinations`, {
      query: includeInactive ? { includeInactive: 'true' } : {},
    }),

  createDestination: (methodId: string, body: CreatePaymentDestinationBody) =>
    api.post(paymentDestinationSchema, `/v1/admin/payment-methods/${methodId}/destinations`, {
      body,
    }),

  updateDestination: (destinationId: string, body: UpdatePaymentDestinationBody) =>
    api.patch(paymentDestinationSchema, `/v1/admin/payment-destinations/${destinationId}`, { body }),

  deactivateDestination: (destinationId: string) =>
    api.delete(paymentDestinationSchema, `/v1/admin/payment-destinations/${destinationId}`),
};

// ── Admin directory and approval limits ────────────────────────────────────────────────────────

export const adminsApi = {
  list: (query: AdminListQuery = {}, signal?: AbortSignal) =>
    api.page(adminUserSchema, '/v1/admin/admins', {
      query: asQuery({ ...query }),
      ...(signal === undefined ? {} : { signal }),
    }),

  byId: (id: string) => api.get(adminUserSchema, `/v1/admin/admins/${id}`),

  create: (body: CreateAdminBody) => api.post(adminUserSchema, '/v1/admin/admins', { body }),

  update: (id: string, body: UpdateAdminBody) =>
    api.patch(adminUserSchema, `/v1/admin/admins/${id}`, { body }),

  /** Deactivates: the row is referenced by every deposit this person decided. */
  deactivate: (id: string) => api.delete(adminUserSchema, `/v1/admin/admins/${id}`),

  approvalLimits: (adminUserId: string) =>
    api.get(z.array(approvalLimitSchema), `/v1/admin/admins/${adminUserId}/approval-limits`),

  /** Creates a new version and closes the previous one. History is never rewritten. */
  setApprovalLimit: (adminUserId: string, body: SetApprovalLimitBody) =>
    api.post(approvalLimitSchema, `/v1/admin/admins/${adminUserId}/approval-limits`, { body }),

  /** Ends a version without replacing it — the admin is left unable to approve anything. */
  endApprovalLimit: (limitId: string) =>
    api.delete(approvalLimitSchema, `/v1/admin/approval-limits/${limitId}`),
};

// ── Reconciliation ─────────────────────────────────────────────────────────────────────────────

export const reconciliationApi = {
  breaks: (query: BreakListQuery = {}, signal?: AbortSignal) =>
    api.cursorPage(reconciliationBreakSchema, '/v1/admin/reconciliation/breaks', {
      query: asQuery({ ...query }),
      ...(signal === undefined ? {} : { signal }),
    }),

  breakById: (id: string) =>
    api.get(reconciliationBreakSchema, `/v1/admin/reconciliation/breaks/${id}`),

  assignBreak: (id: string) =>
    api.post(reconciliationBreakSchema, `/v1/admin/reconciliation/breaks/${id}/assign`),

  resolveBreak: (id: string, body: ResolveBreakBody) =>
    api.post(reconciliationBreakSchema, `/v1/admin/reconciliation/breaks/${id}/resolve`, { body }),

  correctFloat: (breakId: string, note: string) =>
    api.post(floatCorrectionSchema, `/v1/admin/reconciliation/breaks/${breakId}/correct-float`, {
      body: { note },
    }),

  syncFloat: () => api.post(floatSyncResultSchema, '/v1/admin/reconciliation/agent-float/sync'),

  railAgeing: (signal?: AbortSignal) =>
    api.get(railAgeingReportSchema, '/v1/admin/reconciliation/rail-ageing', {
      ...(signal === undefined ? {} : { signal }),
    }),

  runInvariants: () => api.post(invariantReportSchema, '/v1/admin/reconciliation/invariants/run'),
};

// ── Tenants (PLATFORM_ADMIN) ───────────────────────────────────────────────────────────────────

export const tenantsApi = {
  /** The endpoint answers `{ tenants: [...] }`; callers get the array. */
  list: async (signal?: AbortSignal) => {
    const result = await api.get(tenantListSchema, '/v1/admin/tenants', {
      ...(signal === undefined ? {} : { signal }),
    });
    return result.tenants;
  },

  byId: (id: string) => api.get(tenantSchema, `/v1/admin/tenants/${id}`),

  /** Lands SUSPENDED on purpose — activating is a second, deliberate act. */
  create: (body: CreateTenantBody) => api.post(tenantSchema, '/v1/admin/tenants', { body }),

  update: (id: string, body: UpdateTenantBody) =>
    api.patch(tenantSchema, `/v1/admin/tenants/${id}`, { body }),

  /** Verifies the Ichancy agent with a real signin before it starts serving. */
  activate: (id: string) => api.post(tenantSchema, `/v1/admin/tenants/${id}/activate`),

  suspend: (id: string) => api.post(tenantSchema, `/v1/admin/tenants/${id}/suspend`),

  /**
   * Tells Telegram where to deliver this operator's updates.
   *
   * Creating an operator generates a webhook path token but never tells Telegram about it, so a new
   * operator's bot receives nothing until this call — see docs/TENANT-OPERATIONS.md section 5.
   */
  registerWebhook: (id: string) => api.post(tenantWebhookSchema, `/v1/admin/tenants/${id}/webhook`),

  /** Stops delivery without suspending: the operator keeps serving, its bot just goes quiet. */
  removeWebhook: (id: string) => api.delete(tenantWebhookSchema, `/v1/admin/tenants/${id}/webhook`),

  /** Pushes the command menus, so `/console` and `/start` appear in the operator's bot. */
  setupBot: (id: string) => api.post(tenantBotSetupSchema, `/v1/admin/tenants/${id}/bot-setup`),

  /**
   * Costly on purpose: the server runs a real Ichancy signin and a Telegram round trip for it. Ask
   * for it when someone is looking, not on a timer — see `useTenantHealth`.
   */
  health: (id: string, signal?: AbortSignal) =>
    api.get(tenantHealthSchema, `/v1/admin/tenants/${id}/health`, {
      ...(signal === undefined ? {} : { signal }),
    }),

  /** Re-verified with a real signin before it saves; refuses a new agent id once players exist. */
  updateIchancy: (id: string, body: UpdateTenantIchancyBody) =>
    api.patch(tenantSchema, `/v1/admin/tenants/${id}/ichancy`, { body }),

  /** Verified with `getMe`, and answers with the webhook cleared: the new bot needs registering. */
  updateBot: (id: string, body: UpdateTenantBotBody) =>
    api.patch(tenantSchema, `/v1/admin/tenants/${id}/bot`, { body }),
};
