import { DetailList, DetailRow, TimeAgo } from '@/components/common';
import { Alert } from '@/components/ui';
import { useT } from '@/lib/i18n/use-translation';
import { isPlayerBlocked, type AdminPlayer } from '@/types/player';

import { playerMessages } from './messages';

/**
 * The block, said in words at the top of the detail page: why, when, and by whom.
 *
 * A danger alert rather than a row in the identity card, because the block is the one fact about
 * this player that changes what every other action on the page means — and the reason is what the
 * next admin reads before deciding whether to lift it.
 */
export function PlayerBlockedAlert({ player }: { player: AdminPlayer }) {
  const t = useT(playerMessages);
  if (!isPlayerBlocked(player)) return null;

  return (
    <Alert tone="danger" title={t('players.blocked.title')} data-testid="player-blocked-alert">
      <p>{t('players.blocked.body')}</p>
      <DetailList className="mt-2">
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
    </Alert>
  );
}
