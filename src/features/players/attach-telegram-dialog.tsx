import { useState, type SyntheticEvent } from 'react';
import { toast } from 'sonner';

import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@/components/ui';
import { errorMessage } from '@/lib/api/errors';
import { useAttachPlayerTelegram } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import { playerDisplayName, type AdminPlayer } from '@/types/player';

import { playerMessages } from './messages';

/**
 * Giving an imported or admin-registered row the Telegram account it was missing.
 *
 * Only offered for a row whose id is null: attaching to a row that already has one would be
 * REPOINTING an account, which is a different and more dangerous act the backend refuses anyway.
 * The id is a 64-bit number and stays a string all the way to the wire.
 */

const TELEGRAM_ID_RE = /^\d+$/;

export function AttachTelegramDialog({
  player,
  open,
  onOpenChange,
  onAttached,
}: {
  player: AdminPlayer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAttached: (player: AdminPlayer) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <AttachForm
          player={player}
          onCancel={() => {
            onOpenChange(false);
          }}
          onAttached={onAttached}
        />
      </DialogContent>
    </Dialog>
  );
}

function AttachForm({
  player,
  onCancel,
  onAttached,
}: {
  player: AdminPlayer;
  onCancel: () => void;
  onAttached: (player: AdminPlayer) => void;
}) {
  const t = useT(playerMessages);
  const mutation = useAttachPlayerTelegram();
  const [telegramUserId, setTelegramUserId] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const name = playerDisplayName(player);
  const typed = telegramUserId.trim();
  const fieldError = TELEGRAM_ID_RE.test(typed) ? null : t('players.attach.validation');
  const failure: unknown = mutation.error;

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (fieldError !== null) return;

    void (async () => {
      try {
        const attached = await mutation.mutateAsync({
          playerId: player.id,
          body: { telegramUserId: typed },
        });
        toast.success(t('players.attach.doneTitle', { id: typed }), {
          description: t('players.attach.doneBody', { name }),
        });
        onAttached(attached);
      } catch (error) {
        toast.error(t('players.attach.failedTitle'), { description: errorMessage(error) });
      }
    })();
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <DialogHeader>
        <DialogTitle>{t('players.attach.title', { name })}</DialogTitle>
        <DialogDescription>{t('players.attach.description')}</DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="attach-telegram-id">{t('players.attach.field')}</Label>
        <Input
          id="attach-telegram-id"
          value={telegramUserId}
          inputMode="numeric"
          autoComplete="off"
          className="font-mono"
          onChange={(event) => {
            setTelegramUserId(event.target.value);
          }}
          aria-invalid={submitted && fieldError !== null}
          aria-describedby={
            submitted && fieldError !== null
              ? 'attach-telegram-id-hint attach-telegram-id-error'
              : 'attach-telegram-id-hint'
          }
        />
        <p id="attach-telegram-id-hint" className="text-xs text-[var(--muted-foreground)]">
          {t('players.attach.hint')}
        </p>
        {submitted && fieldError !== null ? (
          <p id="attach-telegram-id-error" role="alert" className="text-sm text-[var(--danger)]">
            {fieldError}
          </p>
        ) : null}
      </div>

      {/* ERROR: an id another player already holds, most often. */}
      {failure == null ? null : (
        <Alert tone="danger" title={t('players.attach.failedTitle')}>
          {errorMessage(failure)}
        </Alert>
      )}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={mutation.isPending}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="primary" loading={mutation.isPending}>
          {t('players.attach.submit')}
        </Button>
      </DialogFooter>
    </form>
  );
}
