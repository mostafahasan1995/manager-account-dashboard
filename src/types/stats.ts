import { z } from 'zod';

import { isoDateTime, moneyViewSchema } from './api';

/**
 * The numbers behind the queue: what happened, as opposed to what still needs deciding.
 *
 * ══ WHY THE QUEUE COULD NOT ANSWER THIS ═══════════════════════════════════════════════════════
 * `GET /v1/admin/deposits` is a WORK LIST — cursor paginated, no total, defaulting to the three
 * reviewable statuses. Counting a month through it means paging the whole month into the browser,
 * and even then the client cannot say "and there are 40 more" because a cursor page carries no
 * count. These figures are aggregated in the database and arrive as one small object.
 *
 * ══ `basis` IS NOT DECORATION ═════════════════════════════════════════════════════════════════
 * Three different timestamps decide whether a deposit is inside the window, and the blocks are NOT
 * views of one set — `opened` and `credited` will not add up, and they are not supposed to. Each
 * block says which clock it was computed on so the screen can print that under the figure instead
 * of leaving somebody to work out why two numbers that "should" match do not:
 *
 *   createdAt   started in the window, wherever it ended up
 *   creditedAt  money that LANDED in the window — a deposit opened last night and credited this
 *               morning belongs to this morning, which is how it reconciles against Ichancy
 *   decidedAt   the moment a human refused it
 *   paidAt      the moment the operator actually sent a withdrawal
 *   current     RIGHT NOW, deliberately outside the window — money stuck since last week must not
 *               fall out of today's figures
 */
export const statsBasisSchema = z.enum([
  'createdAt',
  'creditedAt',
  'decidedAt',
  'paidAt',
  'current',
]);
export type StatsBasis = z.infer<typeof statsBasisSchema>;

/** A count and the money behind it. Always reported together — a count alone hides the size. */
export const statsBlockSchema = z.looseObject({
  count: z.number(),
  total: moneyViewSchema,
  basis: statsBasisSchema,
});
export type StatsBlock = z.infer<typeof statsBlockSchema>;

/** One rail's share of the credited money. Sorted biggest-first by the server. */
export const statsMethodRowSchema = z.looseObject({
  paymentMethodId: z.string(),
  displayName: z.string(),
  count: z.number(),
  total: moneyViewSchema,
  fees: moneyViewSchema,
});
export type StatsMethodRow = z.infer<typeof statsMethodRowSchema>;

/** Every window the console may ask for. `all` has no lower bound. */
export const STATS_PERIODS = ['day', 'week', 'month', 'all'] as const;
export const statsPeriodKeySchema = z.enum(STATS_PERIODS);
export type StatsPeriodKey = z.infer<typeof statsPeriodKeySchema>;

/**
 * The window a figure was computed over, as the SERVER resolved it.
 *
 * Echoed back rather than recomputed in the browser on purpose: the boundaries are UTC and the
 * browser is not, so a client that worked out "this month" itself would print a header that
 * disagreed with the numbers underneath it by up to a day at the edges.
 *
 * `key` is a plain string, not the enum: an older console must render a period a newer server
 * added rather than failing the whole response on an unknown value.
 */
export const statsPeriodSchema = z.looseObject({
  key: z.string(),
  from: isoDateTime,
  to: isoDateTime,
});
export type StatsPeriod = z.infer<typeof statsPeriodSchema>;

/**
 * WHAT THE OPERATOR KEEPS — and why a zero here is usually a SETTING, not a bad month.
 *
 * Fees are the only revenue this system models: `feeFixedMinor + feeBps` on a rail, charged on a
 * deposit and on a withdrawal, posted to HOUSE_CASH. A rail left at 0/0 — which is every rail on a
 * fresh install — collects nothing, and `total` is then a truthful 0.
 *
 * `chargingRails` is what lets the screen tell the two apart. `0 of 7` means nothing you run charges
 * a fee, which is a thing to go and change; `0 kept from 3 charging rails` would mean a bad month.
 * A bare zero cannot say which, and reads to most people as a loss.
 */
export const statsProfitSchema = z.looseObject({
  depositFees: moneyViewSchema,
  withdrawalFees: moneyViewSchema,
  total: moneyViewSchema,
  chargingRails: z.number(),
  activeRails: z.number(),
});
export type StatsProfit = z.infer<typeof statsProfitSchema>;

/** Every figure for ONE operator over ONE window. */
export const tenantStatsSchema = z.looseObject({
  tenantId: z.string(),
  slug: z.string(),
  displayName: z.string(),
  currency: z.string(),
  period: statsPeriodSchema,

  players: z.looseObject({
    newInPeriod: z.number(),
    total: z.number(),
  }),

  deposits: z.looseObject({
    opened: statsBlockSchema,
    /** THE SUCCESSFUL ONES — the figure the queue's default filter has never shown. */
    credited: statsBlockSchema,
    rejected: statsBlockSchema,
    expired: statsBlockSchema,
    waiting: statsBlockSchema,
    attention: statsBlockSchema,
    /** Every deposit this operator has ever had, in any status. Not period-bound. */
    lifetimeCount: z.number(),
  }),

  withdrawals: z.looseObject({
    paid: statsBlockSchema,
    pending: statsBlockSchema,
  }),

  profit: statsProfitSchema,
  byMethod: z.array(statsMethodRowSchema),
});
export type TenantStats = z.infer<typeof tenantStatsSchema>;

/** The platform answer: the same block per operator, plus the window once at the top. */
export const platformStatsSchema = z.looseObject({
  period: statsPeriodSchema,
  tenants: z.array(tenantStatsSchema),
});
export type PlatformStats = z.infer<typeof platformStatsSchema>;
