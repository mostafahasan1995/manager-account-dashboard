import { AlertCircle, Inbox, Lock, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage, isApiError } from '@/lib/api/errors';
import { useT } from '@/lib/i18n/use-translation';
import { cn } from '@/lib/utils';

/** The three things a data surface can be instead of data: empty, broken, or forbidden. */

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-14 text-center',
        className,
      )}
    >
      <div className="rounded-full bg-[var(--muted)] p-3 text-[var(--muted-foreground)]">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description === undefined ? null : (
          <p className="max-w-md text-sm text-[var(--muted-foreground)]">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/**
 * A failed request, shown as what it is. The correlation id is included because it is the only
 * thing that ties what the operator saw to the line the backend logged.
 */
export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const t = useT();
  const correlationId = isApiError(error) ? error.correlationId : null;
  const code = isApiError(error) ? error.code : null;
  const forbidden = isApiError(error) && error.isForbidden;

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-14 text-center',
        className,
      )}
    >
      <div className="rounded-full bg-[var(--danger-muted)] p-3 text-[var(--danger)]">
        {forbidden ? <Lock className="size-5" /> : <AlertCircle className="size-5" />}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {forbidden ? t('state.forbiddenTitle') : t('state.errorTitle')}
        </p>
        <p className="max-w-md text-sm text-[var(--muted-foreground)]">{errorMessage(error)}</p>
        {code === null ? null : (
          <p className="font-mono text-xs text-[var(--muted-foreground)]">{code}</p>
        )}
        {correlationId === null ? null : (
          <p className="font-mono text-xs text-[var(--muted-foreground)]">
            {t('state.correlationId', { id: correlationId })}
          </p>
        )}
      </div>
      {onRetry === undefined || forbidden ? null : (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw className="size-3.5" />
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}

/** Rows that keep the table's shape while it loads, so nothing shifts when the data lands. */
export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2 p-3" data-testid="table-skeleton">
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-3">
          {Array.from({ length: columns }, (_, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className={cn('h-5 flex-1', columnIndex === 0 && 'max-w-28')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-3 rounded-lg border border-[var(--border)] p-5', className)}>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-3 w-full max-w-56" />
    </div>
  );
}
