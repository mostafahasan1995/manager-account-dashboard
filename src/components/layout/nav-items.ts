import {
  Banknote,
  Building2,
  HandCoins,
  LayoutDashboard,
  Scale,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import type { Capability } from '@/lib/auth/permissions';

/**
 * The navigation, in the order the work happens: what needs deciding, who it belongs to, where the
 * money comes in, whether the books agree, who may act, and finally the platform itself.
 *
 * Each entry names the capability it needs. A role that cannot open a screen does not see its link
 * — the nav is derived from the same table the screens use, so the two can never disagree.
 *
 * Labels are message KEYS, not text: this list is a module constant, evaluated once, and a
 * translated string baked in here would stay in whichever language the app started in.
 */

export interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  capability: Capability;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', labelKey: 'nav.overview', icon: LayoutDashboard, capability: 'deposits.read' },
  { to: '/deposits', labelKey: 'nav.deposits', icon: Banknote, capability: 'deposits.read' },
  { to: '/players', labelKey: 'nav.players', icon: Users, capability: 'players.read' },
  {
    to: '/payment-methods',
    labelKey: 'nav.paymentMethods',
    icon: Wallet,
    capability: 'paymentMethods.read',
  },
  /*
   * The same capability as the rails screen, deliberately: a REVIEWER or a SUPPORT agent reads the
   * USDT rate off here while deciding a crypto deposit. Gating the ROUTE on write would take that
   * away from them; the write controls inside are gated one by one instead.
   */
  {
    to: '/financial',
    labelKey: 'nav.financial',
    icon: HandCoins,
    capability: 'paymentMethods.read',
  },
  {
    to: '/reconciliation',
    labelKey: 'nav.reconciliation',
    icon: Scale,
    capability: 'reconciliation.read',
  },
  { to: '/staff', labelKey: 'nav.staff', icon: ShieldCheck, capability: 'admins.read' },
  { to: '/tenants', labelKey: 'nav.tenants', icon: Building2, capability: 'tenants.manage' },
] as const;

export const SETTINGS_ITEM = {
  to: '/settings',
  labelKey: 'nav.settings',
  icon: Settings,
} as const;

export function visibleNavItems(can: (capability: Capability) => boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => can(item.capability));
}

/**
 * Where a role lands after signing in.
 *
 * Operators first for anyone who manages them, even though a platform admin can now also read a
 * deposit queue. Its job is the PLATFORM, and the queue it would otherwise land on belongs to
 * whichever operator happens to be selected — a screenful of somebody else's money is a poor way to
 * open a shift, and choosing the operator is the first thing that has to happen anyway.
 */
export function homeRouteFor(can: (capability: Capability) => boolean): string {
  if (can('tenants.manage')) return '/tenants';
  if (can('deposits.read')) return '/';
  const first = visibleNavItems(can)[0];
  return first?.to ?? '/settings';
}
