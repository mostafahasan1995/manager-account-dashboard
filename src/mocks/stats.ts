import { money, MOCK_CURRENCY } from './fixtures';
import { db } from './db';
import type {
  AdminDeposit,
  PlatformStats,
  StatsBasis,
  StatsBlock,
  StatsMethodRow,
  StatsPeriodKey,
  TenantStats,
} from '@/types';

/**
 * The stats endpoints, computed from the SAME mock rows the deposit queue serves.
 *
 * ══ WHY IT COMPUTES RATHER THAN RETURNING A FIXTURE ═══════════════════════════════════════════
 * A hand-written stats fixture would drift from `mockDeposits` the moment anybody adds a row, and
 * the demo would then show a screen whose totals contradict the list underneath it — which is
 * exactly the failure mode this screen exists to fix. Deriving the figures means the demo is
 * internally consistent by construction, and a test can add a deposit and assert the tile moves.
 *
 * ══ IT REPRODUCES THE SERVER'S PRECEDENCE, INCLUDING WHICH CLOCK EACH BLOCK IS ON ═════════════
 * `verified ?? claimed` for the money, `creditedAt` for credited, `createdAt` for opened, current
 * state for the queue blocks. Getting that wrong here would make the mock a worse oracle than no
 * mock: component tests would pass against figures the real API never produces.
 */

const DAY_MS = 86_400_000;

/** MIRRORS `periodRange` in the API's report-period.util.ts. UTC, `from` inclusive, `to` exclusive. */
export function mockPeriodRange(period: StatsPeriodKey, now: Date): { from: Date; to: Date } {
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  switch (period) {
    case 'day':
      return { from: new Date(todayUtc), to: now };
    case 'week':
      return { from: new Date(todayUtc - 6 * DAY_MS), to: now };
    case 'month':
      return { from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), to: now };
    case 'all':
      return { from: new Date(0), to: now };
  }
}

const minorOf = (value: { minor: string } | null): bigint =>
  value === null ? 0n : BigInt(value.minor);

/** The server's precedence: what an admin confirmed, or the player's claim until they did. */
const amountOf = (row: AdminDeposit): bigint =>
  row.verified === null ? minorOf(row.claimed) : minorOf(row.verified);

const inWindow = (stamp: string | null, from: Date, to: Date): boolean => {
  if (stamp === null) return false;
  const at = new Date(stamp).getTime();
  return at >= from.getTime() && at < to.getTime();
};

const block = (rows: readonly AdminDeposit[], basis: StatsBasis): StatsBlock => ({
  count: rows.length,
  total: money(rows.reduce((sum, row) => sum + amountOf(row), 0n)),
  basis,
});

const WAITING = ['SUBMITTED', 'UNDER_REVIEW', 'PENDING_SECOND_APPROVAL'];
const ATTENTION = ['CREDIT_FAILED', 'NEEDS_RECONCILIATION'];
const PENDING_WITHDRAWALS = ['REQUESTED', 'APPROVED', 'DEBITING', 'DEBITED'];

function byMethod(rows: readonly AdminDeposit[]): StatsMethodRow[] {
  const totals = new Map<string, { count: number; total: bigint; fees: bigint }>();
  for (const row of rows) {
    const entry = totals.get(row.paymentMethodId) ?? { count: 0, total: 0n, fees: 0n };
    entry.count += 1;
    entry.total += amountOf(row);
    entry.fees += minorOf(row.fee);
    totals.set(row.paymentMethodId, entry);
  }

  return (
    [...totals.entries()]
      .map(([paymentMethodId, entry]) => ({
        paymentMethodId,
        displayName:
          db.methods.find((method) => method.id === paymentMethodId)?.displayName ??
          paymentMethodId,
        count: entry.count,
        total: money(entry.total),
        fees: money(entry.fees),
      }))
      // Biggest rail first, exactly as the server sorts it — the console renders this order verbatim.
      .sort((a, b) => {
        const bySum = BigInt(b.total.minor) - BigInt(a.total.minor);
        if (bySum !== 0n) return bySum > 0n ? 1 : -1;
        return a.displayName.localeCompare(b.displayName);
      })
  );
}

