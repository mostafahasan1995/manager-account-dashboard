import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-4',
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description === undefined ? null : (
          <p className="max-w-3xl text-sm text-[var(--muted-foreground)]">{description}</p>
        )}
      </div>
      {actions === undefined ? null : (
        // `flex-wrap`, not `shrink-0`. The header wraps this block onto its own line, but the block
        // itself was one unbreakable row — and the player screen puts three buttons in it (back,
        // credit, debit), which at 390px is wider than the phone and pushed the page sideways.
        // Buttons are `whitespace-nowrap` and will not squash, so wrapping is the only give here.
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}

/** A label/value pair. Detail panels are built out of rows of these. */
export function DetailRow({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 py-1.5 text-sm', className)}>
      <dt className="shrink-0 text-[var(--muted-foreground)]">{label}</dt>
      <dd className="min-w-0 text-end break-words">{children}</dd>
    </div>
  );
}

export function DetailList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('divide-y divide-[var(--border)]', className)}>{children}</dl>;
}
