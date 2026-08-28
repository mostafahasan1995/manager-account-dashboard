import { HttpResponse, http, type HttpHandler } from 'msw';

import { config } from '@/config';
import { can } from '@/lib/auth/permissions';
import { minorFromString, parseDecimalToMinor } from '@/lib/money';
import {
  ADMIN_ROLES,
  DEBIT_REASON_MAX_LENGTH,
  type AdminDeposit,
  type AdminRole,
  type Tenant,
} from '@/types';

import {
  agentFloatView,
  approveDeposit,
  claimDeposit,
  correctFloat,
  createAdmin,
  createDestination,
  createMethod,
  createTenant,
  db,
  debitPlayer,
  findDeposit,
  nextId,
  nowIso,
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
} from './db';
import { MOCK_AGENT_PASSWORD, MOCK_SESSION_TTL_MINUTES, mockRoleForCode } from './demo';
import {
  mockBalanceAlwaysFailsFor,
  mockBalanceMinorFor,
  TENANT_IDS,
  TENANT_ZERO_ID,
} from './fixtures';
import { mockDepositChainCheck } from './deposit-chain-check';
import { mockNetworkForAddress, mockWalletBalance } from './wallet-balance';

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

/** What AGENT_OPERATOR_AMBIGUOUS and AGENT_OPERATOR_NOT_ACTIVE carry in `details`. No secrets. */
const operatorChoices = (rows: readonly Tenant[]): { slug: string; displayName: string }[] =>
  rows.map((tenant) => ({ slug: tenant.slug, displayName: tenant.displayName }));

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

  // ── Auth ─────────────────────────────────────────────────────────────────────────────────────
  http.post(url('/v1/admin/auth/bot-code'), async ({ request }) => {
    const body = (await request.json()) as { code?: string };
    const role = mockRoleForCode(body.code ?? '');
    if (role === null) {
      return fail(
        401,
        'BOT_CODE_INVALID',
        'That code is not valid. Send /console to the bot for a new one.',
      );
    }

    // Demo mode only: the code names the role, so every role-gated screen can actually be shown.
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
   * The OTHER door: an operator signing in with its Ichancy agent account.
   *
   * The refusal ORDER is mirrored from the real route rather than merely its status codes, because
   * the order is the security property. Nothing about which operators exist is said until the
   * password is right; everything said afterwards is about an operator the caller has already
   * proved they run. A mock that had that backwards would let a console ship a screen which leaks
   * against the real backend and looks correct against this one.
   */
  http.post(url('/v1/admin/auth/ichancy'), async ({ request }) => {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
      operatorSlug?: string;
    };

    const username = (body.username ?? '').trim().toLowerCase();
    const matched =
      username.length > 0 && body.password === MOCK_AGENT_PASSWORD
        ? db.tenants.filter((tenant) => tenant.ichancyUsername.toLowerCase() === username)
        : [];

    const wanted = body.operatorSlug?.trim().toLowerCase();
    const chosen =
      wanted === undefined || wanted.length === 0
        ? matched
        : matched.filter((tenant) => tenant.slug.toLowerCase() === wanted);

    if (chosen.length === 0) {
      return fail(
        401,
        'AGENT_CREDENTIALS_INVALID',
        'Those Ichancy credentials are not valid for any operator on this platform.',
      );
    }

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

    // The agent account is the top of ONE operator, so it opens the console as a SUPER_ADMIN —
    // never as the PLATFORM_ADMIN, which runs no agent of its own and stays a bot-code login.
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
  }),

  // ── The rate that prices a crypto deposit ────────────────────────────────────────────────────

  /*
   * Read by anyone who can read the rails; set only by the roles that own the operator money.
   * The same boundary the backend argues for a payout account: PLATFORM_ADMIN reads and does not
   * write, however senior it sounds.
   */
  // ── Sham Cash session (external cashier account, linked by pasting cookies) ────────────────────
  http.get(url('/v1/admin/shamcash/session'), ({ request }) => {
    const role = callerRole(request);
    if (role !== null && !can(role, 'paymentMethods.read')) {
      return fail(403, 'INSUFFICIENT_ROLE', 'Your role cannot read the payment configuration.');
    }
    return ok(db.shamCashSession);
  }),

  http.post(url('/v1/admin/shamcash/session'), async ({ request }) => {
    const role = callerRole(request);
    if (role !== null && !can(role, 'paymentMethods.write')) {
      return fail(403, 'INSUFFICIENT_ROLE', 'Your role cannot change the payment configuration.');
    }
    const body = (await request.json()) as { accessToken?: string; authToken?: string };
    if (!body.accessToken || !body.authToken) {
      return fail(400, 'VALIDATION_FAILED', 'accessToken and authToken are required.');
    }
    // The cookies are never stored in the mock — only the fact that a session now exists, which is
    // all the real backend ever returns.
    db.shamCashSession = { linked: true, updatedAt: nowIso() };
    return ok(db.shamCashSession);
  }),

  http.delete(url('/v1/admin/shamcash/session'), ({ request }) => {
    const role = callerRole(request);
    if (role !== null && !can(role, 'paymentMethods.write')) {
      return fail(403, 'INSUFFICIENT_ROLE', 'Your role cannot change the payment configuration.');
    }
    db.shamCashSession = { linked: false, updatedAt: null };
    return ok(db.shamCashSession);
  }),

  http.post(url('/v1/admin/shamcash/balance'), ({ request }) => {
    const role = callerRole(request);
    if (role !== null && !can(role, 'paymentMethods.write')) {
      return fail(403, 'INSUFFICIENT_ROLE', 'Your role cannot read the payment configuration.');
    }
    if (!db.shamCashSession.linked) {
      return ok({ status: 'not_linked' });
    }
    // A plausible read: the account holds SYP, and the last two transfers are the +/-10 test moves.
    return ok({
      status: 'ok',
      balances: [
        { currency: 'SYP', available: '250,000', locked: '10,000' },
        { currency: 'USD', available: '0', locked: '0' },
        { currency: 'EUR', available: '0', locked: '0' },
      ],
      transactions: [
        {
          transactionId: '100000001',
          date: '2026-08-26 - 16:10:31',
          amount: '10',
          currency: 'SYP',
          direction: 'out',
          username: 'Counterparty One',
          maskedCard: '**** **** **** 0000',
        },
        {
          transactionId: '100000002',
          date: '2026-08-26 - 16:08:45',
          amount: '10',
          currency: 'SYP',
          direction: 'in',
          username: 'Counterparty Two',
          maskedCard: '**** **** **** 1111',
        },
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

    let rows = [...db.players];
    if (status !== null) rows = rows.filter((row) => row.status === status);
    if (telegramUserId !== null) {
      rows = rows.filter((row) => row.telegramUserId === telegramUserId);
    }
    if (linked !== undefined) rows = rows.filter((row) => row.ichancyLinked === linked);
    if (search !== null) {
      const needle = search.toLowerCase();
      rows = rows.filter((row) =>
        [row.firstName, row.lastName, row.telegramUsername, row.telegramUserId, row.phone]
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

    const alreadyLinked = player.ichancyLinked;
    if (!alreadyLinked) {
      player.ichancyLinked = true;
      player.ichancyPlayerId = String(90_000 + db.players.indexOf(player));
      player.ichancyLogin = `tg${player.telegramUserId}`;
      player.ichancyRegisteredAt = nowIso();
      player.status = 'ACTIVE';
    }

    return ok({
      playerId: player.id,
      ichancyPlayerId: player.ichancyPlayerId ?? '0',
      ichancyLogin: player.ichancyLogin ?? '',
      created: !alreadyLinked,
      agentId: '10045',
    });
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
    if (db.admins.some((row) => row.telegramUserId === String(body.telegramUserId))) {
      return fail(409, 'ADMIN_ALREADY_EXISTS', 'That Telegram account is already an admin.');
    }
    return ok(createAdmin(body), {}, 201);
  }),

  http.patch(url('/v1/admin/admins/:id'), async ({ params, request }) => {
    const admin = db.admins.find((row) => row.id === String(params.id));
    if (admin === undefined) return fail(404, 'ADMIN_NOT_FOUND', 'Admin not found.');
    if (admin.id === db.currentAdmin.id) {
      return fail(422, 'ADMIN_SELF_MODIFICATION', 'You cannot change your own admin record.');
    }
    Object.assign(admin, await request.json());
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
  http.get(url('/v1/admin/agent-float'), () => ok(agentFloatView())),

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
  http.get(url('/v1/admin/tenants'), () => ok({ tenants: db.tenants })),

  http.get(url('/v1/admin/tenants/:id'), ({ params }) => {
    const tenant = db.tenants.find((row) => row.id === String(params.id));
    return tenant === undefined ? fail(404, 'TENANT_NOT_FOUND', 'Tenant not found.') : ok(tenant);
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
    return ok({ ...tenant, provisioning }, {}, 201);
  }),

  http.patch(url('/v1/admin/tenants/:id'), async ({ params, request }) => {
    const tenant = db.tenants.find((row) => row.id === String(params.id));
    if (tenant === undefined) return fail(404, 'TENANT_NOT_FOUND', 'Tenant not found.');
    Object.assign(tenant, await request.json(), { updatedAt: nowIso() });
    return ok(tenant);
  }),

  http.post(url('/v1/admin/tenants/:id/activate'), ({ params }) => {
    const tenant = db.tenants.find((row) => row.id === String(params.id));
    if (tenant === undefined) return fail(404, 'TENANT_NOT_FOUND', 'Tenant not found.');
    tenant.status = 'ACTIVE';
    tenant.botUsername = tenant.botUsername ?? `${tenant.slug.replace(/-/g, '_')}_bot`;
    tenant.updatedAt = nowIso();
    return ok(tenant);
  }),

  http.post(url('/v1/admin/tenants/:id/suspend'), ({ params }) => {
    const tenant = db.tenants.find((row) => row.id === String(params.id));
    if (tenant === undefined) return fail(404, 'TENANT_NOT_FOUND', 'Tenant not found.');
    tenant.status = 'SUSPENDED';
    tenant.updatedAt = nowIso();
    return ok(tenant);
  }),

  // ── Operator operations ──────────────────────────────────────────────────────────────────────
  http.post(url('/v1/admin/tenants/:id/webhook'), ({ params }) => {
    const tenant = db.tenants.find((row) => row.id === String(params.id));
    return tenant === undefined
      ? fail(404, 'TENANT_NOT_FOUND', 'Tenant not found.')
      : ok(registerWebhook(tenant.id));
  }),

  http.delete(url('/v1/admin/tenants/:id/webhook'), ({ params }) => {
    const tenant = db.tenants.find((row) => row.id === String(params.id));
    return tenant === undefined
      ? fail(404, 'TENANT_NOT_FOUND', 'Tenant not found.')
      : ok(removeWebhook(tenant.id));
  }),

  http.post(url('/v1/admin/tenants/:id/bot-setup'), ({ params }) => {
    const tenant = db.tenants.find((row) => row.id === String(params.id));
    return tenant === undefined
      ? fail(404, 'TENANT_NOT_FOUND', 'Tenant not found.')
      : ok({ commandsSet: BOT_COMMANDS_PUSHED, scopes: [...BOT_COMMAND_SCOPES] });
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
    return ok(tenant);
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

    replaceTenantBot(tenant, botToken);
    return ok(tenant);
  }),
];
