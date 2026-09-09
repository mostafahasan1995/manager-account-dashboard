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

import { AgentFloatPill } from './agent-float-pill';
import { HealthPill } from './health-pill';
import { LanguageToggle } from './language-toggle';
import { TenantSwitcher } from './tenant-switcher';

/**
 * How much session is left before the countdown is worth showing at all.
 *
 * Admin tokens have NO refresh, so when the clock reaches zero the console signs out — a reviewer
 * ten minutes into a difficult deposit deserves to have seen that coming. But the warning only
 * carries weight while it is rare. Admin sessions now last for days (ADMIN_JWT_ACCESS_TTL), and a
 * permanent "29d" pill is a countdown to nothing: it trains people to ignore the one badge that
 * matters on the afternoon it says eight minutes.
 */
const SESSION_CLOCK_VISIBLE_BELOW_MS = 2 * 60 * 60 * 1000;

function SessionClock() {
  const { session, expiringSoon, expiresInMs } = useAuth();
  const t = useT();
  if (session === null) return null;
  if (expiresInMs > SESSION_CLOCK_VISIBLE_BELOW_MS) return null;

  return (
    <Tooltip content={t('account.sessionEnds')}>
      {/*
        Desktop only, and this is the one thing in the bar that yields.

        A phone bar is ~390px and this badge is the widest item in it — a ticking "59m 58s" cannot
        be shortened the way a label can be dropped. Something had to give once the float joined the
        cluster, and measured against the alternatives this is the cheapest: it is absent entirely
        above two hours (see the constant), and inside the last five minutes AppShell raises a
        full-width alert under this bar that a phone reads far better than a 12px countdown. The
        float, by contrast, is the number this bar exists to carry at every width.
      */}
      <span className="hidden shrink-0 md:block">
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
        // The first thing to go when the bar runs out of room, and the only control here that is
        // duplicated elsewhere: Settings → Appearance sets the same preference, in words. Set once
        // and never touched again, unlike the language picker beside it — see the header's budget.
        className="hidden shrink-0 sm:inline-flex"
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
    /*
     * ── WHY THIS BAR HAS A WIDTH BUDGET ──────────────────────────────────────────────────────
     *
     * Everything in this row is `whitespace-nowrap`, so the row cannot reflow: past its budget it
     * either crushes its own controls or scrolls the page sideways. Adding the float — a permanent
     * ~130px of money — spent what was left. Measured in Chrome at 390px it overflowed by 56px and
     * squeezed the toggles to 16px, in both languages.
     *
     * So the reveals are staged, and the order is a priority list, poorest width first: the float's
     * FIGURE and the health light are in from 320px; the theme toggle returns at `sm`; the two
     * labels, the session countdown, the operator's name and the admin's name and role at `md`. The
     * float's number never yields — it is why the bar was rebuilt — and neither does the language
     * picker, which is the one control whose whole job is rescuing somebody who cannot read the
     * language on screen.
     *
     * Verified end to end at 320/360/390/414/640/768 in both directions, in the ordinary and the
     * low state. Everything from 360 up fits with no horizontal scroll; 320 overflows the bar by
     * 16px, and the console already overflows there on its own (the deposit table needs 369px).
     *
     * That budget was measured WITHOUT the operator switcher, which only a platform admin ever
     * sees — so the one role that could not read this bar on a phone was the role that administers
     * every operator on it. Its name is now staged at `md` like everything else here; the reasoning
     * and the numbers are on the trigger itself.
     */
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)]/95 px-3 backdrop-blur sm:gap-3 sm:px-4">
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 lg:hidden"
        onClick={onOpenNav}
        aria-label={t('nav.open')}
      >
        <Menu className="size-4" />
      </Button>

      {/* Leading, beside the navigation: whose data this is comes before how the API is feeling. */}
      <TenantSwitcher />

      <div className="flex-1" />

      {/* Before the health light, and for the same reason the operator comes before it: how much
          money is left to credit players with outranks how the API is feeling. */}
      <AgentFloatPill />
      <HealthPill />
      <SessionClock />
      <LanguageToggle />
      <ThemeToggle />

      {admin === null ? null : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex shrink-0 items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-[var(--muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
              aria-label={t('account.menu')}
            >
              <Avatar>
                <AvatarFallback>{initialsOf(admin.displayName)}</AvatarFallback>
              </Avatar>
              <span className="hidden text-start md:block">
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
                {admin.telegramUserId === null
                  ? t('account.noTelegram')
                  : t('account.telegram', { id: admin.telegramUserId })}
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
