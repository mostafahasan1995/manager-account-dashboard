import { z } from 'zod';

import {
  BREAK_CATEGORIES,
  BREAK_STATUSES,
  DEPOSIT_SORTS,
  DEPOSIT_STATUSES,
  PAYMENT_RAILS,
  PLAYER_STATUSES,
  TENANT_STATUSES,
  ADMIN_ROLES,
} from '@/types/enums';

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
const optionalBool = z.coerce.boolean().optional().catch(undefined);
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
  limit: pageLimit,
  offset: pageOffset,
});
export type PlayerSearch = z.infer<typeof playerSearchSchema>;

export const staffSearchSchema = z.object({
  role: z.enum(ADMIN_ROLES).optional().catch(undefined),
  isActive: optionalBool,
  limit: pageLimit,
  offset: pageOffset,
});
export type StaffSearch = z.infer<typeof staffSearchSchema>;

export const paymentMethodSearchSchema = z.object({
  rail: z.enum(PAYMENT_RAILS).optional().catch(undefined),
  isActive: optionalBool,
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
