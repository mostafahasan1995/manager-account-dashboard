import { toast } from 'sonner';

import { ConfirmDialog, DetailList, DetailRow, TimeAgo } from '@/components/common';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import { errorMessage } from '@/lib/api/errors';
import { useUnblockPlayer } from '@/lib/api/queries';
import { playerDisplayName, type AdminPlayer } from '@/types/player';

import { playerMessages } from './messages';

/**
 * Lifting the operator's lock.
 *
 * One confirmation, not two: unblocking restores what the player had, and the thing worth reading
 * before pressing it is the reason somebody blocked them — which is why the reason, the time and
 * the admin are in the dialog rather than only on the detail page behind it.
 */
export function UnblockPlayerDialog({
  player,
  open,
  onOpenChange,
  onUnblocked,
}: {
  player: AdminPlayer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnblocked: (player: AdminPlayer) => void;
}) {
  const mutation = useUnblockPlayer();
  const t = useT(playerMessages);
  const enumLabel = useEnumLabel();
  const name = playerDisplayName(player);

  const confirm = async () => {
    try {
      const unblocked = await mutation.mutateAsync(player.id);
      toast.success(t('players.unblock.doneTitle', { name }), {
        description: t('players.unblock.doneBody', {
          status: enumLabel('playerStatus', unblocked.status),
        }),
      });
      onUnblocked(unblocked);
      onOpenChange(false);
    } catch (error) {
      toast.error(t('players.unblock.failedTitle'), { description: errorMessage(error) });
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('players.unblock.confirmTitle', { name })}
      description={t('players.unblock.confirmDescription')}
      confirmLabel={t('players.unblock.confirmLabel')}
      loading={mutation.isPending}
      onConfirm={confirm}
    >
      <DetailList>
        <DetailRow label={t('players.blocked.reason')}>
          {player.blockedReason == null || player.blockedReason.trim() === ''
            ? t('players.blocked.noReason')
            : player.blockedReason}
        </DetailRow>
        <DetailRow label={t('players.blocked.when')}>
          <TimeAgo value={player.blockedAt} />
        </DetailRow>
        <DetailRow label={t('players.blocked.by')}>
          {player.blockedByAdminId === null ? (
            '—'
          ) : (
            <span className="font-mono text-xs">{player.blockedByAdminId}</span>
          )}
        </DetailRow>
      </DetailList>
    </ConfirmDialog>
  );
}
