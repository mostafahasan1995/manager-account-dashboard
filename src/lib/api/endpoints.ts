import { z } from 'zod';

import type {
  AdminListQuery,
  AdminSession,
  AgentSignInBody,
  ApproveDepositBody,
  BreakListQuery,
  CreateAdminBody,
  CreatePaymentDestinationBody,
  CreatePaymentMethodBody,
  CreateTenantBody,
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
  SetExchangeRateBody,
  UpdateTenantBody,
  UpdateTenantBotBody,
  UpdateTenantIchancyBody,
  UpdatePlatformDefaultsBody,
} from '@/types';
import {
  adminDepositSchema,
  adminPlayerSchema,
  adminSessionSchema,
  adminUserSchema,
  agentFloatSchema,
  approvalLimitSchema,
  depositChainCheckSchema,
  floatCorrectionSchema,
  floatSyncResultSchema,
  ichancyAccountSchema,
  invariantReportSchema,
  livenessSchema,
  paymentDestinationSchema,
  paymentMethodSchema,
  exchangeRateSchema,
  playerBalanceSchema,
  playerDebitSchema,
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
  tenantCreatedSchema,
  platformDefaultsSchema,
  tenantWebhookSchema,
  walletBalanceSchema,
} from '@/types';

import { createLimiter } from '@/lib/concurrency';

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

  /**
   * Signs an operator in with its ICHANCY AGENT account, and answers the same session shape.
   *
   * Same shape is the point: the console counts down one expiry and sends one bearer token, and
   * nothing past this line can tell which door a session came through.
   *
   * A 409 AGENT_OPERATOR_AMBIGUOUS is not a failure to report and stop at — it is the server asking
   * which operator, with the choices in `error.details.operators`. See agentOperatorChoices.
   */
  signInWithAgent: (body: AgentSignInBody): Promise<AdminSession> =>
    api.post(adminSessionSchema, '/v1/admin/auth/ichancy', {
      body,
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

/**
 * What the chain says about ONE deposit.
 *
 * Its own object rather than a member of `depositsApi`, for the same reason `walletBalancesApi` is
 * not a member of `paymentMethodsApi`: everything in there reads the backend's own tables, and this
 * one goes on to a chain explorer that is rate-limited, sometimes slow and sometimes down. Keeping
 * it apart is what stops somebody folding it into the deposit view — where the QUEUE endpoint would
 * then pay for one chain call per row.
 *
 * Deliberately has no `queue` sibling and never will. If a list ever needs chain state it wants a
 * batch endpoint, not this one called N times.
 */
export const depositChainChecksApi = {
  read: (depositId: string, signal?: AbortSignal) =>
    api.get(depositChainCheckSchema, `/v1/admin/deposits/${depositId}/chain-check`, {
      ...(signal === undefined ? {} : { signal }),
    }),
};

// ── Players ────────────────────────────────────────────────────────────────────────────────────

/**
 * How many balance reads may be in flight at once, across the entire console.
 *
 * Four, not twenty. Each read is an Ichancy `getPlayerBalanceById` behind Cloudflare: seconds of
 * latency and a rate limit that answers a burst with challenges. Four keeps a page of ten filling
 * in under a handful of waves while staying well inside what the agent tolerates.
 */
export const BALANCE_CONCURRENCY = 4;

const balanceLimiter = createLimiter(BALANCE_CONCURRENCY);

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

  /**
   * Takes funds back OUT of a player's Ichancy account and into the agent float.
   *
   * The opposite of `createIchancyAccount` in every way that matters: NOT idempotent, and NOT safe
   * to repeat. Ichancy has no idempotency key, so a second call is a second debit of a real
   * person's money. When the server cannot prove which way it went it answers with a status that
   * demands a human — never with an invitation to try again.
   */
  debit: (id: string, body: DebitPlayerBody) =>
    api.post(playerDebitSchema, `/v1/admin/players/${id}/debit`, { body }),

  /**
   * What Ichancy holds for one player.
   *
   * Routed through a SHARED gate rather than called directly, and the gate is the whole design of
   * the balance column: there is no bulk read, so a table of balances is one upstream call per row
   * through Cloudflare, and firing a page of them at once earns challenges and 429s instead of
   * numbers. Four at a time is four across the whole console, not four per component — which only
   * works because the limiter lives here, beside the request, rather than in any one screen.
   */
  balance: (id: string, signal?: AbortSignal) =>
    balanceLimiter.run(() => {
      // Checked after the wait, not before it: a row that scrolled away, a page that was turned, or
      // a filter that was retyped while this sat in the queue must not spend its slot on an answer
      // nobody is waiting for any more.
      if (signal?.aborted === true) throw new DOMException('Aborted', 'AbortError');
      return api.get(playerBalanceSchema, `/v1/admin/players/${id}/balance`, {
        ...(signal === undefined ? {} : { signal }),
      });
    }),
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
  deactivate: (id: string) => api.delete(paymentMethodSchema, `/v1/admin/payment-methods/${id}`),

  destinations: (methodId: string, includeInactive = false) =>
    api.get(
      z.array(paymentDestinationSchema),
      `/v1/admin/payment-methods/${methodId}/destinations`,
      {
        query: includeInactive ? { includeInactive: 'true' } : {},
      },
    ),

  createDestination: (methodId: string, body: CreatePaymentDestinationBody) =>
    api.post(paymentDestinationSchema, `/v1/admin/payment-methods/${methodId}/destinations`, {
      body,
    }),

  updateDestination: (destinationId: string, body: UpdatePaymentDestinationBody) =>
    api.patch(paymentDestinationSchema, `/v1/admin/payment-destinations/${destinationId}`, {
      body,
    }),

  deactivateDestination: (destinationId: string) =>
    api.delete(paymentDestinationSchema, `/v1/admin/payment-destinations/${destinationId}`),
};

// ── What the chain says a payout wallet holds ──────────────────────────────────────────────────

/**
 * The on-chain balance of ONE payout wallet.
 *
 * Its own object rather than a member of `paymentMethodsApi`, because it is not the same kind of
 * call. Everything there reads the backend's own tables; this one goes on to a third-party chain
 * explorer, which is rate-limited, sometimes slow and sometimes down — and which answers `200` with
 * a NULL balance when it could not read, rather than an error. Keeping it separate is what stops a
 * screen treating a wallet balance as the cheap read a destination list is.
 */
export const walletBalancesApi = {
  read: (destinationId: string, signal?: AbortSignal) =>
    api.get(walletBalanceSchema, `/v1/admin/payment-destinations/${destinationId}/balance`, {
      ...(signal === undefined ? {} : { signal }),
    }),
};

// ── The rate that prices a crypto deposit ──────────────────────────────────────────────────────

/**
 * One rate per asset per operator. `get` answers `null` when nobody has set one — a normal state a
 * screen renders as an empty form, not a missing resource.
 */
export const exchangeRatesApi = {
  getUsdt: (signal?: AbortSignal) =>
    api.get(exchangeRateSchema.nullable(), '/v1/admin/exchange-rates/usdt', {
      ...(signal === undefined ? {} : { signal }),
    }),

  /** PUT: there is one current rate, even though every set records a new version behind it. */
  setUsdt: (body: SetExchangeRateBody) =>
    api.post(exchangeRateSchema, '/v1/admin/exchange-rates/usdt', { body }),
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

// ── The agent float ────────────────────────────────────────────────────────────────────────────

/**
 * The Ichancy agent balance, read out of the local ledger.
 *
 * NOT a member of `reconciliationApi`, even though the float sync lives there. This one is chrome:
 * the top bar asks for it on every screen, and hanging it off reconciliation would tie a permanent
 * background read to a page most people never open — and would invite somebody to invalidate it
 * from a break resolution, which refetches it for everybody looking at anything.
 *
 * Cheap by contract: a ledger balance, not an Ichancy round trip. That is the whole reason the top
 * bar is allowed to poll it at all — compare `tenantsApi.health`, which costs a real signin.
 */
export const agentFloatApi = {
  get: (signal?: AbortSignal) =>
    api.get(agentFloatSchema, '/v1/admin/agent-float', {
      ...(signal === undefined ? {} : { signal }),
    }),
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

// ── Platform defaults (PLATFORM_ADMIN) ─────────────────────────────────────────────────────────

/**
 * The values every NEW operator inherits.
 *
 * Not a tenant, and deliberately not hung off `/v1/admin/tenants`: it is the platform's own row,
 * and a sub-path of a collection it is not a member of would read as one.
 */
export const platformDefaultsApi = {
  get: (signal?: AbortSignal) =>
    api.get(platformDefaultsSchema, '/v1/admin/platform-defaults', {
      ...(signal === undefined ? {} : { signal }),
    }),

  /** Answers the same view as `get`, so a screen never has to guess what it saved. */
  update: (body: UpdatePlatformDefaultsBody) =>
    api.patch(platformDefaultsSchema, '/v1/admin/platform-defaults', { body }),
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

  /**
   * Creates an operator and finishes the job: the backend registers the webhook, pushes the command
   * menus, provisions the default payment rails and attempts activation, then reports each outcome
   * in `provisioning`.
   *
   * Parsed with `tenantCreatedSchema` rather than `tenantSchema`, which is the whole point: that
   * block was arriving on every response and being dropped on the floor, including the one field
   * that says the new operator's rails point at placeholder accounts.
   */
  create: (body: CreateTenantBody) => api.post(tenantCreatedSchema, '/v1/admin/tenants', { body }),

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
