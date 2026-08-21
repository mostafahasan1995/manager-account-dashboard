import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useT } from '@/lib/i18n/use-translation';

/**
 * The one confirmation used for every irreversible-ish action: deactivating a rail, ending an
 * approval limit, suspending a tenant, writing off a break.
 *
 * `confirmWord` asks the operator to type something (a slug, a code) before the button enables.
 * Reserved for actions that stop a live service — a misclick there takes a bot offline.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  loading = false,
  confirmWord,
  children,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  confirmWord?: string;
  children?: ReactNode;
  onConfirm: () => void | Promise<void>;
}) {
  const t = useT();
  const [typed, setTyped] = useState('');
  const blocked = confirmWord !== undefined && typed.trim() !== confirmWord;

  const handleOpenChange = (next: boolean) => {
    if (!next) setTyped('');
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description === undefined ? null : <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {children}

        {confirmWord === undefined ? null : (
          <label className="space-y-1.5 text-sm">
            <span className="text-[var(--muted-foreground)]">
              Type <code className="font-mono font-semibold">{confirmWord}</code> to confirm
            </span>
            <input
              value={typed}
              onChange={(event) => {
                setTyped(event.target.value);
              }}
              className="flex h-9 w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm"
              aria-label={`Type ${confirmWord} to confirm`}
              autoComplete="off"
            />
          </label>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              handleOpenChange(false);
            }}
            disabled={loading}
          >
            {cancelLabel ?? t('common.cancel')}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={() => {
              void onConfirm();
            }}
            loading={loading}
            disabled={blocked}
          >
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
