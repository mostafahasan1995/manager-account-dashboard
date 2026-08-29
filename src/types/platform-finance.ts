import { z } from 'zod';

import { agentFloatSchema } from './agent-float';
import { isoDateTime } from './api';
import { shamCashReadResultSchema } from './shamcash';

/**
 * The platform-wide finance overview: for every operator, three money cells the platform reads to
 * answer "is this operator's money where it should be?" — its Ichancy agent float, its USDT payout
 * wallets, and its external Sham Cash account.
 *
 * ══ EACH CELL CARRIES A STATUS FOR ONE REASON ═════════════════════════════════════════════════
 * A read that FAILED must never be rendered as `0`. Zero is a real answer — an empty wallet — and an
 * outage shown as a zero balance tells somebody with money in that account that it is gone. Every
 * cell is therefore a discriminated union on `status`: the ok/loaded arm carries a figure, and every
 * other arm carries WHAT IT IS instead (`unavailable`, `not linked`, `expired`, `not loaded`) and no
 * figure at all. There is no arm that can turn silence into a digit. This mirrors the same rule the
 * wallet-balance and player-balance code is built around.
 *
 * ══ CHEAP OVERVIEW, EXPENSIVE COLUMNS ═════════════════════════════════════════════════════════
 * The agent float is a cheap ledger read, so it is always present. USDT and Sham Cash cost a chain
 * call and a headless-browser replay respectively, so the overview does NOT pay for them up front:
 * they arrive as `not_loaded` and are filled in per operator by an explicit refresh.
 */

/**
 * The Ichancy agent float for one operator.
 *
 * The `ok` arm IS the existing `agentFloatSchema` shape (currencyCode, balanceMinor, balance,
 * lowWatermarkMinor, isLow, checkedAt) with a `status` added, so a figure here is judged against the
 * same server-computed `isLow` the top-bar pill uses. `unavailable` is the agent not answering — a
 * suspended operator, or an Ichancy outage — and it must never read as an empty float.
 */
export const agentFloatCellSchema = z.discriminatedUnion('status', [
  agentFloatSchema.extend({ status: z.literal('ok') }),
  z.object({ status: z.literal('unavailable'), detail: z.string() }),
]);
export type AgentFloatCell = z.infer<typeof agentFloatCellSchema>;

/**
 * One USDT payout wallet on an operator's rail. `ok` carries the on-chain figure at `balanceMinor`
 * (a decimal string of minor units) and its preformatted `balance`; `unavailable` is the chain read
 * that did not land — a node outage, or a destination that is not a wallet address at all — and it
 * carries the machine `problem` and a human `detail` where the number would have been, never a zero.
 */
export const usdtWalletCellSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    label: z.string(),
    network: z.string().nullable(),
    balanceMinor: z.string(),
    balance: z.string(),
    checkedAt: isoDateTime,
  }),
  z.object({
    status: z.literal('unavailable'),
    label: z.string(),
    network: z.string().nullable(),
    problem: z.string().nullable(),
    detail: z.string().nullable(),
    checkedAt: isoDateTime,
  }),
]);
export type UsdtWalletCell = z.infer<typeof usdtWalletCellSchema>;

/**
 * The USDT column for one operator. `not_loaded` is the un-fetched state the cheap overview starts
 * in — the wallets cost a chain call each, so they are read only on an explicit refresh. `loaded`
 * carries the wallets read at `checkedAt`, each with its own ok/unavailable status.
 */
export const usdtCellSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('not_loaded') }),
  z.object({
    status: z.literal('loaded'),
    checkedAt: isoDateTime,
    wallets: z.array(usdtWalletCellSchema),
  }),
]);
export type UsdtCell = z.infer<typeof usdtCellSchema>;

/**
 * The Sham Cash column for one operator. `not_loaded` is the un-fetched state (reading it replays a
 * headless-browser session, so it is not paid for up front); the loaded arms ARE the existing
 * `shamCashReadResultSchema` union — `ok` with balances and transactions, or `not_linked` /
 * `expired` / `unavailable`, none of which is a wallet of zeros.
 */
export const shamCashCellSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('not_loaded') }),
  ...shamCashReadResultSchema.options,
]);
export type ShamCashCell = z.infer<typeof shamCashCellSchema>;

/** One operator's row in the platform finance overview. */
export const tenantFinanceRowSchema = z.looseObject({
  tenantId: z.string(),
  slug: z.string(),
  agentFloat: agentFloatCellSchema,
  usdt: usdtCellSchema,
  shamCash: shamCashCellSchema,
});
export type TenantFinanceRow = z.infer<typeof tenantFinanceRowSchema>;

/** `GET /v1/admin/finance/balances` answers `{ tenants: [...] }`; callers get the array. */
export const financeBalancesSchema = z.looseObject({
  tenants: z.array(tenantFinanceRowSchema),
});
export type FinanceBalances = z.infer<typeof financeBalancesSchema>;
