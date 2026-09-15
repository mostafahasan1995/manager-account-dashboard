import { z } from 'zod';

import { isoDateTime } from './api';
import {
  depositModeSchema,
  tenantStatusSchema,
  withdrawalModeSchema,
  type DepositMode,
  type WithdrawalMode,
} from './enums';
import { discoveredChatSchema, telegramBotChatStatusSchema } from './telegram-destination';

export const tenantSchema = z.looseObject({
  id: z.string(),
  slug: z.string(),
  displayName: z.string(),
  status: tenantStatusSchema,
  /** The webhook path token itself is never returned — only whether one exists. */
  hasWebhookPath: z.boolean(),
  /**
   * The STAFF GROUP: where review cards and operational alerts go. Null is "not bound yet" (owner
   * decision, 2026-09-15): a new operator is created without one and stays SUSPENDED until the
   * platform admin binds it, because an operator taking real deposits with nowhere to send the
   * review cards is exactly the silent failure this field used to hide.
   */
  adminChatId: z.string().nullable(),
  /** The FEED GROUP, the customer-facing mirror of credited deposits. Null is off, not a fault. */
  feedChatId: z.string().nullable(),
  botUsername: z.string().nullable(),
  ichancyBaseUrl: z.string(),
  ichancyUsername: z.string(),
  ichancyAgentId: z.string(),
  currencyCode: z.string(),
  dualApprovalThresholdMinor: z.string(),
  agentFloatLowWatermarkMinor: z.string(),
  depositExpiryMinutes: z.number(),
  /**
   * How this operator's bot answers a submitted deposit — see `DEPOSIT_MODES`. Optional for the
   * same reason withdrawalMode is: a backend older than this feature answers no such field, and
   * `tenantDepositMode` below reads the absent value as the conservative one.
   */
  depositMode: depositModeSchema.optional(),
  /**
   * How this operator's bot answers a cash-out — see `WITHDRAWAL_MODES`. Optional because a backend
   * older than the withdrawal module answers no such field, and a console that refused to parse its
   * operator list over one missing setting would blank the platform screen; `tenantWithdrawalMode`
   * below reads the absent value as the conservative one.
   */
  withdrawalMode: withdrawalModeSchema.optional(),
  /**
   * The https URL the bot's "open the app" button opens. Null is "not set yet" — the bot answers
   * "coming soon" — and absent is the older backend again.
   */
  miniAppUrl: z.string().nullable().optional(),
  /**
   * True when the DEPLOYMENT runs with ICHANCY_FAKE — repeated on every operator because the console
   * reads operators, not deployments. An ACTIVE status reached under it was "verified" by a fixture,
   * and every screen that reports an Ichancy answer has to say so in words.
   */
  ichancyFake: z.boolean(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  counts: z.looseObject({ players: z.number(), deposits: z.number() }).optional(),
});
export type Tenant = z.infer<typeof tenantSchema>;

/** MANUAL until the backend says otherwise: a missing setting must not auto-approve money. */
export function tenantWithdrawalMode(tenant: Pick<Tenant, 'withdrawalMode'>): WithdrawalMode {
  return tenant.withdrawalMode ?? 'MANUAL';
}

/** MANUAL until the backend says otherwise: a missing setting must not auto-approve money. */
export function tenantDepositMode(tenant: Pick<Tenant, 'depositMode'>): DepositMode {
  return tenant.depositMode ?? 'MANUAL';
}

/**
 * Tenant zero: the platform itself, not an operator (the backend's `TENANT_ZERO_ID`). Keyed on the id,
 * never the slug, because the id is what the backend compares.
 */
export const TENANT_ZERO_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Whether this row is the platform rather than an operator. The platform has no staff group and no
 * feed group: it is ACTIVE with `adminChatId` null, and every bind, link and removal for it is 422
 * `TENANT_PLATFORM_LOCKED`. So none of an operator's group warnings or group steps apply to it.
 */
export function isPlatformTenant(tenant: Pick<Tenant, 'id'>): boolean {
  return tenant.id === TENANT_ZERO_ID;
}

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
 * - `adminChatId` — NO default (2026-09-15): absent means no staff group, and the operator stays
 *   suspended until one is bound. A chat id sent here is verified with Telegram before anything is
 *   written (400 TELEGRAM_CHAT_REJECTED).
 * - `feedChatId` — no default; absent means the operator has no feed chat. Verified the same way.
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
  depositMode?: DepositMode;
  withdrawalMode?: WithdrawalMode;
  /** `null` clears it; absent leaves it alone. An https URL, which the server insists on. */
  miniAppUrl?: string | null;
}