export function tenantStatsView(period: StatsPeriodKey, now = new Date()): TenantStats {
  const { from, to } = mockPeriodRange(period, now);
  const deposits = db.deposits;

  const opened = deposits.filter((row) => inWindow(row.createdAt, from, to));
  const credited = deposits.filter(
    (row) => row.status === 'CREDITED' && inWindow(row.creditedAt, from, to),
  );
  const rejected = deposits.filter(
    (row) => row.status === 'REJECTED' && inWindow(row.decidedAt, from, to),
  );
  const expired = deposits.filter(
    (row) => row.status === 'EXPIRED' && inWindow(row.createdAt, from, to),
  );

  const paidWithdrawals = db.withdrawals.filter((row) => row.status === 'PAID');
  const pendingWithdrawals = db.withdrawals.filter((row) =>
    PENDING_WITHDRAWALS.includes(row.status),
  );

  const depositFees = credited.reduce((sum, row) => sum + minorOf(row.fee), 0n);
  const activeRails = db.methods.filter((method) => method.isActive);
  const chargingRails = activeRails.filter(
    // `feeFixed` is a DECIMAL string ("500.00"), not minor units — BigInt() throws on it. Only the
    // sign matters here, so a numeric comparison is both correct and safe.
    (method) => Number(method.feeFixed) > 0 || method.feeBps > 0,
  );

  const tenant = db.tenants[0];

  return {
    tenantId: tenant?.id ?? 'tenant-zero',
    slug: tenant?.slug ?? 'tenant-zero',
    displayName: tenant?.displayName ?? 'Head office',
    currency: MOCK_CURRENCY,
    period: { key: period, from: from.toISOString(), to: to.toISOString() },
    players: {
      newInPeriod: db.players.filter((player) => inWindow(player.createdAt, from, to)).length,
      total: db.players.length,
    },
    deposits: {
      opened: block(opened, 'createdAt'),
      credited: block(credited, 'creditedAt'),
      rejected: block(rejected, 'decidedAt'),
      expired: block(expired, 'createdAt'),
      // CURRENT state, deliberately outside the window — see the module header.
      waiting: block(
        deposits.filter((row) => WAITING.includes(row.status)),
        'current',
      ),
      attention: block(
        deposits.filter((row) => ATTENTION.includes(row.status)),
        'current',
      ),
      lifetimeCount: deposits.length,
    },
    withdrawals: {
      paid: {
        count: paidWithdrawals.length,
        total: money(paidWithdrawals.reduce((sum, row) => sum + minorOf(row.amount), 0n)),
        basis: 'paidAt',
      },
      pending: {
        count: pendingWithdrawals.length,
        total: money(pendingWithdrawals.reduce((sum, row) => sum + minorOf(row.amount), 0n)),
        basis: 'current',
      },
    },
    profit: {
      depositFees: money(depositFees),
      // No withdrawal fee is modelled in the mock rows, so this is a truthful zero rather than a
      // made-up figure that would make the demo's arithmetic not add up.
      withdrawalFees: money(0n),
      total: money(depositFees),
      chargingRails: chargingRails.length,
      activeRails: activeRails.length,
    },
    byMethod: byMethod(credited),
  };
}

/**
 * The platform view. One row per operator, and only the FIRST carries the derived figures: the mock
 * database holds one operator's deposits, so inventing numbers for the others would be a demo that
 * teaches the wrong thing about which rows belong to whom.
 */
export function platformStatsView(period: StatsPeriodKey, now = new Date()): PlatformStats {
  const mine = tenantStatsView(period, now);
  const others = db.tenants
    .filter((tenant) => tenant.id !== mine.tenantId && tenant.status === 'ACTIVE')
    .map((tenant) => emptyTenantStats(tenant, mine));

  return { period: mine.period, tenants: [mine, ...others] };
}

function emptyTenantStats(
  tenant: { id: string; slug: string; displayName: string },
  template: TenantStats,
): TenantStats {
  const zero = (basis: StatsBasis): StatsBlock => ({ count: 0, total: money(0n), basis });

  return {
    ...template,
    tenantId: tenant.id,
    slug: tenant.slug,
    displayName: tenant.displayName,
    players: { newInPeriod: 0, total: 0 },
    deposits: {
      opened: zero('createdAt'),
      credited: zero('creditedAt'),
      rejected: zero('decidedAt'),
      expired: zero('createdAt'),
      waiting: zero('current'),
      attention: zero('current'),
      lifetimeCount: 0,
    },
    withdrawals: { paid: zero('paidAt'), pending: zero('current') },
    profit: {
      depositFees: money(0n),
      withdrawalFees: money(0n),
      total: money(0n),
      chargingRails: 0,
      activeRails: 0,
    },
    byMethod: [],
  };
}
