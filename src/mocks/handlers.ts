import { HttpResponse, http, type HttpHandler } from 'msw';

import { config } from '@/config';
import { can } from '@/lib/auth/permissions';
import { formatMinorToDecimal, minorFromString, parseDecimalToMinor } from '@/lib/money';
import type { Capability } from '@/lib/auth/permissions';
import {
  ADMIN_ROLES,
  BLOCK_REASON_MAX_LENGTH,
  CREDIT_REASON_MAX_LENGTH,
  DEBIT_REASON_MAX_LENGTH,
  DEPOSIT_MODES,
  PAYOUT_REFERENCE_MAX_LENGTH,
  WITHDRAWAL_MODES,
  WITHDRAWAL_REJECTION_REASON_MAX_LENGTH,
  type AdminDeposit,
  type AdminRole,
  type AdminWithdrawal,
  type DepositMode,
  type Tenant,
  type TelegramDestination,
  type WithdrawalMode,
} from '@/types';

import {
  agentFloatView,
  approveDeposit,
  approveWithdrawal,
  blockPlayer,
  botSettingsView,
  claimDeposit,
  correctFloat,
  createAdmin,
  createDestination,
  createMenuButton,
  createMenuNode,
  createMethod,
  deleteMenuButton,
  deleteMenuNode,
  deleteMethod,
  createTenant,
  db,
  debitPlayer,
  findMenuButton,
  findMenuNode,
  findWithdrawal,
  importPlayers,
  importPlayersForTenant,
  linkIchancyAccount,
  manualCredit,
  markWithdrawalPaid,
  menuNodeStillLinkedFrom,
  financeBalancesView,
  refreshTenantFinance,
  findDeposit,
  nextId,
  nowIso,
  registerPlayer,
  rejectWithdrawal,
  reorderMenuButtons,
  requiredActionLeftWithout,
  unblockPlayer,
  updateBotSettings,
  updateMenuButton,
  platformDefaultsView,
  updatePlatformDefaults,
  usdtRateView,
  setUsdtRate,
  RATE_MAX_JUMP_BPS,
  registerWebhook,
  rejectDeposit,
  releaseDeposit,
  removeWebhook,
  replaceTenantBot,
  resolveIchancyAgentId,
  setApprovalLimit,
  setMockAdmin,
  syncAgentFloat,
  tenantHealth,
  updateTenantIchancy,
  AGENT_PRINCIPAL_LINK_MESSAGE,
  PLATFORM_BOT_LOCKED_MESSAGE,
  PLATFORM_HAS_NO_AGENT_MESSAGE,
  PLATFORM_LINK_MESSAGE,
  PLATFORM_SUSPEND_LOCKED_MESSAGE,
  STAFF_GROUP_REMOVAL_REFUSED_MESSAGE,
  STAFF_GROUP_REQUIRED_MESSAGE,
  TENANT_PLATFORM_LOCKED_MESSAGE,
  bindTenantChat,
  chatRejectionMessage,
  issueBindLink,
  issueStaffLinkCode,
  platformBotUnavailableMessage,
  tenantChatsView,
  tenantView,
  unbindTenantChat,
  unlinkStaffTelegram,
  verifyTenantChat,
  type MockChatVerdict,
} from './db';
import {
  MOCK_AGENT_PASSWORD,
  MOCK_CONSOLE_PASSWORD,
  MOCK_SESSION_TTL_MINUTES,
  mockRoleForLogin,
} from './demo';
import {
  mockBalanceAlwaysFailsFor,
  mockBalanceMinorFor,
  TENANT_IDS,
  TENANT_ZERO_ID,
} from './fixtures';
import { mockDepositChainCheck } from './deposit-chain-check';
import {
  MOCK_PAIRING_EXPIRED,
  MOCK_PAIRING_ID,
  MOCK_QR_IMAGE,
  MOCK_SHAM_PAGE,
  mockAccountLink,
  mockAccountRefresh,
  mockAccountStatus,
  mockAccountUnlink,
  mockPairingPolls,
  mockParseShamCashText,
} from './shamcash-dev';
import { platformStatsView, tenantStatsView } from './stats';
import { mockNetworkForAddress, mockWalletBalance } from './wallet-balance';
import { STATS_PERIODS, type StatsPeriodKey } from '@/types/stats';
import { isAgentPrincipal } from '@/types/admin';

/**
 * The mock backend.
 *
 * It answers in the real envelope, with the real pagination metas, the real error codes and the
 * real status semantics — including the ones that are easy to get wrong and expensive to discover
 * late: `alreadyHandled` when two reviewers race, `awaiting_second_approval` above the threshold,
 * 409 on a deposit that is no longer reviewable, 403 when the role is not allowed.
 */

const base = config.apiBaseUrl;
const url = (path: string): string => `${base}${path}`;

let correlation = 0;
const meta = (extra: Record<string, unknown> = {}) => ({
  correlationId: `mock-${String(++correlation).padStart(6, '0')}`,
  timestamp: nowIso(),
  ...extra,
});

const ok = (data: unknown, extra: Record<string, unknown> = {}, status = 200) =>
  HttpResponse.json({ success: true, data, error: null, meta: meta(extra) }, { status });

const fail = (status: number, code: string, message: string, details?: unknown) =>
  HttpResponse.json(
    {
      success: false,
      data: null,
      error: { code, message, ...(details === undefined ? {} : { details }) },
      meta: meta(),
    },
    { status },
  );

/**
 * The operator a request is pointed at.
 *
 * The real backend honours `X-Tenant-Id` only for a PLATFORM_ADMIN and ignores it from everybody
 * else. The mock does the same, and — so that switching operators visibly DOES something rather
 * than looking like it worked — it serves a smaller slice for any operator that is not the home one.
 * The fixtures only describe one real operator; pretending otherwise would make the demo lie.
 */
/**
 * The caller's role, read out of the BEARER TOKEN rather than out of `db.currentAdmin`.
 *
 * A real access token carries its role, and so must this one: the in-browser database is rebuilt on
 * every page load, so a mock that remembered the role in memory would silently demote a platform
 * admin the moment they refreshed — and the screen would keep saying otherwise, because the session
 * survives in storage. That mismatch is a bug the mock would be inventing all by itself.
 */
const callerRole = (request: Request): AdminRole | null => {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const role = token.split(':')[1];
  return role !== undefined && (ADMIN_ROLES as readonly string[]).includes(role)
    ? (role as AdminRole)
    : null;
};

/**
 * The 403 a route answers a role that lacks its capability — or null when the caller may proceed.
 *
 * `role !== null`, as every guarded route below explains: a token with no role in it is a test
 * client, not a signed-in operator, and the mock login never issues one. A REAL role that lacks the
 * capability is refused, which is the rule the backend enforces.
 */
const refusedFor = (request: Request, capability: Capability, message: string) => {
  const role = callerRole(request);
  return role !== null && !can(role, capability) ? fail(403, 'INSUFFICIENT_ROLE', message) : null;
};

/**
 * The staff and feed group routes are PLATFORM_ADMIN only on the backend (owner decision 3). A token
 * with no role is a test client, as everywhere else in this file.
 */
const platformOnly = (request: Request) => {
  const role = callerRole(request);
  return role !== null && role !== 'PLATFORM_ADMIN'
    ? fail(403, 'INSUFFICIENT_ROLE', 'This endpoint is for platform administrators.')
    : null;
};

const chatPurposeOf = (value: unknown): 'STAFF' | 'FEED' | null =>
  value === 'STAFF' || value === 'FEED' ? value : null;

const tenantClosed = () =>
  fail(
    422,
    'TENANT_CLOSED',
    'This operator is closed. A closed operator keeps its records but no group can be bound to it.',
  );

/**
 * Tenant zero is the platform, not an operator: issuing a link, binding (PUT, or PATCH with a changed
 * chat) and removing a group are all refused, checked after "not found" and before "closed", as the
 * backend does. Reading its chat directory is not refused there, so it is not here either.
 */
const platformLocked = () => fail(422, 'TENANT_PLATFORM_LOCKED', TENANT_PLATFORM_LOCKED_MESSAGE);

/**
 * The other refusal tenant zero gets, from the routes that go through the operator's BOT rather than
 * checking an id: the webhook pair and the command menus. Its stored token is a placeholder, so the
 * bot cannot be built at all — 422 TENANT_BOT_UNAVAILABLE, and the console offers none of the three.
 */
const platformBotUnavailable = (action: string) =>
  fail(422, 'TENANT_BOT_UNAVAILABLE', platformBotUnavailableMessage(action));

/** 400 TELEGRAM_CHAT_REJECTED, in the backend's `details` shape and with its sentence per reason. */
const chatRejected = (
  verdict: Extract<MockChatVerdict, { ok: false }>,
  purpose: 'STAFF' | 'FEED',
  field: string,
) =>
  fail(400, 'TELEGRAM_CHAT_REJECTED', chatRejectionMessage(verdict.reason), {
    reason: verdict.reason,
    purpose,
    field,
    chatId: verdict.chatId,
    detail: null,
  });

/** A Telegram user id: a positive 64-bit integer, which crosses the wire as a decimal string. */
const TELEGRAM_USER_ID_PATTERN = /^[1-9]\d{0,19}$/;

/** A reason or a reference, trimmed, or '' when it was not a string at all. */
const textField = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const requestedTenant = (request: Request): string | null => {
  const header = request.headers.get('x-tenant-id');
  if (header === null || header === TENANT_ZERO_ID) return null;
  return callerRole(request) === 'PLATFORM_ADMIN' ? header : null;
};

/** What another operator's screens show: a believable, obviously smaller book of business. */
const forTenant = <T>(request: Request, rows: T[]): T[] =>
  requestedTenant(request) === null ? rows : rows.slice(0, 2);

