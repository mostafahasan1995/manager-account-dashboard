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
