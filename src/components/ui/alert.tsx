import { cva, type VariantProps } from 'class-variance-authority';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';

const alertVariants = cva('flex gap-3 rounded-lg border p-4 text-sm', {
  variants: {
    tone: {
      info: 'border-[var(--info)]/30 bg-[var(--info-muted)] text-[var(--foreground)]',
      success: 'border-[var(--success)]/30 bg-[var(--success-muted)] text-[var(--foreground)]',
      warning: 'border-[var(--warning)]/40 bg-[var(--warning-muted)] text-[var(--foreground)]',
      danger: 'border-[var(--danger)]/40 bg-[var(--danger-muted)] text-[var(--foreground)]',
      neutral: 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground)]',
    },
  },
  defaultVariants: { tone: 'info' },
});

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  neutral: Info,
} as const;

const ICON_COLORS = {
  info: 'text-[var(--info)]',
  success: 'text-[var(--success)]',
  warning: 'text-[var(--warning)]',
  danger: 'text-[var(--danger)]',
  neutral: 'text-[var(--muted-foreground)]',
} as const;

export interface AlertProps
  extends Omit<ComponentProps<'div'>, 'title'>, VariantProps<typeof alertVariants> {
  title?: ReactNode;
  tone?: keyof typeof ICONS;
  /** Hide the leading icon when the alert sits inside something that already has one. */
  hideIcon?: boolean;
}

export function Alert({
  className,
  tone = 'info',
  title,
  hideIcon = false,
  children,
  ...props
}: AlertProps) {
  const Icon = ICONS[tone];
  return (
    <div role="status" className={cn(alertVariants({ tone }), className)} {...props}>
      {hideIcon ? null : <Icon className={cn('mt-0.5 size-4 shrink-0', ICON_COLORS[tone])} />}
      <div className="min-w-0 flex-1 space-y-1">
        {title === undefined ? null : <p className="font-medium">{title}</p>}
        {children === undefined ? null : (
          <div className="text-[var(--muted-foreground)]">{children}</div>
        )}
      </div>
    </div>
  );
}
