import { z } from 'zod';

/**
 * The shapes shared by every endpoint: the response envelope, the two pagination metas, and money.
 *
 * Schemas are `looseObject` on purpose. A backend that adds a field must never blank a screen here,
 * so unknown keys pass through; what these schemas defend against is a field that VANISHES or
 * changes type, which is the drift that actually breaks a render.
 */

export const apiErrorBodySchema = z.looseObject({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

export const apiMetaSchema = z.looseObject({
  correlationId: z.string(),
  timestamp: z.string(),
});
export type ApiMeta = z.infer<typeof apiMetaSchema>;

export const pageMetaSchema = z.looseObject({
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  hasMore: z.boolean(),
});
export type PageMeta = z.infer<typeof pageMetaSchema>;

export const cursorMetaSchema = z.looseObject({
  limit: z.number(),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});
export type CursorMeta = z.infer<typeof cursorMetaSchema>;

/** An offset-paginated result, already unwrapped out of the envelope by the client. */
export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

/** A cursor-paginated result, already unwrapped. */
export interface CursorPaginated<T> {
  data: T[];
  meta: CursorMeta;
}

export const moneyViewSchema = z.looseObject({
  minor: z.string(),
  amount: z.string(),
  currency: z.string(),
});
export type MoneyView = z.infer<typeof moneyViewSchema>;

/** Reconciliation's money pairs carry no currency of their own — the row does. */
export const breakMoneySchema = z.looseObject({
  minor: z.string(),
  amount: z.string(),
});
export type BreakMoney = z.infer<typeof breakMoneySchema>;

/** ISO-8601 strings; validated as strings, parsed only where they are displayed. */
export const isoDateTime = z.string();
