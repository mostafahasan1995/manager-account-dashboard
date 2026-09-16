import { config } from '@/config';
import { formatMinorToDecimal, minorFromString, parseDecimalToMinor } from '@/lib/money';
import type {
  AdminDeposit,
  AdminIdentity,
  AdminPlayer,
  AdminUser,
  AdminWithdrawal,
  ApprovalLimit,
  BotMenuButton,
  BotMenuGate,
  BotMenuNode,
  BotSettings,
  BuiltinAction,
  DepositStatus,
  IchancyAccount,
  ManualCredit,
  PaymentDestination,
  PaymentMethod,
  PlayerDebit,
  PlayerDebitStatus,
  PlayerImportSummary,
  ReconciliationBreak,
  BoundChatHealth,
  StaffTelegramLinkCode,
  TelegramBindLink,
  TelegramChatPurpose,
  Tenant,
  TenantChatRejectionReason,
  TenantDiscoveredChat,
  TenantFinanceRow,
  TenantProvisioning,
  TenantHealth,
  TenantWebhook,
  DiscoveredChat,
  TelegramDestination,
  WalletCheck,
} from '@/types';

import {
  MOCK_CURRENCY,
  MOCK_DEBIT_TIMEOUT_PLAYER_ID,
  REQUIRED_BUILTIN_ACTIONS,
  TENANT_IDS,
  mockAdmins,
  mockApprovalLimits,
  mockBotMenuGate,
  mockBotMenuNodes,
  mockBreaks,
  mockBuiltinActions,
  mockDeposits,
  mockDestinations,
  mockPaymentMethods,
  mockPlatformDefaults,
  mockPlayerBalances,
  mockPlayers,
  mockRailAgeing,
  mockTenantFinance,
  mockLoadedUsdt,
  mockShamCashOk,
  mockTenants,
  mockTenantChats,
  mockDiscoveredChats,
  mockTelegramDestinations,
  mockWithdrawals,
  type MockTenantChat,
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
/**
 * A fresh id. The PREFIX must not be one the fixtures already number from 1 — `bbbbbbbb`,
 * `88888888`, `99990000` — or the first row created in a test lands on a fixture's id, and a
 * lookup by id answers the wrong row while everything looks fine.
 */
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
   * Where Telegram currently delivers, or null when it has never been told.
   *
   * A new operator is no longer created in that state: `createTenant` registers the webhook, as
   * `TenantService.provision()` does. Null now means somebody removed it, or an operator that
   * predates provisioning — both real, and both worth being able to see.
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
  /**
   * Player cash-outs. Stateful like deposits: approving one really debits the player's balance and
   * moves the float, and marking one paid really closes it — the E2E suite asserts the workflow.
   */
  withdrawals: AdminWithdrawal[];
  /**
   * The bot's menu: screens, buttons and the channel gate, exactly as `GET /v1/admin/bot-menu`
   * answers them. Stateful so the flow editor's writes are visible on the next read.
   */
  botMenu: { nodes: BotMenuNode[]; builtinActions: BuiltinAction[]; gate: BotMenuGate };
  /**
   * Whether Telegram's chat menu button was pointed at the mini app. Set alongside the URL (a
   * best-effort `setChatMenuButton` on the real backend) and cleared with it.
   */
  chatMenuButtonSet: boolean;
  methods: PaymentMethod[];
  destinations: PaymentDestination[];
  deposits: AdminDeposit[];
  breaks: ReconciliationBreak[];
  tenants: Tenant[];
  /**
   * The platform finance overview, one row per operator. Stateful on purpose: a refresh really
   * flips a row's `not_loaded` USDT and Sham Cash to loaded/ok, so the next cheap overview read
   * shows the freshened figures — the exact round trip the console's refresh controls drive.
   */
  finance: TenantFinanceRow[];
  /** Per-operator webhook and agent state: everything `GET /health` reports, keyed by tenant id. */
  operatorOps: Record<string, MockOperatorOps>;
  railAgeing: typeof mockRailAgeing;
  /**
   * The one settings row every tenant-creation default is resolved from. Read it through
   * `platformDefaults()` rather than reaching in here, so there is a single place to change when
   * the backend adds a defaulted field.
   */
  platformDefaults: PlatformDefaults;
  /** Null until somebody prices the crypto rail, which is where every operator starts. */
  usdtRate: MockExchangeRate | null;
  /** When that row was last written, so the screen can tell an edit from the seed. */
  platformDefaultsUpdatedAt: string;
  /** The Sham Cash API credentials. The KEY is never stored here, exactly as it is never returned. */
  shamCashSession: { apiLinked: boolean; walletId: string | null };
  /** The admin the mock session belongs to. Switchable so tests can log in as any role. */
  currentAdmin: AdminIdentity;
  /**
   * Where the operator's bot publishes. Stateful, because the whole point of the screen is that a
   * test message and a publish WRITE freshness back onto the row — a fixture that never changed
   * would let the console claim a destination is healthy without anything having checked.
   */
  telegramDestinations: TelegramDestination[];
  /**
   * The chats the bot has been added to. Stateful for the same reason: binding one changes its
   * `alreadyBound`, and a fixture frozen at load time would keep offering a group that is already
   * configured.
   */
  discoveredChats: DiscoveredChat[];
  /**
   * The deployment's ICHANCY_FAKE. False in every fixture; a test flips it to see each screen say
   * "fake mode" instead of reporting a made-up answer as a real one.
   */
  ichancyFake: boolean;
  /** Each operator's OWN chat directory, keyed by tenant id — the staff and feed group picker. */
  tenantChats: Record<string, MockTenantChat[]>;
  /**
   * The live "Add bot to group" link per operator and purpose. Only the latest one works, exactly as
   * issuing a new link revokes the previous one on the backend.
   */
  bindLinks: Record<
    string,
    Partial<Record<TelegramChatPurpose, { nonce: string; expiresAt: string }>>
  >;
  /** The live one-time Telegram link code per staff account. Only the latest one works. */
  staffLinkCodes: Record<string, { code: string; expiresAt: string }>;
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
    withdrawals: clone(mockWithdrawals),
    botMenu: {
      nodes: clone(mockBotMenuNodes),
      builtinActions: clone(mockBuiltinActions),
      gate: clone(mockBotMenuGate),
    },
    chatMenuButtonSet: false,
    methods: clone(mockPaymentMethods),
    destinations: clone(mockDestinations),
    deposits: clone(mockDeposits),
    breaks: clone(mockBreaks),
    tenants: clone(mockTenants),
    finance: mockTenantFinance(),
    operatorOps: seedOperatorOps(),
    railAgeing: clone(mockRailAgeing),
    // Seeded once, exactly as the backend seeds the settings row from env on first run.
    platformDefaults: clone(mockPlatformDefaults),
    usdtRate: null,
    platformDefaultsUpdatedAt: '2026-08-01T00:00:00.000Z',
    shamCashSession: { apiLinked: false, walletId: null },
    currentAdmin: {
      id: superAdmin.id,
      telegramUserId: superAdmin.telegramUserId,
      role: superAdmin.role,
      displayName: superAdmin.displayName,
    },
    telegramDestinations: clone(mockTelegramDestinations),
    discoveredChats: clone(mockDiscoveredChats),
    ichancyFake: false,
    tenantChats: clone(mockTenantChats),
    bindLinks: {},
    staffLinkCodes: {},
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

  if (
    deposit.status !== 'PENDING_SECOND_APPROVAL' &&
    verifiedMinor > dualApprovalThresholdMinor()
  ) {
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

/**
 * A manual credit, recorded as a manual deposit. The real thing is ASYNC — the deposit is approved
 * and the credit worker tops the player up seconds later — but this synchronous mock collapses that
 * to one step so a dev sees the effect: the float pays (it drops) and the player's balance rises,
 * exactly the opposite of `debitPlayer` and exactly what the ledger posting says. `status` is still
 * 'APPROVED' ("queued"), honest about the real timing.
 */
/**
 * Above this, a manual credit is routed to a second approver instead of crediting now — a demo stand-in
 * for the tenant's real dualApprovalThreshold, so the console's PENDING_SECOND_APPROVAL branch is
 * exercised rather than dead. 1,000,000.00 NSP.
 */
const MANUAL_CREDIT_SECOND_APPROVAL_MINOR = 100_000_000n;

export function manualCredit(player: AdminPlayer, amountMinor: bigint): ManualCredit {
  const amount = {
    minor: amountMinor.toString(),
    amount: formatMinorToDecimal(amountMinor),
    currency: player.currencyCode,
  };
  const shortId = `MC${nextId('x').slice(-6)}`;

  // A large credit waits for a second, different approver — the same four-eyes the real approve path
  // applies. It is NOT credited yet, so nothing moves here.
  if (amountMinor >= MANUAL_CREDIT_SECOND_APPROVAL_MINOR) {
    return {
      shortId,
      status: 'PENDING_SECOND_APPROVAL',
      amount,
      outcome: 'awaiting_second_approval',
    };
  }

  const before = playerBalanceMinor(player.id) ?? 0n;
  db.playerBalances[player.id] = (before + amountMinor).toString();
  db.agentFloatLedgerMinor -= amountMinor;
  db.agentFloatIchancyMinor -= amountMinor;

  return { shortId, status: 'APPROVED', amount, outcome: 'approved' };
}

// ── Registering, linking, blocking and importing players ───────────────────────────────────────

/** The home operator's row — the one the tenant-scoped player and bot routes act on. */
export function homeTenant(): Tenant | undefined {
  return db.tenants.find((row) => row.id === TENANT_IDS.zero) ?? db.tenants[0];
}

/**
 * Links a player to a fresh Ichancy account, as `ensureLinked` does.
 *
 * Idempotent: an already-linked row answers `created: false`. The login is derived from the Telegram
 * id when there is one and from the row id otherwise — the backend's `pa` + hash rule for rows that
 * were never a Telegram account — and the balance ledger starts an account at zero, which is a real
 * figure and not the same as the "no account" absence the debit route refuses on.
 */
export function linkIchancyAccount(player: AdminPlayer): IchancyAccount {
  const alreadyLinked = player.ichancyLinked;
  if (!alreadyLinked) {
    player.ichancyLinked = true;
    player.ichancyPlayerId = String(90_000 + db.players.indexOf(player));
    player.ichancyLogin =
      player.telegramUserId === null
        ? `pa${player.id.replace(/\D/g, '').slice(-8)}`
        : `tg${player.telegramUserId}`;
    player.ichancyRegisteredAt = nowIso();
    if (player.status === 'PENDING_ICHANCY') player.status = 'ACTIVE';
    db.playerBalances[player.id] ??= '0';
  }

  return {
    playerId: player.id,
    ichancyPlayerId: player.ichancyPlayerId ?? '0',
    ichancyLogin: player.ichancyLogin ?? '',
    created: !alreadyLinked,
    agentId: homeTenant()?.ichancyAgentId ?? '10045',
  };
}

/**
 * `POST /v1/admin/players`: a row registered from the console. Lands PENDING_ICHANCY with no
 * account, exactly as a Telegram Start does; the handler links it afterwards when asked to.
 */
export function registerPlayer(body: {
  telegramUserId: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
}): AdminPlayer {
  const player: AdminPlayer = {
    id: nextId('bbbbbbb1'),
    telegramUserId: body.telegramUserId,
    telegramUsername: null,
    firstName: body.firstName,
    lastName: body.lastName,
    languageCode: null,
    status: 'PENDING_ICHANCY',
    source: 'ADMIN',
    currencyCode: homeTenant()?.currencyCode ?? MOCK_CURRENCY,
    ichancyLinked: false,
    createdAt: nowIso(),
    lastSeenAt: null,
    ichancyPlayerId: null,
    ichancyLogin: null,
    ichancyRegisteredAt: null,
    phone: body.phone,
    blockedAt: null,
    blockedReason: null,
    blockedByAdminId: null,
  };
  db.players.push(player);
  return player;
}

/** The operator's lock. The three columns move together — see `adminPlayerSchema`. */
export function blockPlayer(player: AdminPlayer, reason: string): void {
  player.status = 'BLOCKED';
  player.blockedAt = nowIso();
  player.blockedReason = reason;
  player.blockedByAdminId = db.currentAdmin.id;
}

/** Lifting it: ACTIVE when there is an account to go back to, PENDING_ICHANCY when there is not. */
export function unblockPlayer(player: AdminPlayer): void {
  player.status = player.ichancyLinked ? 'ACTIVE' : 'PENDING_ICHANCY';
  player.blockedAt = null;
  player.blockedReason = null;
  player.blockedByAdminId = null;
}

/**
 * What the Ichancy agent would list for the home operator: the players already known by login,
 * plus one it has never told us about. Scanning is one page here; the real thing pages 100 at a
 * time, and the summary shape is the same.
 */
const AGENT_PLAYERS_NOT_YET_IMPORTED: readonly {
  ichancyPlayerId: string;
  login: string;
  phone: string | null;
}[] = [{ ichancyPlayerId: '98077', login: 'rami_2020', phone: '+963900000077' }];

/**
 * `POST /v1/admin/players/import` for the home operator. Idempotent: a second run finds every row
 * `existing` and creates nothing, which is what makes the button safe to press twice.
 */
export function importPlayers(limit: number): PlayerImportSummary {
  const startedAt = nowIso();
  const known = db.players.filter((row) => row.ichancyLogin !== null && row.ichancyLinked);
  const candidates = [
    ...known.map((row) => ({
      ichancyPlayerId: row.ichancyPlayerId ?? '',
      login: row.ichancyLogin ?? '',
      phone: row.phone ?? null,
    })),
    ...AGENT_PLAYERS_NOT_YET_IMPORTED,
  ].slice(0, Math.max(limit, 0));

  let created = 0;
  let existing = 0;
  for (const candidate of candidates) {
    const seen = db.players.some(
      (row) =>
        row.ichancyLogin === candidate.login || row.ichancyPlayerId === candidate.ichancyPlayerId,
    );
    if (seen) {
      existing += 1;
      continue;
    }
    const player: AdminPlayer = {
      id: nextId('bbbbbbb1'),
      telegramUserId: null,
      telegramUsername: null,
      firstName: null,
      lastName: null,
      languageCode: null,
      status: 'ACTIVE',
      source: 'ICHANCY_IMPORT',
      currencyCode: homeTenant()?.currencyCode ?? MOCK_CURRENCY,
      ichancyLinked: true,
      createdAt: nowIso(),
      lastSeenAt: null,
      ichancyPlayerId: candidate.ichancyPlayerId,
      ichancyLogin: candidate.login,
      ichancyRegisteredAt: nowIso(),
      phone: candidate.phone,
      blockedAt: null,
      blockedReason: null,
      blockedByAdminId: null,
    };
    db.players.push(player);
    db.playerBalances[player.id] = '0';
    created += 1;
  }

  const tenant = homeTenant();
  if (tenant?.counts !== undefined) tenant.counts.players += created;

  return {
    scanned: candidates.length,
    created,
    existing,
    error: null,
    startedAt,
    finishedAt: nowIso(),
  };
}

/**
 * `POST /v1/admin/tenants/:id/import-players`, from the platform side.
 *
 * Tenant zero never reaches here: it has no Ichancy agent and the route refuses it (see the handler).
 * An operator's directory is served as a slice of the same rows (see `forTenant` in handlers.ts), so
 * its import only moves the count — and an operator whose agent does not answer REPORTS that in
 * `error` rather than throwing, which is the contract: the rows written before an outage stay
 * written, and the summary says how far it got.
 */
export function importPlayersForTenant(tenant: Tenant): PlayerImportSummary {
  // The platform route always says which mode answered; the operator-side route does not.
  const ichancyFake = db.ichancyFake;

  const startedAt = nowIso();
  const ops = operatorOps(tenant.id);
  if (ops.ichancyError !== null && !ichancyFake) {
    return {
      scanned: 0,
      created: 0,
      existing: 0,
      error: ops.ichancyError,
      startedAt,
      finishedAt: nowIso(),
      ichancyFake,
    };
  }

  const created = 2;
  if (tenant.counts !== undefined) tenant.counts.players += created;
  return {
    scanned: 3,
    created,
    existing: 1,
    error: null,
    startedAt,
    finishedAt: nowIso(),
    ichancyFake,
  };
}

// ── Withdrawals (player cash-out) ──────────────────────────────────────────────────────────────

export function findWithdrawal(id: string): AdminWithdrawal | undefined {
  return db.withdrawals.find((row) => row.id === id);
}

/**
 * What the payout wallet holds, asked the way the worker asks: the rail decides WHICH wallet, and
 * the answer is one of four — a figure that covers it, a figure that does not, a wallet nobody can
 * read, or no wallet at all. Never a zero standing in for silence.
 */
function payoutWalletCheck(withdrawal: AdminWithdrawal): WalletCheck {
  const checkedAt = nowIso();
  const method = db.methods.find((row) => row.id === withdrawal.paymentMethodId);
  const destination = db.destinations
    .filter((row) => row.paymentMethodId === withdrawal.paymentMethodId && row.isActive)
    .sort((a, b) => a.priority - b.priority)[0];

  if (method?.rail === 'CRYPTO') {
    // A placeholder address is not a wallet, and a rail nobody configured cannot be checked.
    if (destination === undefined || destination.accountIdentifier.startsWith('SEED-PLACEHOLDER')) {
      return { status: 'not_configured', availableMinor: null, currency: null, checkedAt };
    }
    return { status: 'ok', availableMinor: '12500000000', currency: 'USDT', checkedAt };
  }

  if (method?.code === 'SHAM_CASH') {
    return db.shamCashSession.apiLinked
      ? { status: 'ok', availableMinor: '25000000', currency: 'SYP', checkedAt }
      : { status: 'not_configured', availableMinor: null, currency: null, checkedAt };
  }

  // A bank or a cash office: only a hand-typed balance can say anything, and it says it in its
  // own currency — compared as minor units because that is the only figure either side holds.
  if (destination?.declaredBalanceMinor != null && destination.declaredBalanceCurrency !== null) {
    const covers =
      minorFromString(destination.declaredBalanceMinor) >= minorFromString(withdrawal.amount.minor);
    return {
      status: covers ? 'ok' : 'insufficient',
      availableMinor: destination.declaredBalanceMinor,
      currency: destination.declaredBalanceCurrency,
      checkedAt,
    };
  }

  return { status: 'unknown', availableMinor: null, currency: null, checkedAt };
}

/**
 * Approving, collapsed to what the worker does seconds later — exactly as `manualCredit` collapses
 * the credit spine — so a demo sees the effect: the player's balance drops, the float rises (the
 * chips came back to the agent, the same posting as a manual debit), and the payout wallet is
 * checked. The real row passes through APPROVED and DEBITING first; the mock lands on the ending.
 *
 * The ending is not always DEBITED. A player who spent the money between asking and being approved
 * is refused by Ichancy, and that is `DEBIT_FAILED` with the code the backend uses — a row nobody
 * was paid on and nobody was charged for, closed rather than retried.
 */
export function approveWithdrawal(withdrawal: AdminWithdrawal): AdminWithdrawal {
  const now = nowIso();
  withdrawal.decidedAt = now;
  withdrawal.decidedByAdminId = db.currentAdmin.id;

  const amount = minorFromString(withdrawal.amount.minor);
  const before = playerBalanceMinor(withdrawal.playerId);

  if (before === null || before < amount) {
    withdrawal.status = 'DEBIT_FAILED';
    withdrawal.failureCode = 'WITHDRAWAL_INSUFFICIENT_BALANCE';
    withdrawal.failureMessage =
      before === null
        ? 'The player has no Ichancy account to debit.'
        : `Ichancy refused the debit: the account holds ${formatMinorToDecimal(before)} ${withdrawal.amount.currency}, less than the ${withdrawal.amount.amount} asked for.`;
    withdrawal.closedAt = now;
    return withdrawal;
  }

  db.playerBalances[withdrawal.playerId] = (before - amount).toString();
  db.agentFloatLedgerMinor += amount;
  db.agentFloatIchancyMinor += amount;

  withdrawal.status = 'DEBITED';
  withdrawal.playerDebitId = nextId('77777771');
  withdrawal.debitedAt = now;
  withdrawal.walletCheck = payoutWalletCheck(withdrawal);
  return withdrawal;
}

/** REQUESTED → REJECTED. Nothing was taken, so nothing moves. */
export function rejectWithdrawal(withdrawal: AdminWithdrawal, reason: string): AdminWithdrawal {
  const now = nowIso();
  withdrawal.status = 'REJECTED';
  withdrawal.rejectionReason = reason;
  withdrawal.decidedAt = now;
  withdrawal.decidedByAdminId = db.currentAdmin.id;
  withdrawal.closedAt = now;
  return withdrawal;
}

/** DEBITED → PAID. The payout is posted to the ledger against the reference the person typed. */
export function markWithdrawalPaid(
  withdrawal: AdminWithdrawal,
  payoutReference: string,
): AdminWithdrawal {
  const now = nowIso();
  withdrawal.status = 'PAID';
  withdrawal.payoutReference = payoutReference;
  withdrawal.ledgerPayoutTxId = nextId('66666666');
  withdrawal.paidAt = now;
  withdrawal.paidByAdminId = db.currentAdmin.id;
  withdrawal.closedAt = now;
  return withdrawal;
}

// ── The bot's menu and its settings ────────────────────────────────────────────────────────────

export function findMenuNode(id: string): BotMenuNode | undefined {
  return db.botMenu.nodes.find((node) => node.id === id);
}

export function findMenuButton(
  id: string,
): { node: BotMenuNode; button: BotMenuButton } | undefined {
  for (const node of db.botMenu.nodes) {
    const button = node.buttons.find((row) => row.id === id);
    if (button !== undefined) return { node, button };
  }
  return undefined;
}

/**
 * The rule `deleteButton`, `updateButton({ isActive: false })` and `deleteNode` all share on the
 * backend: a bot must keep at least one ACTIVE button for each required action. `except` names the
 * buttons about to be removed or hidden, so the check asks "would any remain" rather than "do any
 * exist".
 */
export function requiredActionLeftWithout(except: readonly string[]): string | null {
  for (const action of REQUIRED_BUILTIN_ACTIONS) {
    const remaining = db.botMenu.nodes.some((node) =>
      node.buttons.some(
        (button) =>
          button.kind === 'BUILTIN' &&
          button.builtinAction === action &&
          button.isActive &&
          !except.includes(button.id),
      ),
    );
    if (!remaining) return action;
  }
  return null;
}

export function createMenuNode(body: Record<string, unknown>): BotMenuNode {
  const node: BotMenuNode = {
    id: nextId('88888881'),
    key: str(body.key, `screen-${String(db.botMenu.nodes.length + 1)}`),
    name: str(body.name, 'New screen'),
    promptText: optionalStr(body.promptText),
    isRoot: false,
    buttons: [],
  };
  db.botMenu.nodes.push(node);
  return node;
}

/** Answers the screen another button still opens, or null when the node may go. */
export function menuNodeStillLinkedFrom(nodeId: string): BotMenuNode | null {
  return (
    db.botMenu.nodes.find((node) =>
      node.buttons.some((button) => button.kind === 'NAVIGATE' && button.targetNodeId === nodeId),
    ) ?? null
  );
}

export function deleteMenuNode(node: BotMenuNode): void {
  db.botMenu.nodes = db.botMenu.nodes.filter((row) => row.id !== node.id);
}

/**
 * Exactly one payload column per kind, as the CHECK constraint insists: the other two are nulled on
 * every write, whatever the caller sent.
 */
function buttonPayload(kind: BotMenuButton['kind'], body: Record<string, unknown>) {
  return {
    builtinAction: kind === 'BUILTIN' ? optionalStr(body.builtinAction) : null,
    targetNodeId: kind === 'NAVIGATE' ? optionalStr(body.targetNodeId) : null,
    bodyText: kind === 'TEXT' ? optionalStr(body.bodyText) : null,
  };
}

export function createMenuButton(node: BotMenuNode, body: Record<string, unknown>): BotMenuButton {
  const kind = (body.kind ?? 'BUILTIN') as BotMenuButton['kind'];
  const lastRow = node.buttons.reduce((max, button) => Math.max(max, button.rowIndex), -1);
  const button: BotMenuButton = {
    id: nextId('99990001'),
    nodeId: node.id,
    label: str(body.label, 'New button'),
    kind,
    ...buttonPayload(kind, body),
    rowIndex: num(body.rowIndex, lastRow + 1),
    sortOrder: num(body.sortOrder, 0),
    isActive: bool(body.isActive, true),
  };
  node.buttons.push(button);
  return button;
}

export function updateMenuButton(button: BotMenuButton, body: Record<string, unknown>): void {
  const kind = (body.kind ?? button.kind) as BotMenuButton['kind'];
  const payload = buttonPayload(kind, {
    builtinAction: body.builtinAction ?? button.builtinAction,
    targetNodeId: body.targetNodeId ?? button.targetNodeId,
    bodyText: body.bodyText ?? button.bodyText,
  });
  button.kind = kind;
  button.builtinAction = payload.builtinAction;
  button.targetNodeId = payload.targetNodeId;
  button.bodyText = payload.bodyText;
  button.label = str(body.label, button.label);
  button.rowIndex = num(body.rowIndex, button.rowIndex);
  button.sortOrder = num(body.sortOrder, button.sortOrder);
  button.isActive = bool(body.isActive, button.isActive);
}

export function deleteMenuButton(node: BotMenuNode, button: BotMenuButton): void {
  node.buttons = node.buttons.filter((row) => row.id !== button.id);
}

/** The whole layout in one write, as the backend applies it in one transaction. */
export function reorderMenuButtons(
  node: BotMenuNode,
  positions: readonly { id: string; rowIndex: number; sortOrder: number }[],
): void {
  for (const position of positions) {
    const button = node.buttons.find((row) => row.id === position.id);
    if (button === undefined) continue;
    button.rowIndex = position.rowIndex;
    button.sortOrder = position.sortOrder;
  }
  node.buttons.sort((a, b) => a.rowIndex - b.rowIndex || a.sortOrder - b.sortOrder);
}

/**
 * The bot's runtime settings live on the HOME tenant's row, so the tenants screen and the bot
 * settings card cannot disagree: a PATCH here is a PATCH there. `chatMenuButtonSet` is the one
 * fact the tenant row does not carry.
 */
export function botSettingsView(): BotSettings {
  const tenant = homeTenant();
  return {
    miniAppUrl: tenant?.miniAppUrl ?? null,
    depositMode: tenant?.depositMode ?? 'MANUAL',
    withdrawalMode: tenant?.withdrawalMode ?? 'MANUAL',
    chatMenuButtonSet: db.chatMenuButtonSet,
  };
}

export function updateBotSettings(body: {
  miniAppUrl?: string | null;
  depositMode?: BotSettings['depositMode'];
  withdrawalMode?: BotSettings['withdrawalMode'];
}): BotSettings {
  const tenant = homeTenant();
  if (tenant !== undefined) {
    if (body.depositMode !== undefined) tenant.depositMode = body.depositMode;
    if (body.withdrawalMode !== undefined) tenant.withdrawalMode = body.withdrawalMode;
    if (body.miniAppUrl !== undefined) {
      tenant.miniAppUrl = body.miniAppUrl;
      // Best-effort on the real backend; always succeeds here, and clears with the URL.
      db.chatMenuButtonSet = body.miniAppUrl !== null;
    }
    tenant.updatedAt = nowIso();
  }
  return botSettingsView();
}

// ── Payment methods ────────────────────────────────────────────────────────────────────────────

export function createMethod(body: Record<string, unknown>): PaymentMethod {
  const method: PaymentMethod = {
    id: nextId('cccccccc'),
    code: str(body.code, 'NEW_METHOD'),
    displayName: str(body.displayName, 'New method'),
    rail: (body.rail ?? 'BANK_TRANSFER') as PaymentMethod['rail'],
    currencyCode: str(body.currencyCode, MOCK_CURRENCY),
    verificationMode: (body.verificationMode ??
      'MANUAL_PROOF') as PaymentMethod['verificationMode'],
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
    // A rail created just now has taken nothing, so it is always removable — which is exactly the
    // state the real backend reports for it, and the state that makes a mis-click undoable.
    deletable: true,
    deleteBlockedBy: null,
  };
  db.methods.push(method);
  return method;
}

/**
 * Really remove a method, the way `DELETE /payment-methods/:id/permanent` does.
 *
 * Returns null when the fixture is marked undeletable, so the mock refuses on the same grounds the
 * server does rather than letting a test delete a rail the real system would protect.
 */
export function deleteMethod(id: string): PaymentMethod | null {
  const index = db.methods.findIndex((method) => method.id === id);
  if (index === -1) return null;

  const method = db.methods[index];
  if (method?.deletable !== true) return null;

  db.methods.splice(index, 1);
  db.destinations = db.destinations.filter(
    (destination) => destination.paymentMethodId !== method.id,
  );
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
    declaredBalance: null,
    declaredBalanceMinor: null,
    declaredBalanceCurrency: null,
    declaredBalanceUpdatedAt: null,
    declaredBalanceSetByAdminId: null,
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
    // Always null: a staff account is a username and a password. The real server writes the column
    // as null here too and refuses a telegramUserId in the body outright.
    telegramUserId: null,
    // Nothing is linked until the person sends a link code to the bot.
    telegramLinked: false,
    // Lower-cased like the server does, so the mock cannot accept a pair of usernames the real
    // unique index would treat as one.
    username: optionalStr(body.username)?.toLowerCase() ?? null,
    hasPassword: typeof body.password === 'string' && body.password.length > 0,
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
export function createTenant(body: Record<string, unknown>): {
  tenant: Tenant;
  provisioning: TenantProvisioning;
} {
  const defaults = platformDefaults();
  const displayName = str(body.displayName, 'New tenant');

  const tenant: Tenant = {
    id: nextId('11111111'),
    slug: optionalStr(body.slug) ?? uniqueSlug(slugify(displayName)),
    displayName,
    // Always SUSPENDED: the agent id cannot be verified from a form.
    status: 'SUSPENDED',
    hasWebhookPath: true,
    // NO default since 2026-09-15: absent is "no staff group yet", and the operator stays suspended
    // until one is bound. The real backend verifies a named chat with Telegram first; a brand-new
    // operator has no chat directory in this mock to verify against, so a typed id is taken as given.
    adminChatId: optionalStr(body.adminChatId),
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
    ichancyFake: db.ichancyFake,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    counts: { players: 0, deposits: 0 },
  };
  db.tenants.push(tenant);

  /*
   * The provisioning report, mirroring `TenantService.provision()`: the backend registers the
   * webhook, pushes the command menus and provisions the default payment rails on create, and says
   * how each went.
   *
   * ACTIVATION IS THE ONE STEP THIS MOCK HONESTLY CANNOT DO. The real one activates only after a
   * live Ichancy signin proves the agent credentials, and there is no Ichancy here — so the
   * operator stays SUSPENDED and the report says why, rather than claiming a verification that
   * never happened. That is also the more useful demo: it is the arm an operator actually hits when
   * a password was pasted wrong.
   */
  // The real create tells Telegram where to deliver; `registerWebhook` is that same step.
  const webhook = registerWebhook(tenant.id);
  tenant.botUsername = `${tenant.slug.replace(/-/g, '_')}_bot`;

  const provisioning: TenantProvisioning = {
    webhookRegistered: webhook.registered,
    webhookUrl: webhook.url,
    webhookError: null,
    menusPushed: true,
    menuScopes: ['default', 'all_private_chats'],
    menuError: null,
    activated: false,
    // The staff group is checked before any sign-in, exactly as the backend orders it — so a create
    // that named no group reports THAT, which is the console's ordinary create.
    activationError:
      tenant.adminChatId === null
        ? STAFF_GROUP_REQUIRED_MESSAGE
        : 'The mock API cannot sign in to Ichancy, so the agent was not verified. Activate the operator once its credentials are real.',
    paymentMethodsCreated: DEFAULT_RAIL_COUNT,
    paymentMethodsError: null,
    // Every seeded rail points at a placeholder until somebody enters a real account.
    paymentMethodsNeedAccounts: true,
    // The import runs only after activation succeeded, and activation cannot here — so it did not
    // run, and the report says so rather than claiming zero old players were found.
    playersImported: 0,
    playersImportError:
      'Players were not imported: the operator was not activated. Import them from the operator once it is.',
    ichancyFake: db.ichancyFake,
  };

  return { tenant, provisioning };
}

/** How many rails `provisionDefaultPaymentMethods` seeds: bank, e-wallet, Sham Cash, Syriatel. */
const DEFAULT_RAIL_COUNT = 4;

/**
 * Every TenantView the mock answers goes through here, so the deployment-wide `ichancyFake` a test
 * flips reaches every operator at once — as it does on the backend, where it is not stored per row.
 */
export const tenantView = (tenant: Tenant): Tenant => ({ ...tenant, ichancyFake: db.ichancyFake });

// ── Staff and feed groups ──────────────────────────────────────────────────────────────────────

/** The backend's sentence, verbatim (tenant-admin.constants.ts STAFF_GROUP_REQUIRED_MESSAGE). */
export const STAFF_GROUP_REQUIRED_MESSAGE =
  "This operator has no staff group yet, so it cannot be activated: its deposit review cards and alerts would go nowhere. Add its bot to the staff group from the operator's page, then activate it. The operator stays suspended.";

/** The backend's refusal of removing an ACTIVE operator's staff group, verbatim. */
export const STAFF_GROUP_REMOVAL_REFUSED_MESSAGE =
  'This operator is active, and an active operator must always have a staff group. Bind another group instead, or suspend the operator before removing this one.';

/** The backend's refusal of any group link, bind or removal on tenant zero, verbatim. */
export const TENANT_PLATFORM_LOCKED_MESSAGE =
  'Tenant zero is the platform itself, not an operator, and has no staff or feed group.';

/** The backend's refusal to suspend tenant zero, verbatim (tenant-admin.service.ts). */
export const PLATFORM_SUSPEND_LOCKED_MESSAGE =
  'Tenant zero is the platform itself, not an operator. Suspending it would lock every platform admin out of sign-in, so it cannot be suspended.';

/** The backend's refusal to replace tenant zero's bot token, verbatim (tenant-telegram.service.ts). */
export const PLATFORM_BOT_LOCKED_MESSAGE =
  'Tenant zero is the platform itself, not an operator, and has no Telegram bot to replace.';

/** The backend's refusal of an Ichancy edit or import on tenant zero, verbatim. */
export const PLATFORM_HAS_NO_AGENT_MESSAGE =
  'Tenant zero is the platform, not an operator: it has no Ichancy agent.';

/** The backend's PLATFORM refusal of a link code while working in tenant zero, verbatim. */
export const PLATFORM_LINK_MESSAGE =
  'The platform itself has no bot, so its accounts cannot be linked to Telegram. Link a staff account of an operator instead.';

/**
 * What the webhook and command-menu routes answer for tenant zero.
 *
 * NOT a TENANT_PLATFORM_LOCKED: those routes have no id check at all. They go through the operator's
 * bot, and tenant zero's stored token is a placeholder, so the registry refuses to build a bot and
 * `telegramFailure` maps that to 422 TENANT_BOT_UNAVAILABLE — proved for `POST /:id/webhook` in the
 * backend's tenant-provisioning.int.spec.ts. The sentence is the shape telegram-failure.ts builds:
 * "This operator's bot cannot be used to <action>: <why>", with the registry's own reason.
 */
export const platformBotUnavailableMessage = (action: string): string =>
  `This operator's bot cannot be used to ${action}: the bot token of the platform tenant has not been set; set it from the dashboard`;

/** The backend's AGENT_PRINCIPAL refusal of a link code or an unlink, verbatim. */
export const AGENT_PRINCIPAL_LINK_MESSAGE =
  "This is the operator's agent account, which cannot be linked to Telegram. Create a staff account for the person and link that.";

/** The backend's fake-mode sentence, verbatim (ICHANCY_FAKE_MODE_MESSAGE). */
export const ICHANCY_FAKE_MODE_MESSAGE =
  'Ichancy is in fake mode (ICHANCY_FAKE=true): no real connection was made.';

/** The rights the link asks for, in Telegram's `admin=` syntax (telegram-chat.constants.ts). */
export const BIND_ADMIN_RIGHTS = [
  'post_messages',
  'delete_messages',
  'pin_messages',
  'manage_chat',
] as const;

const BIND_LINK_TTL_MINUTES = 15;
const STAFF_LINK_CODE_TTL_SECONDS = 600;

/** The backend's sentence per reason (chat-binding.errors.ts), each followed by "Nothing was saved." */
const CHAT_REJECTION_SENTENCES: Record<TenantChatRejectionReason, string> = {
  NOT_FOUND:
    'Telegram does not know this chat, or will not show it to this bot. Add the bot to the group first.',
  PRIVATE_CHAT: 'This is a one-to-one chat. A staff or feed group must be a group.',
  CHANNEL_NOT_ALLOWED:
    'This is a channel. A staff or feed group must be a group, where staff can tap the review buttons.',
  BOT_NOT_MEMBER: 'The bot is not a member of this group. Add it to the group, then try again.',
  BOT_NOT_ADMIN:
    'The bot is in this group but is not an administrator. Make it an administrator, then try again.',
  BOT_CANNOT_POST:
    'The bot is not allowed to send messages in this group. Allow it to post, then try again.',
};

export const chatRejectionMessage = (reason: TenantChatRejectionReason): string =>
  `${CHAT_REJECTION_SENTENCES[reason]} Nothing was saved.`;

const chatFieldOf = (purpose: TelegramChatPurpose): 'adminChatId' | 'feedChatId' =>
  purpose === 'STAFF' ? 'adminChatId' : 'feedChatId';

/** One operator's directory as the API answers it: `boundAs` computed from the row, never stored. */
export function tenantChatsView(tenant: Tenant): TenantDiscoveredChat[] {
  return (db.tenantChats[tenant.id] ?? []).map((row) => {
    const boundAs: TelegramChatPurpose[] = [
      ...(tenant.adminChatId === row.chatId ? (['STAFF'] as const) : []),
      ...(tenant.feedChatId === row.chatId ? (['FEED'] as const) : []),
    ];
    return { ...row, boundAs, alreadyBound: boundAs.length > 0 };
  });
}

export type MockChatVerdict =
  { ok: true; chatId: string } | { ok: false; reason: TenantChatRejectionReason; chatId: string };

/**
 * What Telegram would say about binding `chatId` for this operator, asked the way the backend asks:
 * a positive id is a person; a group that became a supergroup is checked at its NEW id; then the
 * chat type, membership, administrator status and the right to post, as separate facts.
 *
 * The directory stands in for Telegram here, which is the one liberty taken: the backend asks
 * Telegram at that moment and never trusts a sighting. A row the directory has never seen is
 * NOT_FOUND, which is also what Telegram answers for a group the bot was never added to.
 */
export function verifyTenantChat(tenantId: string, chatId: string): MockChatVerdict {
  if (!chatId.startsWith('-')) return { ok: false, reason: 'PRIVATE_CHAT', chatId };

  const rows = db.tenantChats[tenantId] ?? [];
  let row = rows.find((candidate) => candidate.chatId === chatId);
  if (row?.migratedToChatId != null) {
    const movedTo = row.migratedToChatId;
    row = rows.find((candidate) => candidate.chatId === movedTo);
    if (row === undefined) return { ok: false, reason: 'NOT_FOUND', chatId: movedTo };
  }
  if (row === undefined) return { ok: false, reason: 'NOT_FOUND', chatId };
  if (row.chatType === 'CHANNEL')
    return { ok: false, reason: 'CHANNEL_NOT_ALLOWED', chatId: row.chatId };
  if (!row.isPresent) return { ok: false, reason: 'BOT_NOT_MEMBER', chatId: row.chatId };
  if (!row.isAdministrator) return { ok: false, reason: 'BOT_NOT_ADMIN', chatId: row.chatId };
  if (!row.canPost) return { ok: false, reason: 'BOT_CANNOT_POST', chatId: row.chatId };
  return { ok: true, chatId: row.chatId };
}

/** Commits a verified chat. Binding never touches the other purpose's group. */
export function bindTenantChat(tenant: Tenant, purpose: TelegramChatPurpose, chatId: string): void {
  tenant[chatFieldOf(purpose)] = chatId;
  tenant.updatedAt = nowIso();
}

export function unbindTenantChat(tenant: Tenant, purpose: TelegramChatPurpose): void {
  tenant[chatFieldOf(purpose)] = null;
  tenant.updatedAt = nowIso();
}

const randomToken = (length: number, alphabet: string): string =>
  Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)] ?? 'A').join(
    '',
  );

