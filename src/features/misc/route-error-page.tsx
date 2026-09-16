import type { ErrorComponentProps } from '@tanstack/react-router';

import { ErrorState } from '@/components/common/states';

/**
 * The last line of defence: a render error inside a route lands here instead of blanking the app.
 * Reloading is offered because the alternative — a white screen mid-shift — has no way out.
 */
export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <ErrorState error={error} onRetry={reset} />
    </div>
  );
}
