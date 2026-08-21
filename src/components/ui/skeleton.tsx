import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/** A loading placeholder that keeps the layout still, so nothing jumps when the data lands. */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-testid="skeleton"
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-[var(--muted)]', className)}
      {...props}
    />
  );
}
