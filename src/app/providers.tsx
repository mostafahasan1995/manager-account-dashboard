import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';

import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/lib/auth/auth-provider';
import { I18nProvider } from '@/lib/i18n/i18n-provider';
import { ThemeProvider } from '@/lib/theme/theme-provider';
import { useTheme } from '@/lib/theme/use-theme';

import { createQueryClient } from './query-client';

/** Split out so the toaster can follow the theme without the provider tree re-rendering. */
function ThemedToaster() {
  const { resolved } = useTheme();
  return (
    <Toaster
      theme={resolved}
      position="bottom-right"
      closeButton
      richColors
      toastOptions={{ duration: 6_000 }}
    />
  );
}

export function AppProviders({
  children,
  queryClient,
}: {
  children: ReactNode;
  /** Tests inject their own so each case starts with an empty cache. */
  queryClient?: QueryClient;
}) {
  const [client] = useState(() => queryClient ?? createQueryClient());

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <TooltipProvider delayDuration={200}>
              {children}
              <ThemedToaster />
            </TooltipProvider>
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