const listParam = (request: Request, key: string): string[] => {
  const raw = new URL(request.url).searchParams.get(key);
  if (raw === null || raw.length === 0) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const param = (request: Request, key: string): string | null =>
  new URL(request.url).searchParams.get(key);

/** An unknown or absent period is the month — the API's own documented default. */
const periodParam = (request: Request): StatsPeriodKey => {
  const raw = param(request, 'period');
  return STATS_PERIODS.find((key) => key === raw) ?? 'month';
};

const numberParam = (request: Request, key: string, fallback: number): number => {
  const raw = param(request, key);
  const parsed = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const boolParam = (request: Request, key: string): boolean | undefined => {
  const raw = param(request, key);
  if (raw === null) return undefined;
  return raw === 'true' || raw === '1';
};

/** Cursor is the index of the next row — enough to exercise real cursor pagination in the UI. */
const decodeCursor = (cursor: string | null): number => {
  if (cursor === null) return 0;
  const parsed = Number(cursor);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

function cursorPage<T>(rows: T[], request: Request) {
  const limit = Math.min(Math.max(numberParam(request, 'limit', 20), 1), 100);
  const start = decodeCursor(param(request, 'cursor'));
  const slice = rows.slice(start, start + limit);
  const hasMore = start + limit < rows.length;
  return {
    data: slice,
    meta: { limit, nextCursor: hasMore ? String(start + limit) : null, hasMore },
  };
}

function offsetPage<T>(rows: T[], request: Request) {
  const limit = Math.min(Math.max(numberParam(request, 'limit', 20), 1), 100);
  const offset = Math.max(numberParam(request, 'offset', 0), 0);
  const slice = rows.slice(offset, offset + limit);
  return {
    data: slice,
    meta: { total: rows.length, limit, offset, hasMore: offset + slice.length < rows.length },
  };
}

/**
 * What BotFather hands out: a numeric bot id, a colon, and 35 URL-safe characters. Checking the
 * shape here is not security theatre — it is the difference between a typo failing in a form and a
 * typo silently replacing a working bot with one Telegram has never heard of.
 */
const BOT_TOKEN_PATTERN = /^\d{6,}:[A-Za-z0-9_-]{30,}$/;

/** The menus the backend pushes, and the Telegram scopes it pushes them to. */
const BOT_COMMAND_SCOPES = ['default', 'all_private_chats', 'chat_administrators'];
const BOT_COMMANDS_PUSHED = 7;

const REVIEWABLE = new Set(['SUBMITTED', 'UNDER_REVIEW', 'PENDING_SECOND_APPROVAL']);
const DECIDABLE = new Set(['SUBMITTED', 'UNDER_REVIEW', 'PENDING_SECOND_APPROVAL']);

/**
 * Who may debit a player: the backend's DECIDE_ROLES, unchanged.
 *
 * Taking money back out of a live account is a money decision, so it is the same three roles that
 * are trusted to decide a deposit — not a new list, which is how two lists drift apart.
 */
const DEBIT_ROLES = new Set<AdminRole>(['SUPER_ADMIN', 'FINANCE_ADMIN', 'REVIEWER']);

/**
 * The casino minimum a manual credit must clear — 25,000.00 NSP in minor units. Ichancy refuses
 * `depositToPlayer` below its own floor, so the backend refuses before recording the deposit; the
 * mock mirrors it so the console is built against the same rule rather than told about it.
 */
const MANUAL_CREDIT_MIN_MINOR = 2_500_000n;

function sortDeposits(rows: AdminDeposit[], sort: string | null): AdminDeposit[] {
  const byCreated = (a: AdminDeposit, b: AdminDeposit) =>
    Date.parse(b.createdAt) - Date.parse(a.createdAt);
  const byAmount = (a: AdminDeposit, b: AdminDeposit) =>
    Number(minorFromString(b.claimed.minor) - minorFromString(a.claimed.minor));

  switch (sort) {
    case 'oldest':
      return [...rows].sort((a, b) => -byCreated(a, b));
    case 'amount_desc':
      return [...rows].sort(byAmount);
    case 'amount_asc':
      return [...rows].sort((a, b) => -byAmount(a, b));
    default:
      return [...rows].sort(byCreated);
  }
}

/** What *_OPERATOR_AMBIGUOUS and *_OPERATOR_NOT_ACTIVE carry in `details`. No secrets. */
const operatorChoices = (rows: readonly Tenant[]): { slug: string; displayName: string }[] =>
  rows.map((tenant) => ({ slug: tenant.slug, displayName: tenant.displayName }));

/**
 * Signing in with an operator's ICHANCY AGENT account, shared by the two routes that can end here.
 *
 * Returns `null` for "these are not agent credentials at all", so the credentials route can answer
 * with its own ordinary wrong-password sentence rather than one about Ichancy — an account the
 * person typing may not know exists. Every other outcome is a real answer and comes back as a
 * response, including the two that only make sense AFTER the password was right.
 *
 * The refusal ORDER is mirrored from the real route rather than merely its status codes, because
 * the order is the security property. Nothing about which operators exist is said until the
 * password is right; everything said afterwards is about an operator the caller has already proved
 * they run. A mock that had that backwards would let a console ship a screen which leaks against
 * the real backend and looks correct against this one.
 */
function agentSignIn(
  rawUsername: string,
  password: string,
  operatorSlug?: string,
): ReturnType<typeof ok> | null {
  const username = rawUsername.trim().toLowerCase();
  const matched =
    username.length > 0 && password === MOCK_AGENT_PASSWORD
      ? db.tenants.filter((tenant) => tenant.ichancyUsername.toLowerCase() === username)
      : [];

  const wanted = operatorSlug?.trim().toLowerCase();
  const chosen =
    wanted === undefined || wanted.length === 0
      ? matched
      : matched.filter((tenant) => tenant.slug.toLowerCase() === wanted);

  if (chosen.length === 0) return null;

  const active = chosen.filter((tenant) => tenant.status === 'ACTIVE');

  if (active.length > 1) {
    return fail(
      409,
      'AGENT_OPERATOR_AMBIGUOUS',
      'That Ichancy agent runs more than one operator. Choose which one to sign into.',
      { operators: operatorChoices(active) },
    );
  }

  // Destructured rather than indexed: `active` is empty when every operator that agent opens is
  // suspended, which is a real answer this route has to give rather than an impossible one.
  const [tenant] = active;
  if (tenant === undefined) {
    return fail(
      403,
      'AGENT_OPERATOR_NOT_ACTIVE',
      'That operator is suspended. A platform admin has to activate it before anyone can sign in.',
      { operators: operatorChoices(chosen) },
    );
  }

  // The agent account is the top of ONE operator, so it opens the console as a SUPER_ADMIN.
  const persona = db.admins.find((admin) => admin.role === 'SUPER_ADMIN');
  if (persona !== undefined) {
    setMockAdmin({
      id: persona.id,
      telegramUserId: persona.telegramUserId,
      role: persona.role,
      displayName: persona.displayName,
    });
  }

  return ok({
    accessToken: `mock:SUPER_ADMIN:${nextId('99999999')}`,
    expiresAt: new Date(Date.now() + MOCK_SESSION_TTL_MINUTES * 60_000).toISOString(),
    admin: db.currentAdmin,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
  });
}

/**
 * The mock's stand-in for resolving a pasted link through the operator's bot.
 *
 * It refuses exactly what the server refuses, keyed off recognisable strings in the URL, so demo
 * mode and the tests can reach every one of the failure sentences without a Telegram account:
 *   …/notamember   -> BOT_NOT_MEMBER      …/notadmin  -> BOT_NOT_ADMIN
 *   …/nopost       -> BOT_CANNOT_POST     …/missing   -> NOT_FOUND
 *   a t.me/+ link  -> INVALID_URL         a positive id -> PRIVATE_CHAT
 *
 * A NEGATIVE id is the pick-list's own submission — the only handle a private group has — and is
 * resolved against the recorded sightings rather than invented, so binding from the picker succeeds
 * or fails for the same reasons it would on the server: unseen is NOT_FOUND, a chat the bot has
 * left is BOT_NOT_MEMBER, and a chat where it is only a member is BOT_NOT_ADMIN.
 *
 * Anything else that parses resolves to a healthy supergroup.
 */
function resolveMockChat(raw: string):
  | {
      chatId: string;
      chatType: TelegramDestination['chatType'];
      title: string;
      username: string | null;
    }
  | { reason: string; message: string } {
  const input = raw.trim();

  if (input.length === 0 || /t\.me\/(\+|joinchat\/)/i.test(input)) {
    return {
      reason: 'INVALID_URL',
      message: 'A private invite link cannot be resolved by a bot.',
    };
  }
  if (/^\d+$/.test(input)) {
    return { reason: 'PRIVATE_CHAT', message: 'That is a private one-to-one chat.' };
  }

  // A NEGATIVE id is a group or channel, and it is what the pick-list submits — the only handle a
  // private group has. Resolved against the sightings so the row that comes back carries the real
  // title, exactly as the server's getChat would; an id for a chat the bot has never seen is a
  // NOT_FOUND, which is also what the server answers.
  if (/^-\d+$/.test(input)) {
    const seen = db.discoveredChats.find((chat) => chat.chatId === input);
    if (seen === undefined) {
      return { reason: 'NOT_FOUND', message: 'Telegram does not know that chat.' };
    }
    if (!seen.isPresent) {
      return { reason: 'BOT_NOT_MEMBER', message: 'The bot is not in that group.' };
    }
    if (!seen.isAdministrator) {
      return {
        reason: 'BOT_NOT_ADMIN',
        message: 'The bot is not an administrator of that group.',
      };
    }
    return {
      chatId: seen.chatId,
      chatType: seen.chatType,
      title: seen.title ?? seen.chatId,
      username: seen.username,
    };
  }
  if (input.includes('notamember')) {
    return { reason: 'BOT_NOT_MEMBER', message: 'The bot is not in that group.' };
  }
  if (input.includes('notadmin')) {
    return { reason: 'BOT_NOT_ADMIN', message: 'The bot is not an administrator of that group.' };
  }
  if (input.includes('nopost')) {
    return { reason: 'BOT_CANNOT_POST', message: 'Its "Post messages" permission is off.' };
  }
  if (input.includes('missing')) {
    return { reason: 'NOT_FOUND', message: 'Telegram does not know that chat.' };
  }

  const handle = /([A-Za-z][A-Za-z0-9_]{3,31})\/?$/.exec(input)?.[1] ?? 'group';
  return {
    // Stable per handle, so adding the same group twice really does collide on the duplicate rule.
    chatId: `-100${String(Math.abs(hashHandle(handle)))
      .padStart(10, '0')
      .slice(0, 10)}`,
    chatType: 'SUPERGROUP',
    title: handle.replace(/_/g, ' '),
    username: handle,
  };
}

/** A tiny stable hash, so one handle always resolves to one chat id within a session. */
function hashHandle(handle: string): number {
  let hash = 0;
  for (const character of handle) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return hash;
}

/**
 * `check` and `test` share everything except whether a message is actually sent, so they share an
 * implementation — and the difference is the one thing the view reports back (`messageSent`).
 */
function checkOrTest(id: string, send: boolean) {
  const row = db.telegramDestinations.find((item) => item.id === id);
  if (row === undefined) return fail(404, 'NOT_FOUND', 'Telegram destination not found');

  const now = new Date().toISOString();

  // The seeded kicked-from-group row keeps failing, so the screen has something to render failing.
  if (row.lastError?.includes('kicked') === true) {
    return ok({
      ok: false,
      isMember: false,
      isAdministrator: false,
      canPost: false,
      reason: 'BOT_NOT_MEMBER',
      detail: row.lastError,
      title: row.title,
      messageSent: false,
    });
  }

  row.lastVerifiedAt = now;
  row.lastError = null;
  if (send) row.lastPublishedAt = now;
  row.updatedAt = now;

  return ok({
    ok: true,
    isMember: true,
    isAdministrator: true,
    canPost: true,
    reason: null,
    detail: null,
    title: row.title,
    messageSent: send,
  });
}

/** What the server calls each reporting window, so the toast reads the same in both. */
const REPORT_TITLES: Record<string, string> = {
  day: 'Today',
  week: 'This week',
  month: 'This month',
};

export const handlers: HttpHandler[] = [
  // ── Health ───────────────────────────────────────────────────────────────────────────────────
  http.get(url('/health/live'), () =>
    ok({ status: 'ok', role: 'api', uptimeSeconds: 4_812, timestamp: nowIso() }),
  ),

  http.get(url('/health/ready'), () =>
    ok({
      status: 'ok',
      info: { database: { status: 'up' }, redis: { status: 'up' } },
      error: {},
      details: { database: { status: 'up' }, redis: { status: 'up' } },
    }),
  ),

  // A representative egress reading: a proxy configured for Ichancy, and a WireGuard tunnel holding
  // the default route. Tests that need another shape (unreachable probe, no proxy, no tunnel)
  // override this one with `server.use`.
  http.get(url('/v1/system/egress-status'), () =>
    ok({
      evaluatedAt: nowIso(),
      transport: 'browser',
      publicIp: { ip: '203.0.113.42', source: 'fresh', error: null },
      vpn: {
        active: true,
        tunnelDefaultRoute: true,
        interfaces: [{ name: 'wg0', kind: 'wireguard' }],
        note: 'a tunnel interface is the default route — egress is via the VPN',
      },
      proxy: {
        configured: true,
        scheme: 'socks5',
        hostport: 'proxy.exit:1080',
        authenticated: true,
        route: 'relay',
      },
    }),
  ),

  // ── Auth ─────────────────────────────────────────────────────────────────────────────────────
  /**
   * The console's only sign-in. Mirrors the real route: a username and a password, with the
   * operator's Ichancy agent account tried second — which is why an unknown console username falls
   * through to the agent handler's logic below rather than being refused here.
   */
  http.post(url('/v1/admin/auth/credentials'), async ({ request }) => {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
      operatorSlug?: string;
    };
    const username = (body.username ?? '').trim();
    const role = mockRoleForLogin(username);

    if (role === null || body.password !== MOCK_CONSOLE_PASSWORD) {
      // Not a console account. The real server tries the agent credential before giving up, and
      // demo mode has to as well or the operator logins the login screen advertises would 401.
      // The slug travels with it, or the ambiguity retry would loop forever asking the question.
      const agentResult = agentSignIn(username, body.password ?? '', body.operatorSlug);
      if (agentResult !== null) return agentResult;

      return fail(
        401,
        'ADMIN_CREDENTIALS_INVALID',
        'Those credentials are not valid for any administrator on this platform.',
      );
    }

    // Demo mode only: the username names the role, so every role-gated screen can be shown.
    const persona = db.admins.find((admin) => admin.role === role);
    if (persona !== undefined) {
      setMockAdmin({
        id: persona.id,
        telegramUserId: persona.telegramUserId,
        role: persona.role,
        displayName: persona.displayName,
      });
    }
    const home = db.tenants.find((tenant) => tenant.id === TENANT_IDS.zero) ?? db.tenants[0];
    return ok({
      accessToken: `mock:${role}:${nextId('99999999')}`,
      expiresAt: new Date(Date.now() + MOCK_SESSION_TTL_MINUTES * 60_000).toISOString(),
      admin: db.currentAdmin,
      // The HOME operator, exactly as the real exchange now reports it.
      tenantId: home?.id ?? TENANT_ZERO_ID,
      tenantSlug: home?.slug ?? 'tenant-zero',
    });
  }),

  /*
   * The agent credential on its own route, kept because the backend keeps it: a published contract
   * the Flutter console still posts to. The web console does not use it — its single sign-in form
   * posts to /credentials, which falls through to the same logic.
   */
  http.post(url('/v1/admin/auth/ichancy'), async ({ request }) => {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
      operatorSlug?: string;
    };

    return (
      agentSignIn(body.username ?? '', body.password ?? '', body.operatorSlug) ??
      fail(
        401,
        'AGENT_CREDENTIALS_INVALID',
        'Those Ichancy credentials are not valid for any operator on this platform.',
      )
    );
  }),

  // ── The rate that prices a crypto deposit ────────────────────────────────────────────────────

  /*
   * Read by anyone who can read the rails; set by the roles that own the operator money — SUPER_ADMIN,
   * FINANCE_ADMIN, and PLATFORM_ADMIN, which configures a tenant's rails on its behalf (its own home
   * tenant, or another once selected in the switcher). The `X-Tenant-Id` header decides WHICH tenant
   * is touched, not whether the write is allowed.
   */
  // ── Sham Cash session (external cashier account, linked by pasting cookies) ────────────────────
  http.get(url('/v1/admin/shamcash/status'), ({ request }) => {
    const role = callerRole(request);
    if (role !== null && !can(role, 'paymentMethods.read')) {
      return fail(403, 'INSUFFICIENT_ROLE', 'Your role cannot read the payment configuration.');
    }
    return ok(db.shamCashSession);
  }),

  // ── Sham Cash HTTP API key (supersedes the session for reading transactions) ─────────────────
  http.post(url('/v1/admin/shamcash/api'), async ({ request }) => {
    const role = callerRole(request);
    if (role !== null && !can(role, 'paymentMethods.write')) {
      return fail(403, 'INSUFFICIENT_ROLE', 'Your role cannot change the payment configuration.');
    }
    const body = (await request.json()) as { walletId?: string; apiKey?: string };
    if (!body.walletId || !body.apiKey) {
      return fail(400, 'VALIDATION_FAILED', 'walletId and apiKey are required.');
    }
    // The KEY is never stored in the mock, exactly as the real backend never returns it. Only that
    // one exists, and the wallet id — which is not a credential.
    db.shamCashSession = { apiLinked: true, walletId: body.walletId };
    return ok(db.shamCashSession);
  }),

  http.delete(url('/v1/admin/shamcash/api'), ({ request }) => {
    const role = callerRole(request);
    if (role !== null && !can(role, 'paymentMethods.write')) {
      return fail(403, 'INSUFFICIENT_ROLE', 'Your role cannot change the payment configuration.');
    }
    db.shamCashSession = { apiLinked: false, walletId: null };
    return ok(db.shamCashSession);
  }),

  http.post(url('/v1/admin/shamcash/test'), ({ request }) => {
    const role = callerRole(request);
    if (role !== null && !can(role, 'paymentMethods.write')) {
      return fail(403, 'INSUFFICIENT_ROLE', 'Your role cannot read the payment configuration.');
    }
    if (!db.shamCashSession.apiLinked) return ok({ status: 'not_linked' });

    // Both halves reported separately, exactly as the real endpoint does — they are different
    // endpoints upstream and can fail apart.
    return ok({
      status: 'ok',
      balance: {
        status: 'ok',
        balances: [{ currency: 'SYP', available: '250000', locked: '0' }],
        checkedAt: nowIso(),
      },
      transactions: {
        status: 'ok',
        total: 2,
        sample: [
          {
            id: '425762101',
            type: 'credit',
            amount: 1200,
            currency: 'SYP',
            counterparty: 'علاء ابراهيم محمد',
            occurredAt: '2026-09-02T22:42:18',
          },
          {
            id: '425762517',
            type: 'debit',
            amount: 1100,
            currency: 'SYP',
            counterparty: 'شركة الفتح',
            occurredAt: '2026-09-02T22:42:33',
          },
        ],
      },
    });
  }),

  http.post(url('/v1/admin/shamcash/balance'), ({ request }) => {
    const role = callerRole(request);
    if (role !== null && !can(role, 'paymentMethods.write')) {
      return fail(403, 'INSUFFICIENT_ROLE', 'Your role cannot read the payment configuration.');
    }
    if (!db.shamCashSession.apiLinked) {
      return ok({ status: 'not_linked' });
    }
    // A plausible read: the account holds SYP. Transactions are no longer part of this response —
    // the balance endpoint returns balances, and lookups have their own endpoint.
    return ok({
      status: 'ok',
      balances: [
        { currency: 'SYP', available: '250,000', locked: '10,000' },
        { currency: 'USD', available: '0', locked: '0' },
        { currency: 'EUR', available: '0', locked: '0' },
      ],
      checkedAt: nowIso(),
    });
  }),

  http.get(url('/v1/admin/exchange-rates/usdt'), ({ request }) => {
    // `role !== null`, as the debit route explains: a token with no role in it is a test client,
    // not a signed-in operator, and the mock login route never issues one. Refusing it would make
    // every component test read this endpoint as a 403 it never asked for.
    const role = callerRole(request);
    if (role !== null && !can(role, 'paymentMethods.read')) {
      return fail(403, 'INSUFFICIENT_ROLE', 'Your role cannot read the payment configuration.');
    }
    return ok(usdtRateView());
  }),

  http.post(url('/v1/admin/exchange-rates/usdt'), async ({ request }) => {
    const role = callerRole(request);
    if (role !== null && !can(role, 'paymentMethods.write')) {
      return fail(403, 'INSUFFICIENT_ROLE', 'Your role cannot change the payment configuration.');
    }

    const body = (await request.json()) as Record<string, unknown>;
    const result = setUsdtRate(body);

    if (!result.ok && result.status === 400) {
      return fail(400, 'VALIDATION_FAILED', 'The request payload is invalid.', {
        fields: [result.field],
      });
    }

    if (!result.ok) {
      // The guard that catches a misplaced decimal, and the 100x denomination confusion.
      return fail(
        422,
        'RATE_IMPLAUSIBLE_JUMP',
        `That rate is ${result.movedPercent.toFixed(1)}% away from the current one, which is ` +
          'further than a rate normally moves. Check the decimal point and the denomination; ' +
          'confirm it deliberately if it is genuinely right.',
        { movedPercent: result.movedPercent, maxPercent: RATE_MAX_JUMP_BPS / 100 },
      );
    }

    return ok(usdtRateView());
  }),

  // ── Platform defaults ────────────────────────────────────────────────────────────────────────

  /*
   * What the NEXT operator inherits. PLATFORM_ADMIN only, like every route on the tenants surface —
   * this row sets the terms for every operator on the platform, so a tenant's own owner editing it
   * would be setting them for their competitors too.
   */
  http.get(url('/v1/admin/platform-defaults'), ({ request }) => {
    if (callerRole(request) !== 'PLATFORM_ADMIN') {
      return fail(403, 'INSUFFICIENT_ROLE', 'This endpoint is for platform administrators.');
    }
    return ok(platformDefaultsView());
  }),

  http.patch(url('/v1/admin/platform-defaults'), async ({ request }) => {
    if (callerRole(request) !== 'PLATFORM_ADMIN') {
      return fail(403, 'INSUFFICIENT_ROLE', 'This endpoint is for platform administrators.');
    }

    const body = (await request.json()) as Record<string, unknown>;

    // The same check the backend makes, and for the same reason: `currencyCode` is a foreign key on
    // `tenants`, so an unknown code would otherwise fail later, on somebody else's tenant creation.
    const result = updatePlatformDefaults(body);
    if (!result.ok) {
      return fail(400, 'VALIDATION_FAILED', 'The request payload is invalid.', {
        fields: [result.field],
      });
    }

    return ok(platformDefaultsView());
  }),

  // ── Platform finance overview ──────────────────────────────────────────────────────────────────

  /*
   * Every operator's finance balances. PLATFORM_ADMIN only, like every route on the tenants surface
   * — reading across operators is the platform's job and nobody else's. 403 for any other role,
   * mirroring `/platform-defaults` above.
   *
   * The GET is the CHEAP overview: it answers whatever is loaded, which for a freshly-seeded
   * operator is `not_loaded` USDT and Sham Cash. The POST is the EXPENSIVE per-operator refresh that
   * flips those to loaded/ok — a client "refresh all" is many of these, dripped through a limiter,
   * never one call here.
   */
  http.get(url('/v1/admin/finance/balances'), ({ request }) => {
    // `role !== null`, as the exchange-rate and debit routes explain: a token with no role in it is
    // a test client, not a signed-in operator, and the mock login never issues one. Refusing it
    // would make every component test on this screen read a 403 it never asked for. A REAL
    // non-platform role is still refused, which is the rule the backend actually enforces.
    const role = callerRole(request);
    if (role !== null && role !== 'PLATFORM_ADMIN') {
      return fail(403, 'INSUFFICIENT_ROLE', 'This endpoint is for platform administrators.');
    }
    return ok(financeBalancesView());
  }),

  http.post(url('/v1/admin/finance/tenants/:tenantId/refresh'), ({ params, request }) => {
    const role = callerRole(request);
    if (role !== null && role !== 'PLATFORM_ADMIN') {
      return fail(403, 'INSUFFICIENT_ROLE', 'This endpoint is for platform administrators.');
    }
    const row = refreshTenantFinance(String(params.tenantId));
    return row === null ? fail(404, 'TENANT_NOT_FOUND', 'Tenant not found.') : ok(row);
  }),

  // ── Sham Cash developer bench ────────────────────────────────────────────────────────────────

  /*
   * The bench, faked well enough to drive the screen and no further.
   *
   * WHAT IT DOES NOT DO: launch a browser, or pretend to take a minute. The real check replays a
   * session at shamcash.sy and is measured at 55-90 seconds; a mock that slept would make every
   * component test wait for it and prove nothing.
   *
   * WHAT IT DOES REPRODUCE is the SHAPE of the three answers, because that is what the screen is
   * built around — a valid session, a lapsed one, and a page that loaded but was not recognised.
   * The trigger is the accessToken, so a test asks for the case it means by name.
   */
  http.post(url('/v1/admin/shamcash/dev/browser-check'), async ({ request }) => {
    const body = (await request.json()) as { accessToken?: string };

    if (body.accessToken === 'expired') return ok({ status: 'expired' });

    if (body.accessToken === 'blank') {
      return ok({
        status: 'unavailable',
        detail: 'The page loaded but did not look like the account home screen.',
        debug: {
          url: 'https://shamcash.sy/en/application/home',
          textSnippet: MOCK_SHAM_PAGE,
          htmlSnippet: '<div id="__next"></div>',
          storageKeys: ['shamcash-pin-code-hash'],
          errors: [],
          api: [{ path: '/v4/api/Account/balance', status: 200 }],
        },
      });
    }

    return ok({
      status: 'ok',
      balances: [
        { currency: 'SYP', available: '250,000', locked: '10,000' },
        { currency: 'USD', available: '0', locked: '0' },
      ],
      transactions: [
        {
          transactionId: '884512309',
          date: '2026-08-26 - 16:10:31',
          amount: '10',
          currency: 'SYP',
          direction: 'in',
          username: 'Test Sender',
          maskedCard: '**** **** **** 0824',
        },
      ],
      checkedAt: '2026-09-07T09:00:00.000Z',
    });
  }),

  /*
   * The parser half. It really does read the text it is given — the point of this endpoint is that
   * it is deterministic and offline, and a mock that ignored the input would make the one test that
   * matters ("does an unrecognised page report nothing?") impossible to write.
   */
  http.post(url('/v1/admin/shamcash/dev/parse'), async ({ request }) => {
    const body = (await request.json()) as { text?: string };
    return ok(mockParseShamCashText(body.text ?? ''));
  }),

  /*
   * The QR pairing, faked as a STATE MACHINE rather than a fixed answer.
   *
   * The screen's whole behaviour is a sequence — show a code, poll while it is pending, react once
   * when it links — and a mock that answered 'linked' immediately would test none of it. So the
   * first poll of a pairing answers pending and the second answers linked, which is the shortest
   * sequence that exercises the real path.
   *
   * MOCK_PAIRING_EXPIRED is the id a test asks for when it wants the unhappy branch.
   */
  http.post(url('/v1/admin/shamcash/dev/qr'), () => {
    mockPairingPolls.clear();
    return ok({
      pairingId: MOCK_PAIRING_ID,
      qrImage: MOCK_QR_IMAGE,
      strategy: 'canvas',
      pageUrl: 'https://shamcash.sy/en/auth/login',
      expiresAt: new Date(Date.now() + 180_000).toISOString(),
    });
  }),

  http.get(url('/v1/admin/shamcash/dev/qr/:pairingId'), ({ params }) => {
    const id = String(params.pairingId);
    if (id === MOCK_PAIRING_EXPIRED) return ok({ status: 'expired' });

    const seen = (mockPairingPolls.get(id) ?? 0) + 1;
    mockPairingPolls.set(id, seen);

    if (seen < 2) {
      return ok({ status: 'pending', expiresAt: new Date(Date.now() + 180_000).toISOString() });
    }

    mockAccountLink();
    return ok({
      status: 'linked',
      session: {
        accessToken: 'linked-access-token',
        authToken: 'linked-auth-token',
        forge: 'linked-forge',
        pinCodeHash: 'linked-pin-hash',
      },
      pinRequired: false,
    });
  }),

  http.delete(url('/v1/admin/shamcash/dev/qr/:pairingId'), () => ok({ deleted: true })),

  /*
   * The linked account. Stateful across a session so the screen can be driven end to end: it
   * starts unlinked, a successful QR poll links it, and Refresh produces numbers.
   */
  http.get(url('/v1/admin/shamcash/account'), () => ok(mockAccountStatus())),

  http.post(url('/v1/admin/shamcash/account/refresh'), () => {
    const snapshot = mockAccountRefresh();
    return snapshot === null
      ? fail(503, 'SHAMCASH_NOT_LINKED', 'No Sham Cash session is linked.')
      : ok(snapshot);
  }),

  http.delete(url('/v1/admin/shamcash/account'), () => {
    mockAccountUnlink();
    return ok({ deleted: true });
  }),

  // ── Stats ────────────────────────────────────────────────────────────────────────────────────

  /*
   * The aggregates, derived from the SAME rows the deposit list below serves — see mocks/stats.ts
   * for why they are computed rather than fixtured. Any role that may read the queue may read them,
   * so there is no role check here; the cross-operator route below has one.
   *
   * An unknown `period` falls back to the month, which is what the API's own default does. Failing
   * it would make a stale link a broken screen rather than the default view.
   */
  http.get(url('/v1/admin/stats'), ({ request }) => ok(tenantStatsView(periodParam(request)))),

  /*
   * Every operator, PLATFORM_ADMIN only — the same rule, and the same `role !== null` escape hatch
   * for test clients, that `/v1/admin/finance/balances` above explains at length.
   */
  http.get(url('/v1/admin/stats/tenants'), ({ request }) => {
    const role = callerRole(request);
    if (role !== null && role !== 'PLATFORM_ADMIN') {
      return fail(403, 'INSUFFICIENT_ROLE', 'This endpoint is for platform administrators.');
    }
    return ok(platformStatsView(periodParam(request)));
  }),

  // ── Deposits ─────────────────────────────────────────────────────────────────────────────────
  http.get(url('/v1/admin/deposits'), ({ request }) => {
    const statuses = listParam(request, 'status');
    const shortId = param(request, 'shortId');
    const playerId = param(request, 'playerId');
    const methodId = param(request, 'paymentMethodId');
    const reference = param(request, 'externalReference');
    const minAmount = param(request, 'minAmount');
    const maxAmount = param(request, 'maxAmount');
    const unclaimedOnly = boolParam(request, 'unclaimedOnly');
    const createdFrom = param(request, 'createdFrom');
    const createdTo = param(request, 'createdTo');

    let rows = db.deposits.filter((deposit) =>
      statuses.length > 0 ? statuses.includes(deposit.status) : REVIEWABLE.has(deposit.status),
    );

    if (shortId !== null) {
      rows = rows.filter((row) => row.shortId.toUpperCase().includes(shortId.toUpperCase()));
    }
    if (playerId !== null) rows = rows.filter((row) => row.playerId === playerId);
    if (methodId !== null) rows = rows.filter((row) => row.paymentMethodId === methodId);
    if (reference !== null) {
      rows = rows.filter((row) => (row.externalReference ?? '').includes(reference));
    }
    if (minAmount !== null) {
      const min = parseDecimalToMinor(minAmount);
      rows = rows.filter((row) => minorFromString(row.claimed.minor) >= min);
    }
    if (maxAmount !== null) {
      const max = parseDecimalToMinor(maxAmount);
      rows = rows.filter((row) => minorFromString(row.claimed.minor) <= max);
    }
    if (unclaimedOnly === true) rows = rows.filter((row) => row.reviewStartedAt === null);
    if (createdFrom !== null) {
      rows = rows.filter((row) => Date.parse(row.createdAt) >= Date.parse(createdFrom));
    }
    if (createdTo !== null) {
      rows = rows.filter((row) => Date.parse(row.createdAt) <= Date.parse(createdTo));
    }

    const page = cursorPage(
      forTenant(request, sortDeposits(rows, param(request, 'sort'))),
      request,
    );
    return ok(page.data, page.meta);
  }),

  http.get(url('/v1/admin/deposits/:id'), ({ params }) => {
    const deposit = findDeposit(String(params.id));
    return deposit === undefined
      ? fail(404, 'DEPOSIT_NOT_FOUND', 'Deposit not found.')
      : ok(deposit);
  }),

  /*
   * The on-chain verdict for ONE deposit, and the only deposit route that leaves the building.
   *
   * A route of its own rather than fields on the deposit view: the queue above would otherwise call
   * a chain explorer once per row, on a screen that also refetches itself every thirty seconds.
   *
   * ── THE RAIL SAYS WHETHER THERE IS A CHAIN; THE ADDRESS SAYS WHICH ──────────────────────────
   * Crypto-ness comes from `rail === 'CRYPTO'` and the network from the DESTINATION ADDRESS. Not
   * from the method code: the operator's live USDT rail is coded plain `USDT`, and a check keyed on
   * `USDT_TRC20`/`USDT_BEP20` quietly answered "skipped" for every real deposit for months. A mock
   * that keyed on the code would agree with that bug instead of catching it.
   */
  http.get(url('/v1/admin/deposits/:id/chain-check'), ({ params, request }) => {
    const role = callerRole(request);
    if (role !== null && !can(role, 'deposits.read')) {
      return fail(403, 'INSUFFICIENT_ROLE', 'Your role cannot read deposits.');
    }

    const deposit = findDeposit(String(params.id));
    if (deposit === undefined) return fail(404, 'DEPOSIT_NOT_FOUND', 'Deposit not found.');

    const method = db.methods.find((row) => row.id === deposit.paymentMethodId);
    const address = deposit.destination?.accountIdentifier ?? '';
    const network =
      method?.rail === 'CRYPTO' && address.length > 0 ? mockNetworkForAddress(address) : null;

    return ok(
      mockDepositChainCheck({
        network,
        claimedMinor: deposit.claimed.minor,
        currency: deposit.claimed.currency,
        txHash: deposit.externalReference,
        rateMinor: db.usdtRate?.rateMinor ?? null,
        checkedAt: nowIso(),
      }),
    );
  }),

  http.post(url('/v1/admin/deposits/:id/claim'), ({ params }) => {
    const deposit = findDeposit(String(params.id));
    if (deposit === undefined) return fail(404, 'DEPOSIT_NOT_FOUND', 'Deposit not found.');
    // Somebody else is already on it: not an error, just an answer.
    if (deposit.reviewStartedAt !== null && deposit.decidedByAdminId !== db.currentAdmin.id) {
      return ok({ kind: 'alreadyHandled', status: deposit.status });
    }
    claimDeposit(deposit);
    return ok({ kind: 'claimed', deposit });
  }),

  http.post(url('/v1/admin/deposits/:id/release'), ({ params }) => {
    const deposit = findDeposit(String(params.id));
    if (deposit === undefined) return fail(404, 'DEPOSIT_NOT_FOUND', 'Deposit not found.');
    releaseDeposit(deposit);
    return ok({ kind: 'released', deposit });
  }),

  http.post(url('/v1/admin/deposits/:id/approve'), async ({ params, request }) => {
    const deposit = findDeposit(String(params.id));
    if (deposit === undefined) return fail(404, 'DEPOSIT_NOT_FOUND', 'Deposit not found.');
    if (!DECIDABLE.has(deposit.status)) {
      return ok({ kind: 'alreadyHandled', status: deposit.status });
    }

    const body = (await request.json().catch(() => ({}))) as {
      verifiedAmount?: { amount?: string };
    };
    const outcome = approveDeposit(deposit, body.verifiedAmount?.amount);

    return outcome.kind === 'approved'
      ? ok({ kind: 'approved', deposit, ledgerTransactionId: outcome.ledgerTransactionId })
      : ok({ kind: 'awaiting_second_approval', deposit });
  }),

  http.post(url('/v1/admin/deposits/:id/reject'), async ({ params, request }) => {
    const deposit = findDeposit(String(params.id));
    if (deposit === undefined) return fail(404, 'DEPOSIT_NOT_FOUND', 'Deposit not found.');
    if (!DECIDABLE.has(deposit.status)) {
      return ok({ kind: 'alreadyHandled', status: deposit.status });
    }

    const body = (await request.json()) as { rejectionCode?: string; rejectionNote?: string };
    if (body.rejectionCode === undefined) {
      return fail(400, 'VALIDATION_FAILED', 'The request payload is invalid.', {
        fields: ['rejectionCode must be one of the defined rejection codes'],
      });
    }

    rejectDeposit(deposit, body.rejectionCode, body.rejectionNote);
    return ok({ kind: 'rejected', deposit });
  }),

  http.post(url('/v1/admin/deposits/:id/retry-credit'), ({ params }) => {
    const deposit = findDeposit(String(params.id));
    if (deposit === undefined) return fail(404, 'DEPOSIT_NOT_FOUND', 'Deposit not found.');
    deposit.creditKeyEpoch += 1;
    deposit.status = 'CREDITING';
    return ok({ requeued: true, creditKeyEpoch: deposit.creditKeyEpoch }, {}, 202);
  }),

  http.get(url('/v1/admin/deposits/:id/proofs/:proofId/url'), ({ params }) =>
    ok({
      url: null,
      streamPath: `/v1/admin/deposits/${String(params.id)}/proofs/${String(params.proofId)}/content`,
      expiresInSeconds: 300,
    }),
  ),

  // A 1x1 PNG. Enough for the proof viewer to prove it fetches, authorises and revokes correctly.
  http.get(url('/v1/admin/deposits/:id/proofs/:proofId/content'), () => {
    const png = Uint8Array.from(
      atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      ),
      (character) => character.charCodeAt(0),
    );
    return HttpResponse.arrayBuffer(png.buffer, {
      headers: { 'Content-Type': 'image/png' },
    });
  }),

  http.post(url('/v1/admin/deposits/maintenance/sweep'), () => {
    let expired = 0;
    for (const deposit of db.deposits) {
      if (
        deposit.expiresAt !== null &&
        Date.parse(deposit.expiresAt) < Date.now() &&
        deposit.status === 'SUBMITTED'
      ) {
        deposit.status = 'EXPIRED';
        expired += 1;
      }
    }
    return ok({ expired, released: 0, reaped: 0 });
  }),

  // ── Players ──────────────────────────────────────────────────────────────────────────────────
  http.get(url('/v1/admin/players'), ({ request }) => {
    const status = param(request, 'status');
    const search = param(request, 'search');
    const telegramUserId = param(request, 'telegramUserId');
    const linked = boolParam(request, 'linked');
    const source = param(request, 'source');
    const blocked = boolParam(request, 'blocked');

    let rows = [...db.players];
    if (status !== null) rows = rows.filter((row) => row.status === status);
    if (telegramUserId !== null) {
      rows = rows.filter((row) => row.telegramUserId === telegramUserId);
    }
    if (linked !== undefined) rows = rows.filter((row) => row.ichancyLinked === linked);
    if (source !== null) rows = rows.filter((row) => row.source === source);
    // `blocked=false` HIDES the blocked rows, which is a different filter from no opinion.
    if (blocked !== undefined) rows = rows.filter((row) => (row.status === 'BLOCKED') === blocked);
    if (search !== null) {
      const needle = search.toLowerCase();
      // The Ichancy login too: an imported row has no name and no Telegram, and its login is the
      // only handle the operator knows it by.
      rows = rows.filter((row) =>
        [
          row.firstName,
          row.lastName,
          row.telegramUsername,
          row.telegramUserId,
          row.phone,
          row.ichancyLogin,
        ]
          .filter((value): value is string => typeof value === 'string')
          .some((value) => value.toLowerCase().includes(needle)),
      );
    }

    const page = offsetPage(forTenant(request, rows), request);
    return ok(page.data, page.meta);
  }),

  http.get(url('/v1/admin/players/:id'), ({ params }) => {
    const player = db.players.find((row) => row.id === String(params.id));
    return player === undefined ? fail(404, 'PLAYER_NOT_FOUND', 'Player not found.') : ok(player);
  }),

  /**
   * One player's live balance.
   *
   * Deliberately models the two failure modes the real endpoint has, because the column is built
   * around them and a mock that always succeeds would let the "unknown, never zero" rule rot:
   *   - a player with no Ichancy account is refused rather than answered with 0
   *   - one specific player always fails, so demo mode and the tests both show a broken cell
   *     next to working ones
   */
  http.get(url('/v1/admin/players/:id/balance'), ({ params }) => {
    const player = db.players.find((row) => row.id === String(params.id));
    if (player === undefined) return fail(404, 'PLAYER_NOT_FOUND', 'Player not found.');

    if (!player.ichancyLinked) {
      return fail(
        422,
        'PLAYER_BALANCE_NOT_LINKED',
        'This player has no Ichancy account, so there is no balance to read.',
      );
    }

    if (mockBalanceAlwaysFailsFor(player.id)) {
      return fail(
        503,
        'PLAYER_BALANCE_UNREADABLE',
        "Could not read this player's balance from Ichancy: getPlayerBalanceById timed out",
      );
    }

    return ok({
      playerId: player.id,
      balanceMinor: mockBalanceMinorFor(player.id),
      currencyCode: player.currencyCode,
      readAt: new Date().toISOString(),
    });
  }),

  http.post(url('/v1/admin/players/:id/ichancy-account'), ({ params }) => {
    const player = db.players.find((row) => row.id === String(params.id));
    if (player === undefined) return fail(404, 'PLAYER_NOT_FOUND', 'Player not found.');
    return ok(linkIchancyAccount(player));
  }),

  /**
   * Registering a player from the console.
   *
   * Two refusals the dialog is built against: a Telegram id that is not a number (400 naming the
   * field) and one another player already holds (409). The Ichancy link, when asked for, happens
   * AFTER the row exists and is reported beside it — a failed link is `ichancy: null` plus an
   * `ichancyError`, never a failed registration.
   */
  http.post(url('/v1/admin/players'), async ({ request }) => {
    const refused = refusedFor(request, 'players.write', 'Your role cannot register a player.');
    if (refused !== null) return refused;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const telegramUserId = textField(body.telegramUserId);
    if (telegramUserId.length > 0 && !TELEGRAM_USER_ID_PATTERN.test(telegramUserId)) {
      return fail(400, 'VALIDATION_FAILED', 'The request payload is invalid.', {
        fields: ['telegramUserId must be a positive integer as a string'],
      });
    }
    if (
      telegramUserId.length > 0 &&
      db.players.some((row) => row.telegramUserId === telegramUserId)
    ) {
      return fail(
        409,
        'PLAYER_TELEGRAM_ID_TAKEN',
        'Another player in this operator already holds that Telegram id.',
      );
    }

    const player = registerPlayer({
      telegramUserId: telegramUserId.length > 0 ? telegramUserId : null,
      firstName: textField(body.firstName) || null,
      lastName: textField(body.lastName) || null,
      phone: textField(body.phone) || null,
    });

    if (body.createIchancyAccount !== true) {
      return ok({ player, ichancy: null, ichancyError: null }, {}, 201);
    }

    // The one registration whose link fails, so the dialog's "created, but not linked" arm exists
    // in the demo and not only in a test that remembers to fake it: a phone ending in 000.
    if (player.phone?.endsWith('000') === true) {
      return ok(
        {
          player,
          ichancy: null,
          ichancyError:
            'Ichancy did not answer within 15s; the player was created without an account.',
        },
        {},
        201,
      );
    }

    return ok({ player, ichancy: linkIchancyAccount(player), ichancyError: null }, {}, 201);
  }),

  http.post(url('/v1/admin/players/:id/block'), async ({ params, request }) => {
    const refused = refusedFor(request, 'players.block', 'Your role cannot block a player.');
    if (refused !== null) return refused;

    const player = db.players.find((row) => row.id === String(params.id));
    if (player === undefined) return fail(404, 'PLAYER_NOT_FOUND', 'Player not found.');

    const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
    const reason = textField(body.reason);
    if (reason.length === 0 || reason.length > BLOCK_REASON_MAX_LENGTH) {
      return fail(400, 'VALIDATION_FAILED', 'The request payload is invalid.', {
        fields: [`reason must be between 1 and ${BLOCK_REASON_MAX_LENGTH} characters`],
      });
    }

    if (player.status === 'BLOCKED') {
      return fail(409, 'PLAYER_ALREADY_BLOCKED', 'This player is already blocked.');
    }
    // A closed account is gone; there is nothing left to lock.
    if (player.status === 'CLOSED') {
      return fail(409, 'PLAYER_NOT_ACTIVE', 'A closed player cannot be blocked.');
    }

    blockPlayer(player, reason);
    return ok(player);
  }),

  http.post(url('/v1/admin/players/:id/unblock'), ({ params, request }) => {
    const refused = refusedFor(request, 'players.block', 'Your role cannot unblock a player.');
    if (refused !== null) return refused;

    const player = db.players.find((row) => row.id === String(params.id));
    if (player === undefined) return fail(404, 'PLAYER_NOT_FOUND', 'Player not found.');
    if (player.status !== 'BLOCKED') {
      return fail(409, 'PLAYER_NOT_BLOCKED', 'This player is not blocked.');
    }

    unblockPlayer(player);
    return ok(player);
  }),

  /**
   * Attaching a Telegram id to a row that has none. Refused for a row that already has one — that
   * would be REPOINTING an account, which is a different and more dangerous act — and for an id
   * another player holds.
   */
  http.patch(url('/v1/admin/players/:id/telegram'), async ({ params, request }) => {
    const refused = refusedFor(
      request,
      'players.write',
      'Your role cannot attach a Telegram account.',
    );
    if (refused !== null) return refused;

    const player = db.players.find((row) => row.id === String(params.id));
    if (player === undefined) return fail(404, 'PLAYER_NOT_FOUND', 'Player not found.');

    const body = (await request.json().catch(() => ({}))) as { telegramUserId?: unknown };
    const telegramUserId = textField(body.telegramUserId);
    if (!TELEGRAM_USER_ID_PATTERN.test(telegramUserId)) {
      return fail(400, 'VALIDATION_FAILED', 'The request payload is invalid.', {
        fields: ['telegramUserId must be a positive integer as a string'],
      });
    }
    if (player.telegramUserId !== null) {
      return fail(
        409,
        'PLAYER_HAS_TELEGRAM',
        'This player already has a Telegram account; attaching is only for rows without one.',
      );
    }
    if (db.players.some((row) => row.telegramUserId === telegramUserId)) {
      return fail(
        409,
        'PLAYER_TELEGRAM_ID_TAKEN',
        'Another player in this operator already holds that Telegram id.',
      );
    }

    player.telegramUserId = telegramUserId;
    return ok(player);
  }),

  /**
   * Pulling the agent's existing players in. Idempotent by construction: a second run finds every
   * row `existing`, which is what makes the button safe to press twice.
   */
  http.post(url('/v1/admin/players/import'), async ({ request }) => {
    const refused = refusedFor(request, 'players.import', 'Your role cannot import players.');
    if (refused !== null) return refused;

    const body = (await request.json().catch(() => ({}))) as { limit?: unknown };
    const limit = typeof body.limit === 'number' && Number.isFinite(body.limit) ? body.limit : 2000;
    if (limit < 1) {
      return fail(400, 'VALIDATION_FAILED', 'The request payload is invalid.', {
        fields: ['limit must be at least 1'],
      });
    }
    return ok(importPlayers(limit));
  }),

  /**
   * Manual debit: money taken back OUT of a player's Ichancy account.
   *
   * Everything here is a mirror of a rule the backend has, and each one is a rule the console has to
   * be built against rather than told about: 403 for a role that may not decide money, 400 for an
   * amount that is not minor units or a reason nobody wrote, 409 for a player with no Ichancy
   * account to debit, and a 200 whose `status` is the only thing that says which of the three
   * endings actually happened.
   */
  http.post(url('/v1/admin/players/:id/debit'), async ({ params, request }) => {
    const player = db.players.find((row) => row.id === String(params.id));
    if (player === undefined) return fail(404, 'PLAYER_NOT_FOUND', 'Player not found.');

    // Null when the token carries no role — a test client rather than a signed-in operator. The
    // real server always knows the role; refusing an unknown one here would break every test.
    const role = callerRole(request);
    if (role !== null && !DEBIT_ROLES.has(role)) {
      return fail(403, 'FORBIDDEN', 'Your role cannot debit a player.');
    }

    const body = (await request.json().catch(() => ({}))) as {
      amountMinor?: unknown;
      reason?: unknown;
    };

    const fields: string[] = [];
    // A STRING of minor units, and nothing else: a number here would already have been rounded by
    // the time it arrived, and "1500.00" is a decimal amount rather than the minor units asked for.
    const amountMinor = typeof body.amountMinor === 'string' ? body.amountMinor.trim() : '';
    if (!/^\d{1,18}$/.test(amountMinor)) {
      fields.push('amountMinor must be minor units as a digits-only string');
    } else if (BigInt(amountMinor) <= 0n) {
      fields.push('amountMinor must be greater than zero');
    }

    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (reason.length === 0 || reason.length > DEBIT_REASON_MAX_LENGTH) {
      fields.push(`reason must be between 1 and ${DEBIT_REASON_MAX_LENGTH} characters`);
    }

    if (fields.length > 0) {
      return fail(400, 'VALIDATION_FAILED', 'The request payload is invalid.', { fields });
    }

    if (!player.ichancyLinked) {
      return fail(
        409,
        'PLAYER_NOT_LINKED',
        'This player has no Ichancy account, so there is nothing to debit.',
      );
    }

    return ok(debitPlayer(player, BigInt(amountMinor), reason));
  }),

  /**
   * POST /v1/admin/deposits/manual — crediting a player by recording a manual deposit.
   *
   * Built against the same rules the backend enforces: 403 for a role that may not decide money, 400
   * for a malformed amount or a missing reason, 422 for an amount below the casino minimum, 404 for an
   * unknown player. Unlike a debit there is NO not-linked refusal — the deposit spine links a new
   * Ichancy account on the way to crediting it. 202, because the credit is queued, not done.
   */
  http.post(url('/v1/admin/deposits/manual'), async ({ request }) => {
    const role = callerRole(request);
    if (role !== null && !DEBIT_ROLES.has(role)) {
      return fail(403, 'FORBIDDEN', 'Your role cannot credit a player.');
    }

    const body = (await request.json().catch(() => ({}))) as {
      playerId?: unknown;
      amountMinor?: unknown;
      reason?: unknown;
    };

    const playerId = typeof body.playerId === 'string' ? body.playerId : '';
    const player = db.players.find((row) => row.id === playerId);
    if (player === undefined) return fail(404, 'PLAYER_NOT_FOUND', 'Player not found.');

    const fields: string[] = [];
    const amountMinor = typeof body.amountMinor === 'string' ? body.amountMinor.trim() : '';
    if (!/^\d{1,18}$/.test(amountMinor)) {
      fields.push('amountMinor must be minor units as a digits-only string');
    } else if (BigInt(amountMinor) <= 0n) {
      fields.push('amountMinor must be greater than zero');
    }

    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (reason.length === 0 || reason.length > CREDIT_REASON_MAX_LENGTH) {
      fields.push(`reason must be between 1 and ${CREDIT_REASON_MAX_LENGTH} characters`);
    }

    if (fields.length > 0) {
      return fail(400, 'VALIDATION_FAILED', 'The request payload is invalid.', { fields });
    }

    if (BigInt(amountMinor) < MANUAL_CREDIT_MIN_MINOR) {
      return fail(
        422,
        'AMOUNT_BELOW_MINIMUM',
        `A credit must be at least ${formatMinorToDecimal(MANUAL_CREDIT_MIN_MINOR)} ${player.currencyCode} — Ichancy refuses less.`,
      );
    }

    return ok(manualCredit(player, BigInt(amountMinor)), {}, 202);
  }),

  // ── Withdrawals (player cash-out) ────────────────────────────────────────────────────────────

  /*
   * The queue, offset-paginated. No status means EVERY status — unlike the deposit queue, whose
   * backend defaults to the reviewable set, the withdrawal backend narrows only when asked. The
   * console's own screen decides its default in the URL, where it is visible.
   */
  http.get(url('/v1/admin/withdrawals'), ({ request }) => {
    const refused = refusedFor(request, 'withdrawals.read', 'Your role cannot read withdrawals.');
    if (refused !== null) return refused;

    const statuses = listParam(request, 'status');
    const playerId = param(request, 'playerId');
    const shortId = param(request, 'shortId');
    const createdFrom = param(request, 'createdFrom');
    const createdTo = param(request, 'createdTo');
    const sort = param(request, 'sort');

    let rows = [...db.withdrawals];
    if (statuses.length > 0) rows = rows.filter((row) => statuses.includes(row.status));
    if (playerId !== null) rows = rows.filter((row) => row.playerId === playerId);
    if (shortId !== null) {
      rows = rows.filter((row) => row.shortId.toUpperCase().includes(shortId.toUpperCase()));
    }
    if (createdFrom !== null) {
      rows = rows.filter((row) => Date.parse(row.requestedAt) >= Date.parse(createdFrom));
    }
    if (createdTo !== null) {
      rows = rows.filter((row) => Date.parse(row.requestedAt) <= Date.parse(createdTo));
    }

    const byRequested = (a: AdminWithdrawal, b: AdminWithdrawal) =>
      Date.parse(b.requestedAt) - Date.parse(a.requestedAt);
    rows.sort(sort === 'oldest' ? (a, b) => -byRequested(a, b) : byRequested);

    const page = offsetPage(forTenant(request, rows), request);
    return ok(page.data, page.meta);
  }),

  http.get(url('/v1/admin/withdrawals/:id'), ({ params, request }) => {
    const refused = refusedFor(request, 'withdrawals.read', 'Your role cannot read withdrawals.');
    if (refused !== null) return refused;

    const withdrawal = findWithdrawal(String(params.id));
    return withdrawal === undefined
      ? fail(404, 'WITHDRAWAL_NOT_FOUND', 'Withdrawal not found.')
      : ok(withdrawal);
  }),

  /*
   * The three decisions. Each is refused with 409 WITHDRAWAL_INVALID_STATE when the row is not in
   * the one state it acts on — a colleague may have decided first, and the console must render
   * that as "already handled" rather than as a failure of the click.
   */
  http.post(url('/v1/admin/withdrawals/:id/approve'), ({ params, request }) => {
    const refused = refusedFor(
      request,
      'withdrawals.decide',
      'Your role cannot decide a withdrawal.',
    );
    if (refused !== null) return refused;

    const withdrawal = findWithdrawal(String(params.id));
    if (withdrawal === undefined) return fail(404, 'WITHDRAWAL_NOT_FOUND', 'Withdrawal not found.');
    if (withdrawal.status !== 'REQUESTED') {
      return fail(
        409,
        'WITHDRAWAL_INVALID_STATE',
        `Only a REQUESTED withdrawal can be approved; this one is ${withdrawal.status}.`,
      );
    }
    return ok(approveWithdrawal(withdrawal));
  }),

  http.post(url('/v1/admin/withdrawals/:id/reject'), async ({ params, request }) => {
    const refused = refusedFor(
      request,
      'withdrawals.decide',
      'Your role cannot decide a withdrawal.',
    );
    if (refused !== null) return refused;

    const withdrawal = findWithdrawal(String(params.id));
    if (withdrawal === undefined) return fail(404, 'WITHDRAWAL_NOT_FOUND', 'Withdrawal not found.');

    const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
    const reason = textField(body.reason);
    if (reason.length === 0 || reason.length > WITHDRAWAL_REJECTION_REASON_MAX_LENGTH) {
      return fail(400, 'VALIDATION_FAILED', 'The request payload is invalid.', {
        fields: [
          `reason must be between 1 and ${WITHDRAWAL_REJECTION_REASON_MAX_LENGTH} characters`,
        ],
      });
    }
    if (withdrawal.status !== 'REQUESTED') {
      return fail(
        409,
        'WITHDRAWAL_INVALID_STATE',
        `Only a REQUESTED withdrawal can be rejected; this one is ${withdrawal.status}.`,
      );
    }
    return ok(rejectWithdrawal(withdrawal, reason));
  }),

  http.post(url('/v1/admin/withdrawals/:id/mark-paid'), async ({ params, request }) => {
    const refused = refusedFor(
      request,
      'withdrawals.decide',
      'Your role cannot decide a withdrawal.',
    );
    if (refused !== null) return refused;

    const withdrawal = findWithdrawal(String(params.id));
    if (withdrawal === undefined) return fail(404, 'WITHDRAWAL_NOT_FOUND', 'Withdrawal not found.');

    const body = (await request.json().catch(() => ({}))) as { payoutReference?: unknown };
    const payoutReference = textField(body.payoutReference);
    if (payoutReference.length === 0 || payoutReference.length > PAYOUT_REFERENCE_MAX_LENGTH) {
      return fail(400, 'VALIDATION_FAILED', 'The request payload is invalid.', {
        fields: [`payoutReference must be between 1 and ${PAYOUT_REFERENCE_MAX_LENGTH} characters`],
      });
    }
    if (withdrawal.status !== 'DEBITED') {
      return fail(
        409,
        'WITHDRAWAL_INVALID_STATE',
        `Only a DEBITED withdrawal can be marked paid; this one is ${withdrawal.status}.`,
      );
    }
    return ok(markWithdrawalPaid(withdrawal, payoutReference));
  }),

  // ── Payment methods ──────────────────────────────────────────────────────────────────────────
  http.get(url('/v1/admin/payment-methods'), ({ request }) => {
    const isActive = boolParam(request, 'isActive');
    const rail = param(request, 'rail');
    let rows = [...db.methods];
    if (isActive !== undefined) rows = rows.filter((row) => row.isActive === isActive);
    if (rail !== null) rows = rows.filter((row) => row.rail === rail);
    return ok(rows.sort((a, b) => a.sortOrder - b.sortOrder));
  }),

  http.get(url('/v1/admin/payment-methods/:id/destinations'), ({ params, request }) => {
    const includeInactive = boolParam(request, 'includeInactive') ?? false;
    const rows = db.destinations
      .filter((row) => row.paymentMethodId === String(params.id))
      .filter((row) => includeInactive || row.isActive)
      .sort((a, b) => a.priority - b.priority);
    return ok(rows);
  }),

  http.get(url('/v1/admin/payment-methods/:id'), ({ params }) => {
    const method = db.methods.find((row) => row.id === String(params.id));
    return method === undefined
      ? fail(404, 'PAYMENT_METHOD_NOT_FOUND', 'That payment method does not exist.')
      : ok(method);
  }),

  http.post(url('/v1/admin/payment-methods'), async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    if (db.methods.some((row) => row.code === body.code)) {
      return fail(
        409,
        'PAYMENT_METHOD_ALREADY_EXISTS',
        'A record with these values already exists.',
      );
    }
    return ok(createMethod(body), {}, 201);
  }),

  http.patch(url('/v1/admin/payment-methods/:id'), async ({ params, request }) => {
    const method = db.methods.find((row) => row.id === String(params.id));
    if (method === undefined) {
      return fail(404, 'PAYMENT_METHOD_NOT_FOUND', 'That payment method does not exist.');
    }
    Object.assign(method, await request.json(), { updatedAt: nowIso() });
    return ok(method);
  }),

  http.delete(url('/v1/admin/payment-methods/:id'), ({ params }) => {
    const method = db.methods.find((row) => row.id === String(params.id));
    if (method === undefined) {
      return fail(404, 'PAYMENT_METHOD_NOT_FOUND', 'That payment method does not exist.');
    }
    method.isActive = false;
    method.updatedAt = nowIso();
    return ok(method);
  }),

  /*
   * Registered AFTER the retire route above, and that ordering is load-bearing in MSW: a `:id`
   * pattern would happily swallow `<id>/permanent` if it were declared first, and the demo would
   * quietly deactivate where it was asked to delete — the exact confusion this endpoint exists to
   * avoid. Distinct suffix, distinct handler, checked in the order written.
   */
  http.delete(url('/v1/admin/payment-methods/:id/permanent'), ({ params }) => {
    const method = db.methods.find((row) => row.id === String(params.id));
    if (method === undefined) {
      return fail(404, 'PAYMENT_METHOD_NOT_FOUND', 'That payment method does not exist.');
    }
    const deleted = deleteMethod(method.id);
    if (deleted === null) {
      return fail(
        409,
        'PAYMENT_METHOD_HAS_HISTORY',
        'Deposits were made through this method, and the record of where that money was sent has ' +
          'to stay. Deactivate it instead.',
      );
    }
    return ok(deleted);
  }),

  http.post(url('/v1/admin/payment-methods/:id/destinations'), async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return ok(createDestination(String(params.id), body), {}, 201);
  }),

  http.patch(url('/v1/admin/payment-destinations/:id'), async ({ params, request }) => {
    const destination = db.destinations.find((row) => row.id === String(params.id));
    if (destination === undefined) {
      return fail(404, 'DESTINATION_NOT_FOUND', 'That destination does not exist.');
    }
    Object.assign(destination, await request.json(), { updatedAt: nowIso() });
    return ok(destination);
  }),

  http.delete(url('/v1/admin/payment-destinations/:id'), ({ params }) => {
    const destination = db.destinations.find((row) => row.id === String(params.id));
    if (destination === undefined) {
      return fail(404, 'DESTINATION_NOT_FOUND', 'That destination does not exist.');
    }
    destination.isActive = false;
    destination.updatedAt = nowIso();
    return ok(destination);
  }),

  /*
   * The hand-typed ("declared") balance. A nulled `balance` clears all four fields together, because
   * a balance is one fact — an amount without its currency, or the reverse, is not a state this
   * screen can render. The real backend stores minor units and returns them formatted; the mock does
   * not recompute minor units (nothing reads them), it just echoes the figure the operator typed.
   */
  http.patch(
    url('/v1/admin/payment-destinations/:id/declared-balance'),
    async ({ params, request }) => {
      const destination = db.destinations.find((row) => row.id === String(params.id));
      if (destination === undefined) {
        return fail(404, 'DESTINATION_NOT_FOUND', 'That destination does not exist.');
      }
      const body = (await request.json()) as { balance: string | null; currency: string | null };

      if (body.balance === null || body.currency === null) {
        destination.declaredBalance = null;
        destination.declaredBalanceMinor = null;
        destination.declaredBalanceCurrency = null;
        destination.declaredBalanceUpdatedAt = null;
        destination.declaredBalanceSetByAdminId = null;
      } else {
        destination.declaredBalance = body.balance;
        destination.declaredBalanceMinor = body.balance;
        destination.declaredBalanceCurrency = body.currency;
        destination.declaredBalanceUpdatedAt = nowIso();
        destination.declaredBalanceSetByAdminId = 'mock-admin';
      }
      destination.updatedAt = nowIso();
      return ok(destination);
    },
  ),

  /*
   * The one read on this screen that leaves the building.
   *
   * It answers 200 with a NULL balance when the chain could not be read — see ./wallet-balance for
   * which wallets do that and why the mock insists on being able to fail. A failure is not a 5xx
   * here because the request was fine; it is the ANSWER that is missing, and a screen has to be
   * able to say that without pretending the wallet is empty.
   */
  http.get(url('/v1/admin/payment-destinations/:id/balance'), ({ params, request }) => {
    // Roleless tokens pass, for the reason the exchange-rate route above gives.
    const role = callerRole(request);
    if (role !== null && !can(role, 'paymentMethods.read')) {
      return fail(403, 'INSUFFICIENT_ROLE', 'Your role cannot read the payment configuration.');
    }

    const destination = db.destinations.find((row) => row.id === String(params.id));
    if (destination === undefined) {
      return fail(404, 'DESTINATION_NOT_FOUND', 'That destination does not exist.');
    }

    /*
     * The RAIL decides whether there is a chain to ask, exactly as the chain-check route above does
     * and exactly as the financial card does before it mounts the balance at all. Never the CODE:
     * this handler used to consult a `USDT_TRC20`/`USDT_BEP20` table first, which answered for none
     * of the rails an operator actually creates and overrode the address for the two it knew.
     *
     * A non-crypto rail is refused rather than answered, because the question is malformed: a bank
     * account has no chain, and a 200 carrying `network: null` would invite a screen to render an
     * empty balance beside a Damascus cashier's account number.
     */
    const method = db.methods.find((row) => row.id === destination.paymentMethodId);
    if (method?.rail !== 'CRYPTO') {
      return fail(
        409,
        'DESTINATION_NOT_ON_CHAIN',
        'That destination is a bank or wallet account, not a chain address. There is no chain to ask.',
      );
    }

    // Which chain comes from the address, the one thing here that cannot lie about it.
    return ok(mockWalletBalance(destination.accountIdentifier.trim(), nowIso()));
  }),

  // ── Admin directory ──────────────────────────────────────────────────────────────────────────
  http.get(url('/v1/admin/admins'), ({ request }) => {
    const role = param(request, 'role');
    const isActive = boolParam(request, 'isActive');
    let rows = [...db.admins];
    if (role !== null) rows = rows.filter((row) => row.role === role);
    if (isActive !== undefined) rows = rows.filter((row) => row.isActive === isActive);
    const page = offsetPage(forTenant(request, rows), request);
    return ok(page.data, page.meta);
  }),

  http.get(url('/v1/admin/admins/:id/approval-limits'), ({ params }) =>
    ok(
      db.approvalLimits
        .filter((row) => row.adminUserId === String(params.id))
        .sort((a, b) => Date.parse(b.effectiveFrom) - Date.parse(a.effectiveFrom)),
    ),
  ),

  http.post(url('/v1/admin/admins/:id/approval-limits'), async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return ok(setApprovalLimit(String(params.id), body), {}, 201);
  }),

  http.delete(url('/v1/admin/approval-limits/:id'), ({ params }) => {
    const limit = db.approvalLimits.find((row) => row.id === String(params.id));
    if (limit === undefined) {
      return fail(404, 'APPROVAL_LIMIT_NOT_FOUND', 'That approval limit does not exist.');
    }
    limit.effectiveTo = nowIso();
    return ok(limit);
  }),

  http.get(url('/v1/admin/admins/:id'), ({ params }) => {
    const admin = db.admins.find((row) => row.id === String(params.id));
    return admin === undefined ? fail(404, 'ADMIN_NOT_FOUND', 'Admin not found.') : ok(admin);
  }),

  http.post(url('/v1/admin/admins'), async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;

    // A staff account IS a username and a password; the server's DTO requires both.
    const username = (typeof body.username === 'string' ? body.username : '').trim().toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    if (username.length < 3 || !/^[A-Za-z0-9._@+-]+$/.test(username)) {
      return fail(422, 'VALIDATION_FAILED', 'Validation failed.', {
        fields: [
          'username may contain letters, digits and . _ @ + - only, and is 3 to 64 characters',
        ],
      });
    }
    if (password.length < 8) {
      return fail(422, 'VALIDATION_FAILED', 'Validation failed.', {
        fields: ['password must be at least 8 characters'],
      });
    }

    // Compared lower-cased on both sides: `@@unique([tenantId, username])` is case-sensitive in
    // Postgres, which is exactly why the server folds case before it writes.
    if (db.admins.some((row) => row.username?.toLowerCase() === username)) {
      return fail(
        409,
        'ADMIN_ALREADY_EXISTS',
        'That username is already taken by another administrator in this operator.',
      );
    }
    return ok(createAdmin(body), {}, 201);
  }),

  http.patch(url('/v1/admin/admins/:id'), async ({ params, request }) => {
    const admin = db.admins.find((row) => row.id === String(params.id));
    if (admin === undefined) return fail(404, 'ADMIN_NOT_FOUND', 'Admin not found.');
    if (admin.id === db.currentAdmin.id) {
      return fail(422, 'ADMIN_SELF_MODIFICATION', 'You cannot change your own admin record.');
    }
    const { password, ...rest } = (await request.json()) as { password?: unknown };
    Object.assign(admin, rest);
    // `password` is never stored or returned — only whether one is set. Omitted means "unchanged".
    if (typeof password === 'string' && password.length > 0) admin.hasPassword = true;
    return ok(admin);
  }),

  http.delete(url('/v1/admin/admins/:id'), ({ params }) => {
    const admin = db.admins.find((row) => row.id === String(params.id));
    if (admin === undefined) return fail(404, 'ADMIN_NOT_FOUND', 'Admin not found.');
    if (admin.id === db.currentAdmin.id) {
      return fail(422, 'ADMIN_SELF_MODIFICATION', 'You cannot deactivate yourself.');
    }
    const activeSupers = db.admins.filter((row) => row.role === 'SUPER_ADMIN' && row.isActive);
    if (admin.role === 'SUPER_ADMIN' && activeSupers.length <= 1) {
      return fail(422, 'ADMIN_LAST_SUPER_ADMIN', 'The last active super admin cannot be removed.');
    }
    admin.isActive = false;
    return ok(admin);
  }),

  /**
   * A one-time Telegram link code. The staff member for their own account, or platform staff — never
   * a SUPER_ADMIN for someone else: whoever sees the code can send it from their own Telegram.
   * "Self" is `db.currentAdmin`, the mock session's identity.
   */
  http.post(url('/v1/admin/admins/:id/telegram-link-code'), ({ params, request }) => {
    const adminId = String(params.id);
    const role = callerRole(request);
    if (role !== null && role !== 'PLATFORM_ADMIN' && adminId !== db.currentAdmin.id) {
      return fail(
        403,
        'ADMIN_TELEGRAM_LINK_FORBIDDEN',
        'Only the staff member themselves, or a platform admin, can get a Telegram link code for an account.',
      );
    }
    // Tenant zero has no bot, so no code is issued there for any row, checked before the row is even
    // looked up. The mock knows the tenant a request is for only through a platform admin's
    // X-Tenant-Id; every other role is treated as working in its operator.
    const effectiveTenantId = requestedTenant(request) ?? TENANT_ZERO_ID;
    if (role === 'PLATFORM_ADMIN' && effectiveTenantId === TENANT_ZERO_ID) {
      return fail(422, 'ADMIN_TELEGRAM_LINK_NOT_ALLOWED', PLATFORM_LINK_MESSAGE, {
        reason: 'PLATFORM',
      });
    }
    const admin = db.admins.find((row) => row.id === adminId);
    if (admin === undefined) return fail(404, 'ADMIN_NOT_FOUND', 'Administrator not found.');
    // Before "inactive", as the backend checks it: the reserved "0" is never a person.
    if (isAgentPrincipal(admin)) {
      return fail(422, 'ADMIN_TELEGRAM_LINK_NOT_ALLOWED', AGENT_PRINCIPAL_LINK_MESSAGE, {
        reason: 'AGENT_PRINCIPAL',
      });
    }
    if (!admin.isActive) {
      return fail(
        422,
        'ADMIN_TELEGRAM_LINK_NOT_ALLOWED',
        'This staff account is deactivated. Reactivate it before linking it to Telegram.',
        { reason: 'INACTIVE' },
      );
    }
    if (admin.telegramLinked) {
      return fail(
        409,
        'ADMIN_TELEGRAM_ALREADY_LINKED',
        'This staff account is already linked to a Telegram account. Remove that link first.',
      );
    }
    const botUsername = db.tenants.find((row) => row.id === effectiveTenantId)?.botUsername ?? null;
    return ok(issueStaffLinkCode(admin, botUsername));
  }),

  /**
   * The staff member, a SUPER_ADMIN of the operator, or platform staff. Idempotent. A PLATFORM_ADMIN
   * row only by someone who could grant that role: a platform admin with no tenant override. The agent
   * principal never, whoever asks.
   */
  http.delete(url('/v1/admin/admins/:id/telegram-link'), ({ params, request }) => {
    const adminId = String(params.id);
    const role = callerRole(request);
    if (
      role !== null &&
      role !== 'PLATFORM_ADMIN' &&
      role !== 'SUPER_ADMIN' &&
      adminId !== db.currentAdmin.id
    ) {
      return fail(
        403,
        'ADMIN_TELEGRAM_LINK_FORBIDDEN',
        "Only the staff member, a super admin of this operator or a platform admin can remove an account's Telegram link.",
      );
    }
    const admin = db.admins.find((row) => row.id === adminId);
    if (admin === undefined) return fail(404, 'ADMIN_NOT_FOUND', 'Administrator not found.');
    if (
      role !== null &&
      adminId !== db.currentAdmin.id &&
      admin.role === 'PLATFORM_ADMIN' &&
      (role !== 'PLATFORM_ADMIN' || requestedTenant(request) !== null)
    ) {
      return fail(
        403,
        'ADMIN_TELEGRAM_LINK_FORBIDDEN',
        'Only platform staff working in the platform itself can change a platform admin.',
      );
    }
    if (isAgentPrincipal(admin)) {
      return fail(422, 'ADMIN_TELEGRAM_LINK_NOT_ALLOWED', AGENT_PRINCIPAL_LINK_MESSAGE, {
        reason: 'AGENT_PRINCIPAL',
      });
    }
    return ok(unlinkStaffTelegram(admin));
  }),

  // ── Reconciliation ───────────────────────────────────────────────────────────────────────────
  http.get(url('/v1/admin/reconciliation/breaks'), ({ request }) => {
    const statuses = listParam(request, 'status');
    const categories = listParam(request, 'category');
    const minSeverity = param(request, 'minSeverity');

    let rows = db.breaks.filter((row) =>
      statuses.length > 0
        ? statuses.includes(row.status)
        : row.status === 'OPEN' || row.status === 'INVESTIGATING',
    );
    if (categories.length > 0) rows = rows.filter((row) => categories.includes(row.category));
    if (minSeverity !== null) {
      rows = rows.filter((row) => row.severity >= Number(minSeverity));
    }

    rows = rows.sort((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt));
    const page = cursorPage(rows, request);
    return ok(page.data, page.meta);
  }),

  /*
   * The top bar asks for this on every screen, so it is deliberately the cheapest handler here:
   * one ledger figure and the operator's watermark, no Ichancy call and no pagination.
   */
  http.get(url('/v1/admin/reconciliation/agent-float'), () => ok(agentFloatView())),

  http.get(url('/v1/admin/reconciliation/rail-ageing'), () =>
    ok({ ...db.railAgeing, generatedAt: nowIso() }),
  ),

  http.post(url('/v1/admin/reconciliation/agent-float/sync'), () => ok(syncAgentFloat())),

  http.post(url('/v1/admin/reconciliation/invariants/run'), () =>
    ok({ ok: true, checkedAt: nowIso(), violations: [], truncated: false }),
  ),

  http.get(url('/v1/admin/reconciliation/breaks/:id'), ({ params }) => {
    const row = db.breaks.find((entry) => entry.id === String(params.id));
    return row === undefined ? fail(404, 'BREAK_NOT_FOUND', 'Break not found.') : ok(row);
  }),

  http.post(url('/v1/admin/reconciliation/breaks/:id/assign'), ({ params }) => {
    const row = db.breaks.find((entry) => entry.id === String(params.id));
    if (row === undefined) return fail(404, 'BREAK_NOT_FOUND', 'Break not found.');
    row.assignedToAdminId = db.currentAdmin.id;
    row.status = 'INVESTIGATING';
    return ok(row);
  }),

  http.post(url('/v1/admin/reconciliation/breaks/:id/resolve'), async ({ params, request }) => {
    const row = db.breaks.find((entry) => entry.id === String(params.id));
    if (row === undefined) return fail(404, 'BREAK_NOT_FOUND', 'Break not found.');

    const body = (await request.json()) as { status?: string; note?: string };
    if (body.status === undefined || body.note === undefined || body.note.trim().length === 0) {
      return fail(400, 'VALIDATION_FAILED', 'The request payload is invalid.', {
        fields: ['note should not be empty'],
      });
    }

    row.status = body.status;
    row.resolvedAt = nowIso();
    row.resolvedByAdminId = db.currentAdmin.id;
    row.resolutionNote = body.note;
    return ok(row);
  }),

  http.post(
    url('/v1/admin/reconciliation/breaks/:id/correct-float'),
    async ({ params, request }) => {
      const body = (await request.json()) as { note?: string };
      return ok(correctFloat(String(params.id), body.note ?? ''));
    },
  ),

  // ── Tenants ──────────────────────────────────────────────────────────────────────────────────
  http.get(url('/v1/admin/tenants'), () => ok({ tenants: db.tenants.map(tenantView) })),

  http.get(url('/v1/admin/tenants/:id'), ({ params }) => {
    const tenant = db.tenants.find((row) => row.id === String(params.id));
    return tenant === undefined
      ? fail(404, 'TENANT_NOT_FOUND', 'Tenant not found.')
      : ok(tenantView(tenant));
  }),

  /**
   * Four required fields; everything else is resolved here and answered in the TenantView, so the
   * console can show what the operator actually got rather than what it typed.
   */
  http.post(url('/v1/admin/tenants'), async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;

    // The one field with nowhere left to fall back to. Ichancy signin returns a token pair and
    // nothing else, so an agent id that is neither supplied, nor in the platform defaults, nor on
    // tenant zero cannot be invented — 400 naming the field, like every other validation failure.
    if (resolveIchancyAgentId(body) === null) {
      return fail(400, 'VALIDATION_FAILED', 'The request payload is invalid.', {
        fields: [
          'ichancyAgentId is required: no platform default and no tenant zero to fall back to',
        ],
      });
    }

    // Only a slug the caller CHOSE can collide. A derived one is de-duplicated as it is generated.
    if (typeof body.slug === 'string' && db.tenants.some((row) => row.slug === body.slug)) {
      return fail(409, 'DUPLICATE_RESOURCE', 'A record with these values already exists.', {
        fields: ['slug'],
      });
    }

    const { tenant, provisioning } = createTenant(body);
    // Flattened, exactly as the backend answers it: `{ ...TenantView, provisioning }`.
    return ok({ ...tenantView(tenant), provisioning }, {}, 201);
  }),

  /**
   * A CHANGED staff or feed chat is a bind: verified first, and nothing is written when either is
   * refused. An unchanged one — the edit form sends the chat back on every save — verifies nothing.
   */
  http.patch(url('/v1/admin/tenants/:id'), async ({ params, request }) => {
    const tenant = db.tenants.find((row) => row.id === String(params.id));
    if (tenant === undefined) return fail(404, 'TENANT_NOT_FOUND', 'Tenant not found.');

    const body = (await request.json()) as Record<string, unknown>;
    const verified: Partial<Record<'adminChatId' | 'feedChatId', string>> = {};
    for (const [field, purpose] of [
      ['adminChatId', 'STAFF'],
      ['feedChatId', 'FEED'],
    ] as const) {
      const next = body[field];
      if (typeof next !== 'string' || next === tenant[field]) continue;
      if (next === '0') {
        return fail(400, 'VALIDATION_FAILED', 'The request payload is invalid.', {
          fields: [
            `${field} must be a real Telegram chat id: 0 is no chat. Remove a group with DELETE /v1/admin/tenants/:id/telegram/chats/${purpose}`,
          ],
        });
      }
      if (tenant.id === TENANT_ZERO_ID) return platformLocked();
      const verdict = verifyTenantChat(tenant.id, next);
      if (!verdict.ok) return chatRejected(verdict, purpose, field);
      verified[field] = verdict.chatId;
    }

    Object.assign(tenant, body, verified, { updatedAt: nowIso() });
    return ok(tenantView(tenant));
  }),

  http.post(url('/v1/admin/tenants/:id/activate'), ({ params }) => {
    const tenant = db.tenants.find((row) => row.id === String(params.id));
    if (tenant === undefined) return fail(404, 'TENANT_NOT_FOUND', 'Tenant not found.');
    // Checked before any sign-in, as the backend does: the answer does not depend on credentials.
    if (tenant.status !== 'ACTIVE' && tenant.adminChatId === null) {
      return fail(422, 'TENANT_STAFF_GROUP_REQUIRED', STAFF_GROUP_REQUIRED_MESSAGE);
    }
    tenant.status = 'ACTIVE';
    tenant.botUsername = tenant.botUsername ?? `${tenant.slug.replace(/-/g, '_')}_bot`;
    tenant.updatedAt = nowIso();
    return ok(tenantView(tenant));
  }),

  http.post(url('/v1/admin/tenants/:id/suspend'), ({ params }) => {
    const tenant = db.tenants.find((row) => row.id === String(params.id));
    if (tenant === undefined) return fail(404, 'TENANT_NOT_FOUND', 'Tenant not found.');
    if (tenant.id === TENANT_ZERO_ID) {
      return fail(422, 'TENANT_PLATFORM_LOCKED', PLATFORM_SUSPEND_LOCKED_MESSAGE);
    }
    tenant.status = 'SUSPENDED';
    tenant.updatedAt = nowIso();
    return ok(tenantView(tenant));
  }),

  // ── Operator operations ──────────────────────────────────────────────────────────────────────
  //
  // The three routes below run through the operator's BOT, and tenant zero's stored token is a
  // placeholder rather than a bot — so they answer 422 TENANT_BOT_UNAVAILABLE for it, not the
  // TENANT_PLATFORM_LOCKED the id-checked routes answer. Two different codes for two different
  // reasons, and the console hides all of them for the platform either way.
  http.post(url('/v1/admin/tenants/:id/webhook'), ({ params }) => {
    const tenant = db.tenants.find((row) => row.id === String(params.id));
    if (tenant === undefined) return fail(404, 'TENANT_NOT_FOUND', 'Tenant not found.');
    if (tenant.id === TENANT_ZERO_ID) return platformBotUnavailable('register the webhook');
    return ok(registerWebhook(tenant.id));
  }),

  http.delete(url('/v1/admin/tenants/:id/webhook'), ({ params }) => {
    const tenant = db.tenants.find((row) => row.id === String(params.id));
    if (tenant === undefined) return fail(404, 'TENANT_NOT_FOUND', 'Tenant not found.');
    if (tenant.id === TENANT_ZERO_ID) return platformBotUnavailable('remove the webhook');
    return ok(removeWebhook(tenant.id));
  }),

  http.post(url('/v1/admin/tenants/:id/bot-setup'), ({ params }) => {
    const tenant = db.tenants.find((row) => row.id === String(params.id));
    if (tenant === undefined) return fail(404, 'TENANT_NOT_FOUND', 'Tenant not found.');
    if (tenant.id === TENANT_ZERO_ID) return platformBotUnavailable('push the command menus');
    return ok({ commandsSet: BOT_COMMANDS_PUSHED, scopes: [...BOT_COMMAND_SCOPES] });
  }),

  http.get(url('/v1/admin/tenants/:id/health'), ({ params }) => {
    const tenant = db.tenants.find((row) => row.id === String(params.id));
    return tenant === undefined
      ? fail(404, 'TENANT_NOT_FOUND', 'Tenant not found.')
      : ok(tenantHealth(tenant));
  }),

  http.patch(url('/v1/admin/tenants/:id/ichancy'), async ({ params, request }) => {
    const tenant = db.tenants.find((row) => row.id === String(params.id));
    if (tenant === undefined) return fail(404, 'TENANT_NOT_FOUND', 'Tenant not found.');

    if (tenant.id === TENANT_ZERO_ID) {
      return fail(422, 'TENANT_PLATFORM_LOCKED', PLATFORM_HAS_NO_AGENT_MESSAGE);
    }

    const body = (await request.json()) as Record<string, unknown>;
    const agentId = body.ichancyAgentId;
    const players = tenant.counts?.players ?? 0;

    // Repointing the agent under existing players orphans them from the tree their balances live
    // in. There is no safe version of this, so it is refused rather than warned about.
    if (typeof agentId === 'string' && agentId !== tenant.ichancyAgentId && players > 0) {
      return fail(
        422,
        'TENANT_AGENT_HAS_PLAYERS',
        'This operator has linked players, so its Ichancy agent id cannot be changed.',
        { players },
      );
    }

    updateTenantIchancy(tenant, body);
    return ok(tenantView(tenant));
  }),

  http.patch(url('/v1/admin/tenants/:id/bot'), async ({ params, request }) => {
    const tenant = db.tenants.find((row) => row.id === String(params.id));
    if (tenant === undefined) return fail(404, 'TENANT_NOT_FOUND', 'Tenant not found.');

    const body = (await request.json()) as { botToken?: unknown };
    const botToken = typeof body.botToken === 'string' ? body.botToken : '';
    if (!BOT_TOKEN_PATTERN.test(botToken)) {
      return fail(400, 'VALIDATION_FAILED', 'The request payload is invalid.', {
        fields: ['botToken must look like 123456789:AA... — the token BotFather gave you'],
      });
    }

    if (tenant.id === TENANT_ZERO_ID) {
      return fail(422, 'TENANT_PLATFORM_LOCKED', PLATFORM_BOT_LOCKED_MESSAGE);
    }
    replaceTenantBot(tenant, botToken);
    return ok(tenantView(tenant));
  }),

  /** The platform pulling an operator's existing players in. PLATFORM_ADMIN, like every tenant route. */
  http.post(url('/v1/admin/tenants/:id/import-players'), ({ params, request }) => {
    const role = callerRole(request);
    if (role !== null && role !== 'PLATFORM_ADMIN') {
      return fail(403, 'INSUFFICIENT_ROLE', 'This endpoint is for platform administrators.');
    }
    const tenant = db.tenants.find((row) => row.id === String(params.id));
    if (tenant === undefined) return fail(404, 'TENANT_NOT_FOUND', 'Tenant not found.');
    if (tenant.id === TENANT_ZERO_ID) {
      return fail(422, 'TENANT_PLATFORM_LOCKED', PLATFORM_HAS_NO_AGENT_MESSAGE);
    }
    return ok(importPlayersForTenant(tenant));
  }),

  // ── Staff and feed groups (PLATFORM_ADMIN) ───────────────────────────────────────────────────

  http.post(url('/v1/admin/tenants/:id/telegram/bind-links'), async ({ params, request }) => {
    const refused = platformOnly(request);
    if (refused !== null) return refused;
    const tenant = db.tenants.find((row) => row.id === String(params.id));
    if (tenant === undefined) return fail(404, 'TENANT_NOT_FOUND', 'Tenant not found.');

    const body = (await request.json().catch(() => ({}))) as { purpose?: unknown };
    const purpose = chatPurposeOf(body.purpose);
    if (purpose === null) {
      return fail(400, 'VALIDATION_FAILED', 'The request payload is invalid.', {
        fields: ['purpose must be STAFF or FEED'],
      });
    }
    if (tenant.id === TENANT_ZERO_ID) return platformLocked();
    if (tenant.status === 'CLOSED') return tenantClosed();
    if (tenant.botUsername === null) {
      return fail(
        422,
        'TENANT_BOT_UNAVAILABLE',
        "This operator's bot has no known @username yet, so no link can be built. Replace its bot token from the dashboard so Telegram confirms the bot, then try again.",
      );
    }
    return ok(issueBindLink(tenant, tenant.botUsername, purpose));
  }),

  http.get(url('/v1/admin/tenants/:id/telegram/chats'), ({ params, request }) => {
    const refused = platformOnly(request);
    if (refused !== null) return refused;
    const tenant = db.tenants.find((row) => row.id === String(params.id));
    return tenant === undefined
      ? fail(404, 'TENANT_NOT_FOUND', 'Tenant not found.')
      : ok(tenantChatsView(tenant));
  }),

  http.put(url('/v1/admin/tenants/:id/telegram/chats/:purpose'), async ({ params, request }) => {
    const refused = platformOnly(request);
    if (refused !== null) return refused;
    const tenant = db.tenants.find((row) => row.id === String(params.id));
    if (tenant === undefined) return fail(404, 'TENANT_NOT_FOUND', 'Tenant not found.');
    const purpose = chatPurposeOf(params.purpose);
    const body = (await request.json().catch(() => ({}))) as { chatId?: unknown };
    const chatId = typeof body.chatId === 'string' ? body.chatId.trim() : '';
    if (purpose === null || !/^-?\d{1,19}$/.test(chatId) || chatId === '0') {
      return fail(400, 'VALIDATION_FAILED', 'The request payload is invalid.', {
        fields: [
          purpose === null
            ? 'purpose must be STAFF or FEED'
            : 'chatId must be a real Telegram chat id: 0 is no chat',
        ],
      });
    }
    if (tenant.id === TENANT_ZERO_ID) return platformLocked();
    if (tenant.status === 'CLOSED') return tenantClosed();

    const verdict = verifyTenantChat(tenant.id, chatId);
    if (!verdict.ok) return chatRejected(verdict, purpose, 'chatId');
    bindTenantChat(tenant, purpose, verdict.chatId);
    return ok(tenantView(tenant));
  }),

  http.delete(url('/v1/admin/tenants/:id/telegram/chats/:purpose'), ({ params, request }) => {
    const refused = platformOnly(request);
    if (refused !== null) return refused;
    const tenant = db.tenants.find((row) => row.id === String(params.id));
    if (tenant === undefined) return fail(404, 'TENANT_NOT_FOUND', 'Tenant not found.');
    const purpose = chatPurposeOf(params.purpose);
    if (purpose === null) {
      return fail(400, 'VALIDATION_FAILED', 'The request payload is invalid.', {
        fields: ['purpose must be STAFF or FEED'],
      });
    }
    if (tenant.id === TENANT_ZERO_ID) return platformLocked();
    if (tenant.status === 'CLOSED') return tenantClosed();
    if (purpose === 'STAFF' && tenant.status === 'ACTIVE') {
      return fail(422, 'TENANT_STAFF_GROUP_REQUIRED', STAFF_GROUP_REMOVAL_REFUSED_MESSAGE);
    }
    unbindTenantChat(tenant, purpose);
    return ok(tenantView(tenant));
  }),
  // ---- Telegram destinations -----------------------------------------------------------------
  //
  // The mock resolves a URL the way the server does — it refuses what the server refuses, and for
  // the same reasons — because the point of these routes is the REFUSALS. A mock that accepted
  // everything would let the console ship without ever rendering the four sentences that are the
  // whole feature.

  http.get(url('/v1/admin/telegram/destinations'), () => ok(db.telegramDestinations)),

  /**
   * The chats the bot has been added to.
   *
   * `alreadyBound` is RECOMPUTED here rather than served from the fixture, because it is the one
   * field on this list that the console's own actions change: binding a group must stop offering
   * it, and removing one must offer it again. A stored flag would go stale the moment a test added
   * a destination, and the picker would then hand back a group the server answers DUPLICATE for.
   */
  http.get(url('/v1/admin/telegram/chats'), () => {
    const bound = new Set(
      db.telegramDestinations.filter((row) => row.isActive).map((row) => row.chatId),
    );
    return ok(
      db.discoveredChats.map((chat) => ({ ...chat, alreadyBound: bound.has(chat.chatId) })),
    );
  }),

  http.post(url('/v1/admin/telegram/destinations'), async ({ request }) => {
    const body = (await request.json()) as {
      url?: unknown;
      displayName?: unknown;
      categories?: unknown;
      isActive?: unknown;
    };

    const raw = typeof body.url === 'string' ? body.url.trim() : '';
    const categories = Array.isArray(body.categories) ? (body.categories as string[]) : [];

    if (categories.length === 0) {
      return fail(400, 'VALIDATION_FAILED', 'Choose at least one kind of notification.', {
        fields: ['categories must not be empty'],
      });
    }

    const resolved = resolveMockChat(raw);
    if ('reason' in resolved) {
      return fail(400, 'TELEGRAM_CHAT_REJECTED', resolved.message, { reason: resolved.reason });
    }

    const existing = db.telegramDestinations.find((row) => row.chatId === resolved.chatId);
    if (existing?.isActive === true) {
      return fail(400, 'TELEGRAM_CHAT_REJECTED', 'That chat is already a destination.', {
        reason: 'DUPLICATE',
      });
    }

    const now = new Date().toISOString();
    const next: TelegramDestination = {
      id:
        existing?.id ??
        `a1f0c2d3-0000-4000-8000-${String(db.telegramDestinations.length + 90).padStart(12, '0')}`,
      chatId: resolved.chatId,
      chatType: resolved.chatType,
      telegramUrl: raw,
      title: resolved.title,
      username: resolved.username,
      displayName: typeof body.displayName === 'string' ? body.displayName : null,
      categories: categories as TelegramDestination['categories'],
      isActive: body.isActive !== false,
      lastVerifiedAt: now,
      lastError: null,
      lastPublishedAt: existing?.lastPublishedAt ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    // Re-adding a removed chat REVIVES its row rather than colliding — the same rule the server
    // follows, and the reason the console never shows a bare unique-constraint error.
    if (existing === undefined) db.telegramDestinations.push(next);
    else db.telegramDestinations.splice(db.telegramDestinations.indexOf(existing), 1, next);

    return ok(next, {}, 201);
  }),

  http.patch(url('/v1/admin/telegram/destinations/:id'), async ({ params, request }) => {
    const row = db.telegramDestinations.find((item) => item.id === String(params.id));
    if (row === undefined) return fail(404, 'NOT_FOUND', 'Telegram destination not found');

    const body = (await request.json()) as {
      displayName?: unknown;
      categories?: unknown;
      isActive?: unknown;
    };

    if (Array.isArray(body.categories)) {
      if (body.categories.length === 0) {
        return fail(400, 'VALIDATION_FAILED', 'A destination must receive something.', {
          fields: ['categories must not be empty'],
        });
      }
      row.categories = body.categories as TelegramDestination['categories'];
    }
    if (typeof body.displayName === 'string') {
      row.displayName = body.displayName.length === 0 ? null : body.displayName;
    }
    if (typeof body.isActive === 'boolean') row.isActive = body.isActive;
    row.updatedAt = new Date().toISOString();

    return ok(row);
  }),

  http.delete(url('/v1/admin/telegram/destinations/:id'), ({ params }) => {
    const row = db.telegramDestinations.find((item) => item.id === String(params.id));
    if (row === undefined) return fail(404, 'NOT_FOUND', 'Telegram destination not found');

    // Deactivates, never deletes — the house rule, and what makes the revive above reachable.
    row.isActive = false;
    row.updatedAt = new Date().toISOString();
    return ok(row);
  }),

  http.post(url('/v1/admin/telegram/destinations/:id/check'), ({ params }) =>
    checkOrTest(String(params.id), false),
  ),

  http.post(url('/v1/admin/telegram/destinations/:id/test'), ({ params }) =>
    checkOrTest(String(params.id), true),
  ),

  http.post(url('/v1/admin/reports/activity/publish'), async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { period?: unknown };
    const period = typeof body.period === 'string' ? body.period : 'month';

    const subscribed = db.telegramDestinations.filter(
      (row) => row.isActive && row.categories.includes('REPORT'),
    );
    const now = new Date().toISOString();
    // A publish stamps freshness on every row it reached — which is how the table's "last
    // published" column becomes an honest answer rather than decoration.
    for (const row of subscribed) {
      if (row.lastError === null) row.lastPublishedAt = now;
    }

    const failed = subscribed.filter((row) => row.lastError !== null).length;
    return ok({
      title: REPORT_TITLES[period] ?? period,
      considered: subscribed.length,
      delivered: subscribed.length - failed,
      failed,
    });
  }),

  // ── The bot's menu ───────────────────────────────────────────────────────────────────────────
  //
  // Reader roles GET; the manager roles write — the same split the rails follow, because the
  // flow editor sits behind `paymentMethods.write` on the console side. The refusals are the
  // contract: the root screen cannot go, a screen still opened by a button cannot go, and the
  // last active button for a REQUIRED action can be neither deleted nor hidden.

  http.get(url('/v1/admin/bot-menu'), ({ request }) => {
    const refused = refusedFor(
      request,
      'paymentMethods.read',
      'Your role cannot read the bot menu.',
    );
    if (refused !== null) return refused;
    return ok({ ...db.botMenu, settings: botSettingsView() });
  }),

  http.get(url('/v1/admin/bot-menu/settings'), ({ request }) => {
    const refused = refusedFor(
      request,
      'paymentMethods.read',
      'Your role cannot read the bot menu.',
    );
    if (refused !== null) return refused;
    return ok(botSettingsView());
  }),

  /*
   * The runtime settings. `miniAppUrl` must be https or null — a bot that opened an http page
   * would be refused by Telegram anyway, and the server says so before saving. PATCH semantics: an
   * absent key leaves the value alone.
   */
  http.patch(url('/v1/admin/bot-menu/settings'), async ({ request }) => {
    const refused = refusedFor(
      request,
      'botSettings.write',
      'Your role cannot change the bot settings.',
    );
    if (refused !== null) return refused;

    const body = (await request.json().catch(() => ({}))) as {
      miniAppUrl?: unknown;
      depositMode?: unknown;
      withdrawalMode?: unknown;
    };
    const fields: string[] = [];
    const patch: {
      miniAppUrl?: string | null;
      depositMode?: DepositMode;
      withdrawalMode?: WithdrawalMode;
    } = {};

    if ('miniAppUrl' in body) {
      if (body.miniAppUrl === null) {
        patch.miniAppUrl = null;
      } else if (typeof body.miniAppUrl === 'string' && /^https:\/\/\S+$/.test(body.miniAppUrl)) {
        patch.miniAppUrl = body.miniAppUrl;
      } else {
        fields.push('miniAppUrl must be an https URL, or null to clear it');
      }
    }
    if ('depositMode' in body) {
      const mode = DEPOSIT_MODES.find((entry) => entry === body.depositMode);
      if (mode === undefined) fields.push('depositMode must be AUTO or MANUAL');
      else patch.depositMode = mode;
    }
    if ('withdrawalMode' in body) {
      const mode = WITHDRAWAL_MODES.find((entry) => entry === body.withdrawalMode);
      if (mode === undefined) fields.push('withdrawalMode must be AUTO or MANUAL');
      else patch.withdrawalMode = mode;
    }
    if (fields.length > 0) {
      return fail(400, 'VALIDATION_FAILED', 'The request payload is invalid.', { fields });
    }
    return ok(updateBotSettings(patch));
  }),

  http.post(url('/v1/admin/bot-menu/nodes'), async ({ request }) => {
    const refused = refusedFor(
      request,
      'paymentMethods.write',
      'Your role cannot edit the bot menu.',
    );
    if (refused !== null) return refused;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.key === 'string' && db.botMenu.nodes.some((node) => node.key === body.key)) {
      return fail(409, 'DUPLICATE_RESOURCE', 'A screen with that key already exists.', {
        fields: ['key'],
      });
    }
    return ok(createMenuNode(body), {}, 201);
  }),

  http.patch(url('/v1/admin/bot-menu/nodes/:id'), async ({ params, request }) => {
    const refused = refusedFor(
      request,
      'paymentMethods.write',
      'Your role cannot edit the bot menu.',
    );
    if (refused !== null) return refused;

    const node = findMenuNode(String(params.id));
    if (node === undefined) return fail(404, 'BOT_MENU_NODE_NOT_FOUND', 'Screen not found.');

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.name === 'string' && body.name.trim().length > 0) node.name = body.name.trim();
    if ('promptText' in body) {
      node.promptText =
        typeof body.promptText === 'string' && body.promptText.length > 0 ? body.promptText : null;
    }
    return ok(node);
  }),

  http.delete(url('/v1/admin/bot-menu/nodes/:id'), ({ params, request }) => {
    const refused = refusedFor(
      request,
      'paymentMethods.write',
      'Your role cannot edit the bot menu.',
    );
    if (refused !== null) return refused;

    const node = findMenuNode(String(params.id));
    if (node === undefined) return fail(404, 'BOT_MENU_NODE_NOT_FOUND', 'Screen not found.');
    if (node.isRoot) {
      return fail(
        409,
        'BOT_MENU_ROOT_PROTECTED',
        'The root screen is what /start draws; it cannot be deleted.',
      );
    }
    const linkedFrom = menuNodeStillLinkedFrom(node.id);
    if (linkedFrom !== null) {
      return fail(
        409,
        'BOT_MENU_NODE_IN_USE',
        `A button on "${linkedFrom.name}" still opens this screen. Repoint or remove it first.`,
      );
    }
    const required = requiredActionLeftWithout(node.buttons.map((button) => button.id));
    if (required !== null) {
      return fail(409, 'BUTTON_REQUIRED', `Every bot must keep a button for "${required}".`);
    }
    deleteMenuNode(node);
    return ok({ deleted: true });
  }),

  http.patch(url('/v1/admin/bot-menu/nodes/:id/reorder'), async ({ params, request }) => {
    const refused = refusedFor(
      request,
      'paymentMethods.write',
      'Your role cannot edit the bot menu.',
    );
    if (refused !== null) return refused;

    const node = findMenuNode(String(params.id));
    if (node === undefined) return fail(404, 'BOT_MENU_NODE_NOT_FOUND', 'Screen not found.');

    const body = (await request.json().catch(() => ({}))) as { positions?: unknown };
    if (!Array.isArray(body.positions)) {
      return fail(400, 'VALIDATION_FAILED', 'The request payload is invalid.', {
        fields: ['positions must be an array'],
      });
    }
    reorderMenuButtons(
      node,
      body.positions as { id: string; rowIndex: number; sortOrder: number }[],
    );
    return ok(node);
  }),

  http.post(url('/v1/admin/bot-menu/buttons'), async ({ request }) => {
    const refused = refusedFor(
      request,
      'paymentMethods.write',
      'Your role cannot edit the bot menu.',
    );
    if (refused !== null) return refused;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const node = findMenuNode(typeof body.nodeId === 'string' ? body.nodeId : '');
    if (node === undefined) return fail(404, 'BOT_MENU_NODE_NOT_FOUND', 'Screen not found.');

    const label = textField(body.label);
    if (label.length === 0) {
      return fail(400, 'VALIDATION_FAILED', 'The request payload is invalid.', {
        fields: ['label should not be empty'],
      });
    }
    // The label IS the routing key: two of them on one screen are indistinguishable to the bot.
    if (node.buttons.some((button) => button.label === label)) {
      return fail(
        409,
        'DUPLICATE_RESOURCE',
        'A button with that label is already on this screen.',
        {
          fields: ['label'],
        },
      );
    }
    if (
      body.kind === 'BUILTIN' &&
      !db.botMenu.builtinActions.some((entry) => entry.action === body.builtinAction)
    ) {
      return fail(400, 'VALIDATION_FAILED', 'The request payload is invalid.', {
        fields: ['builtinAction must be one of the bot actions'],
      });
    }
    return ok(createMenuButton(node, { ...body, label }), {}, 201);
  }),

  http.patch(url('/v1/admin/bot-menu/buttons/:id'), async ({ params, request }) => {
    const refused = refusedFor(
      request,
      'paymentMethods.write',
      'Your role cannot edit the bot menu.',
    );
    if (refused !== null) return refused;

    const found = findMenuButton(String(params.id));
    if (found === undefined) return fail(404, 'BOT_MENU_BUTTON_NOT_FOUND', 'Button not found.');

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (
      typeof body.label === 'string' &&
      found.node.buttons.some(
        (button) => button.id !== found.button.id && button.label === body.label,
      )
    ) {
      return fail(
        409,
        'DUPLICATE_RESOURCE',
        'A button with that label is already on this screen.',
        {
          fields: ['label'],
        },
      );
    }
    // Hiding is the same loss as deleting, for the bot: a hidden button is not routable.
    if (body.isActive === false) {
      const required = requiredActionLeftWithout([found.button.id]);
      if (required !== null) {
        return fail(
          409,
          'BUTTON_REQUIRED',
          `Every bot must keep an active button for "${required}".`,
        );
      }
    }
    updateMenuButton(found.button, body);
    return ok(found.button);
  }),

  http.delete(url('/v1/admin/bot-menu/buttons/:id'), ({ params, request }) => {
    const refused = refusedFor(
      request,
      'paymentMethods.write',
      'Your role cannot edit the bot menu.',
    );
    if (refused !== null) return refused;

    const found = findMenuButton(String(params.id));
    if (found === undefined) return fail(404, 'BOT_MENU_BUTTON_NOT_FOUND', 'Button not found.');
    const required = requiredActionLeftWithout([found.button.id]);
    if (required !== null) {
      return fail(409, 'BUTTON_REQUIRED', `Every bot must keep a button for "${required}".`);
    }
    deleteMenuButton(found.node, found.button);
    return ok({ deleted: true });
  }),

  /** Both or neither. Half a gate has either nothing tappable to show or no way to check. */
  http.patch(url('/v1/admin/bot-menu/gate'), async ({ request }) => {
    const refused = refusedFor(
      request,
      'paymentMethods.write',
      'Your role cannot edit the bot menu.',
    );
    if (refused !== null) return refused;

    const body = (await request.json().catch(() => ({}))) as {
      channelId?: unknown;
      channelUsername?: unknown;
    };
    const channelId = textField(body.channelId);
    const channelUsername = textField(body.channelUsername).replace(/^@/, '');

    if ((channelId.length === 0) !== (channelUsername.length === 0)) {
      return fail(400, 'VALIDATION_FAILED', 'The request payload is invalid.', {
        fields: ['channelId and channelUsername must be set together, or cleared together'],
      });
    }
    if (channelId.length > 0 && !/^-?\d{1,20}$/.test(channelId)) {
      return fail(400, 'VALIDATION_FAILED', 'The request payload is invalid.', {
        fields: ['channelId must be a Telegram channel id, as a string'],
      });
    }

    db.botMenu.gate =
      channelId.length === 0
        ? { channelId: null, channelUsername: null }
        : { channelId, channelUsername };
    return ok(db.botMenu.gate);
  }),
];
