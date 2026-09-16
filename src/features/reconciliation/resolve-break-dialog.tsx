import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/input';
import { errorMessage } from '@/lib/api/errors';
import { useResolveBreak } from '@/lib/api/queries';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import { TERMINAL_BREAK_STATUSES, type TerminalBreakStatus } from '@/types/enums';

import { reconMessages } from './messages';

/**
 * Closing a break.
 *
 * The three closing statuses are not interchangeable and the operator picks between them with the
 * consequence written next to each one: "written off" means real money is gone and we are accepting
 * the loss, which is an accounting decision, not a tidy-up. That one takes a second, explicit
 * confirmation. The note is mandatory for all three because a closed break with no explanation is
 * indistinguishable from a break somebody hid.
 */

/** What each closing status commits the operator to, keyed by the status the backend accepts. */
const CONSEQUENCE_KEYS = {
  RESOLVED: 'recon.resolve.RESOLVED',
  WRITTEN_OFF: 'recon.resolve.WRITTEN_OFF',
  FALSE_POSITIVE: 'recon.resolve.FALSE_POSITIVE',
} as const satisfies Record<TerminalBreakStatus, string>;

/** Built from the translated message, so the refusal is in the language the note was written in. */
const resolveSchema = (noteRequired: string) =>
  z.object({
    status: z.enum(TERMINAL_BREAK_STATUSES),
    note: z.string().trim().min(1, noteRequired),
  });

type ResolveFormValues = z.infer<ReturnType<typeof resolveSchema>>;

export function ResolveBreakDialog({
  breakId,
  breakLabel,
  open,
  onOpenChange,
  onResolved,
}: {
  breakId: string;
  breakLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolved?: () => void;
}) {
  const fieldId = useId();
  const t = useT(reconMessages);
  const enumLabel = useEnumLabel();
  const resolve = useResolveBreak();
  const [pendingWriteOff, setPendingWriteOff] = useState<ResolveFormValues | null>(null);

  const form = useForm<ResolveFormValues>({
    resolver: zodResolver(resolveSchema(t('recon.resolve.noteRequired'))),
    defaultValues: { status: 'RESOLVED', note: '' },
  });

  const close = () => {
    setPendingWriteOff(null);
    form.reset({ status: 'RESOLVED', note: '' });
    onOpenChange(false);
  };

  const submit = (values: ResolveFormValues) => {
    resolve.mutate(
      { id: breakId, body: { status: values.status, note: values.note.trim() } },
      {
        onSuccess: () => {
          toast.success(
            t('recon.resolve.closedAs', { status: enumLabel('breakStatus', values.status) }),
          );
          close();
          onResolved?.();
        },
        onError: (error) => {
          toast.error(t('recon.resolve.error'), { description: errorMessage(error) });
        },
      },
    );
  };

  const onSubmit = (values: ResolveFormValues) => {
    // Writing off is the only one of the three that concedes a loss, so it is never one click away.
    if (values.status === 'WRITTEN_OFF') {
      setPendingWriteOff(values);
      return;
    }
    submit(values);
  };

  const noteError = form.formState.errors.note?.message;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent>
        {pendingWriteOff === null ? (
          <form
            onSubmit={(event) => {
              void form.handleSubmit(onSubmit)(event);
            }}
          >
            <DialogHeader>
              <DialogTitle>{t('recon.resolve.title')}</DialogTitle>
              <DialogDescription>{breakLabel}</DialogDescription>
            </DialogHeader>

            <fieldset className="mt-4 space-y-2">
              <legend className="mb-2 text-sm font-medium">{t('recon.resolve.how')}</legend>
              {TERMINAL_BREAK_STATUSES.map((status) => (
                <div
                  key={status}
                  className="flex gap-3 rounded-md border border-[var(--border)] p-3"
                >
                  <input
                    type="radio"
                    id={`${fieldId}-${status}`}
                    value={status}
                    className="mt-1 size-4 accent-[var(--primary)]"
                    {...form.register('status')}
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor={`${fieldId}-${status}`} className="cursor-pointer">
                      {enumLabel('breakStatus', status)}
                    </Label>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {t(CONSEQUENCE_KEYS[status])}
                    </p>
                  </div>
                </div>
              ))}
            </fieldset>

            <div className="mt-4 space-y-1.5">
              <Label htmlFor={`${fieldId}-note`}>{t('recon.field.resolutionNote')}</Label>
              <Textarea
                id={`${fieldId}-note`}
                placeholder={t('recon.resolve.notePlaceholder')}
                aria-invalid={noteError !== undefined}
                aria-describedby={noteError === undefined ? undefined : `${fieldId}-note-error`}
                {...form.register('note')}
              />
              {noteError === undefined ? (
                <p className="text-xs text-[var(--muted-foreground)]">
                  {t('recon.resolve.noteHint')}
                </p>
              ) : (
                <p
                  id={`${fieldId}-note-error`}
                  role="alert"
                  className="text-sm text-[var(--danger)]"
                >
                  {noteError}
                </p>
              )}
            </div>

            <DialogFooter className="mt-5">
              <Button type="button" variant="ghost" onClick={close} disabled={resolve.isPending}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" variant="primary" loading={resolve.isPending}>
                {t('recon.resolve.submit')}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t('recon.writeOff.title')}</DialogTitle>
              <DialogDescription>{breakLabel}</DialogDescription>
            </DialogHeader>

            <Alert tone="danger" title={t('recon.writeOff.alertTitle')}>
              {t('recon.writeOff.alertBody')}
            </Alert>

            {/* The quoted note is the operator's own words: the rule it hangs on moves to the
                other edge in Arabic, so the border and its padding are logical. */}
            <blockquote className="border-s-2 border-[var(--border-strong)] ps-3 text-sm text-[var(--muted-foreground)]">
              {pendingWriteOff.note.trim()}
            </blockquote>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setPendingWriteOff(null);
                }}
                disabled={resolve.isPending}
              >
                {t('common.back')}
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={resolve.isPending}
                onClick={() => {
                  submit(pendingWriteOff);
                }}
              >
                {t('recon.writeOff.confirm')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