/**
 * `POST /:id/telegram/bind-links`. The caller has already refused a missing, closed or bot-less
 * operator. Issuing revokes the previous link for the same purpose, because only the latest is kept.
 */
export function issueBindLink(
  tenant: Tenant,
  botUsername: string,
  purpose: TelegramChatPurpose,
): TelegramBindLink {
  const nonce = randomToken(32, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-');
  const expiresAt = new Date(Date.now() + BIND_LINK_TTL_MINUTES * 60_000).toISOString();
  db.bindLinks[tenant.id] = { ...db.bindLinks[tenant.id], [purpose]: { nonce, expiresAt } };
  return {
    purpose,
    url: `https://t.me/${botUsername}?startgroup=${nonce}&admin=${BIND_ADMIN_RIGHTS.join('+')}`,
    botUsername,
    expiresAt,
    adminRights: [...BIND_ADMIN_RIGHTS],
  };
}

/**
 * What happens inside Telegram after the owner follows a bind link: the bot lands in `chat`, and its
 * `/start@bot <nonce>` binds it — if the link is still live and the chat passes verification. For
 * tests and the demo, since nothing here can play Telegram's part. Returns whether it bound.
 */
export function completeBindLink(
  tenantId: string,
  purpose: TelegramChatPurpose,
  chat: MockTenantChat,
): boolean {
  const tenant = db.tenants.find((row) => row.id === tenantId);
  const link = db.bindLinks[tenantId]?.[purpose];
  if (tenant === undefined || link === undefined || Date.parse(link.expiresAt) <= Date.now()) {
    return false;
  }

  const rows = db.tenantChats[tenantId] ?? [];
  db.tenantChats[tenantId] = [chat, ...rows.filter((row) => row.chatId !== chat.chatId)];

  const verdict = verifyTenantChat(tenantId, chat.chatId);
  if (!verdict.ok) return false;
  // Used up, exactly once.
  db.bindLinks[tenantId] = { ...db.bindLinks[tenantId], [purpose]: undefined };
  bindTenantChat(tenant, purpose, verdict.chatId);
  return true;
}

/** One bound group in health: the binding, plus the bot's last sighting there. */
function boundChatHealth(tenantId: string, chatId: string | null): BoundChatHealth {
  const sighting =
    chatId === null
      ? undefined
      : (db.tenantChats[tenantId] ?? []).find((row) => row.chatId === chatId);
  return {
    chatId,
    title: sighting?.title ?? null,
    status: sighting?.status ?? null,
    isPresent: sighting?.isPresent ?? null,
    isAdministrator: sighting?.isAdministrator ?? null,
    canPost: sighting?.canPost ?? null,
    lastSeenAt: sighting?.lastSeenAt ?? null,
  };
}

// ── Linking a staff account to Telegram ────────────────────────────────────────────────────────

/**
 * `POST /v1/admin/admins/:id/telegram-link-code`, after the caller's refusals. Revokes the last code.
 * `botUsername` is the bot of the operator the request is for, which is the one that takes the code.
 */
export function issueStaffLinkCode(
  admin: AdminUser,
  botUsername: string | null,
): StaffTelegramLinkCode {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const code = `${randomToken(4, alphabet)}-${randomToken(4, alphabet)}`;
  const expiresAt = new Date(Date.now() + STAFF_LINK_CODE_TTL_SECONDS * 1_000).toISOString();
  db.staffLinkCodes[admin.id] = { code, expiresAt };
  return {
    adminUserId: admin.id,
    code,
    command: `/link ${code}`,
    expiresAt,
    ttlSeconds: STAFF_LINK_CODE_TTL_SECONDS,
    botUsername,
    botUrl: botUsername === null ? null : `https://t.me/${encodeURIComponent(botUsername)}`,
  };
}

/**
 * What the bot does with `/link <code>` in a private chat: the sender's id lands on the account the
 * code belongs to. For tests and the demo. Returns whether it linked.
 */
export function redeemStaffLinkCode(code: string, telegramUserId: string): boolean {
  const normalised = code.replace('-', '').toUpperCase();
  const entry = Object.entries(db.staffLinkCodes).find(
    ([, value]) =>
      value.code.replace('-', '') === normalised && Date.parse(value.expiresAt) > Date.now(),
  );
  if (entry === undefined) return false;
  const [adminId] = entry;
  const admin = db.admins.find((row) => row.id === adminId);
  if (admin === undefined || !admin.isActive || admin.telegramLinked) return false;
  dropStaffLinkCode(adminId);
  admin.telegramUserId = telegramUserId;
  admin.telegramLinked = true;
  return true;
}

/** `DELETE /v1/admin/admins/:id/telegram-link`. Idempotent, and any live code dies with it. */
/** A used or revoked code is gone, not flagged: only a live code is ever kept. */
function dropStaffLinkCode(adminId: string): void {
  db.staffLinkCodes = Object.fromEntries(
    Object.entries(db.staffLinkCodes).filter(([id]) => id !== adminId),
  );
}

export function unlinkStaffTelegram(admin: AdminUser): AdminUser {
  dropStaffLinkCode(admin.id);
  admin.telegramUserId = null;
  admin.telegramLinked = false;
  return admin;
}

// ── The rate that prices a crypto deposit ──────────────────────────────────────────────────────

/**
 * The mock mirrors the real guards, not just the happy path.
 *
 * A demo where any number is accepted would let the console ship a rate form that looks finished
 * and has no protection behind it — and the protection is the entire point of this feature. The
 * 20% jump refusal in particular is what catches the 100x denomination mistake, so demo mode has
 * to be able to show somebody what that refusal looks like.
 */
export const RATE_MAX_JUMP_BPS = 2_000;
export const RATE_MAX_AGE_HOURS = 24;

export interface MockExchangeRate {
  quoteAsset: string;
  currencyCode: string;
  rateMinor: bigint;
  source: string;
  sourceNote: string | null;
  setByAdminId: string | null;
  effectiveFrom: string;
}

export function usdtRateView(): Record<string, unknown> | null {
  const rate = db.usdtRate;
  if (rate === null) return null;

  const ageMs = Date.now() - new Date(rate.effectiveFrom).getTime();
  return {
    quoteAsset: rate.quoteAsset,
    currencyCode: rate.currencyCode,
    rate: formatMinorToDecimal(rate.rateMinor),
    rateMinor: rate.rateMinor.toString(),
    source: rate.source,
    sourceNote: rate.sourceNote,
    setByAdminId: rate.setByAdminId,
    effectiveFrom: rate.effectiveFrom,
    isStale: ageMs > RATE_MAX_AGE_HOURS * 3_600_000,
    maxAgeHours: RATE_MAX_AGE_HOURS,
  };
}

/** Mirrors the server order: shape, then positivity, then the jump guard. */
export function setUsdtRate(
  body: Record<string, unknown>,
):
  | { ok: true }
  | { ok: false; status: 400; field: string }
  | { ok: false; status: 422; movedPercent: number } {
  const raw = typeof body.rate === 'string' ? body.rate : '';
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(raw)) {
    return { ok: false, status: 400, field: 'rate: must be a decimal amount, e.g. "13200.00"' };
  }

  const rateMinor = parseDecimalToMinor(raw);
  if (rateMinor <= 0n) {
    return { ok: false, status: 400, field: `rate: got ${raw}` };
  }

  const previous = db.usdtRate;
  if (previous !== null && body.confirmLargeChange !== true) {
    const delta =
      rateMinor > previous.rateMinor
        ? rateMinor - previous.rateMinor
        : previous.rateMinor - rateMinor;
    const movedBps = (delta * 10_000n) / previous.rateMinor;
    if (movedBps > BigInt(RATE_MAX_JUMP_BPS)) {
      return { ok: false, status: 422, movedPercent: Number(movedBps) / 100 };
    }
  }

  db.usdtRate = {
    quoteAsset: 'USDT',
    currencyCode: MOCK_CURRENCY,
    rateMinor,
    source: 'MANUAL',
    sourceNote: typeof body.sourceNote === 'string' ? body.sourceNote : null,
    setByAdminId: db.currentAdmin.id,
    effectiveFrom: nowIso(),
  };
  return { ok: true };
}

