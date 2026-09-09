import { z } from 'zod';

import {
  BREAK_CATEGORIES,
  BREAK_STATUSES,
  DEPOSIT_SORTS,
  DEPOSIT_STATUSES,
  PAYMENT_RAILS,
  PLAYER_SOURCES,
  PLAYER_STATUSES,
  TENANT_STATUSES,
  ADMIN_ROLES,
  WITHDRAWAL_SORTS,
  WITHDRAWAL_STATUSES,
} from '@/types/enums';
import { STATS_PERIODS } from '@/types/stats';

/**
 * Filters live in the URL, not in component state.
 *
 * That is a deliberate choice for an operations console: a reviewer can send a colleague the exact
 * queue they are looking at, a refresh does not lose the filter someone spent a minute building,
 * and the browser's back button behaves the way everybody expects. The cost is that every filter
 * has to be validated on the way in, which is what these schemas do — an unparseable URL falls back
 * to the default view rather than throwing.
 */

const csvArray = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.array(z.enum(values)), z.string()])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      if (Array.isArray(value)) return value.length > 0 ? value : undefined;
      const parsed = value
        .split(',')
        .map((entry) => entry.trim().toUpperCase())
        .filter((entry): entry is T[number] => (values as readonly string[]).includes(entry));
      return parsed.length > 0 ? parsed : undefined;
    });

/**
 * A text filter, which the router may hand us as a number.
 *
 * TanStack parses every search value with `JSON.parse`, so a bank reference of `884512309`, a
 * Telegram id, or an amount of `1500.00` arrives typed as a number. Rejecting those would make the
 * filter silently vanish out of a link somebody shared — so they are read back as text. The one
 * casualty is trailing zeros: `1500.00` comes back `1500`, which filters identically.
 */
const optionalString = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => value.length > 0)
  .optional()
  .catch(undefined);
/**
 * A boolean filter, which the router may hand us as a boolean, a number, or a string.
 *
 * ── WHY NOT `z.coerce.boolean()` ──────────────────────────────────────────────────────────────
 * That is `Boolean(value)`, and `Boolean('false')` is `true`. The router `JSON.parse`s each search
 * value and falls back to the raw string when that throws, so the console's own links — which write
 * real JSON booleans — were fine, and `?linked=no`, `?unclaimedOnly=False` and `?isActive=off`
 * arrived as strings and every one of them read as **yes**. A link that says "not linked" filtered
 * to linked, silently, which is the worst way for a filter to be wrong: nothing looks broken.
 *
 * That only bites a hand-typed or hand-edited link. It is worth fixing anyway, because "a reviewer
 * can send a colleague the exact queue they are looking at" is a property this file already goes to
 * trouble to protect for string filters (see `optionalString` above) — booleans were simply missed.
 *
 * ── WHAT IS ACCEPTED, AND WHY THE REST IS ABSENT RATHER THAN FALSE ────────────────────────────
 * Real booleans; the numbers `1` and `0`, which is what `?x=1` becomes after `JSON.parse`; and the
 * strings `'true'`, `'false'`, `'1'`, `'0'`, case-insensitively. Anything else — `no`, `off`,
 * `maybe`, an empty value — is treated as ABSENT, which is this file's stated rule for an
 * unparseable filter (see the header): fall back to the default view. Reading `?linked=maybe` as
 * `false` would be inventing a filter nobody asked for, and it would be just as silent as the bug
 * it replaced.
 *
 * `yes` and `on` are deliberately NOT accepted. Guessing what somebody meant is how `'false'`
 * became `true` in the first place.
 */
const BOOLEAN_WORDS: Readonly<Record<string, boolean>> = {
  true: true,
  '1': true,
  false: false,
  '0': false,
};

const optionalBool = z
  .union([z.boolean(), z.number(), z.string()])
  .transform((value) => {
    if (typeof value === 'boolean') return value;
    // `String(1)` rather than a numeric branch, so the number and the string forms of the same
    // value cannot drift apart — `?x=1` is a number after JSON.parse and `?x=%31` is a string.
    return BOOLEAN_WORDS[String(value).trim().toLowerCase()];
  })
  // AFTER the transform, not before: `.optional()` here is what makes the KEY optional in the
  // inferred type. In front of the transform it would instead produce a required key that may hold
  // undefined, which `exactOptionalPropertyTypes` rejects everywhere the search object is passed on.
  .optional()
  .catch(undefined);
const pageLimit = z.coerce.number().int().min(1).max(100).optional().catch(undefined);
const pageOffset = z.coerce.number().int().min(0).optional().catch(undefined);

export const depositSearchSchema = z.object({
  status: csvArray(DEPOSIT_STATUSES).catch(undefined),
  sort: z.enum(DEPOSIT_SORTS).optional().catch(undefined),
  shortId: optionalString,
  playerId: optionalString,
  paymentMethodId: optionalString,
  externalReference: optionalString,
  createdFrom: optionalString,
  createdTo: optionalString,
  minAmount: optionalString,
  maxAmount: optionalString,
  unclaimedOnly: optionalBool,
  limit: pageLimit,
  /** The deposit open in the review panel. Makes a deposit under review a shareable link. */
  selected: optionalString,
});
export type DepositSearch = z.infer<typeof depositSearchSchema>;

