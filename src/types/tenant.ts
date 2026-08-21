import { z } from 'zod';

import { isoDateTime } from './api';
import { tenantStatusSchema } from './enums';

export const tenantSchema = z.looseObject({
  id: z.string(),
  slug: z.string(),
  displayName: z.string(),
  status: tenantStatusSchema,
  /** The webhook path token itself is never returned — only whether one exists. */
  hasWebhookPath: z.boolean(),
  adminChatId: z.string(),
  feedChatId: z.string().nullable(),
  botUsername: z.string().nullable(),
  ichancyBaseUrl: z.string(),
  ichancyUsername: z.string(),
  ichancyAgentId: z.string(),
  currencyCode: z.string(),
  dualApprovalThresholdMinor: z.string(),
  agentFloatLowWatermarkMinor: z.string(),
  depositExpiryMinutes: z.number(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  counts: z.looseObject({ players: z.number(), deposits: z.number() }).optional(),
});
export type Tenant = z.infer<typeof tenantSchema>;

/** GET /v1/admin/tenants answers `{ tenants: [...] }`, not a bare array. */
export const tenantListSchema = z.looseObject({ tenants: z.array(tenantSchema) });

export interface CreateTenantBody {
  slug: string;
  displayName: string;
  botToken: string;
  adminChatId: string;
  feedChatId?: string;
  ichancyBaseUrl: string;
  ichancyUsername: string;
  ichancyPassword: string;
  ichancyAgentId: string;
  currencyCode: string;
  dualApprovalThresholdMinor: string;
  agentFloatLowWatermarkMinor: string;
  depositExpiryMinutes: number;
}

/** `slug` and `currencyCode` are absent for a reason: both would rewrite the meaning of old rows. */
export interface UpdateTenantBody {
  displayName?: string;
  adminChatId?: string;
  feedChatId?: string;
  dualApprovalThresholdMinor?: string;
  agentFloatLowWatermarkMinor?: string;
  depositExpiryMinutes?: number;
}

// ── Operator operations: webhook, bot, health ──────────────────────────────────────────────────

/**
 * `POST` and `DELETE /v1/admin/tenants/:id/webhook` answer the same shape, which is what makes the
 * pair usable as one control: whatever the console did, this is where Telegram now delivers.
 *
 * `url` is nullable even though registering always produces one — after a DELETE there is no URL to
 * report, and a screen that renders `""` there would be claiming a registration that is gone.
 */
export const tenantWebhookSchema = z.looseObject({
  url: z.string().nullable(),
  registered: z.boolean(),
  pendingUpdateCount: z.number(),
  lastErrorMessage: z.string().nullable(),
  lastErrorDate: isoDateTime.nullable(),
});
export type TenantWebhook = z.infer<typeof tenantWebhookSchema>;

/** `POST /bot-setup`: how many commands were pushed, and to which Telegram command scopes. */
export const tenantBotSetupSchema = z.looseObject({
  commandsSet: z.number(),
  scopes: z.array(z.string()),
});
export type TenantBotSetup = z.infer<typeof tenantBotSetupSchema>;

/**
 * The Telegram half of a health check: `getMe` plus `getWebhookInfo`.
 *
 * `webhookMatches` is the field that matters. A bot can have a webhook registered and still be
 * dead to this deployment, because the URL Telegram holds is some other host — an old staging box,
 * or another operator's path token. `webhookUrl !== null` is not the question; agreeing with what
 * this deployment expects is.
 */
export const tenantBotHealthSchema = z.looseObject({
  ok: z.boolean(),
  username: z.string().nullable(),
  webhookUrl: z.string().nullable(),
  webhookMatches: z.boolean(),
  pendingUpdateCount: z.number(),
  lastErrorMessage: z.string().nullable(),
  lastErrorDate: isoDateTime.nullable(),
});
export type TenantBotHealth = z.infer<typeof tenantBotHealthSchema>;

/**
 * The Ichancy half: a real signin against this operator's agent, and the float it reports.
 *
 * `sharesAgentWith` carries the SLUGS of the other operators configured with the same
 * `ichancyBaseUrl` + `ichancyUsername`. Ichancy issues one token pair per agent account, so those
 * operators share a single session whether or not anyone meant them to — see
 * docs/TENANT-OPERATIONS.md section 3. Showing the coupling is the whole point of the field.
 */
export const tenantIchancyHealthSchema = z.looseObject({
  ok: z.boolean(),
  baseUrl: z.string(),
  username: z.string(),
  agentId: z.string(),
  checkedAt: isoDateTime,
  error: z.string().nullable(),
  /** Minor units as a string, and null when the signin failed — there is no float to report. */
  floatMinor: z.string().nullable(),
  belowWatermark: z.boolean(),
  sharesAgentWith: z.array(z.string()),
});
export type TenantIchancyHealth = z.infer<typeof tenantIchancyHealthSchema>;

export const tenantHealthCountsSchema = z.looseObject({
  players: z.number(),
  deposits: z.number(),
});
export type TenantHealthCounts = z.infer<typeof tenantHealthCountsSchema>;

/** `GET /health`: bot, webhook, Ichancy agent and float in one call, because they fail together. */
export const tenantHealthSchema = z.looseObject({
  bot: tenantBotHealthSchema,
  ichancy: tenantIchancyHealthSchema,
  counts: tenantHealthCountsSchema,
});
export type TenantHealth = z.infer<typeof tenantHealthSchema>;

/**
 * `PATCH /ichancy`. The password is write-only in both directions: it is sealed on arrival and
 * never returned, so omitting it means "leave the sealed one alone".
 *
 * `ichancyAgentId` is refused once the operator has linked players (`TENANT_AGENT_HAS_PLAYERS`):
 * repointing an agent under existing players orphans them from the tree their balances live in.
 */
export interface UpdateTenantIchancyBody {
  ichancyBaseUrl?: string;
  ichancyUsername?: string;
  ichancyPassword?: string;
  ichancyAgentId?: string;
}

/**
 * `PATCH /bot`. Verified with a real `getMe` before it is sealed, so a bad token never lands.
 *
 * Replacing the token also drops the webhook: the new bot has never been told where to deliver, and
 * Telegram permits exactly one webhook URL per bot. The screen must send the operator back through
 * "register webhook" rather than implying delivery survived.
 */
export interface UpdateTenantBotBody {
  botToken: string;
}
