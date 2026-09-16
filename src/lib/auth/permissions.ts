import type { AdminRole } from '@/types/enums';
import { TENANT_ZERO_ID } from '@/types/tenant';

/**
 * What each role may do, transcribed from the backend's own role constants.
 *
 * This is a MIRROR, not the enforcement. The server decides; this decides what to render. Keeping
 * them in step is the point of the table below being one literal object rather than conditionals
 * scattered through the screens — when a backend constant changes, exactly one thing changes here.
 *
 * `SUPER_ADMIN` is the top of ONE tenant and intentionally cannot touch tenants. `PLATFORM_ADMIN`
 * is the OWNER SUPERSET and holds every capability — see the long note on its entry in the table
 * below for why that reverses the platform/tenant split this file originally drew.
 */

export const CAPABILITIES = [
  'deposits.read',
  'deposits.decide',
  'deposits.retryCredit',
  'deposits.sweep',
  'players.read',
  'players.link',
  'players.write',
  'players.block',
  'players.import',
  'withdrawals.read',
  'withdrawals.decide',
  'botSettings.write',
  'paymentMethods.read',
  'paymentMethods.write',
  'admins.read',
  'admins.write',
  'reconciliation.read',
  'reconciliation.act',
  'tenants.manage',
  'platformFinance.read',
  'telegramDestinations.read',
  'telegramDestinations.write',
  'reports.publish',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

type CapabilityMap = Record<Capability, boolean>;

const none = (): CapabilityMap =>
  Object.fromEntries(CAPABILITIES.map((capability) => [capability, false])) as CapabilityMap;

const withCapabilities = (...granted: Capability[]): CapabilityMap => {
  const map = none();
  for (const capability of granted) map[capability] = true;
  return map;
};

export const ROLE_CAPABILITIES: Record<AdminRole, CapabilityMap> = {
  /*
   * THE OWNER SUPERSET. By the operator's explicit decision, PLATFORM_ADMIN can do EVERYTHING every
   * other role can — decide deposits, correct floats, resolve breaks, credit and debit players,
   * configure rails — PLUS the platform-level actions (create and configure operators, manage staff
   * across them, see every operator's finance balances). So it holds every capability.
   *
   * WHICH tenant an action touches is decided by the tenant it is operating IN: its own home
   * (tenant zero) when nothing is selected, or another operator once picked in the switcher (the
   * `X-Tenant-Id` override). The override is how it REACHES another tenant, never a gate on the action.
   *
   * This deliberately crosses the "platform admin never decides money" line the earlier design drew:
   * the operator wanted their owner account to be a strict superset of a tenant SUPER_ADMIN, and this
   * is that. Its money decisions are unbounded by an approval limit (the RolesGuard and the
   * approval-limit evaluator on the backend exempt it) but still land in the ledger and the audit
   * trail like anyone else's. Mirrors the backend, where PLATFORM_ADMIN now satisfies every role list.
   */
  PLATFORM_ADMIN: withCapabilities(...CAPABILITIES),

  SUPER_ADMIN: withCapabilities(
    'deposits.read',
    'deposits.decide',
    'deposits.retryCredit',
    'deposits.sweep',
    'players.read',
    'players.link',
    // Registering, attaching a Telegram id, blocking and importing are the operator's own account
    // administration — PLAYER_CREATE_ROLES / PLAYER_BLOCK_ROLES / PLAYER_IMPORT_ROLES on the
    // backend, all three the same pair as `players.link`.
    'players.write',
    'players.block',
    'players.import',
    // A cash-out is decided by the same three roles that decide a deposit or a debit.
    'withdrawals.read',
    'withdrawals.decide',
    // The withdrawal mode and the mini-app URL: settings that move money or open a website.
    'botSettings.write',
    'paymentMethods.read',
    'paymentMethods.write',
    'admins.read',
    'admins.write',
    'reconciliation.read',
    'reconciliation.act',
    // The operator owns the groups its own bot posts into — mirrors
    // TELEGRAM_DESTINATION_MANAGER_ROLES on the backend.
    'telegramDestinations.read',
    'telegramDestinations.write',
    'reports.publish',
  ),

  FINANCE_ADMIN: withCapabilities(
    'deposits.read',
    'deposits.decide',
    'deposits.retryCredit',
    'deposits.sweep',
    'players.read',
    'players.link',
    'players.write',
    'players.block',
    'players.import',
    'withdrawals.read',
    'withdrawals.decide',
    'botSettings.write',
    'paymentMethods.read',
    'paymentMethods.write',
    // Reads the admin directory and approval limits; only SUPER_ADMIN may change them.
    'admins.read',
    'reconciliation.read',
    'reconciliation.act',
    // Reads the destination list and may publish a report; only SUPER_ADMIN may rebind a chat.
    'telegramDestinations.read',
    'reports.publish',
  ),

  REVIEWER: withCapabilities(
    'deposits.read',
    'deposits.decide',
    'players.read',
    // Decides cash-outs as it decides deposits — WITHDRAWAL_DECIDE_ROLES is pinned to the debit
    // set on the backend — but cannot register, block or import a player.
    'withdrawals.read',
    'withdrawals.decide',
    'paymentMethods.read',
    'reconciliation.read',
    // A reviewer sees a card in a group and needs to be able to ask which group that was.
    'telegramDestinations.read',
  ),

  // Reads the withdrawal queue as it reads players — the same reader set — and decides nothing.
  SUPPORT: withCapabilities(
    'deposits.read',
    'players.read',
    'withdrawals.read',
    'paymentMethods.read',
  ),

  VIEWER: withCapabilities('deposits.read', 'reconciliation.read'),
};

export function can(role: AdminRole | null | undefined, capability: Capability): boolean {
  if (role == null) return false;
  return ROLE_CAPABILITIES[role][capability];
}

export function canAny(role: AdminRole | null | undefined, capabilities: Capability[]): boolean {
  return capabilities.some((capability) => can(role, capability));
}

/**
 * May the signed-in admin hand out this role? A mirror of `AdminUserService.assertMayGrant`.
 *
 * `admins.write` is not enough on its own, because one role is not like the others. PLATFORM_ADMIN
 * reaches ACROSS tenants, so the backend restricts granting it twice over: the actor must already
 * hold it, AND must be operating in tenant zero — a platform admin who has switched into an
 * operator is refused, because `admin_users` is keyed on (tenant, telegram id) and the row would
 * land inside that operator as a tenant-scoped login holding platform authority.
 *
 * `tenantOverride` is the `X-Tenant-Id` the console is currently sending; `null` means none, which
 * is the only state in which the backend is in tenant zero.
 *
 * Without this the picker offers every role to everyone and the server answers 403 — a form that
 * invites a choice it cannot honour, which is exactly what the mirror exists to prevent.
 */
export function mayGrantRole(
  actorRole: AdminRole | null | undefined,
  role: AdminRole,
  tenantOverride: string | null,
): boolean {
  if (!can(actorRole, 'admins.write')) return false;
  if (role !== 'PLATFORM_ADMIN') return true;
  return actorRole === 'PLATFORM_ADMIN' && tenantOverride === null;
}

/**
 * Whether the backend answers this console's requests for tenant zero, the platform.
 *
 * The backend reads a request for the caller's HOME tenant unless `X-Tenant-Id` moves it, and it
 * honours that header only for a PLATFORM_ADMIN — whose home is always tenant zero — and only when
 * this deployment sends it (`headerEnabled`). So a platform admin is in tenant zero until an operator
 * is picked; anyone else is in whatever tenant they signed into (`homeTenantId`, absent on a session
 * older than the tenant claim, which is then not assumed to be tenant zero).
 */
export function worksInTenantZero(input: {
  role: AdminRole | null | undefined;
  homeTenantId: string | undefined;
  tenantOverride: string | null;
  headerEnabled: boolean;
}): boolean {
  if (input.role === 'PLATFORM_ADMIN') {
    const override = input.headerEnabled ? input.tenantOverride : null;
    return override === null || override === TENANT_ZERO_ID;
  }
  return input.homeTenantId === TENANT_ZERO_ID;
}

/** Everything this role can do, for the "your access" panel on the profile screen. */
export function capabilitiesOf(role: AdminRole | null | undefined): Capability[] {
  if (role == null) return [];
  return CAPABILITIES.filter((capability) => ROLE_CAPABILITIES[role][capability]);
}

export const CAPABILITY_LABELS: Record<Capability, string> = {
  'deposits.read': 'See the deposit queue',
  'deposits.decide': 'Claim, approve and reject deposits',
  'deposits.retryCredit': 'Retry a failed credit',
  'deposits.sweep': 'Run the deposit maintenance sweep',
  'players.read': 'See players',
  'players.link': 'Create a player Ichancy account',
  'players.write': 'Register a player and attach a Telegram account',
  'players.block': 'Block and unblock players',
  'players.import': 'Import the existing Ichancy players',
  'withdrawals.read': 'See the withdrawal queue',
  'withdrawals.decide': 'Approve, reject and pay out withdrawals',
  'botSettings.write': 'Set the withdrawal mode and the mini app link',
  'paymentMethods.read': 'See payment methods and destinations',
  'paymentMethods.write': 'Change payment methods and destinations',
  'admins.read': 'See staff and their approval limits',
  'admins.write': 'Add staff and set approval limits',
  'reconciliation.read': 'See reconciliation breaks and rail ageing',
  'reconciliation.act': 'Resolve breaks, sync the float, run invariants',
  'tenants.manage': 'Create, configure and suspend tenants',
  'platformFinance.read': "See every operator's finance balances",
  'telegramDestinations.read': 'See where the bot publishes',
  'telegramDestinations.write': 'Add, change and test Telegram destinations',
  'reports.publish': 'Publish a report to Telegram',
};