// ── Platform defaults ──────────────────────────────────────────────────────────────────────────

/**
 * The row a new operator inherits from, shaped as the API answers it.
 *
 * `appliesToNewOperatorsOnly` is always true and is sent anyway, because it is the assumption most
 * likely to be wrong: editing a default changes what the NEXT operator inherits and does not reach
 * back into the ones already created. Their values were copied onto their own rows at creation.
 */
export function platformDefaultsView(): {
  ichancyBaseUrl: string;
  ichancyAgentId: string | null;
  currencyCode: string;
  dualApprovalThresholdMinor: string;
  agentFloatLowWatermarkMinor: string;
  depositExpiryMinutes: number;
  updatedAt: string;
  appliesToNewOperatorsOnly: true;
} {
  const defaults = platformDefaults();
  return {
    ichancyBaseUrl: defaults.ichancyBaseUrl,
    ichancyAgentId: defaults.ichancyAgentId,
    currencyCode: defaults.currencyCode,
    dualApprovalThresholdMinor: defaults.dualApprovalThresholdMinor,
    agentFloatLowWatermarkMinor: defaults.agentFloatLowWatermarkMinor,
    depositExpiryMinutes: defaults.depositExpiryMinutes,
    updatedAt: db.platformDefaultsUpdatedAt,
    appliesToNewOperatorsOnly: true,
  };
}

