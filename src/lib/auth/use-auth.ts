import { useContext } from 'react';

import { AuthContext, type AuthState } from './auth-context';

/** Throws rather than returning null: a screen rendered outside the provider is a wiring bug. */
export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}
