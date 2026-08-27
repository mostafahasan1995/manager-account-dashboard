import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';
import type { Tone } from '@/types/enums';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'border-[var(--border-strong)] bg-[var(--muted)] text-[var(--foreground)]',
        muted: 'border-[var(--border)] bg-transparent text-[var(--muted-foreground)]',
        info: 'border-transparent bg-[var(--info-muted)] text-[var(--info)]',
        success: 'border-transparent bg-[var(--success-muted)] text-[var(--success)]',
        warning: 'border-transparent bg-[var(--warning-muted)] text-[var(--warning)]',
        danger: 'border-transparent bg-[var(--danger-muted)] text-[var(--danger)]',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends Omit<ComponentProps<'span'>, 'color'>, VariantProps<typeof badgeVariants> {
  tone?: Tone;
}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { badgeVariants };
