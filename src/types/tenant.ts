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

/**
 * `POST /v1/admin/tenants`. FOUR fields are required; everything else has a server-side default.
 *
 * The optional half is optional in the strict sense: an omitted field must be ABSENT from the JSON,
 * not present as `""` or `null`. An empty string is a value, and the backend would store it rather
 * than resolve its default — which is how an operator ends up with a blank currency instead of the
 * platform's. `toCreateBody` in tenant-form-dialog.tsx is the one place that decides, and it spreads
 * each field in only when it holds something.
 *
 * What the server fills in, per docs/TENANT-OPERATIONS.md:
 * - `slug` — slugify(displayName), de-duplicated with -2, -3 … on collision.
 * - `adminChatId` — the Telegram id of the PLATFORM_ADMIN making the request.
 * - `feedChatId` — no default; absent means the operator has no feed chat.
 * - everything else — the single PlatformDefaults settings row, except `ichancyAgentId`, which
 *   falls back to PlatformDefaults and then to tenant zero's, and is a 400 naming the field when
 *   none of the three exists. Ichancy `signin()` returns only a token pair, so an agent id can
 *   never be derived from the credentials.
 */
export interface CreateTenantBody {
  displayName: string;
  botToken: string;
  ichancyUsername: string;
  ichancyPassword: string;
  slug?: string;
  adminChatId?: string;
  feedChatId?: string;
  ichancyBaseUrl?: string;
  ichancyAgentId?: string;
  currencyCode?: string;
  dualApprovalThresholdMinor?: string;
  agentFloatLowWatermarkMinor?: string;
  depositExpiryMinutes?: number;
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

// ── What creation actually did, and what a new operator inherits ───────────────────────────────

/**
 * The report `POST /v1/admin/tenants` returns beside the new operator.
 *
 * ══ WHY THIS TYPE HAS TO EXIST ════════════════════════════════════════════════════════════════
 * Creating an operator is no longer one write. `TenantService.create` calls `provision()`, which
 * registers the Telegram webhook, pushes the command menus, provisions the default payment rails
 * and attempts activation — and reports the outcome of each. `tenantSchema` is a `looseObject`, so
 * this block was arriving on every create response and passing straight through untyped and unread.
 *
 * The console was therefore showing a six-step setup checklist for steps the backend had usually
 * already done, and — the part that matters — was silent about `paymentMethodsNeedAccounts`.
 *
 * ══ WHY `paymentMethodsNeedAccounts` IS THE FIELD TO CARE ABOUT ═══════════════════════════════
 * A freshly provisioned operator has payment methods whose destinations are placeholders
 * (`SEED-PLACEHOLDER-…`, account holder `REPLACE ME`). That operator can be activated, can be shown
 * to a player, and can take a deposit — and the player will have sent their money to a string that
 * is not an account. Nothing is recoverable from there. The backend's own DTO comment says the
 * console "must say it out loud until real accounts replace them"; until now it could not, because
 * it had no idea the field existed.
 *
 * Every step is reported as a boolean AND a nullable error, never as one tri-state: "did not run"
 * and "ran and failed" send an operator to two different places, and a single `webhookOk?: boolean`
 * would collapse them.
 */
export const tenantProvisioningSchema = z.looseObject({
  webhookRegistered: z.boolean(),
  /** Carries the path token, so it is a credential — shown to the platform admin who just created
   *  this operator, and to nobody else. Null when registration never succeeded. */
  webhookUrl: z.string().nullable(),
  webhookError: z.string().nullable(),

  menusPushed: z.boolean(),
  menuScopes: z.array(z.string()),
  menuError: z.string().nullable(),

  activated: z.boolean(),
  activationError: z.string().nullable(),

  paymentMethodsCreated: z.number(),
  paymentMethodsError: z.string().nullable(),
  /** True while any provisioned method still points at a placeholder account. */
  paymentMethodsNeedAccounts: z.boolean(),
});
export type TenantProvisioning = z.infer<typeof tenantProvisioningSchema>;

/**
 * `POST /v1/admin/tenants` — the operator, plus what provisioning managed.
 *
 * `provisioning` is optional because a backend older than `provision()` answers a bare `TenantView`,
 * and a console that refused to parse that would fail a creation which actually succeeded.
 */
export const tenantCreatedSchema = tenantSchema.extend({
  provisioning: tenantProvisioningSchema.optional(),
});
export type TenantCreated = z.infer<typeof tenantCreatedSchema>;

/**
 * `GET` / `PATCH /v1/admin/platform-defaults` — what the NEXT operator inherits.
 *
 * Minor units are strings, like every amount in this API. `ichancyAgentId` is the only nullable
 * member: Ichancy's `signin()` returns a token pair and nothing else, so an agent id can never be
 * derived from credentials, and a platform that has not named a house agent genuinely has none.
 *
 * `appliesToNewOperatorsOnly` is always true and is sent anyway, because it is the assumption most
 * likely to be wrong: editing a default changes what the next operator inherits and does not reach
 * back into the ones already created. Their values were copied onto their own rows and are theirs.
 */
export const platformDefaultsSchema = z.looseObject({
  ichancyBaseUrl: z.string(),
  ichancyAgentId: z.string().nullable(),
  currencyCode: z.string(),
  dualApprovalThresholdMinor: z.string(),
  agentFloatLowWatermarkMinor: z.string(),
  depositExpiryMinutes: z.number(),
  updatedAt: isoDateTime,
  appliesToNewOperatorsOnly: z.boolean(),
});
export type PlatformDefaults = z.infer<typeof platformDefaultsSchema>;

/** Every field optional: it is a PATCH, and an absent key leaves the stored value alone. */
export interface UpdatePlatformDefaultsBody {
  ichancyBaseUrl?: string;
  ichancyAgentId?: string;
  currencyCode?: string;
  dualApprovalThresholdMinor?: string;
  agentFloatLowWatermarkMinor?: string;
  depositExpiryMinutes?: number;
}
