import type { UseFormRegisterReturn } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * One labelled input for the two operational forms.
 *
 * The hint and the error paragraphs are always in the DOM. `aria-describedby` pointing at an
 * element that only appears once something goes wrong is a broken reference until then, and an
 * empty live region is how a screen reader gets told about the error the moment it arrives.
 */
export function TenantField({
  id,
  label,
  registration,
  error,
  hint,
  type = 'text',
  autoComplete,
  placeholder,
  mono = false,
}: {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  error: string | undefined;
  hint?: string;
  type?: 'text' | 'password';
  autoComplete?: string;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        aria-invalid={error !== undefined}
        aria-describedby={`${id}-hint ${id}-error`}
        className={cn(mono && 'font-mono')}
        {...(autoComplete === undefined ? {} : { autoComplete })}
        {...(placeholder === undefined ? {} : { placeholder })}
        {...registration}
      />
      <p id={`${id}-hint`} className="text-xs text-[var(--muted-foreground)] empty:hidden">
        {hint}
      </p>
      <p id={`${id}-error`} role="alert" className="text-sm text-[var(--danger)] empty:hidden">
        {error}
      </p>
    </div>
  );
}
