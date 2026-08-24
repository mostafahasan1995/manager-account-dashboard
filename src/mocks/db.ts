import { config } from '@/config';
import { formatMinorToDecimal, minorFromString, parseDecimalToMinor } from '@/lib/money';
import type {
  AdminDeposit,
  AdminIdentity,
  AdminPlayer,
  AdminUser,
  ApprovalLimit,
  DepositStatus,
  PaymentDestination,
  PaymentMethod,
  PlayerDebit,
  PlayerDebitStatus,
  ReconciliationBreak,
  Tenant,
  TenantHealth,
  TenantWebhook,
} from '@/types';

import {
  MOCK_CURRENCY,
  MOCK_DEBIT_TIMEOUT_PLAYER_ID,
  TENANT_IDS,
  mockAdmins,
  mockApprovalLimits,
  mockBreaks,
  mockDeposits,
  mockDestinations,
  mockPaymentMethods,
  mockPlatformDefaults,
  mockPlayerBalances,
  mockPlayers,
  mockRailAgeing,
  mockTenants,
  type PlatformDefaults,
} from './fixtures';

/**
 * A small in-memory database behind the mock API.
 *
 * It is stateful on purpose: approving a deposit really moves it out of the queue, ending an
 * approval limit really closes the version, suspending a tenant really changes its status. A mock
 * that only ever replays a fixture proves the table renders; this one proves the workflow works,
 * which is what the E2E suite is actually asserting.
 */

