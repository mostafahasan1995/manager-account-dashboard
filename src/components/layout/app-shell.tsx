import { Outlet } from '@tanstack/react-router';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { useAuth } from '@/lib/auth/use-auth';
import { useT } from '@/lib/i18n/use-translation';

import { Sidebar } from './sidebar';
import { TenantNotice } from './tenant-notice';
import { TenantScopeStrip } from './tenant-switcher';
import { Topbar } from './topbar';

/**
 * The frame every signed-in screen renders inside: navigation down the leading edge, status on top,
 * the page in the middle. Leading, not left — in Arabic the whole shell mirrors. One column below
 * `lg`, where the navigation becomes a drawer that slides in from that same edge.
 */
export function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const { expiringSoon } = useAuth();
  const t = useT();

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <Sidebar
        open={navOpen}
        onClose={() => {
          setNavOpen(false);
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onOpenNav={() => {
            setNavOpen(true);
          }}
        />
        <TenantNotice />
        <TenantScopeStrip />

        {expiringSoon ? (
          <div className="px-4 pt-4 sm:px-6">
            <Alert tone="warning" title={t('session.expiringTitle')}>
              {t('session.expiringBody')}
            </Alert>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
