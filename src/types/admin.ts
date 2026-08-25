import { z } from 'zod';

import { isoDateTime } from './api';
import { adminRoleSchema, type AdminRole } from './enums';

export const adminUserSchema = z.looseObject({
  id: z.string(),
  telegramUserId: z.string(),
  username: z.string().nullable(),
  displayName: z.string(),
  role: adminRoleSchema,
  isActive: z.boolean(),
  lastLoginAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
});
export type AdminUser = z.infer<typeof adminUserSchema>;

/** The identity returned by the login exchange — shorter than AdminUser on purpose. */
export const adminIdentitySchema = z.looseObject({
  id: z.string(),
  telegramUserId: z.string(),
  role: adminRoleSchema,
  displayName: z.string(),
});
export type AdminIdentity = z.infer<typeof adminIdentitySchema>;

export const adminSessionSchema = z.looseObject({
  accessToken: z.string(),
  expiresAt: isoDateTime,
  admin: adminIdentitySchema,
  /**
   * The HOME operator this session signed into — the one whose bot minted the code, and the one
   * every request on this token resolves identity against.
   *
   * Optional because a session issued before the backend carried a tenant claim has neither field,
   * and such a token stays valid until it expires. Absent means the default operator.
   */
  tenantId: z.string().optional(),
  tenantSlug: z.string().optional(),
});
export type AdminSession = z.infer<typeof adminSessionSchema>;

/**
 * One VERSION of an admin's authority. Setting a new one closes the previous; deleting one leaves
 * the admin with no authority at all, which the backend evaluates as DENIED.
 */
export const approvalLimitSchema = z.looseObject({
  id: z.string(),
  adminUserId: z.string(),
  currencyCode: z.string(),
  maxSingleApproval: z.string(),
  maxDailyApproval: z.string(),
  secondApprovalAbove: z.string().nullable(),
  effectiveFrom: isoDateTime,
  effectiveTo: isoDateTime.nullable(),
  createdAt: isoDateTime,
});
export type ApprovalLimit = z.infer<typeof approvalLimitSchema>;

export interface AdminListQuery {
  role?: AdminRole;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

export interface CreateAdminBody {
  telegramUserId: string;
  displayName: string;
  role: AdminRole;
  username?: string;
}

export interface UpdateAdminBody {
  displayName?: string;
  role?: AdminRole;
  isActive?: boolean;
  username?: string;
}

export interface SetApprovalLimitBody {
  currencyCode: string;
  maxSingleApproval: string;
  maxDailyApproval: string;
  secondApprovalAbove?: string;
}

/** A limit version is in force when it has not been closed. */
export function isCurrentLimit(limit: ApprovalLimit): boolean {
  return limit.effectiveTo === null;
}

// ── Signing in with an Ichancy agent account ───────────────────────────────────────────────────

/**
 * `POST /v1/admin/auth/ichancy`. The OTHER door into a session, beside the Telegram bot code.
 *
 * An operator IS an Ichancy agent: `ichancyUsername` / `ichancyPassword` on its tenant row are the
 * account that registers its players and holds its float. Those are what it signs in with, and the
 * session it gets back is that operator's SUPER_ADMIN. PLATFORM_ADMIN is not reachable this way —
 * the platform runs no agent of its own — so running the platform stays a bot-code login.
 *
 * `operatorSlug` is absent on the FIRST attempt and present on the second: two tenants may be
 * configured against one agent account, and when they are, the server refuses with
 * `AGENT_OPERATOR_AMBIGUOUS` and names them rather than picking one.
 */
export interface AgentSignInBody {
  username: string;
  password: string;
  operatorSlug?: string;
}

/** One operator offered by `AGENT_OPERATOR_AMBIGUOUS`. Never carries a secret. */
export const agentOperatorChoiceSchema = z.looseObject({
  slug: z.string(),
  displayName: z.string(),
});
export type AgentOperatorChoice = z.infer<typeof agentOperatorChoiceSchema>;

/**
 * The operators named in an error's `details`, or none.
 *
 * Parsed rather than cast, and empty rather than throwing on a shape it does not recognise: this
 * reads an ERROR body, so it runs at the exact moment something has already gone wrong. A screen
 * that then crashed on the diagnosis would replace a message the operator can act on with one
 * nobody can.
 */
export function agentOperatorChoices(details: unknown): AgentOperatorChoice[] {
  if (typeof details !== 'object' || details === null) return [];
  const operators = (details as { operators?: unknown }).operators;
  if (!Array.isArray(operators)) return [];
  return operators.flatMap((entry) => {
    const parsed = agentOperatorChoiceSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}
