import type { ReactNode } from 'react';

import { useAuth } from '@/lib/auth/use-auth';
import type { Capability } from '@/lib/auth/permissions';

/**
 * Renders its children only when the signed-in role holds the capability.
 *
 * This hides; it does not protect. The backend enforces the same table independently — see
 * docs/API-CONTRACT.md section 3. Hiding a button the server would refuse is a courtesy to the
 * operator, not a security boundary, and treating it as one is how consoles grow holes.
 */
export function Can({
  capability,
  children,
  fallback = null,
}: {
  capability: Capability;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can } = useAuth();
  return <>{can(capability) ? children : fallback}</>;
}
