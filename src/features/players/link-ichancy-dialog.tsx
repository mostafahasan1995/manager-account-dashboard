import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/common';
import { Alert } from '@/components/ui';
import { errorMessage } from '@/lib/api/errors';
import { useCreateIchancyAccount } from '@/lib/api/queries';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import { playerDisplayName, type AdminPlayer, type IchancyAccount } from '@/types/player';

import { playerMessages } from './messages';

/**
 * Creating the player's Ichancy account — the one write this feature owns.
 *
 * The endpoint is idempotent, and that is the whole reason this dialog exists in its own file:
 * `created: false` means the player already had an account and nothing happened, which has to read
 * as "already linked" rather than as a success message that invents a registration. Two operators
 * unblocking the same stuck player at once is normal, not an error.
 */
export function LinkIchancyDialog({
  player,
  open,
  onOpenChange,
  onLinked,
}: {
  player: AdminPlayer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked?: (result: IchancyAccount) => void;
}) {
  const mutation = useCreateIchancyAccount();
  const t = useT(playerMessages);
  const enumLabel = useEnumLabel();
  const name = playerDisplayName(player);

  const confirm = async () => {
    try {
      const result = await mutation.mutateAsync(player.id);
      if (result.created) {
        toast.success(t('players.link.created'), {
          description: t('players.link.createdDescription', {
            name,
            login: result.ichancyLogin,
            agent: result.agentId,
          }),
        });
      } else {
        toast.info(t('players.link.alreadyLinked'), {
          description: t('players.link.alreadyLinkedDescription', {
            name,
            login: result.ichancyLogin,
            agent: result.agentId,
          }),
        });
      }
      onLinked?.(result);
      onOpenChange(false);
    } catch (error) {
      toast.error(t('players.link.failed'), { description: errorMessage(error) });
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('players.link.confirmTitle')}
      description={t('players.link.confirmDescription', { name })}
      confirmLabel={t('players.link.confirmLabel')}
      loading={mutation.isPending}
      onConfirm={confirm}
    >
      <div className="space-y-3 text-sm">
        <p className="text-[var(--muted-foreground)]">
          {t('field.telegramId')} <span className="font-mono">{player.telegramUserId}</span> ·{' '}
          {t('field.currency')} <span className="font-mono">{player.currencyCode}</span>
        </p>

        {player.status === 'PENDING_ICHANCY' ? null : (
          <Alert tone="warning" title={t('players.link.notWaitingTitle')}>
            {/* The status the operator is being compared against comes from the same table the
                badge reads, so the warning cannot quote a label that no longer exists. */}
            {t('players.link.notWaitingBody', {
              status: enumLabel('playerStatus', 'PENDING_ICHANCY'),
            })}
          </Alert>
        )}

        <p className="text-[var(--muted-foreground)]">{t('players.link.idempotentNote')}</p>
      </div>
    </ConfirmDialog>
  );
}
