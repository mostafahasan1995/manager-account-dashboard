import { useState, type SyntheticEvent } from 'react';

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
import { Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import type { AdminDeposit, RejectDepositBody } from '@/types';
import {
  REJECTION_CODES,
  REJECTION_CODES_REQUIRING_NOTE,
  type RejectionCode,
} from '@/types/enums';

import { depositMessages } from './messages';

/**
 * Rejecting a deposit sends the player away without their money, so the reason is not optional and
 * for the two codes that accuse somebody of something — fraud, and the catch-all "other" — neither
 * is the explanation. Those get read months later by whoever answers the complaint.
 */
export function RejectDialog({
  deposit,
  open,
  onOpenChange,
  loading,
  onConfirm,
}: {
  deposit: AdminDeposit;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  onConfirm: (body: RejectDepositBody) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <RejectForm
          deposit={deposit}
          loading={loading}
          onCancel={() => {
            onOpenChange(false);
          }}
          onConfirm={onConfirm}
        />
      </DialogContent>
    </Dialog>
  );
}

function RejectForm({
  deposit,
  loading,
  onCancel,
  onConfirm,
}: {
  deposit: AdminDeposit;
  loading: boolean;
  onCancel: () => void;
  onConfirm: (body: RejectDepositBody) => void;
}) {
  const t = useT(depositMessages);
  const enumLabel = useEnumLabel();

  // Radix reads an empty value as "nothing chosen yet", which is what we want: no reason is
  // pre-selected, because the cheapest reason to click is never the right one.
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const chosen = REJECTION_CODES.find((entry): entry is RejectionCode => entry === code) ?? null;
  const noteRequired = chosen !== null && REJECTION_CODES_REQUIRING_NOTE.includes(chosen);
  const trimmedNote = note.trim();

  const codeError = chosen === null ? t('deposits.reject.reasonRequired') : null;
  const noteError =
    noteRequired && trimmedNote.length === 0
      ? t('deposits.reject.noteRequired', { reason: enumLabel('rejectionCode', chosen) })
      : null;

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (chosen === null || noteError !== null) return;

    onConfirm({
      rejectionCode: chosen,
      ...(trimmedNote.length === 0 ? {} : { rejectionNote: trimmedNote }),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{t('deposits.reject.title', { shortId: deposit.shortId })}</DialogTitle>
        <DialogDescription>{t('deposits.reject.description')}</DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="reject-code">{t('field.reason')}</Label>
        <Select value={code} onValueChange={setCode}>
          <SelectTrigger
            id="reject-code"
            aria-invalid={submitted && codeError !== null}
            {...(submitted && codeError !== null
              ? { 'aria-describedby': 'reject-code-error' }
              : {})}
          >
            <SelectValue placeholder={t('deposits.reject.reasonPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {REJECTION_CODES.map((entry) => (
              <SelectItem key={entry} value={entry}>
                {enumLabel('rejectionCode', entry)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {submitted && codeError !== null ? (
          <p id="reject-code-error" role="alert" className="text-sm text-[var(--danger)]">
            {codeError}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reject-note">
          {noteRequired
            ? t('field.note')
            : t('deposits.optionalField', {
                label: t('field.note'),
                optional: t('common.optional'),
              })}
        </Label>
        <Textarea
          id="reject-note"
          value={note}
          // aria-required rather than required: the browser's own bubble would pre-empt the
          // message that actually says which reason needs explaining.
          aria-required={noteRequired}
          placeholder={t('deposits.reject.notePlaceholder')}
          onChange={(event) => {
            setNote(event.target.value);
          }}
          aria-invalid={submitted && noteError !== null}
          {...(submitted && noteError !== null ? { 'aria-describedby': 'reject-note-error' } : {})}
        />
        {submitted && noteError !== null ? (
          <p id="reject-note-error" role="alert" className="text-sm text-[var(--danger)]">
            {noteError}
          </p>
        ) : null}
      </div>

      {noteRequired ? (
        <Alert tone="warning" title={t('deposits.reject.noteAlertTitle')}>
          {t('deposits.reject.noteAlertBody')}
        </Alert>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="danger" loading={loading}>
          {t('deposits.reject.confirm')}
        </Button>
      </DialogFooter>
    </form>
  );
}
