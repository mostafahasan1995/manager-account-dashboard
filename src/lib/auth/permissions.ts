import type { AdminRole } from '@/types/enums';

/**
 * What each role may do, transcribed from the backend's own role constants.
 *
 * This is a MIRROR, not the enforcement. The server decides; this decides what to render. Keeping
 * them in step is the point of the table below being one literal object rather than conditionals
 * scattered through the screens — when a backend constant changes, exactly one thing changes here.
 *
 * `PLATFORM_ADMIN` is intentionally almost entirely `false`: it runs the platform, not a tenant, and
 * it has no business reading a tenant's deposits. `SUPER_ADMIN` is the top of ONE tenant and equally
 * intentionally cannot touch tenants.
 */

export const CAPABILITIES = [
  'deposits.read',
  'deposits.decide',
  'deposits.retryCredit',
  'deposits.sweep',
  'players.read',
  'players.link',
  'paymentMethods.read',
  'paymentMethods.write',
  'admins.read',
  'admins.write',
  'reconciliation.read',
  'reconciliation.act',
  'tenants.manage',
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
   * Runs the PLATFORM: creates and configures operators, and manages the staff inside any of them
   * by naming one with `X-Tenant-Id`. It reads everything else so the operator's state can be seen,
   * and CHANGES almost nothing.
   *
   * The line it does not cross is deciding money — approving a deposit, retrying a credit, posting
   * a float correction, resolving a break. Those are bounded by an `admin_approval_limits` row,
   * which is a per-operator grant a platform admin has none of; the backend's limit evaluator would
   * refuse it anyway, and a role that can approve without a limit is exactly the hole those limits
   * exist to close. Mirrors the backend's own role lists.
   */
  PLATFORM_ADMIN: withCapabilities(
    'tenants.manage',
    'admins.read',
    'admins.write',
    'deposits.read',
    'players.read',
    'paymentMethods.read',
    'reconciliation.read',
  ),

  SUPER_ADMIN: withCapabilities(
    'deposits.read',
    'deposits.decide',
    'deposits.retryCredit',
    'deposits.sweep',
    'players.read',
    'players.link',
    'paymentMethods.read',
    'paymentMethods.write',
    'admins.read',
    'admins.write',
    'reconciliation.read',
    'reconciliation.act',
  ),

  FINANCE_ADMIN: withCapabilities(
    'deposits.read',
    'deposits.decide',
    'deposits.retryCredit',
    'deposits.sweep',
    'players.read',
    'players.link',
    'paymentMethods.read',
    'paymentMethods.write',
    // Reads the admin directory and approval limits; only SUPER_ADMIN may change them.
    'admins.read',
    'reconciliation.read',
    'reconciliation.act',
  ),

  REVIEWER: withCapabilities(
    'deposits.read',
    'deposits.decide',
    'players.read',
    'paymentMethods.read',
    'reconciliation.read',
  ),

  SUPPORT: withCapabilities('deposits.read', 'players.read', 'paymentMethods.read'),

  VIEWER: withCapabilities('deposits.read', 'reconciliation.read'),
};

export function can(role: AdminRole | null | undefined, capability: Capability): boolean {
  if (role == null) return false;
  return ROLE_CAPABILITIES[role][capability];
}

export function canAny(role: AdminRole | null | undefined, capabilities: Capability[]): boolean {
  return capabilities.some((capability) => can(role, capability));
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
  'paymentMethods.read': 'See payment methods and destinations',
  'paymentMethods.write': 'Change payment methods and destinations',
  'admins.read': 'See staff and their approval limits',
  'admins.write': 'Add staff and set approval limits',
  'reconciliation.read': 'See reconciliation breaks and rail ageing',
  'reconciliation.act': 'Resolve breaks, sync the float, run invariants',
  'tenants.manage': 'Create, configure and suspend tenants',
};