let sequence = 0;
const nextId = (prefix: string): string =>
  `${prefix}-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * Request bodies arrive as `Record<string, unknown>`. These read a field or fall back, WITHOUT
 * stringifying whatever happened to be there — `String({})` would quietly write "[object Object]"
 * into a field the UI then renders as if it were real.
 */
const str = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.length > 0 ? value : fallback;

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const optionalStr = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

/**
 * What the platform knows about ONE operator's plumbing, as opposed to its row.
 *
 * These live beside the tenant rather than on it because the real backend does not store them
 * either: the webhook state is whatever Telegram answers to `getWebhookInfo`, and the agent state
 * is whatever a real signin just did. The tenant row only carries the path token and the config.
 */
export interface MockOperatorOps {
  /**
   * Generated when the operator is created — 32 CSPRNG bytes in the backend. It is the only thing
   * separating one operator's Telegram updates from another's, so it is never caller-supplied.
   */
  webhookPathToken: string;
  /**
   * Where Telegram currently delivers, or null when it has never been told. A NEW operator starts
   * null even though its path token exists: that gap is exactly what stops a new bot working today
   * — see docs/TENANT-OPERATIONS.md section 5.
   */
  webhookUrl: string | null;
  pendingUpdateCount: number;
  lastErrorMessage: string | null;
  lastErrorDate: string | null;
  /**
   * Non-null when a real Ichancy signin would fail. An agent that does not answer is the ordinary
   * reason an operator is still SUSPENDED, so one fixture carries it.
   */
  ichancyError: string | null;
  /**
   * Minor units, or null when there is no float to report. The HOME operator is the exception: its
   * float lives on the reconciliation side of this db, so health reads it from there and the two
   * screens cannot contradict each other.
   */
  floatMinor: string | null;
}

export interface MockState {
  admins: AdminUser[];
  approvalLimits: ApprovalLimit[];
  players: AdminPlayer[];
  /** What Ichancy holds for each player: minor units, keyed by player id, as strings. */
  playerBalances: Record<string, string>;
  /** Every manual debit this session has posted, oldest first. */
  playerDebits: PlayerDebit[];
  methods: PaymentMethod[];
  destinations: PaymentDestination[];
  deposits: AdminDeposit[];
  breaks: ReconciliationBreak[];
  tenants: Tenant[];
  /** Per-operator webhook and agent state: everything `GET /health` reports, keyed by tenant id. */
  operatorOps: Record<string, MockOperatorOps>;
  railAgeing: typeof mockRailAgeing;
  /**
   * The one settings row every tenant-creation default is resolved from. Read it through
   * `platformDefaults()` rather than reaching in here, so there is a single place to change when
   * the backend adds a defaulted field.
   */
  platformDefaults: PlatformDefaults;
  /** The admin the mock session belongs to. Switchable so tests can log in as any role. */
  currentAdmin: AdminIdentity;
  /** Ledger side of the agent float, so a float sync produces a believable delta. */
  agentFloatLedgerMinor: bigint;
  agentFloatIchancyMinor: bigint;
}

/**
 * The real one is 32 CSPRNG bytes. This is not a secret — it only has to be unguessable-looking and
 * different per operator, so that a webhook URL comparison is a real comparison.
 */
const webhookPathToken = (): string =>
  Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join('');

/** Where this deployment expects Telegram to deliver an operator's updates. */
export const expectedWebhookUrl = (pathToken: string): string =>
  `${config.apiBaseUrl}/telegram/webhook/${pathToken}`;

/** The float a re-verified agent starts reporting, so a recovered operator is not blank. */
const RECOVERED_AGENT_FLOAT_MINOR = '12500000';

function seedOperatorOps(): Record<string, MockOperatorOps> {
  const home = webhookPathToken();
  const northern = webhookPathToken();

  return {
    // Healthy and delivering.
    [TENANT_IDS.zero]: {
      webhookPathToken: home,
      webhookUrl: expectedWebhookUrl(home),
      pendingUpdateCount: 0,
      lastErrorMessage: null,
      lastErrorDate: null,
      ichancyError: null,
      floatMinor: null,
    },
    // Registered and answering, with a small delivery backlog and a float under its watermark:
    // two warnings that are NOT outages, which is a distinction the panel has to draw.
    [TENANT_IDS.second]: {
      webhookPathToken: northern,
      webhookUrl: expectedWebhookUrl(northern),
      pendingUpdateCount: 4,
      lastErrorMessage: null,
      lastErrorDate: null,
      ichancyError: null,
      floatMinor: '38000000',
    },
    // The operator that was created and then stalled: a path token Telegram never heard of, and an
    // agent that does not answer. Both of the reasons an operator sits SUSPENDED, in one fixture.
    [TENANT_IDS.suspended]: {
      webhookPathToken: webhookPathToken(),
      webhookUrl: null,
      pendingUpdateCount: 0,
      lastErrorMessage: null,
      lastErrorDate: null,
      ichancyError:
        'Ichancy sign-in failed for agent_pilot: the agent did not answer (504 after 15s).',
      floatMinor: null,
    },
  };
}

function seed(): MockState {
  const superAdmin = mockAdmins[0];
  if (superAdmin === undefined) throw new Error('fixtures are empty');

  return {
    admins: clone(mockAdmins),
    approvalLimits: clone(mockApprovalLimits),
    players: clone(mockPlayers),
    playerBalances: clone(mockPlayerBalances),
    playerDebits: [],
    methods: clone(mockPaymentMethods),
    destinations: clone(mockDestinations),
    deposits: clone(mockDeposits),
    breaks: clone(mockBreaks),
    tenants: clone(mockTenants),
    operatorOps: seedOperatorOps(),
    railAgeing: clone(mockRailAgeing),
    // Seeded once, exactly as the backend seeds the settings row from env on first run.
    platformDefaults: clone(mockPlatformDefaults),
    currentAdmin: {
      id: superAdmin.id,
      telegramUserId: superAdmin.telegramUserId,
      role: superAdmin.role,
      displayName: superAdmin.displayName,
    },
    agentFloatLedgerMinor: 450_000_000n,
    agentFloatIchancyMinor: 443_750_000n,
  };
}

export const db: MockState = seed();

/** Called between tests so no case can depend on another's writes. */
export function resetMockDb(): void {
  Object.assign(db, seed());
  sequence = 0;
}

/** Lets a test sign in as any role without going through six fixtures. */
export function setMockAdmin(admin: Partial<AdminIdentity> & { role?: AdminUser['role'] }): void {
  db.currentAdmin = { ...db.currentAdmin, ...admin };
}

export const nowIso = (): string => new Date().toISOString();

// ── Deposits ───────────────────────────────────────────────────────────────────────────────────

export function findDeposit(id: string): AdminDeposit | undefined {
  return db.deposits.find((deposit) => deposit.id === id);
}

export function setDepositStatus(deposit: AdminDeposit, status: DepositStatus): void {
  deposit.status = status;
}

/**
 * Mirrors the backend's dual-approval rule: above the tenant threshold an approval does not credit,
 * it asks for a second pair of eyes.
 */
export function dualApprovalThresholdMinor(): bigint {
  const tenant = db.tenants[0];
  return tenant === undefined ? 50_000_000n : minorFromString(tenant.dualApprovalThresholdMinor);
}

export function approveDeposit(
  deposit: AdminDeposit,
  verifiedAmount?: string,
): { kind: 'approved' | 'awaiting_second_approval'; ledgerTransactionId: string } {
  const verifiedMinor =
    verifiedAmount === undefined
      ? minorFromString(deposit.claimed.minor)
      : parseDecimalToMinor(verifiedAmount);

  deposit.verified = {
    minor: verifiedMinor.toString(),
    amount: formatMinorToDecimal(verifiedMinor),
    currency: deposit.claimed.currency,
  };
  deposit.decidedAt = nowIso();
  deposit.decidedByAdminId = db.currentAdmin.id;

  if (deposit.status !== 'PENDING_SECOND_APPROVAL' && verifiedMinor > dualApprovalThresholdMinor()) {
    deposit.status = 'PENDING_SECOND_APPROVAL';
    deposit.requiresSecondApproval = true;
    return { kind: 'awaiting_second_approval', ledgerTransactionId: '' };
  }

  if (deposit.status === 'PENDING_SECOND_APPROVAL') {
    deposit.secondApproverAdminId = db.currentAdmin.id;
  }

  deposit.status = 'CREDITED';
  deposit.credited = deposit.verified;
  deposit.creditedAt = nowIso();
  deposit.creditVerifiedBy = 'API_OK';
  deposit.creditAttempts += 1;
  deposit.requiresSecondApproval = false;

  return { kind: 'approved', ledgerTransactionId: nextId('66666666') };
}

export function rejectDeposit(deposit: AdminDeposit, code: string, note?: string): void {
  deposit.status = 'REJECTED';
  deposit.rejectionCode = code;
  deposit.rejectionNote = note ?? null;
  deposit.decidedAt = nowIso();
  deposit.decidedByAdminId = db.currentAdmin.id;
}

export function claimDeposit(deposit: AdminDeposit): void {
  deposit.status = 'UNDER_REVIEW';
  deposit.reviewStartedAt = nowIso();
  deposit.decidedByAdminId = db.currentAdmin.id;
}

export function releaseDeposit(deposit: AdminDeposit): void {
  deposit.status = 'SUBMITTED';
  deposit.reviewStartedAt = null;
  deposit.decidedByAdminId = null;
}

// ── Manual player debits ───────────────────────────────────────────────────────────────────────

/** What Ichancy holds for this player, or null when there is no account to hold anything. */
export function playerBalanceMinor(playerId: string): bigint | null {
  const raw = db.playerBalances[playerId];
  return raw === undefined ? null : minorFromString(raw);
}

/**
 * A manual debit, with all three endings the real path has.
 *
 * The rules are the backend's, not this file's inventions:
 *
 *   - MORE THAN THE ACCOUNT HOLDS -> Ichancy refuses. Nothing moves and nothing is posted.
 *   - THE TIMEOUT FIXTURE -> the call does not answer, ONE balance re-read does not settle it, and
 *     it lands in NEEDS_RECONCILIATION rather than being tried a third time. A repeat here would
 *     take a real player's money twice; Ichancy has no idempotency key to stop it.
 *   - OTHERWISE -> debited, and the balance really moves, so a second debit of the same account
 *     sees the smaller number.
 *
 * A CONFIRMED debit also moves the float on both sides, because that is what the posting says:
 * `ICHANCY_AGENT_FLOAT +A` against `PLAYER_LIABILITY -A`. The chips came back to us, so the
 * reconciliation screen must not go on reporting the float it had before. A refused or unconfirmed
 * debit posts nothing — the ledger only ever records what Ichancy actually did.
 */
export function debitPlayer(player: AdminPlayer, amountMinor: bigint, reason: string): PlayerDebit {
  const before = playerBalanceMinor(player.id) ?? 0n;

  const status: PlayerDebitStatus =
    player.id === MOCK_DEBIT_TIMEOUT_PLAYER_ID
      ? 'NEEDS_RECONCILIATION'
      : amountMinor > before
        ? 'REJECTED'
        : 'DEBITED';

  const after = status === 'DEBITED' ? before - amountMinor : before;

  if (status === 'DEBITED') {
    db.playerBalances[player.id] = after.toString();
    db.agentFloatLedgerMinor += amountMinor;
    db.agentFloatIchancyMinor += amountMinor;
  }

  const debit: PlayerDebit = {
    debitId: nextId('77777777'),
    playerId: player.id,
    amountMinor: amountMinor.toString(),
    status,
    playerBalanceBeforeMinor: before.toString(),
    playerBalanceAfterMinor: after.toString(),
    // Never API_OK: Ichancy's debit call carries no idempotency key and its answer is not proof, so
    // what confirms a debit is re-reading the balance. An unconfirmed one has verified nothing.
    verifiedBy: status === 'DEBITED' ? 'BALANCE_DELTA' : null,
    reason,
    decidedBy: db.currentAdmin.id,
    createdAt: nowIso(),
  };
  db.playerDebits.push(debit);
  return debit;
}

// ── Payment methods ────────────────────────────────────────────────────────────────────────────

export function createMethod(body: Record<string, unknown>): PaymentMethod {
  const method: PaymentMethod = {
    id: nextId('cccccccc'),
    code: str(body.code, 'NEW_METHOD'),
    displayName: str(body.displayName, 'New method'),
    rail: (body.rail ?? 'BANK_TRANSFER') as PaymentMethod['rail'],
    currencyCode: str(body.currencyCode, MOCK_CURRENCY),
    verificationMode: (body.verificationMode ?? 'MANUAL_PROOF') as PaymentMethod['verificationMode'],
    minAmount: str(body.minAmount, '0.00'),
    maxAmount: str(body.maxAmount, '0.00'),
    feeFixed: str(body.feeFixed, '0.00'),
    feeBps: num(body.feeBps, 0),
    requiresReference: bool(body.requiresReference, false),
    // Defaults TRUE, matching the column: a new rail asks for a photo unless told not to.
    requiresProof: bool(body.requiresProof, true),
    referencePattern: optionalStr(body.referencePattern),
    instructions: optionalStr(body.instructions),
    isActive: bool(body.isActive, true),
    sortOrder: num(body.sortOrder, db.methods.length + 1),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    requiredProofFields: [],
  };
  db.methods.push(method);
  return method;
}

export function createDestination(
  methodId: string,
  body: Record<string, unknown>,
): PaymentDestination {
  const destination: PaymentDestination = {
    id: nextId('dddddddd'),
    paymentMethodId: methodId,
    label: str(body.label, 'New destination'),
    accountIdentifier: str(body.accountIdentifier, ''),
    accountHolder: optionalStr(body.accountHolder),
    notes: optionalStr(body.notes),
    isActive: bool(body.isActive, true),
    priority: num(body.priority, 1),
    dailyCap: optionalStr(body.dailyCap),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  db.destinations.push(destination);
  return destination;
}

// ── Admins ─────────────────────────────────────────────────────────────────────────────────────

export function createAdmin(body: Record<string, unknown>): AdminUser {
  const admin: AdminUser = {
    id: nextId('aaaaaaaa'),
    telegramUserId: str(body.telegramUserId, '0'),
    username: optionalStr(body.username),
    displayName: str(body.displayName, 'New admin'),
    role: (body.role ?? 'VIEWER') as AdminUser['role'],
    isActive: true,
    lastLoginAt: null,
    createdAt: nowIso(),
  };
  db.admins.push(admin);
  return admin;
}

/** Setting a limit closes the open version rather than editing it — same as the backend. */
export function setApprovalLimit(
  adminUserId: string,
  body: Record<string, unknown>,
): ApprovalLimit {
  const now = nowIso();
  for (const limit of db.approvalLimits) {
    if (limit.adminUserId === adminUserId && limit.effectiveTo === null) {
      limit.effectiveTo = now;
    }
  }

  const limit: ApprovalLimit = {
    id: nextId('22222222'),
    adminUserId,
    currencyCode: str(body.currencyCode, MOCK_CURRENCY),
    maxSingleApproval: str(body.maxSingleApproval, '0.00'),
    maxDailyApproval: str(body.maxDailyApproval, '0.00'),
    secondApprovalAbove: optionalStr(body.secondApprovalAbove),
    effectiveFrom: now,
    effectiveTo: null,
    createdAt: now,
  };
  db.approvalLimits.unshift(limit);
  return limit;
}

// ── Tenants ────────────────────────────────────────────────────────────────────────────────────

/**
 * The platform settings row, read through one function.
 *
 * Everything that defaults during tenant creation comes from here — never from a literal in a
 * handler and never from `config`, which is this deployment's env rather than the platform's
 * stored settings. A test can write to it to prove a default really is the source of a value.
 */
export const platformDefaults = (): PlatformDefaults => db.platformDefaults;

/**
 * `slugify(displayName)`, as the backend does it: lowercase, non-alphanumerics collapsed to single
 * hyphens, trimmed. A name with nothing latin in it (Arabic, say) leaves nothing to slug, so it
 * falls back to a fixed stem — the de-duplicator below is what keeps that usable.
 */
export function slugify(displayName: string): string {
  const slug = displayName
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'tenant' : slug;
}

/** `northern-branch`, then `northern-branch-2`, `-3`, … Slugs are globally unique. */
function uniqueSlug(base: string): string {
  if (!db.tenants.some((row) => row.slug === base)) return base;
  let suffix = 2;
  while (db.tenants.some((row) => row.slug === `${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

/**
 * The agent id, or null when there is nowhere left to look.
 *
 * Ichancy `signin()` returns a token pair and nothing else, so this CANNOT be derived from the
 * credentials — there is no lookup to add here. Supplied wins, then the platform settings row, then
 * tenant zero's; null is the caller's cue to refuse with a 400 naming the field. Two operators
 * sharing one agent id is allowed and is how a second operator gets tested.
 */
export function resolveIchancyAgentId(body: Record<string, unknown>): string | null {
  const supplied = optionalStr(body.ichancyAgentId);
  if (supplied !== null) return supplied;

  const fromPlatform = platformDefaults().ichancyAgentId;
  if (fromPlatform !== null && fromPlatform !== '') return fromPlatform;

  const tenantZero = db.tenants.find((row) => row.id === TENANT_IDS.zero);
  return optionalStr(tenantZero?.ichancyAgentId);
}

/**
 * `POST /v1/admin/tenants` with four required fields and nine that default.
 *
 * Every `optionalStr(...) ?? …` below is the server-side default the console is relying on: an
 * ABSENT field is filled in here, and the response carries the resolved value so the detail panel
 * can show what the operator actually got.
 */
export function createTenant(body: Record<string, unknown>): Tenant {
  const defaults = platformDefaults();
  const displayName = str(body.displayName, 'New tenant');

  const tenant: Tenant = {
    id: nextId('11111111'),
    slug: optionalStr(body.slug) ?? uniqueSlug(slugify(displayName)),
    displayName,
    // Always SUSPENDED: the agent id cannot be verified from a form.
    status: 'SUSPENDED',
    hasWebhookPath: true,
    // The platform admin making the request — the account that will send /console to this bot.
    adminChatId: optionalStr(body.adminChatId) ?? db.currentAdmin.telegramUserId,
    // The one optional field with no default: no feed chat until somebody sets one.
    feedChatId: optionalStr(body.feedChatId),
    botUsername: null,
    ichancyBaseUrl: optionalStr(body.ichancyBaseUrl) ?? defaults.ichancyBaseUrl,
    ichancyUsername: str(body.ichancyUsername, ''),
    // The handler refuses the create when this is null, so it is resolvable by the time we are here.
    ichancyAgentId: resolveIchancyAgentId(body) ?? '',
    currencyCode: optionalStr(body.currencyCode) ?? defaults.currencyCode,
    dualApprovalThresholdMinor:
      optionalStr(body.dualApprovalThresholdMinor) ?? defaults.dualApprovalThresholdMinor,
    agentFloatLowWatermarkMinor:
      optionalStr(body.agentFloatLowWatermarkMinor) ?? defaults.agentFloatLowWatermarkMinor,
    depositExpiryMinutes: num(body.depositExpiryMinutes, defaults.depositExpiryMinutes),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    counts: { players: 0, deposits: 0 },
  };
  db.tenants.push(tenant);
  return tenant;
}

// ── Operator operations: webhook, bot, Ichancy agent ───────────────────────────────────────────

/**
 * This operator's plumbing state, created on first use.
 *
 * An operator nobody has touched gets a path token and NO webhook, which is what the backend really
 * does on create: it generates the token and never tells Telegram about it.
 */
export function operatorOps(tenantId: string): MockOperatorOps {
  const existing = db.operatorOps[tenantId];
  if (existing !== undefined) return existing;

  const fresh: MockOperatorOps = {
    webhookPathToken: webhookPathToken(),
    webhookUrl: null,
    pendingUpdateCount: 0,
    lastErrorMessage: null,
    lastErrorDate: null,
    ichancyError: null,
    floatMinor: null,
  };
  db.operatorOps[tenantId] = fresh;
  return fresh;
}

const webhookView = (ops: MockOperatorOps): TenantWebhook => ({
  url: ops.webhookUrl,
  registered: ops.webhookUrl !== null,
  pendingUpdateCount: ops.pendingUpdateCount,
  lastErrorMessage: ops.lastErrorMessage,
  lastErrorDate: ops.lastErrorDate,
});

export function registerWebhook(tenantId: string): TenantWebhook {
  const ops = operatorOps(tenantId);
  ops.webhookUrl = expectedWebhookUrl(ops.webhookPathToken);
  // Telegram keeps whatever it had queued and starts delivering it; only the last error is history.
  ops.lastErrorMessage = null;
  ops.lastErrorDate = null;
  return webhookView(ops);
}

export function removeWebhook(tenantId: string): TenantWebhook {
  const ops = operatorOps(tenantId);
  ops.webhookUrl = null;
  // With no webhook there is no delivery queue and no delivery error to report.
  ops.pendingUpdateCount = 0;
  ops.lastErrorMessage = null;
  ops.lastErrorDate = null;
  return webhookView(ops);
}

/**
 * Replacing the bot token, as `PATCH /bot` does after a successful `getMe`.
 *
 * It clears the webhook, because Telegram permits exactly one webhook URL per bot and the NEW bot
 * has never been told where to deliver. Reporting the old URL here would be the precise lie this
 * screen exists to prevent: a console claiming delivery for a bot that receives nothing.
 */
export function replaceTenantBot(tenant: Tenant, botToken: string): void {
  const botId = botToken.split(':')[0] ?? '0';
  // The backend reads this back from getMe; the mock derives it so the change is visible.
  tenant.botUsername = `op${botId}_bot`;
  tenant.updatedAt = nowIso();

  const ops = operatorOps(tenant.id);
  ops.webhookUrl = null;
  ops.pendingUpdateCount = 0;
  ops.lastErrorMessage = null;
  ops.lastErrorDate = null;
}

/**
 * Applies `PATCH /ichancy`. The caller has already refused an agent id change under live players.
 *
 * The password is sealed on arrival and never returned, so there is nothing here to store — but a
 * changed credential stands in for the real signin the backend runs before saving, which is what
 * would clear an agent that was not answering. A bare agent-id change verifies nothing, so an
 * existing error survives it.
 */
export function updateTenantIchancy(tenant: Tenant, body: Record<string, unknown>): void {
  const baseUrl = optionalStr(body.ichancyBaseUrl);
  const username = optionalStr(body.ichancyUsername);
  const password = optionalStr(body.ichancyPassword);
  const agentId = optionalStr(body.ichancyAgentId);

  if (baseUrl !== null) tenant.ichancyBaseUrl = baseUrl;
  if (username !== null) tenant.ichancyUsername = username;
  if (agentId !== null) tenant.ichancyAgentId = agentId;
  tenant.updatedAt = nowIso();

  if (baseUrl === null && username === null && password === null) return;

  const ops = operatorOps(tenant.id);
  ops.ichancyError = null;
  ops.floatMinor ??= RECOVERED_AGENT_FLOAT_MINOR;
}

/**
 * The other operators that would share this one's Ichancy session.
 *
 * Ichancy issues one token pair per agent account, and the session is identified by base URL plus
 * username — not by tenant and not by agent id. Two operators matching on those two fields knock
 * each other's tokens out unless the backend keys the session by the agent, which is the change
 * docs/TENANT-OPERATIONS.md section 3 asks for. Slugs, because that is what a human recognises.
 */
export function operatorsSharingAgent(tenant: Tenant): string[] {
  const identity = `${tenant.ichancyBaseUrl}|${tenant.ichancyUsername}`;
  return db.tenants
    .filter(
      (row) =>
        row.id !== tenant.id && `${row.ichancyBaseUrl}|${row.ichancyUsername}` === identity,
    )
    .map((row) => row.slug);
}

/** The home operator's float is the one reconciliation moves; the rest carry their own. */
function agentFloatMinor(tenant: Tenant, ops: MockOperatorOps): string | null {
  if (ops.ichancyError !== null) return null;
  return tenant.id === TENANT_IDS.zero ? db.agentFloatIchancyMinor.toString() : ops.floatMinor;
}

export function tenantHealth(tenant: Tenant): TenantHealth {
  const ops = operatorOps(tenant.id);
  // Not "is a webhook set" but "is it OURS": a bot pointed at a stale deployment is registered and
  // still dead to this one.
  const webhookMatches = ops.webhookUrl === expectedWebhookUrl(ops.webhookPathToken);
  const floatMinor = agentFloatMinor(tenant, ops);

  return {
    bot: {
      ok: tenant.botUsername !== null && webhookMatches && ops.lastErrorMessage === null,
      username: tenant.botUsername,
      webhookUrl: ops.webhookUrl,
      webhookMatches,
      pendingUpdateCount: ops.pendingUpdateCount,
      lastErrorMessage: ops.lastErrorMessage,
      lastErrorDate: ops.lastErrorDate,
    },
    ichancy: {
      ok: ops.ichancyError === null,
      baseUrl: tenant.ichancyBaseUrl,
      username: tenant.ichancyUsername,
      agentId: tenant.ichancyAgentId,
      checkedAt: nowIso(),
      error: ops.ichancyError,
      floatMinor,
      belowWatermark:
        floatMinor !== null &&
        minorFromString(floatMinor) < minorFromString(tenant.agentFloatLowWatermarkMinor),
      sharesAgentWith: operatorsSharingAgent(tenant),
    },
    counts: tenant.counts ?? { players: 0, deposits: 0 },
  };
}

// ── Reconciliation ─────────────────────────────────────────────────────────────────────────────

export function syncAgentFloat(): {
  currencyCode: string;
  ledgerMinor: string;
  ichancyMinor: string | null;
  deltaMinor: string | null;
  breakId: string | null;
  belowWatermark: boolean;
} {
  const delta = db.agentFloatIchancyMinor - db.agentFloatLedgerMinor;
  const tenant = db.tenants[0];
  const watermark =
    tenant === undefined ? 0n : minorFromString(tenant.agentFloatLowWatermarkMinor);

  return {
    currencyCode: MOCK_CURRENCY,
    ledgerMinor: db.agentFloatLedgerMinor.toString(),
    ichancyMinor: db.agentFloatIchancyMinor.toString(),
    deltaMinor: delta.toString(),
    breakId: delta === 0n ? null : (db.breaks[0]?.id ?? null),
    belowWatermark: db.agentFloatIchancyMinor < watermark,
  };
}

export function correctFloat(breakId: string, note: string) {
  const found = db.breaks.find((row) => row.id === breakId);
  const delta = db.agentFloatIchancyMinor - db.agentFloatLedgerMinor;
  db.agentFloatLedgerMinor = db.agentFloatIchancyMinor;

  if (found !== undefined) {
    found.status = 'RESOLVED';
    found.resolvedAt = nowIso();
    found.resolvedByAdminId = db.currentAdmin.id;
    found.resolutionNote = note;
    found.resolutionTxId = nextId('66666666');
  }

  return { ledgerTransactionId: found?.resolutionTxId ?? nextId('66666666'), deltaMinor: delta.toString() };
}

export { nextId };
