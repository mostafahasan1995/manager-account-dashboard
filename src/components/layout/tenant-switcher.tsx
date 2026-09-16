import { ArrowLeft, Building2, Check } from 'lucide-react';

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
import { config } from '@/config';
import { useTenants } from '@/lib/api/queries';
import { useAuth } from '@/lib/auth/use-auth';
import { useT } from '@/lib/i18n/use-translation';
import { cn } from '@/lib/utils';

/**
 * Which operator the console is pointed at.
 *
 * ── WHY ONLY A PLATFORM ADMIN SEES THIS ───────────────────────────────────────────────────────
 * An operator's own staff have exactly one operator: their own. The backend enforces that — it
 * ignores `X-Tenant-Id` from anybody who is not a PLATFORM_ADMIN — so showing a switcher to a
 * SUPER_ADMIN would offer a choice the server discards, which is worse than offering none.
 *
 * ── WHY IT SHOWS THE HOME OPERATOR WHEN NOTHING IS SELECTED ───────────────────────────────────
 * "No selection" is not a neutral state on this screen: it means the caller's own operator, and the
 * money on screen belongs to somebody. Naming it is the difference between reading a deposit queue
 * and reading the WRONG deposit queue.
 *
 * ── WHY THE TRIGGER IS AN ICON ON A PHONE ─────────────────────────────────────────────────────
 * The name was the widest single item in the top bar: `max-w-56` is 224px of the ~366px a 390px
 * screen has, and with it the bar overflowed by half again for the one role that sees this — the
 * role that administers every operator in the list was the only role that could not read the bar on
 * a phone. So the label joins the staged reveal the float and the health light already run there,
 * `sr-only` below `md` and back at `md`. `sr-only`, not `hidden`: a bare building icon is a control
 * whose entire subject — whose money is on screen — has gone missing, and that has to survive in
 * the accessibility tree at every width even when the eye cannot have it.
 */
export function TenantSwitcher() {
  const { can, tenantId, setTenantId, session } = useAuth();
  const t = useT();

  const isPlatformAdmin = can('tenants.manage');
  // Fetching the operator list is itself a PLATFORM_ADMIN-only call; asking as anyone else is a 403.
  const tenants = useTenants({ enabled: isPlatformAdmin && config.tenantHeaderEnabled });

  if (!isPlatformAdmin || !config.tenantHeaderEnabled) return null;

  const rows = tenants.data ?? [];
  const selected = rows.find((tenant) => tenant.id === tenantId) ?? null;
  const homeSlug = session?.tenantSlug ?? null;

  const label = selected?.displayName ?? homeSlug ?? t('tenant.home');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="min-w-0 gap-2 md:max-w-56">
          <Building2 className="size-4 shrink-0" />
          {/* Truncation on the inner box: `not-sr-only` restores `overflow` and `white-space`,
              which are two of the three declarations `truncate` is. And `block`, because `overflow`
              does nothing to an inline box — the flat version worked only by being a flex child. */}
          <span className="min-w-0 sr-only md:not-sr-only">
            <span className="block truncate">{label}</span>
          </span>
          {selected !== null && selected.status !== 'ACTIVE' ? (
            // `hidden`, unlike the label: `not-sr-only` zeroes padding, which is most of a badge.
            // Nothing a phone cannot reach — the dropdown marks the same status on the row itself.
            <Badge tone="warning" className="hidden md:inline-flex">
              {t(`enum.tenantStatus.${selected.status}` as 'common.all')}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="max-h-80 w-64 overflow-y-auto">
        <DropdownMenuLabel>
          {t('tenant.switcher')}
          <span className="mt-0.5 block font-normal">{t('tenant.switcherHint')}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() => {
            setTenantId(null);
          }}
          className={cn(tenantId === null && 'font-semibold text-[var(--primary)]')}
        >
          {tenantId === null ? <Check className="size-4" /> : <span className="size-4" />}
          <span className="truncate">{homeSlug ?? t('tenant.home')}</span>
        </DropdownMenuItem>

        {rows.map((tenant) => (
          <DropdownMenuItem
            key={tenant.id}
            onSelect={() => {
              setTenantId(tenant.id);
            }}
            className={cn(tenant.id === tenantId && 'font-semibold text-[var(--primary)]')}
          >
            {tenant.id === tenantId ? <Check className="size-4" /> : <span className="size-4" />}
            <span className="min-w-0 flex-1 truncate">{tenant.displayName}</span>
            {/* A suspended operator still has data worth reading; say which one it is up front. */}
            {tenant.status === 'ACTIVE' ? null : (
              <Badge tone="muted">{t(`enum.tenantStatus.${tenant.status}` as 'common.all')}</Badge>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The standing reminder that these numbers are not yours.
 *
 * The switcher is a control: it is looked at while a choice is being made and then forgotten. Every
 * screen after that shows another operator's deposits, another operator's float and another
 * operator's players, formatted exactly like your own — and a label inside a dropdown three clicks
 * ago is not what a reader consults before approving a payment.
 *
 * So the selection gets a line of its own, under the top bar, on every screen, for as long as it is
 * not the home operator. Quiet by design — a tinted strip and one button, not a banner with a
 * warning icon. It is orientation, not an alarm: this must be readable at a glance and ignorable
 * once read, because an alarm that never stops being true stops being read at all.
 */
export function TenantScopeStrip() {
  const { can, tenantId, setTenantId, session } = useAuth();
  const t = useT();

  const isPlatformAdmin = can('tenants.manage');
  // The same query the switcher runs, so naming the operator here costs no extra request.
  const tenants = useTenants({ enabled: isPlatformAdmin && config.tenantHeaderEnabled });

  // A session issued before the backend carried a tenant claim has no home id; "no selection" is
  // then the only thing that means home, which is exactly what the null check below says.
  const homeTenantId = session?.tenantId ?? null;
  const viewingOther =
    isPlatformAdmin && config.tenantHeaderEnabled && tenantId !== null && tenantId !== homeTenantId;

  if (!viewingOther) return null;

  const selected = tenants.data?.find((tenant) => tenant.id === tenantId) ?? null;
  // Before the list arrives the id is all there is, and naming nothing would be worse than naming
  // something unfamiliar — the point of the strip is that the selection is never invisible.
  const name = selected?.displayName ?? tenantId;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--border)] border-s-2 border-s-[var(--primary)] bg-[var(--primary-muted)] px-4 py-1.5 text-xs sm:px-6">
      <Building2 className="size-3.5 shrink-0 text-[var(--primary)]" />
      <p className="min-w-0 flex-1 text-[var(--foreground)]">
        {t('tenant.viewingOther', { tenant: name })}
      </p>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setTenantId(null);
        }}
      >
        {/* Directional: it means "back to where you came from", which is mirrored in Arabic. */}
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t('tenant.home')}
      </Button>
    </div>
  );
}
