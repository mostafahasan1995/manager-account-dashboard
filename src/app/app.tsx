import { RouterProvider } from '@tanstack/react-router';
import { useEffect, useMemo, useRef } from 'react';

import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/lib/auth/use-auth';

import { createAppRouter } from './router';

export function App() {
  const auth = useAuth();

  // Created ONCE. `auth` is deliberately not a dependency: rebuilding the router would throw away
  // the history stack and every loaded route on each sign-in. The live auth state reaches the
  // guards through the `context` prop below, which updates on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const router = useMemo(() => createAppRouter({ auth }), []);

  /*
   * Signing in or out has to re-run the guards, and handing the router a new context does not do
   * that by itself — `beforeLoad` runs on NAVIGATION, and losing a session is not a navigation.
   * Without this, signing out leaves the operator sitting on a screen they can no longer load,
   * watching its requests 401 one by one. Invalidating replays every guard against the new state,
   * which is what redirects them to /login.
   */
  const wasAuthenticated = useRef(auth.isAuthenticated);
  useEffect(() => {
    if (wasAuthenticated.current === auth.isAuthenticated) return;
    wasAuthenticated.current = auth.isAuthenticated;
    void router.invalidate();
  }, [auth.isAuthenticated, router]);

  // Restoring the stored session takes one tick. Rendering the router first would evaluate the
  // guards against "signed out" and bounce a returning operator to the login screen.
  if (auth.isRestoring) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <Spinner label="Restoring your session" />
      </div>
    );
  }

  return <RouterProvider router={router} context={{ auth }} />;
}
