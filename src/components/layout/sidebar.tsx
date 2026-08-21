import { Link } from '@tanstack/react-router';
import { Coins, X, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { config } from '@/config';
import { useAuth } from '@/lib/auth/use-auth';
import { useT } from '@/lib/i18n/use-translation';
import { cn } from '@/lib/utils';

import { NAV_ITEMS, SETTINGS_ITEM } from './nav-items';

/**
 * The navigation.
 *
 * Every edge here is a LOGICAL one — `start`, `end`, `border-e` — not left and right. In Arabic the
 * whole shell mirrors: the sidebar moves to the right, the drawer slides in from the right, and the
 * border it draws is on its left. Writing `left-0` would pin it to the wrong side of an Arabic
 * screen while everything around it flipped, which reads as a broken layout rather than a language.
 */

function NavLink({
  to,
  label,
  icon: Icon,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  onNavigate?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      // `exact` on the root so Overview is not highlighted on every child route.
      activeOptions={{ exact: to === '/' }}
      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] data-[status=active]:bg-[var(--primary-muted)] data-[status=active]:text-[var(--primary)]"
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function Sidebar({
  open = false,
  onClose,
}: {
  /** Mobile only: the sidebar is a drawer below `lg`. */
  open?: boolean;
  onClose?: () => void;
}) {
  const { can } = useAuth();
  const t = useT();
  const items = NAV_ITEMS.filter((item) => can(item.capability));

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-40 flex w-60 shrink-0 flex-col border-e border-[var(--border)] bg-[var(--surface)] transition-transform lg:static lg:translate-x-0',
          // The drawer hides off whichever edge it lives on, which is not the same edge in Arabic.
          open ? 'translate-x-0' : 'max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full',
        )}
        aria-label={t('nav.main')}
      >
        <div className="flex h-14 items-center justify-between gap-2 border-b border-[var(--border)] px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-[var(--primary)] text-[var(--primary-foreground)]">
              <Coins className="size-4" />
            </span>
            <span className="truncate text-sm font-semibold tracking-tight">{config.appName}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onClose}
            aria-label={t('nav.close')}
          >
            <X className="size-4" />
          </Button>
        </div>

        <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              label={t(item.labelKey as 'nav.overview')}
              icon={item.icon}
              {...(onClose === undefined ? {} : { onNavigate: onClose })}
            />
          ))}
        </nav>

        <div className="border-t border-[var(--border)] p-3">
          <NavLink
            to={SETTINGS_ITEM.to}
            label={t('nav.settings')}
            icon={SETTINGS_ITEM.icon}
            {...(onClose === undefined ? {} : { onNavigate: onClose })}
          />
        </div>
      </aside>
    </>
  );
}