/**
 * A PATCH. An ABSENT key leaves the stored value alone — which is the behaviour worth mirroring
 * faithfully, because getting it wrong on the real backend would un-name the platform's house agent
 * and break the NEXT tenant creation with an error naming a field nobody touched.
 *
 * Answers the offending field rather than throwing, so the handler can shape the 400 the backend
 * would send. The currency is checked here for the same reason the backend checks it: it is a
 * foreign key on tenants, so an unknown code fails later, on somebody else's creation.
 */
export function updatePlatformDefaults(
  body: Record<string, unknown>,
): { ok: true } | { ok: false; field: string } {
  const currency = optionalStr(body.currencyCode);
  if (currency !== null && currency !== MOCK_CURRENCY) {
    return { ok: false, field: `currencyCode: no Currency row for ${currency}` };
  }

  const defaults = db.platformDefaults;
  const assign = <K extends keyof PlatformDefaults>(
    key: K,
    value: PlatformDefaults[K] | null,
  ): void => {
    if (value !== null) defaults[key] = value;
  };

  assign('ichancyBaseUrl', optionalStr(body.ichancyBaseUrl));
  assign('ichancyAgentId', optionalStr(body.ichancyAgentId));
  assign('currencyCode', currency);
  assign('dualApprovalThresholdMinor', optionalStr(body.dualApprovalThresholdMinor));
  assign('agentFloatLowWatermarkMinor', optionalStr(body.agentFloatLowWatermarkMinor));
  if (typeof body.depositExpiryMinutes === 'number') {
    defaults.depositExpiryMinutes = body.depositExpiryMinutes;
  }

  db.platformDefaultsUpdatedAt = nowIso();
  return { ok: true };
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
      (row) => row.id !== tenant.id && `${row.ichancyBaseUrl}|${row.ichancyUsername}` === identity,
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
    // Fake mode is NOT a success with a made-up float: `ok` false, the backend's sentence, no float
    // and no comparison — the shape a real deployment answers under ICHANCY_FAKE.
    ichancy: db.ichancyFake
      ? {
          ok: false,
          fake: true,
          baseUrl: tenant.ichancyBaseUrl,
          username: tenant.ichancyUsername,
          agentId: tenant.ichancyAgentId,
          checkedAt: nowIso(),
          error: ICHANCY_FAKE_MODE_MESSAGE,
          floatMinor: null,
          belowWatermark: false,
          sharesAgentWith: operatorsSharingAgent(tenant),
        }
      : {
          ok: ops.ichancyError === null,
          fake: false,
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
    chats: {
      staff: boundChatHealth(tenant.id, tenant.adminChatId),
      feed: boundChatHealth(tenant.id, tenant.feedChatId),
    },
    counts: tenant.counts ?? { players: 0, deposits: 0 },
  };
}

