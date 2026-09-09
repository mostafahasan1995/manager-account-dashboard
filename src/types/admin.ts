import { z } from 'zod';

import { isoDateTime } from './api';
import { adminRoleSchema, type AdminRole } from './enums';

export const adminUserSchema = z.looseObject({
  id: z.string(),
  /** Null for a manager added with just a username and password — no Telegram account. */
  telegramUserId: z.string().nullable(),
  username: z.string().nullable(),
  /** Whether a console password is set. Never the password or its hash. */
  hasPassword: z.boolean(),
  displayName: z.string(),
  role: adminRoleSchema,
  isActive: z.boolean(),
  lastLoginAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
});
export type AdminUser = z.infer<typeof adminUserSchema>;

/**
 * The identity returned by a sign-in exchange — shorter than AdminUser on purpose.
 *
 * `telegramUserId` is null for a manager who signed in with POST /v1/admin/auth/credentials rather
 * than a Telegram-based door: that account may hold no Telegram id at all.
 */
export const adminIdentitySchema = z.looseObject({
  id: z.string(),
  telegramUserId: z.string().nullable(),
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

/**
 * A staff account is a display name, a role, a username and a password (2026-09-05). There is no
 * `telegramUserId` here on purpose: the server refuses one outright — `forbidNonWhitelisted` — so
 * a client that still sent it would get a 400 rather than quietly have it ignored.
 */
export interface CreateAdminBody {
  displayName: string;
  role: AdminRole;
  /** Unique inside the tenant. A plain name or an email; the server lower-cases it. */
  username: string;
  password: string;
}

export interface UpdateAdminBody {
  displayName?: string;
  role?: AdminRole;
  isActive?: boolean;
  username?: string;
  /** Sets or replaces the console password. Omitted means "leave it exactly as it is". */
  password?: string;
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

// ── Signing in ─────────────────────────────────────────────────────────────────────────────────

/**
 * `POST /v1/admin/auth/credentials`. The only door into a session.
 *
 * `username` is a console login — a plain name or an email; both are ordinary values of the same
 * field, which is why this carries no separate `email`. Behind these two the server tries the
 * caller's own console credential first and the operator's Ichancy agent account second, and
 * answers the same session either way. Which one it was is not the console's business.
 *
 * `operatorSlug` is absent on the FIRST attempt and present on the second: one credential can open
 * more than one operator, and when it does the server refuses with `ADMIN_OPERATOR_AMBIGUOUS`
 * (or `AGENT_OPERATOR_AMBIGUOUS`, when it was the agent account that matched) and names them
 * rather than picking one.
 */
export interface AdminCredentialsBody {
  username: string;
  password: string;
  operatorSlug?: string;
}

/** One operator offered by an `*_OPERATOR_AMBIGUOUS` refusal. Never carries a secret. */
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
