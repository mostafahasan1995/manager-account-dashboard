import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';

import { Label, Switch } from '@/components/ui';
import { cn } from '@/lib/utils';

/**
 * The field wrappers the two rail forms are built from.
 *
 * They exist so no input on this screen can ship without a label, an error slot and the
 * `aria-describedby` that ties them together: those are forgotten one field at a time, and the
 * person who pays for it is the operator staring at a form that will not submit and will not say
 * why. The hint and error paragraphs are always in the DOM — an `aria-describedby` pointing at an
 * element that appears later is a broken reference, and an empty live region is how a screen
 * reader gets told about the error the moment it arrives.
 */

export interface FieldControl {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby': string;
}

export function Field({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
  className?: string;
  children: (control: FieldControl) => ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        'aria-invalid': error !== undefined,
        'aria-describedby': `${id}-hint ${id}-error`,
      })}
      <p id={`${id}-hint`} className="text-xs text-[var(--muted-foreground)] empty:hidden">
        {hint}
      </p>
      <p id={`${id}-error`} role="alert" className="text-sm text-[var(--danger)] empty:hidden">
        {error}
      </p>
    </div>
  );
}

/**
 * A value the backend refuses to change. Shown rather than omitted: an operator who cannot find the
 * currency field assumes the form is broken, while one who can see it locked with the reason next
 * to it knows to create a new method instead.
 */
export function ReadOnlyField({
  label,
  value,
  reason,
  mono = false,
}: {
  label: string;
  value: string;
  reason: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm leading-none font-medium">{label}</p>
      <div className="flex h-9 items-center gap-2 rounded-md border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 text-sm text-[var(--muted-foreground)]">
        <Lock className="size-3.5 shrink-0" aria-hidden="true" />
        <span className={cn('truncate', mono && 'font-mono text-xs')}>{value}</span>
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">{reason}</p>
    </div>
  );
}

export function ToggleField({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description?: string | undefined;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-[var(--border)] p-3">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        {description === undefined ? null : (
          <p className="text-xs text-[var(--muted-foreground)]">{description}</p>
        )}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
