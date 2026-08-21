import { Link } from '@tanstack/react-router';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Tone } from '@/types/enums';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'text-[var(--foreground)]',
  muted: 'text-[var(--muted-foreground)]',
  info: 'text-[var(--info)]',
  success: 'text-[var(--success)]',
  warning: 'text-[var(--warning)]',
  danger: 'text-[var(--danger)]',
};

/**
 * One number, what it means, and where to go about it.
 *
 * Every tile on the overview links somewhere: a count nobody can act on is decoration, and this
 * console is opened when something needs doing.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
  icon: Icon,
  to,
  search,
  loading = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  icon?: LucideIcon;
  to?: string;
  search?: Record<string, unknown>;
  loading?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-[var(--muted-foreground)] uppercase">
          {label}
        </p>
        {Icon === undefined ? null : <Icon className={cn('size-4', TONE_CLASSES[tone])} />}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <p className={cn('tabular mt-2 text-2xl font-semibold', TONE_CLASSES[tone])}>{value}</p>
      )}
      {hint === undefined ? null : (
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">{hint}</p>
      )}
    </>
  );

  if (to === undefined) {
    return <Card className="p-4">{body}</Card>;
  }

  return (
    <Card className="transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]">
      <Link
        to={to}
        search={search as never}
        className="block rounded-lg p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
      >
        {body}
      </Link>
    </Card>
  );
}
