import { QueryCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { ApiError, errorMessage } from '@/lib/api/errors';

/**
 * One QueryClient for the app, and one for each test.
 *
 * Retry policy is the part worth reading: a 4xx is never retried, because it will fail identically
 * and a retried 403 just delays telling the operator their role cannot do this. 5xx, 429 and
 * network failures are retried twice with a backoff.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => {
          if (error instanceof ApiError && !error.isRetryable) return false;
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),
        refetchOnWindowFocus: false,
      },
      mutations: {
        // Never retried: every mutation here moves money or changes authority, and the backend's
        // idempotency is per-key, not per-endpoint. A duplicate approve is not a recoverable error.
        retry: false,
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Background refetch failures are silent by design — the screen already shows stale data
        // and a toast storm during a backend blip helps nobody. A first load reports itself through
        // the screen's own ErrorState. This handler exists for the one case neither covers.
        if (query.state.data !== undefined && error instanceof ApiError && error.status >= 500) {
          toast.error('The API is having trouble', { description: errorMessage(error) });
        }
      },
    }),
  });
}
