import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';

export const TooltipProvider = TooltipPrimitive.Provider;

export function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 max-w-xs rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-xs shadow-md',
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}

/**
 * The shorthand used everywhere: a trigger plus a text tip. Every timestamp in the console renders
 * as "3 minutes ago" with the exact time in here, so both questions have an answer.
 */
export function Tooltip({
  content,
  children,
  side,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  if (content === null || content === undefined || content === '') return <>{children}</>;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipContent {...(side === undefined ? {} : { side })}>{content}</TooltipContent>
    </TooltipPrimitive.Root>
  );
}