// ── The agent float ────────────────────────────────────────────────────────────────────────────

/**
 * What the top-bar pill reads.
 *
 * The ICHANCY side, not the ledger side, and the same precedence the backend's own `/float` command
 * applies: an approval is drawn against what the agent wallet actually holds, so that is the figure
 * worth judging against the watermark. Our books are the fallback there and are not the answer
 * here — the two differ by design in these fixtures, and a mock that quietly showed the ledger
 * figure would hide exactly the drift the reconciliation screen exists to find.
 */
export function agentFloatView(): {
  currencyCode: string;
  balanceMinor: string;
  balance: string;
  lowWatermarkMinor: string;
  isLow: boolean;
  checkedAt: string;
} {
  const tenant = db.tenants[0];
  const watermark = tenant === undefined ? 0n : minorFromString(tenant.agentFloatLowWatermarkMinor);
  const balance = db.agentFloatIchancyMinor;

  return {
    currencyCode: MOCK_CURRENCY,
    balanceMinor: balance.toString(),
    balance: formatMinorToDecimal(balance),
    lowWatermarkMinor: watermark.toString(),
    isLow: balance < watermark,
    checkedAt: nowIso(),
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
  ichancyFake: boolean;
} {
  const delta = db.agentFloatIchancyMinor - db.agentFloatLedgerMinor;
  const tenant = db.tenants[0];
  const watermark = tenant === undefined ? 0n : minorFromString(tenant.agentFloatLowWatermarkMinor);

  // Fake mode reads no wallet and opens no break; the watermark comes from the ledger alone.
  if (db.ichancyFake) {
    return {
      currencyCode: MOCK_CURRENCY,
      ledgerMinor: db.agentFloatLedgerMinor.toString(),
      ichancyMinor: null,
      deltaMinor: null,
      breakId: null,
      belowWatermark: db.agentFloatLedgerMinor < watermark,
      ichancyFake: true,
    };
  }

  return {
    ichancyFake: false,
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

  return {
    ledgerTransactionId: found?.resolutionTxId ?? nextId('66666666'),
    deltaMinor: delta.toString(),
  };
}

// ── Platform finance overview ──────────────────────────────────────────────────────────────────

/** The cheap overview, in the wrapper the API answers: `{ tenants: [...] }`. */
export function financeBalancesView(): { tenants: TenantFinanceRow[] } {
  return { tenants: db.finance };
}

/**
 * The expensive per-operator refresh.
 *
 * Loads that operator's USDT wallets and Sham Cash — flipping whatever they were (typically
 * `not_loaded`) to loaded/ok — and answers the freshened row. The agent float is the cheap ledger
 * read the overview already carries, so it is left as it is: refreshing a suspended operator whose
 * agent does not answer loads its wallets without inventing a float it cannot read. `null` when no
 * such operator exists, which the handler turns into a 404.
 */
export function refreshTenantFinance(tenantId: string): TenantFinanceRow | null {
  const row = db.finance.find((entry) => entry.tenantId === tenantId);
  if (row === undefined) return null;

  const checkedAt = nowIso();
  row.usdt = mockLoadedUsdt(checkedAt);
  row.shamCash = mockShamCashOk(checkedAt);
  return row;
}

export { nextId };
