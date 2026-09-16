import { useState, type SyntheticEvent } from 'react';
import { toast } from 'sonner';

import { DetailList, DetailRow } from '@/components/common';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from '@/components/ui';
import { errorMessage } from '@/lib/api/errors';
import { useBlockPlayer } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import { BLOCK_REASON_MAX_LENGTH, playerDisplayName, type AdminPlayer } from '@/types/player';

import { playerMessages } from './messages';

/**
 * Locking a player out of the bot.
 *
 * Not a money action, but it is one the player feels immediately — the next button they press is
 * refused — so it is two steps like the debit: the reason is typed on one screen and the name read
 * back on the next. The reason is the whole record of why; whoever lifts the block months from now
 * reads it and nothing else.
 *
 * The form is mounted only while open, so each opening starts empty rather than with the last
 * player's reason already filled in.
 */
export function BlockPlayerDialog({
  player,
  open,
  onOpenChange,
  onBlocked,
}: {
  player: AdminPlayer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBlocked: (player: AdminPlayer) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <BlockForm
          player={player}
          onCancel={() => {
            onOpenChange(false);
          }}
          onBlocked={onBlocked}
        />
      </DialogContent>
    </Dialog>
  );
}

type Step = 'reason' | 'confirm';

function BlockForm({
  player,
  onCancel,
  onBlocked,
}: {
  player: AdminPlayer;
  onCancel: () => void;
  onBlocked: (player: AdminPlayer) => void;
}) {
  const t = useT(playerMessages);
  const mutation = useBlockPlayer();
  const [step, setStep] = useState<Step>('reason');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const name = playerDisplayName(player);
  const trimmedReason = reason.trim();

  const reasonError =
    trimmedReason.length === 0
      ? t('players.block.reasonRequired')
      : trimmedReason.length > BLOCK_REASON_MAX_LENGTH
        ? t('players.block.reasonTooLong', {
            max: BLOCK_REASON_MAX_LENGTH,
            length: trimmedReason.length,
          })
        : null;

  const failure: unknown = mutation.error;

  const review = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (reasonError !== null) return;
    setStep('confirm');
  };

  const send = () => {
    void (async () => {
      try {
        const blocked = await mutation.mutateAsync({
          playerId: player.id,
          body: { reason: trimmedReason },
        });
        toast.success(t('players.block.doneTitle', { name }), {
          description: t('players.block.doneBody'),
        });
        onBlocked(blocked);
      } catch (error) {
        toast.error(t('players.block.failedTitle'), { description: errorMessage(error) });
      }
    })();
  };

  // CONFIRMATION: the name and the reason, read back before the bot starts refusing them.
  if (step === 'confirm') {
    return (
      <div className="space-y-4">
        <DialogHeader>
          <DialogTitle>{t('players.block.confirmTitle', { name })}</DialogTitle>
          <DialogDescription>{t('players.block.confirmBody')}</DialogDescription>
        </DialogHeader>

        <DetailList>
          <DetailRow label={t('field.player')}>{name}</DetailRow>
          <DetailRow label={t('field.reason')}>{trimmedReason}</DetailRow>
        </DetailList>

        {/* ERROR: what the server said, and that nothing changed. */}
        {failure == null ? null : (
          <Alert tone="danger" title={t('players.block.failedTitle')}>
            <p>{errorMessage(failure)}</p>
            <p className="mt-1">{t('players.block.failedHint')}</p>
          </Alert>
        )}

        {/* LOADING: said out loud rather than only as a spinner on the button. */}
        {mutation.isPending ? (
          <p className="text-sm text-[var(--muted-foreground)]" aria-live="polite">
            {t('players.block.sending')}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={mutation.isPending}
            onClick={() => {
              setStep('reason');
            }}
          >
            {t('players.block.back')}
          </Button>
          <Button type="button" variant="danger" loading={mutation.isPending} onClick={send}>
            {t('players.block.confirmLabel', { name })}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  // DATA: the form itself.
  return (
    <form onSubmit={review} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{t('players.block.title', { name })}</DialogTitle>
        <DialogDescription>{t('players.block.description')}</DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="block-reason">{t('players.block.reasonLabel')}</Label>
        <Textarea
          id="block-reason"
          value={reason}
          // aria-required rather than required: the browser's own bubble would pre-empt the
          // message that actually explains who reads this and when.
          aria-required
          placeholder={t('players.block.reasonPlaceholder')}
          onChange={(event) => {
            setReason(event.target.value);
          }}
          aria-invalid={submitted && reasonError !== null}
          {...(submitted && reasonError !== null
            ? { 'aria-describedby': 'block-reason-error' }
            : {})}
        />
        <p className="text-xs text-[var(--muted-foreground)]">
          {t('players.block.reasonCounter', {
            length: trimmedReason.length,
            max: BLOCK_REASON_MAX_LENGTH,
          })}
        </p>
        {submitted && reasonError !== null ? (
          <p id="block-reason-error" role="alert" className="text-sm text-[var(--danger)]">
            {reasonError}
          </p>
        ) : null}
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        {/* Not "Block": this only moves to the confirmation. The lock is one more press away. */}
        <Button type="submit" variant="danger">
          {t('players.block.review')}
        </Button>
      </DialogFooter>
    </form>
  );
}