export const playerSearchSchema = z.object({
  status: z.enum(PLAYER_STATUSES).optional().catch(undefined),
  search: optionalString,
  telegramUserId: optionalString,
  linked: optionalBool,
  /** `ICHANCY_IMPORT` is the "old players" view — accounts that predate the bot. */
  source: z.enum(PLAYER_SOURCES).optional().catch(undefined),
  /** Strict, like `linked`: `?blocked=no` is absent, never true. */
  blocked: optionalBool,
  limit: pageLimit,
  offset: pageOffset,
});
export type PlayerSearch = z.infer<typeof playerSearchSchema>;

/**
 * The withdrawal queue. Offset-paginated like the player directory rather than cursor-paginated like
 * deposits, because that is how the backend serves it; the filters otherwise mirror the deposit
 * queue's, and `selected` makes an open withdrawal a shareable link for the same reason.
 */
export const withdrawalSearchSchema = z.object({
  status: csvArray(WITHDRAWAL_STATUSES).catch(undefined),
  playerId: optionalString,
  shortId: optionalString,
  createdFrom: optionalString,
  createdTo: optionalString,
  sort: z.enum(WITHDRAWAL_SORTS).optional().catch(undefined),
  limit: pageLimit,
  offset: pageOffset,
  /** The withdrawal open in the detail panel. */
  selected: optionalString,
});
export type WithdrawalSearch = z.infer<typeof withdrawalSearchSchema>;

export const staffSearchSchema = z.object({
  role: z.enum(ADMIN_ROLES).optional().catch(undefined),
  isActive: optionalBool,
  limit: pageLimit,
  offset: pageOffset,
});
export type StaffSearch = z.infer<typeof staffSearchSchema>;

/**
 * The rails table's state filter — three choices, not the two `optionalBool` gives every other
 * screen.
 *
 * ══ WHY THIS IS THE ONE FILTER WITH ITS OWN DEFAULT ══════════════════════════════════════════
 * Every other list on this console defaults to "everything", because everything on those lists is
 * still current. A payment method is not: a retired rail is not just one more row, it is one that
 * moved real money once and now MUST NOT be offered again — and a table that shows it next to the
 * live rails, unfiltered, on first load, reads as a rail an operator could still pick. So this is
 * the one list whose ABSENT filter is not "no opinion" but "hide what is retired", and the operator
 * reaches everything else — retired rails, or literally everything — by choosing to.
 *
 * That needs a state `undefined` cannot express: undefined already means "not narrowed", and this
 * screen wants undefined to mean something narrower than any explicit choice. `'all'` is the escape
 * hatch — it says "no, really, show me the retired ones too" — and it has to be a value that
 * survives in the URL, not the same undefined the default already claims.
 */
const paymentMethodStateFilter = z.enum(['active', 'inactive', 'all']).optional().catch(undefined);

export const paymentMethodSearchSchema = z.object({
  rail: z.enum(PAYMENT_RAILS).optional().catch(undefined),
  state: paymentMethodStateFilter,
  /** The method whose destinations are open. */
  selected: optionalString,
  includeInactiveDestinations: optionalBool,
});
export type PaymentMethodSearch = z.infer<typeof paymentMethodSearchSchema>;

export const RECONCILIATION_TABS = ['breaks', 'ageing', 'ledger'] as const;
export type ReconciliationTab = (typeof RECONCILIATION_TABS)[number];

export const reconciliationSearchSchema = z.object({
  tab: z.enum(RECONCILIATION_TABS).optional().catch(undefined),
  status: csvArray(BREAK_STATUSES).catch(undefined),
  category: csvArray(BREAK_CATEGORIES).catch(undefined),
  minSeverity: z.coerce.number().int().min(1).max(5).optional().catch(undefined),
  selected: optionalString,
});
export type ReconciliationSearch = z.infer<typeof reconciliationSearchSchema>;

export const tenantSearchSchema = z.object({
  status: z.enum(TENANT_STATUSES).optional().catch(undefined),
  selected: optionalString,
  /** Opens the create form straight from a link or an empty state. */
  create: optionalBool,
});
export type TenantSearch = z.infer<typeof tenantSearchSchema>;

/**
 * The stats window, in the URL like every other filter.
 *
 * `.catch(undefined)` rather than a hard failure: an unknown period in a shared link falls back to
 * the default window instead of throwing away the whole navigation, which is the same bargain every
 * schema above makes. Undefined means the server's own default — the month — so the console does
 * not have to restate which one that is.
 */
export const statsSearchSchema = z.object({
  period: z.enum(STATS_PERIODS).optional().catch(undefined),
});
export type StatsSearch = z.infer<typeof statsSearchSchema>;

/** Where to send the operator back to after they sign in. */
export const loginSearchSchema = z.object({
  redirect: optionalString,
});
export type LoginSearch = z.infer<typeof loginSearchSchema>;

/** Drops keys whose value is undefined, so cleared filters leave the URL instead of becoming "". */
export function pruneSearch<T extends Record<string, unknown>>(search: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(search).filter(([, value]) => {
      if (value === undefined || value === null || value === '') return false;
      return !(Array.isArray(value) && value.length === 0);
    }),
  ) as Partial<T>;
}
