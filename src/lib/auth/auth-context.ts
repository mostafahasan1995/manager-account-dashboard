import { createContext } from 'react';

import type { AdminIdentity, AdminSession } from '@/types/admin';
import type { AdminRole } from '@/types/enums';

import type { Capability } from './permissions';

export type SignOutReason = 'manual' | 'expired' | 'unauthorized';

export interface AuthState {
  session: AdminSession | null;
  admin: AdminIdentity | null;
  role: AdminRole | null;
  isAuthenticated: boolean;
  /** True while the stored session is being restored, before the first render decides a route. */
  isRestoring: boolean;
  /** Set when the last sign-out was not the admin's own doing, so the login screen can say why. */
  signOutReason: SignOutReason | null;
  /** Milliseconds until the access token expires. 0 when there is no session. */
  expiresInMs: number;
  expiringSoon: boolean;
  signIn: (code: string) => Promise<AdminSession>;
  signOut: (reason?: SignOutReason) => void;
  can: (capability: Capability) => boolean;
  /** The tenant the console is pointed at, when the tenant header is enabled. */
  tenantId: string | null;
  setTenantId: (tenantId: string | null) => void;
}

export const AuthContext = createContext<AuthState | null>(null);