/**
 * `slug` and `currencyCode` are absent for a reason: both would rewrite the meaning of old rows.
 *
 * A CHANGED `adminChatId` or `feedChatId` is a bind, verified with Telegram before anything saves
 * (400 TELEGRAM_CHAT_REJECTED). There is no way to unset either here: a group is removed with
 * `DELETE /v1/admin/tenants/:id/telegram/chats/:purpose`, so the form leaves a blank field out.
 */
export interface UpdateTenantBody {
  displayName?: string;
  adminChatId?: string;
  feedChatId?: string;
  dualApprovalThresholdMinor?: string;
  agentFloatLowWatermarkMinor?: string;
  depositExpiryMinutes?: number;
  depositMode?: DepositMode;
  withdrawalMode?: WithdrawalMode;
  miniAppUrl?: string | null;
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
  /** False whenever nothing real answered — including fake mode, see `fake`. */
  ok: z.boolean(),
  /**
   * True when the deployment runs with ICHANCY_FAKE: NO connection to Ichancy was made, `ok` is
   * false, `floatMinor` is null and `error` says so. The console keys its fake-mode notice on this
   * boolean and never on the error text, which differs for tenant zero.
   */
  fake: z.boolean(),
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

/**
 * One bound group in health. `chatId` is the binding; everything else is the bot's LAST SIGHTING in
 * that group, null when it was never seen there.
 *
 * `isPresent: false` is the case this block exists for: the bot was removed from the group. The
 * binding is kept on purpose — clearing it would turn "somebody kicked the bot" into "no group was
 * ever set" — so nothing reaches the group until a human adds the bot back or binds another one.
 */
export const boundChatHealthSchema = z.looseObject({
  chatId: z.string().nullable(),
  title: z.string().nullable(),
  status: telegramBotChatStatusSchema.nullable(),
  isPresent: z.boolean().nullable(),
  isAdministrator: z.boolean().nullable(),
  canPost: z.boolean().nullable(),
  lastSeenAt: isoDateTime.nullable(),
});
export type BoundChatHealth = z.infer<typeof boundChatHealthSchema>;

export const tenantChatsHealthSchema = z.looseObject({
  staff: boundChatHealthSchema,
  feed: boundChatHealthSchema,
});
export type TenantChatsHealth = z.infer<typeof tenantChatsHealthSchema>;

/** `GET /health`: bot, webhook, Ichancy agent, groups and float in one call, because they fail together. */
export const tenantHealthSchema = z.looseObject({
  bot: tenantBotHealthSchema,
  ichancy: tenantIchancyHealthSchema,
  chats: tenantChatsHealthSchema,
  counts: tenantHealthCountsSchema,
});
export type TenantHealth = z.infer<typeof tenantHealthSchema>;

// ── Staff and feed groups ──────────────────────────────────────────────────────────────────────

/**
 * Which of an operator's two groups a bind is for: `STAFF` is `adminChatId`, `FEED` is `feedChatId`.
 * The backend's own enum spelling, so a path segment and a body value need no translation.
 */
export const TELEGRAM_CHAT_PURPOSES = ['STAFF', 'FEED'] as const;
export const telegramChatPurposeSchema = z.enum(TELEGRAM_CHAT_PURPOSES);
export type TelegramChatPurpose = z.infer<typeof telegramChatPurposeSchema>;

/**
 * `POST /v1/admin/tenants/:id/telegram/bind-links` — the "Add bot to staff group" link.
 *
 * `url` carries a one-time nonce and works once, for fifteen minutes, for this operator and this
 * purpose only. It is a bearer credential for pointing an operator's review cards (player names,
 * amounts) at a chat, so the console opens it and shows it to the admin who asked, and keeps it only
 * while it is shown: in the component's state and the mutation's result, both dropped when the step
 * is dismissed or unmounts (`gcTime: 0` on the mutation). Never in storage or a log line.
 */
export const telegramBindLinkSchema = z.looseObject({
  purpose: telegramChatPurposeSchema,
  url: z.string(),
  botUsername: z.string(),
  expiresAt: isoDateTime,
  /** The rights the link asks Telegram to give the bot, as in its `admin=` parameter. */
  adminRights: z.array(z.string()),
});
export type TelegramBindLink = z.infer<typeof telegramBindLinkSchema>;

/**
 * `GET /v1/admin/tenants/:id/telegram/chats` — one operator's chat directory, named in the path.
 *
 * The operator-scoped `/v1/admin/telegram/chats` row, plus what binding a staff group needs. Note that
 * `alreadyBound` changes meaning here: bound as THIS operator's staff or feed group (`boundAs`), not
 * "an active destination". `lastChangedBy…` names who last added or removed the bot, so a stranger's
 * group is recognisable before anybody picks it, and `migratedToChatId` marks the dead id a group left
 * behind when it became a supergroup.
 */
export const tenantDiscoveredChatSchema = discoveredChatSchema.extend({
  boundAs: z.array(telegramChatPurposeSchema),
  migratedToChatId: z.string().nullable(),
  lastChangedByTelegramUserId: z.string().nullable(),
  lastChangedByUsername: z.string().nullable(),
});
export type TenantDiscoveredChat = z.infer<typeof tenantDiscoveredChatSchema>;

/** `PUT /v1/admin/tenants/:id/telegram/chats/:purpose`. A string, like every Telegram id here. */
export interface BindTenantChatBody {
  chatId: string;
}

/**
 * `details.reason` of 400 TELEGRAM_CHAT_REJECTED on the staff and feed group routes. The destination
 * reasons, minus the two only a pasted link can produce, plus CHANNEL_NOT_ALLOWED: staff tap review
 * buttons, and a channel has nobody to tap them.
 */
export const TENANT_CHAT_REJECTION_REASONS = [
  'NOT_FOUND',
  'PRIVATE_CHAT',
  'CHANNEL_NOT_ALLOWED',
  'BOT_NOT_MEMBER',
  'BOT_NOT_ADMIN',
  'BOT_CANNOT_POST',
] as const;
export type TenantChatRejectionReason = (typeof TENANT_CHAT_REJECTION_REASONS)[number];

/** The refusal of an activation, of removing an active operator's staff group, and of a deposit. */
export const TENANT_STAFF_GROUP_REQUIRED = 'TENANT_STAFF_GROUP_REQUIRED';

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

  /**
   * The "old players": how many of the agent's existing Ichancy accounts were pulled in on create.
   * `.catch()` on both, so a backend that predates the import reads as "none imported, no error"
   * rather than failing to parse a creation that succeeded — the same degrade `deletable` uses.
   */
  playersImported: z.number().catch(0),
  playersImportError: z.string().nullable().catch(null),

  /**
   * True under ICHANCY_FAKE: `activated` and `playersImported` were answered by the fake adapter, so
   * the agent's credentials were never proven and any imported players are made up.
   * `activationError` keeps its meaning and never carries this notice.
   */
  ichancyFake: z.boolean(),
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
