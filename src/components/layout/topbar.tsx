import { useNavigate } from '@tanstack/react-router';
import { Clock, LogOut, Menu, Monitor, Moon, Settings, Sun } from 'lucide-react';

import { Countdown } from '@/components/common/time';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/auth/use-auth';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import { useTheme } from '@/lib/theme/use-theme';
import { initialsOf } from '@/lib/utils';

import { HealthPill } from './health-pill';
import { LanguageToggle } from './language-toggle';
import { TenantSwitcher } from './tenant-switcher';

/**
 * The session countdown is not decoration. Admin tokens have NO refresh — when this reaches zero
 * the console signs out, and a reviewer who is ten minutes into a difficult deposit deserves to
 * have seen it coming.
 */
function SessionClock() {
  const { session, expiringSoon } = useAuth();
  const t = useT();
  if (session === null) return null;

  return (
    <Tooltip content={t('account.sessionEnds')}>
      <span>
        <Badge tone={expiringSoon ? 'warning' : 'muted'} className="cursor-help">
          <Clock className="size-3" />
          {/* The token's own expiry, not a time computed during render — see Countdown's header. */}
          <Countdown target={session.expiresAt} />
        </Badge>
      </span>
    </Tooltip>
  );
}

function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  const t = useT();

  const next = preference === 'light' ? 'dark' : preference === 'dark' ? 'system' : 'light';
  const Icon = preference === 'light' ? Sun : preference === 'dark' ? Moon : Monitor;
  const label = t(`theme.${preference}`);

  return (
    <Tooltip content={t('theme.switch', { preference: label })}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          setPreference(next);
        }}
        aria-label={t('theme.switch', { preference: label })}
      >
        <Icon className="size-4" />
      </Button>
    </Tooltip>
  );
}

export function Topbar({ onOpenNav }: { onOpenNav: () => void }) {
  const { admin, signOut } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const enumLabel = useEnumLabel();

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 backdrop-blur">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenNav}
        aria-label={t('nav.open')}
      >
        <Menu className="size-4" />
      </Button>

      {/* Leading, beside the navigation: whose data this is comes before how the API is feeling. */}
      <TenantSwitcher />

      <div className="flex-1" />

      <HealthPill />
      <SessionClock />
      <LanguageToggle />
      <ThemeToggle />

      {admin === null ? null : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-[var(--muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
              aria-label={t('account.menu')}
            >
              <Avatar>
                <AvatarFallback>{initialsOf(admin.displayName)}</AvatarFallback>
              </Avatar>
              <span className="hidden text-start sm:block">
                <span className="block max-w-40 truncate font-medium">{admin.displayName}</span>
                <span className="block text-xs text-[var(--muted-foreground)]">
                  {enumLabel('adminRole', admin.role)}
                </span>
              </span>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent>
            <DropdownMenuLabel>
              {admin.displayName}
              <span className="mt-0.5 block font-normal">
                {t('account.telegram', { id: admin.telegramUserId })}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                void navigate({ to: '/settings' });
              }}
            >
              <Settings className="size-4" />
              {t('nav.settings')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                signOut('manual');
              }}
            >
              <LogOut className="size-4" />
              {t('account.signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
}
