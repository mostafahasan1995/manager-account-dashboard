import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

const baseField =
  'flex h-9 w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-[var(--muted-foreground)] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-[var(--danger)]';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(baseField, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(baseField, 'h-auto min-h-20 py-2', className)} {...props} />;
}

export { baseField };
